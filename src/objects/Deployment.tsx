import { Html, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Antenna, House, RadioTower, Router } from 'lucide-react'
import { useRef } from 'react'
import { Group, Vector3 } from 'three'
import { clock, regionalView, useGame } from '../game/GameEngine'
import { Box } from '../world/Infrastructure'
import { groundPoint } from '../world/layout'

const sites = [
  { id: 'Road cut', kind: 'sensor', at: groundPoint(62, -55), note: 'Inclinometer · crack meter' },
  { id: 'North catchment', kind: 'sensor', at: groundPoint(76, -144), note: 'Piezometer · rain gauge' },
  { id: 'West slope', kind: 'sensor', at: groundPoint(-117, -64), note: 'Tilt · justified vibration monitoring' },
  { id: 'East ridge', kind: 'relay', at: groundPoint(90, -15), note: 'Coverage relay · no field sensors' },
  { id: 'West saddle', kind: 'relay', at: groundPoint(-114, -111), note: 'Coverage relay · no field sensors' },
  { id: 'Valley gateway', kind: 'gateway', at: groundPoint(-43, -34), note: 'Regional internet uplink' },
  { id: 'Upper road gateway', kind: 'gateway', at: groundPoint(58, -115), note: 'Regional internet uplink' },
  { id: 'Ridge Hamlet', kind: 'community', at: groundPoint(41, 43.5), note: 'Mobile reporting' },
  { id: 'North settlement', kind: 'community', at: groundPoint(-35, -82), note: 'Mobile reporting' },
] as const

const style = {
  sensor: { color: '#ffd58c', height: 6.3, icon: Antenna, label: 'Sensor station' },
  relay: { color: '#91eaff', height: 12.7, icon: RadioTower, label: 'Relay station' },
  gateway: { color: '#a0f2bf', height: 8, icon: Router, label: 'Regional gateway' },
  community: { color: '#f3b38c', height: 3.3, icon: House, label: 'Community reporting' },
}

const connections = [[0, 3], [3, 5], [1, 6], [2, 4], [4, 5], [7, 5], [8, 6]] as const
const paths = connections.map(([a, b]) => {
  const start = sites[a].at.clone().add(new Vector3(0, style[sites[a].kind].height, 0))
  const end = sites[b].at.clone().add(new Vector3(0, style[sites[b].kind].height, 0))
  const mid = start.clone().lerp(end, .5)
  mid.y = Math.max(start.y, end.y) + 12 + start.distanceTo(end) * .07
  return { start, mid, end, community: sites[a].kind === 'community' }
})

function Pulses() {
  const dots = useRef<Group>(null)
  const offset = new Vector3()
  useFrame(() => {
    dots.current?.children.forEach((dot, index) => {
      const { start, mid, end } = paths[index]
      const t = (clock.time * .18 + index * .188) % 1
      dot.position.copy(start).multiplyScalar((1 - t) ** 2)
      dot.position.addScaledVector(mid, 2 * (1 - t) * t).addScaledVector(end, t * t)
    })
  })
  return <group ref={dots}>
    {paths.map(({ community }, index) => <mesh key={index} position={offset}>
      <octahedronGeometry args={[.76, 0]} />
      <meshBasicMaterial color={community ? '#ffe4b8' : '#b1f4fc'} toneMapped={false} />
    </mesh>)}
  </group>
}

export function Deployment() {
  const active = useGame(regionalView)
  if (!active) return null
  return <group>
    {sites.map(({ id, kind, at, note }) => {
      const { color, height, icon: Icon, label } = style[kind]
      return <group key={id} position={at}>
        {kind === 'sensor' && <>
          <Box size={[4.2, .38, 3.4]} position={[0, .13, 0]} color="#a1895d" />
          <Box size={[2.4, 1.6, 1.55]} position={[0, 1.06, 0]} color="#876e48" />
          <Box size={[2.9, .26, 2]} position={[0, 1.95, 0]} color="#c2a474" />
          <Box size={[.25, 4.2, .25]} position={[1.03, 3.9, -.62]} color="#74745e" />
        </>}
        {kind === 'relay' && <>
          {[[-.65, -.55], [.65, -.55], [0, .7]].map(([x, z]) => <Box key={x} size={[.2, 11.8, .2]} position={[x, 6, z]} color="#839e9f" rotation={[z * .09, 0, -x * .10]} />)}
          {[2.2, 4.7, 7.2, 9.7].map((y) => <Box key={y} size={[1.8 - y * .085, .15, 1.55 - y * .06]} position={[0, y, 0]} color="#809d9d" />)}
          <Box size={[2.6, .26, .28]} position={[0, 11.8, .04]} color="#97a6a3" />
        </>}
        {kind === 'gateway' && <>
          <Box size={[5.5, 2.6, 3.4]} position={[0, 1.25, 0]} color="#5f7864" />
          <Box size={[5.75, .29, 3.58]} position={[0, 2.7, 0]} color="#9eb29b" />
          <Box size={[.22, 6.1, .22]} position={[1.8, 4.8, -.64]} color="#78978b" />
        </>}
        {kind === 'community' && <mesh position-y={.2} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[2.6, 2.86, 24]} /><meshBasicMaterial color={color} toneMapped={false} />
        </mesh>}
        <mesh position-y={height}><octahedronGeometry args={[1.03, 0]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
        <Html position={[0, height + 1.6, 0]} center zIndexRange={[15, 10]} pointerEvents="none">
          <div className={'world-tag deployment-tag ' + kind} title={note}>
            <Icon size={15} style={{ color }} /><div><strong>{id}</strong><span>{label}</span></div>
          </div>
        </Html>
      </group>
    })}
    {paths.map(({ start, mid, end, community }, index) => <Line key={index}
      points={Array.from({ length: 25 }, (_, i) => {
        const t = i / 24
        return start.clone().multiplyScalar((1 - t) ** 2).addScaledVector(mid, 2 * (1 - t) * t).addScaledVector(end, t * t)
      })}
      color={community ? '#eec087' : '#8be9ed'} transparent opacity={.8} lineWidth={2.4} dashed dashSize={3} gapSize={1.75} />)}
    <Pulses />
  </group>
}
