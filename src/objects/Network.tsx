import { Html, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Cloud, Database, Radio as RadioIcon } from 'lucide-react'
import { useRef } from 'react'
import { Group, Mesh, Vector3, type CatmullRomCurve3 } from 'three'
import { clock, useGame } from '../game/GameEngine'
import { CUES, phase } from '../game/Timeline'
import { cloud, downlink, gateway, node, phone, receiver, rfCurve, transmitter, uplink } from '../world/layout'

export const packetProgress = (time: number) => phase(time, CUES.radio + 1.0, 65)

function Packet({ path, start, end, color, scale = 1 }: { path: CatmullRomCurve3; start: number; end: number; color: string; scale?: number }) {
  const group = useRef<Group>(null)
  useFrame(() => {
    if (!group.current) return
    const time = clock.time
    group.current.visible = time >= start && time < end
    if (!group.current.visible) return
    const u = phase(time, start, end)
    path.getPointAt(u, group.current.position)
    for (let i = 0; i < group.current.children.length; i++) {
      const trail = group.current.children[i]
      path.getPointAt(Math.max(0, u - i * .013), trail.position)
      trail.position.sub(group.current.position)
      trail.rotation.y = time * 3.5
      trail.rotation.x = time * 1.7
    }
  })
  return <group ref={group} visible={false} scale={scale}>
    {Array.from({ length: 8 }, (_, i) => <mesh key={i}>
      <octahedronGeometry args={[i ? .51 - i * .053 : .73, 0]} />
      <meshBasicMaterial color={i ? color : '#edfff0'} toneMapped={false} transparent={i > 0} opacity={1 - i * .1} depthWrite={i === 0} />
    </mesh>)}
  </group>
}

function Signal({ at, active }: { at: Vector3; active: boolean }) {
  const group = useRef<Group>(null)
  useFrame(() => {
    if (!group.current || !active) return
    const time = clock.time
    group.current.children.forEach((mesh, i) => {
      const scale = (time * .72 + i * .32) % 1
      mesh.scale.setScalar(.18 + scale * 4.6)
      const ring = mesh as Mesh<import('three').RingGeometry, import('three').MeshBasicMaterial>
      ring.material.opacity = (1 - scale) * .84
    })
  })
  return <group ref={group} position={at} visible={active}>
    {[0, 1, 2].map((i) => <mesh key={i} rotation-y={-.66}>
      <ringGeometry args={[.92, 1, 36]} /><meshBasicMaterial color="#a3fff1" transparent depthWrite={false} side={2} />
    </mesh>)}
  </group>
}

const rfPoints = rfCurve.getSpacedPoints(88)
const upPoints = uplink.getSpacedPoints(48)
const phonePoints = downlink.getSpacedPoints(42)
const finalConnections = [
  [node.clone().add(new Vector3(-2, 2.4, 0)), node.clone().add(new Vector3(-.25, 2.4, .04)), transmitter],
  rfPoints, upPoints, phonePoints,
]

const cloudPuffs = [[-2.1, -.1, 0, 2], [-.4, .6, -.15, 2.75], [1.71, .15, .10, 2.25], [3.03, -.44, -.32, 1.37], [-2.9, -.5, -.5, 1.25]] as const

export function Network() {
  const hub = useRef<Group>(null)
  const orbit = useRef<Group>(null)
  const s = useGame((state) => state.second)
  const transmitting = s >= CUES.radio && s < CUES.gateway
  const offline = s >= CUES.offline && s < CUES.restored
  const overview = s >= CUES.overview
  const cloudActive = s >= CUES.cloud - 2 && s < CUES.mobile + 5 || s >= CUES.restored
  useFrame(() => {
    if (orbit.current) orbit.current.rotation.y = clock.time * .34
    if (hub.current) hub.current.position.y = cloud.y + Math.sin(clock.time * 1.05) * .26
  })
  return <>
    {transmitting && <Line points={rfPoints} color="#79edd7" lineWidth={1.8} transparent opacity={.75} dashed dashSize={2} gapSize={1.5} />}
    {offline && <>
      <Line points={rfPoints} color="#72ded0" lineWidth={1.75} transparent opacity={.57} dashed dashSize={2.2} gapSize={1.9} />
      <Line points={upPoints.slice(0, 21)} color="#db9b63" lineWidth={2} dashed dashSize={1} gapSize={1} />
    </>}
    {((s >= CUES.gateway + 7 && s < CUES.mobile) || (s >= CUES.restored && !overview)) &&
      <Line points={upPoints} color="#9ce4bc" lineWidth={2.2} transparent opacity={.8} dashed dashSize={1.3} gapSize={.9} />}
    {s >= CUES.mobile && s < CUES.mobile + 5 && <Line points={phonePoints} color="#8df1b8" lineWidth={1.8} transparent opacity={.74} dashed dashSize={1.1} gapSize={.9} />}
    <Signal at={transmitter} active={s >= CUES.radio && s < CUES.radio + 5 || offline} />
    <Signal at={receiver} active={s >= 64 && s < CUES.gateway + 5 || offline} />
    <Packet path={rfCurve} start={CUES.radio + 1} end={65} color="#7ef6dd" />
    <Packet path={uplink} start={CUES.gateway + 8} end={CUES.cloud + 4} color="#79f3bc" />
    <Packet path={downlink} start={CUES.mobile} end={CUES.mobile + 3} color="#9ef0c2" />
    <Packet path={rfCurve} start={CUES.offline + 1} end={CUES.offline + 7} color="#72ded0" />
    <Packet path={uplink} start={CUES.restored} end={CUES.overview - 1} color="#91f5b8" />

    <group ref={hub} position={cloud} visible={cloudActive}>
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
      {(s >= CUES.cloud + 2 && s < CUES.mobile || s >= CUES.restored && !overview) && <Html position={[0, -.05, 1.74]} center zIndexRange={[18, 17]} pointerEvents="none">
        <div className="cloud-badge world-tag"><Database size={27} /><strong>SUPABASE</strong><span>{s >= CUES.cloud + 4 ? 'SIMULATED SYNC COMPLETE' : 'SYNCHRONIZING'}</span></div>
      </Html>}
    </group>
    {s >= CUES.radio + 2 && s < 65 && <Html position={rfCurve.getPointAt(packetProgress(s)).add(new Vector3(0, 2.1, 0))} center zIndexRange={[12, 11]} pointerEvents="none">
      <div className="world-tag rf-tag"><RadioIcon size={14} /> HC-12 · SIMULATED RF LINK</div>
    </Html>}
    {overview && <>
      {finalConnections.map((points, i) => s >= CUES.overview + i && <Line key={i} points={points} color="#9cefd2" lineWidth={2.4} transparent opacity={.86} dashed dashSize={2.8} gapSize={1.6} />)}
      {s < CUES.end && [
        [node.clone().add(new Vector3(0, 4.0, 0)), 'FIELD NODE · UNO R3'],
        [gateway.clone().add(new Vector3(0, 4.6, 0)), 'TINKER BOARD'],
        [cloud.clone().add(new Vector3(0, 3.8, 0)), 'SUPABASE'],
        [phone.clone().add(new Vector3(4.0, 2.8, 0)), 'PAHAADSAATHI APP'],
      ].map(([point, label]) => <Html key={label as string} position={point as Vector3} center pointerEvents="none" zIndexRange={[12, 10]}>
        <div className="world-tag rf-tag">{label === 'SUPABASE' && <Cloud size={14} />}{label as string}</div>
      </Html>)}
    </>}
  </>
}
