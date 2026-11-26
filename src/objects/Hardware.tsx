import { Html, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group, Vector3 } from 'three'
import { clock, useGame } from '../game/GameEngine'
import { CUES, phase, smooth } from '../game/Timeline'
import { Box } from '../world/Infrastructure'
import { gateway, node } from '../world/layout'

const pins = (count: number) => Array.from({ length: count }, (_, index) => index)
const silver = '#b5c0b9'
const gold = '#a98950'
const dark = '#222c2b'

function Header({ at, count, step = .112, colors }: { at: [number, number, number]; count: number; step?: number; colors?: string[] }) {
  return <group position={at}>
    <Box size={[count * step + .06, .12, .15]} color="#262b2a" />
    {pins(count).map((i) => <Box key={i} size={[.038, .135, .041]} position={[(i - (count - 1) / 2) * step, .09, 0]} color={colors?.[i % colors.length] ?? gold} />)}
  </group>
}

function Bolt({ at }: { at: [number, number, number] }) {
  return <mesh position={at}><cylinderGeometry args={[.066, .066, .025, 8]} /><meshStandardMaterial color={silver} metalness={.52} roughness={.55} /></mesh>
}

function Board({ w, d, color }: { w: number; d: number; color: string }) {
  return <>
    <Box size={[w, .08, d]} color={color} shadow />
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <Bolt key={x + '/' + z} at={[x * (w / 2 - .097), .047, z * (d / 2 - .097)]} />))}
  </>
}

function Components({ w, d, count }: { w: number; d: number; count: number }) {
  return <>{pins(count).map((i) => {
    const x = (((i * 9 + 5) % 23) / 23 - .5) * w
    const z = (((i * 13 + 6) % 29) / 29 - .5) * d
    return <Box key={i} size={[.075 + (i % 3) * .017, .035, .047]} position={[x, .059, z]} color={i % 3 ? '#485655' : '#b3a27d'} />
  })}</>
}

function Uno() {
  return <>
    <Board w={2.09} d={1.46} color="#1b7a8c" />
    <Components w={1.26} d={1.06} count={17} />
    <Box size={[.47, .35, .42]} position={[-.87, .207, -.44]} color={silver} />
    <Box size={[.022, .17, .25]} position={[-1.111, .23, -.44]} color="#353e3c" />
    <Box size={[.38, .29, .32]} position={[-.88, .19, .435]} color={dark} />
    <Box size={[.018, .125, .15]} position={[-1.08, .195, .435]} color="#0f1717" />
    <Box size={[.78, .125, .29]} position={[.37, .112, .17]} color="#292e2e" />
    {[.02, .32].map((z) => <Header key={z} at={[.37, .076, z]} count={12} step={.061} />)}
    <Header at={[.26, .103, -.59]} count={14} step={.105} />
    <Header at={[.41, .103, .59]} count={12} step={.111} />
    <Box size={[.23, .092, .115]} position={[-.39, .088, .15]} color={silver} />
    <Box size={[.082, .055, .075]} position={[-.21, .081, -.45]} color="#9ffc93" glow />
    {[-.38, -.54].map((x) => <mesh key={x} position={[x, .14, .43]}>
      <cylinderGeometry args={[.068, .068, .19, 9]} /><meshStandardMaterial color={silver} metalness={.34} roughness={.77} />
    </mesh>)}
  </>
}

function Vibration() {
  return <>
    <Board w={.95} d={.56} color="#295982" />
    <mesh position={[-.22, .15, -.03]} rotation-z={Math.PI / 2}>
      <cylinderGeometry args={[.124, .124, .32, 12]} /><meshStandardMaterial color="#2176c6" roughness={.74} />
    </mesh>
    <Box size={[.114, .096, .098]} position={[.19, .091, -.114]} color="#3377b0" />
    <Box size={[.076, .023, .072]} position={[.19, .147, -.114]} color={silver} />
    <Header at={[.26, .07, .155]} count={3} />
    <Box size={[.06, .04, .049]} position={[-.035, .066, .157]} color="#fb7950" glow />
  </>
}

function Mpu() {
  return <>
    <Board w={.82} d={.59} color="#244b85" />
    <Box size={[.182, .043, .169]} position={[-.05, .066, .034]} color={dark} />
    <Components w={.54} d={.35} count={7} />
    <Header at={[0, .075, -.195]} count={8} step={.077} />
    <Box size={[.063, .039, .06]} position={[.258, .068, .11]} color="#93c6e5" glow />
  </>
}

function Radio() {
  return <>
    <Board w={1.18} d={.57} color="#1b7960" />
    <Box size={[.28, .087, .226]} position={[-.102, .087, -.022]} color={dark} />
    <Components w={.8} d={.44} count={11} />
    <Header at={[-.025, .074, .196]} count={5} step={.132} />
    <Box size={[.17, .081, .108]} position={[-.39, .08, -.11]} color={silver} />
    <Box size={[.15, .10, .13]} position={[.49, .087, -.109]} color={gold} />
    <mesh position={[.518, .405, -.109]}>
      <cylinderGeometry args={[.024, .03, .66, 8]} /><meshStandardMaterial color={gold} metalness={.42} roughness={.53} />
    </mesh>
    <mesh position={[.52, .54, -.11]} rotation-x={Math.PI / 2}>
      <torusGeometry args={[.065, .013, 5, 12, Math.PI * 1.7]} /><meshStandardMaterial color={gold} metalness={.42} roughness={.53} />
    </mesh>
  </>
}

function Tinker() {
  return <>
    <Board w={2.48} d={1.65} color="#275d43" />
    <Components w={1.97} d={1.39} count={23} />
    <Header at={[-.20, .103, -.66]} count={20} step={.081} colors={['#b0504a', '#a6af64', '#5d7896', '#c79153', '#65736c']} />
    <Header at={[-.20, .103, -.52]} count={20} step={.081} colors={['#b0504a', '#a6af64', '#5d7896', '#c79153', '#65736c']} />
    {[-.39, .08, .57].map((z, i) => <group key={z}>
      <Box size={[.47, i === 2 ? .44 : .34, .39]} position={[1.04, .24, z]} color={silver} />
      <Box size={[.019, .15, .25]} position={[1.28, .29, z]} color={i === 2 ? '#2c3331' : '#405d82'} />
    </group>)}
    <Box size={[.52, .21, .37]} position={[-.35, .139, .71]} color={silver} />
    <Box size={[.55, .068, .53]} position={[-.084, .09, .03]} color="#202729" />
    {pins(10).map((i) => <Box key={i} size={[.041, .15, .55]} position={[-.37 + i * .064, .172, .03]} color="#a49d81" />)}
  </>
}

type Label = { at: [number, number, number]; name: string; role: string; align?: string }
const fieldLabels: Label[] = [
  { at: [-2.66, 2.81, .95], name: 'SW-420', role: 'Digital vibration trigger', align: 'left' },
  { at: [-2.64, 2.93, -.77], name: 'GY-521 MPU6050', role: 'Acceleration + angular velocity', align: 'left' },
  { at: [-.01, 3.15, -.27], name: 'Arduino UNO R3', role: 'Processes sensor inputs' },
  { at: [2.56, 2.82, -.2], name: 'HC-12 transmitter', role: 'Wireless serial', align: 'right' },
]
const gatewayLabels: Label[] = [
  { at: [-2.36, 2.98, .16], name: 'HC-12 receiver', role: 'Incoming wireless serial', align: 'left' },
  { at: [.93, 3.32, -.12], name: 'ASUS Tinker Board', role: 'Original gateway · event forwarding', align: 'right' },
]

function Labels({ labels }: { labels: Label[] }) {
  return <>{labels.map(({ at, name, role, align }) => <Html key={name} position={at} center zIndexRange={[15, 10]} pointerEvents="none">
    <div className={`world-tag hardware-tag ${align ?? ''}`}><strong>{name}</strong><span>{role}</span></div>
  </Html>)}</>
}

const flowLines: [number, number, number][][] = [
  [[-1.93, 1.66, .68], [-1.30, 1.87, .76], [-.83, 1.8, .44], [-.22, 1.67, .15]],
  [[-2.02, 1.67, -.63], [-1.40, 1.84, -.79], [-.91, 1.80, -.49], [-.22, 1.67, .15]],
  [[-.13, 1.69, .3], [.81, 1.86, .43], [1.60, 1.85, .31], [2.15, 1.67, .12]],
]
const localPulse = new Vector3(), localNext = new Vector3()

export function FieldHardware() {
  const cover = useRef<Group>(null)
  const spark = useRef<Group>(null)
  const second = useGame((state) => state.second)
  const inspection = second >= CUES.node + 2 && second < CUES.vibration - 1 || second >= CUES.processing + 2 && second < CUES.radio
  const processing = second >= CUES.processing && second < CUES.radio
  useFrame(() => {
    const t = clock.time
    const open = Math.max(
      smooth(phase(t, CUES.node, CUES.node + 2)) * (1 - smooth(phase(t, CUES.vibration - .5, CUES.vibration + 1.2))),
      smooth(phase(t, CUES.processing, CUES.processing + 2)) * (1 - smooth(phase(t, CUES.radio + 2, CUES.radio + 4))),
      smooth(phase(t, CUES.overview, CUES.overview + 3)),
    )
    if (cover.current) cover.current.rotation.x = -open * 2.08
    if (spark.current) {
      const traversal = ((t - CUES.processing + 3) * .58 % 3 + 3) % 3
      const baseline = flowLines[Math.floor(traversal)]
      const amount = (traversal % 1) * 3
      localPulse.fromArray(baseline[Math.floor(amount)]).lerp(localNext.fromArray(baseline[Math.min(3, Math.floor(amount) + 1)]), amount % 1)
      spark.current.position.copy(localPulse)
    }
  })
  return <group position={node}>
    <Box size={[1.8, .22, 1.66]} position={[0, .08, 0]} color="#7b7e66" />
    <Box size={[.22, 1.48, .22]} position={[-1.22, .69, .37]} color="#60665b" shadow />
    <Box size={[.22, 1.48, .22]} position={[1.19, .69, .37]} color="#60665b" shadow />
    <Box size={[5.9, .23, 2.78]} position={[0, 1.37, 0]} color="#424c43" shadow />
    <Box size={[5.65, .055, 2.54]} position={[0, 1.52, 0]} color="#6d7662" />
    <Box size={[5.93, .15, .13]} position={[0, 1.56, 1.35]} color="#ac9a64" />
    <group ref={cover} position={[0, 1.63, -1.38]}>
      <Box size={[5.92, .17, 2.68]} position={[0, .29, 1.36]} color="#576b55" shadow />
      <Box size={[5.94, .27, .10]} position={[0, .16, 2.72]} color="#4b594d" />
      <Box size={[1.54, .026, .51]} position={[0, .39, 1.52]} color="#cdb284" />
    </group>
    <group position={[-2.05, 1.59, .67]}><Vibration /></group>
    <group position={[-2.05, 1.59, -.67]}><Mpu /></group>
    <group position={[-.22, 1.59, -.05]}><Uno /></group>
    <group position={[1.83, 1.59, 0]}><Radio /></group>
    {flowLines.map((points, i) => <Line key={i} points={points} color={processing ? '#95f4ca' : i === 1 ? '#858e66' : '#ba9254'} lineWidth={processing ? 2.8 : 1.6} />)}
    <group ref={spark} visible={processing}>
      <mesh><sphereGeometry args={[.1, 12, 8]} /><meshBasicMaterial color="#dcffcd" toneMapped={false} /></mesh>
    </group>
    {inspection && <Labels labels={fieldLabels} />}
  </group>
}

export function GatewayHardware() {
  const s = useGame((state) => state.second)
  const active = (s >= CUES.gateway + 2 && s < CUES.cloud) || (s >= CUES.offline + 2 && s < CUES.overview)
  return <group position={gateway}>
    <Box size={[5.95, .34, 2.86]} position={[0, 1.3, 0]} color="#4c574b" shadow />
    <Box size={[5.82, .055, 2.66]} position={[0, 1.51, 0]} color="#7d8371" />
    <Box size={[.21, 1.37, 1.66]} position={[-2.59, .61, 0]} color="#626d63" shadow />
    <Box size={[.21, 1.37, 1.66]} position={[2.59, .61, 0]} color="#626d63" shadow />
    <group position={[-2.05, 1.59, .1]}><Radio /></group>
    <group position={[.76, 1.59, -.19]}><Tinker /></group>
    <Line points={[[-1.93, 1.68, .31], [-1.53, 1.87, .44], [-1.28, 1.78, .06], [-.60, 1.68, -.63], [.23, 1.72, -.78]]}
      color={active ? '#93f3ca' : '#a6915b'} lineWidth={active ? 2.8 : 1.5} />
    {active && <Labels labels={gatewayLabels} />}
  </group>
}
