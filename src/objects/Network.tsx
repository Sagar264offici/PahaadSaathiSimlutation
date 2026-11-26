import { Html, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Database, Radio } from 'lucide-react'
import { useRef } from 'react'
import { Group, Mesh, MeshBasicMaterial, RingGeometry, type Vector3, type CatmullRomCurve3 } from 'three'
import { clock, regionalView, useGame, worldFocus } from '../game/GameEngine'
import { CLOUD_WORK, COMMUNITY_FLIGHT, FLIGHT } from '../game/Scenario'
import { CUES, phase } from '../game/Timeline'
import { cloud, communityUplink, downlink, firstHop, radioFlight, receiver, relayRadio, secondHop, transmitter, uplink } from '../world/layout'

function Packet({ path, start, duration, color }: { path: CatmullRomCurve3; start: number; duration: number; color: string }) {
  const group = useRef<Group>(null)
  useFrame(() => {
    if (!group.current) return
    const time = clock.time
    group.current.visible = time >= start && time < start + duration
    if (!group.current.visible) return
    const u = phase(time, start, start + duration)
    path.getPointAt(u, group.current.position)
    group.current.children.forEach((trail, i) => {
      path.getPointAt(Math.max(0, u - i * .022), trail.position)
      trail.position.sub(group.current!.position)
      trail.rotation.set(time * 1.7, time * 3.5, .44)
    })
  })
  return <group ref={group} visible={false}>
    {Array.from({ length: 7 }, (_, i) => <mesh key={i}>
      <octahedronGeometry args={[i ? .55 - i * .06 : .76, 0]} />
      <meshBasicMaterial color={i ? color : '#eaffed'} toneMapped={false} transparent={i > 0} opacity={1 - i * .12} depthWrite={i === 0} />
    </mesh>)}
  </group>
}

function Signal({ at }: { at: Vector3 }) {
  const group = useRef<Group>(null)
  useFrame(() => {
    const time = clock.time
    group.current?.children.forEach((mesh, i) => {
      const scale = (time * .72 + i * .32) % 1
      mesh.scale.setScalar(.18 + scale * 4.6)
      const ring = mesh as Mesh<RingGeometry, MeshBasicMaterial>
      ring.material.opacity = (1 - scale) * .84
    })
  })
  return <group ref={group} position={at}>
    {[0, 1, 2].map((i) => <mesh key={i} rotation-y={-.66}>
      <ringGeometry args={[.94, 1, 32]} /><meshBasicMaterial color="#a3fff1" transparent depthWrite={false} side={2} />
    </mesh>)}
  </group>
}

const first = firstHop.getSpacedPoints(80)
const second = secondHop.getSpacedPoints(70)
const upPoints = uplink.getSpacedPoints(46)
const phonePoints = downlink.getSpacedPoints(56)
const cloudPuffs = [[-2.1, -.1, 0, 2], [-.4, .6, -.15, 2.75], [1.71, .15, .10, 2.25], [3.03, -.44, -.32, 1.37], [-2.9, -.5, -.5, 1.25]] as const

export function Network() {
  const hub = useRef<Group>(null)
  const orbit = useRef<Group>(null)
  const rfLabel = useRef<Group>(null)
  const scenario = useGame((state) => state.scenario)
  const focus = useGame(worldFocus)
  const regional = useGame(regionalView)
  const overview = useGame((state) => state.control === 'auto' && state.second >= CUES.overview)
  const alertAt = useGame((state) => state.control === 'auto' && state.scenario.alert ? CUES.alert : null)
  const packet = scenario.packet
  const rf = radioFlight(scenario)
  const firstActive = packet?.step === 'sending-NODE-01'
  const secondActive = packet?.step === 'forwarding-NODE-02'
  const probe = scenario.probeAt !== null && !scenario.probeReceived
  const showPacketPath = focus === 'packet' && packet !== null
  const hubVisible = focus === 'cloud' || scenario.sync === 'syncing' || scenario.report === 'sending' || overview

  useFrame(() => {
    if (orbit.current) orbit.current.rotation.y = clock.time * .34
    if (hub.current) hub.current.position.y = cloud.y + Math.sin(clock.time * 1.05) * .26
    if (rf && rfLabel.current) {
      rf.path.getPointAt(phase(clock.time, rf.from, rf.to), rfLabel.current.position)
      rfLabel.current.position.y += 2.2
    }
  })
  if (regional) return null
  return <>
    {(firstActive || packet?.step === 'at-NODE-02' || probe || overview || showPacketPath) &&
      <Line points={first} color="#81eaca" lineWidth={overview ? 2.4 : 2.2} transparent opacity={.79} dashed dashSize={2.2} gapSize={1.5} />}
    {(secondActive || packet?.step === 'at-GW-01' || probe || overview || showPacketPath) &&
      <Line points={second} color="#91e5f1" lineWidth={overview ? 2.4 : 2.2} transparent opacity={.85} dashed dashSize={2.0} gapSize={1.5} />}
    {(scenario.sync === 'pending' || !scenario.internet) &&
      <Line points={upPoints.slice(0, 19)} color="#d8a465" lineWidth={2.1} dashed dashSize={.85} gapSize={1} />}
    {(scenario.sync === 'syncing' || overview) &&
      <Line points={upPoints} color="#9ce4bc" lineWidth={2.2} transparent opacity={.85} dashed dashSize={1.35} gapSize={.9} />}
    {(scenario.report === 'sending' || overview || (alertAt !== null && focus === 'community')) &&
      <Line points={phonePoints} color="#f1c786" lineWidth={2.25} transparent opacity={.83} dashed dashSize={1.46} gapSize={.98} />}
    {(firstActive || probe) && <Signal at={transmitter} />}
    {(firstActive || secondActive || probe || packet?.step === 'at-NODE-02') && <Signal at={relayRadio} />}
    {(secondActive || probe || packet?.step === 'at-GW-01') && <Signal at={receiver} />}
    {rf && <>
      <Packet path={rf.path} start={rf.from} duration={FLIGHT} color={firstActive ? '#7ef6dd' : '#86e5fb'} />
      <group ref={rfLabel}><Html position={[0, 0, 0]} center zIndexRange={[14, 11]} pointerEvents="none">
        <div className="world-tag rf-tag"><Radio size={14} />{firstActive ? 'NODE-01 → NODE-02' : 'NODE-02 → GW-01'} · SIMULATED LoRa</div>
      </Html></group>
    </>}
    {probe && scenario.probeAt !== null && <>
      <Packet path={firstHop} start={scenario.probeAt} duration={4} color="#95e7d3" />
      <Packet path={secondHop} start={scenario.probeAt + 4} duration={4} color="#9cf9e8" />
    </>}
    {scenario.sync === 'syncing' && scenario.syncAt !== null &&
      <Packet path={uplink} start={scenario.syncAt} duration={CLOUD_WORK} color="#91f5b8" />}
    {scenario.report === 'sending' && scenario.reportAt !== null &&
      <Packet path={communityUplink} start={scenario.reportAt} duration={COMMUNITY_FLIGHT} color="#f6be78" />}
    {alertAt !== null && focus === 'community' && <Packet path={downlink} start={alertAt} duration={3.4} color="#f1c786" />}
    {hubVisible && <group ref={hub} position={cloud} onClick={(e) => {
      if (e.delta < 5) { e.stopPropagation(); useGame.getState().inspect('cloud') }
    }}>
      {cloudPuffs.map(([x, y, z, scale]) => <mesh key={x} position={[x, y, z]} scale={[scale, scale * .73, scale * .61]}>
        <icosahedronGeometry args={[1, 1]} /><meshLambertMaterial color="#b1c9c1" flatShading />
      </mesh>)}
      <group ref={orbit} rotation-x={.23}>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[4.82, .052, 6, 72]} /><meshBasicMaterial color="#a2f2d0" toneMapped={false} transparent opacity={.78} />
        </mesh>
        {[-1, 1].map((side) => <mesh key={side} position-x={side * 4.82}>
          <octahedronGeometry args={[.26, 0]} /><meshBasicMaterial color="#d6ffe1" toneMapped={false} />
        </mesh>)}
      </group>
      <Html position={[0, -.06, 1.82]} center zIndexRange={[18, 17]} pointerEvents="none">
        <div className="cloud-badge world-tag"><Database size={25} /><strong>SUPABASE</strong>
          <span>{scenario.correlated && focus === 'cloud' ? 'MACHINE + COMMUNITY EVIDENCE' : 'SIMULATED CLOUD SYNC · ' + scenario.sync.toUpperCase()}</span></div>
      </Html>
    </group>}
  </>
}
