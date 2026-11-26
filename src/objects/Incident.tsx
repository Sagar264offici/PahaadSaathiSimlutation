import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { TriangleAlert } from 'lucide-react'
import { useRef } from 'react'
import { Group, Vector3 } from 'three'
import { clock, useGame } from '../game/GameEngine'
import { CUES, phase } from '../game/Timeline'
import { randomSeed } from '../world/geometry'
import { Box } from '../world/Infrastructure'
import { closurePoint, closureStart, elevationAt, mainRoad, node, slope } from '../world/layout'

const rockScatter = (() => {
  const random = randomSeed(860)
  return Array.from({ length: 8 }, (_, i) => {
    const start = slope.clone().add(new Vector3(random() * 8, 0, (random() - .5) * 7))
    const segment = .607 + i * .0036
    const stop = mainRoad.getPointAt(segment)
    const bearing = mainRoad.getTangentAt(segment)
    const scatter = (i % 3 === 0 ? 1.6 : 3.35) + random() * 2.6
    stop.x -= bearing.z * scatter
    stop.z += bearing.x * scatter
    start.y = elevationAt(start.x, start.z)
    stop.y = elevationAt(stop.x, stop.z)
    return { start, stop, delay: i * .3, size: .2 + random() * .66 }
  })
})()
const barrierAt = mainRoad.getPointAt(closureStart + .007)
const direction = mainRoad.getTangentAt(closureStart + .007)

export function Incident() {
  const rocks = useRef<Group>(null)
  const rings = useRef<Group>(null)
  const dust = useRef<Group>(null)
  const second = useGame((state) => state.second)
  useFrame(() => {
    const time = clock.time
    if (rocks.current) {
      rocks.current.visible = time >= CUES.vibration
      rocks.current.children.forEach((object, i) => {
        const { start, stop, delay, size } = rockScatter[i]
        const u = phase(time, CUES.vibration + 2.1 + delay, CUES.vibration + 6.9 + delay)
        object.position.lerpVectors(start, stop, u ** 1.8)
        object.position.y = elevationAt(object.position.x, object.position.z) + size * .31 + (1 - u) * Math.abs(Math.sin(u * 19 + i)) * .85
        object.rotation.set(u * 10.9 + i, u * 9.1, u * 12.5)
      })
    }
    if (dust.current) {
      dust.current.visible = time >= CUES.vibration + 3.2 && time < CUES.vibration + 10
      if (dust.current.visible) dust.current.children.forEach((object, i) => {
        const { start, stop, delay } = rockScatter[i]
        const u = phase(time, CUES.vibration + 3.4 + delay, CUES.vibration + 6.9 + delay)
        object.visible = u > 0 && u < 1
        object.position.lerpVectors(start, stop, .36 + u * .55)
        object.position.y = elevationAt(object.position.x, object.position.z) + Math.sin(u * Math.PI) * 1.2
        object.scale.setScalar(.25 + Math.sin(u * Math.PI) * (.7 + i * .13))
      })
    }
    if (rings.current) {
      rings.current.visible = time >= CUES.vibration && time < CUES.processing
      rings.current.children.forEach((object, i) => {
        const u = ((time - CUES.vibration + i / 3) * .62) % 1
        object.scale.setScalar(u > 0 ? .13 + u * 5.7 : .13)
      })
    }
  })
  const warning = second >= CUES.review && second < CUES.offline
  const closed = second >= CUES.confirmed
  return <>
    <group ref={rocks} visible={false}>
      {rockScatter.map(({ size }, i) => <mesh key={i} scale={[size * 1.32, size * .82, size]} castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshLambertMaterial color={i % 2 ? '#767b6d' : '#a39b79'} flatShading />
      </mesh>)}
    </group>
    <group ref={dust} visible={false}>
      {rockScatter.map((_, i) => <mesh key={i}>
        <icosahedronGeometry args={[.8, 0]} /><meshBasicMaterial color="#d4c09e" transparent opacity={.24} depthWrite={false} />
      </mesh>)}
    </group>
    <group ref={rings} position={node.clone().add(new Vector3(0, .29, 0))} visible={false}>
      {[0, 1, 2].map((i) => <mesh key={i} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[.94, 1, 34]} />
        <meshBasicMaterial color="#ffc470" transparent opacity={.65} depthWrite={false} />
      </mesh>)}
    </group>
    {second >= CUES.vibration + 8 && second < CUES.processing + 1 && <Html position={node.clone().add(new Vector3(0, 3.65, 0))} center pointerEvents="none" zIndexRange={[15, 10]}>
      <div className="world-tag warning-tag"><TriangleAlert size={15} /><span>NODE-01 · SIMULATED TRIGGER</span></div>
    </Html>}
    {warning && <Html position={closurePoint.clone().add(new Vector3(0, 5, 0))} center pointerEvents="none" zIndexRange={[15, 10]}>
      <div className={`world-tag warning-tag ${closed ? 'is-closed' : ''}`}><TriangleAlert size={16} /><span>{closed ? 'CONFIRMED ROAD CLOSURE' : 'POTENTIAL HAZARD · UNDER REVIEW'}</span></div>
    </Html>}
    {closed && <group position={barrierAt} rotation-y={Math.atan2(direction.x, direction.z)}>
      {[-2.2, 2.2].map((x) => <Box key={x} size={[.23, 1.65, .24]} position={[x, .75, 0]} color="#666758" />)}
      {Array.from({ length: 11 }, (_, i) => <Box key={i} size={[.45, .45, .16]} position={[(i - 5) * .45, 1.4, .03]} color={i % 2 ? '#e3d694' : '#ae4f3a'} />)}
      <Box size={[5, .07, .17]} position={[0, 1.65, .03]} color="#e7c17d" />
    </group>}
  </>
}
