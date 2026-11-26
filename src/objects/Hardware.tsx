import { Html, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group, Vector3 } from 'three'
import { clock, regionalView, useGame, worldFocus } from '../game/GameEngine'
import { Box } from '../world/Infrastructure'
import { gateway, node, relay } from '../world/layout'

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

function Controller({ active }: { active: boolean }) {
  return <>
    <Board w={1.6} d={1.05} color="#202731" />
    <Components w={.94} d={.65} count={13} />
    <Box size={[.33, .16, .35]} position={[-.745, .12, -.04]} color={silver} />
    <Box size={[.012, .075, .22]} position={[-.918, .122, -.04]} color="#18201f" />
    <Box size={[.3, .089, .31]} position={[.015, .084, -.03]} color="#101419" />
    <Header at={[.04, .077, -.405]} count={8} step={.145} />
    <Header at={[.04, .077, .405]} count={8} step={.145} />
    <Box size={[.22, .05, .18]} position={[.56, .066, .12]} color="#9f7d46" />
    <Box size={[.085, .04, .07]} position={[.37, .075, -.19]} color={active ? '#baffbd' : '#4b785d'} glow={active} />
    <Box size={[.10, .075, .09]} position={[-.48, .085, .19]} color="#bbbdb7" />
  </>
}

function SoilProbe() {
  return <group rotation-y={-.15}>
    <Box size={[.48, .07, .29]} position={[-.19, 0, 0]} color="#315b48" />
    {[-.087, .087].map((z) => <Box key={z} size={[.57, .047, .074]} position={[.29, .006, z]} color="#c29959" />)}
    <Box size={[.15, .043, .115]} position={[-.16, .058, 0]} color={dark} />
  </group>
}

function ThermalSwitch() {
  return <>
    <mesh position={[0, .12, 0]}>
      <cylinderGeometry args={[.187, .204, .23, 12]} /><meshStandardMaterial color={silver} metalness={.55} roughness={.58} />
    </mesh>
    {[-.085, .085].map((z) => <Box key={z} size={[.43, .04, .06]} position={[-.128, .028, z]} color={gold} />)}
    <Box size={[.17, .055, .17]} position={[0, .008, 0]} color={dark} />
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

function Radio({ active }: { active: boolean }) {
  return <>
    <Board w={1.45} d={.76} color="#24292d" />
    <Components w={1.05} d={.51} count={9} />
    <Header at={[-.04, .075, .28]} count={9} step={.107} />
    <Box size={[.59, .103, .39]} position={[-.16, .092, -.043]} color="#a4adb0" />
    <Box size={[.37, .015, .21]} position={[-.16, .151, -.043]} color="#757f82" />
    <Box size={[.16, .10, .15]} position={[.519, .082, -.108]} color={gold} />
    <mesh position={[.52, .445, -.11]}>
      <cylinderGeometry args={[.035, .045, .77, 8]} /><meshStandardMaterial color="#323c3a" roughness={.78} />
    </mesh>
    <Box size={[.081, .045, .072]} position={[.32, .072, .11]} color={active ? '#95f7ff' : '#517079'} glow={active} />
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
  { at: [-2.64, 2.93, -.77], name: 'MPU6050', role: 'Acceleration + angular velocity', align: 'left' },
  { at: [-.01, 3.15, -.27], name: 'ESP32-C3 SuperMini', role: 'Processes sensor inputs' },
  { at: [2.52, 2.82, -.2], name: 'LoRa module', role: 'Separate RF transceiver', align: 'right' },
  { at: [-.87, 2.33, 1.63], name: 'Soil moisture probe', role: 'Independent ground input', align: 'context' },
  { at: [1.12, 2.36, 1.57], name: 'Bimetallic switch', role: 'Independent thermal contact', align: 'context' },
]
const relayLabels: Label[] = [fieldLabels[2], { ...fieldLabels[3], role: 'Receive and forward PS-001' }]
const gatewayLabels: Label[] = [
  { at: [-2.36, 2.98, .16], name: 'LoRa receiver', role: 'Simulated LoRa reception', align: 'left' },
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

function NodeMarker({ id, role }: { id: 'NODE-01' | 'NODE-02' | 'GW-01'; role: string }) {
  const presenter = useGame((state) => state.control !== 'auto')
  return <Html position={[0, 4.3, 0]} center zIndexRange={[16, 13]} pointerEvents={presenter ? 'auto' : 'none'} distanceFactor={18}>
    {presenter ? <button className="world-tag node-tag" title={role} onClick={() => useGame.getState().inspect(id)} aria-label={'Inspect node ' + id}>{id}<span>{role}</span></button> :
      <div className="world-tag node-tag">{id}<span>{role}</span></div>}
  </Html>
}

export function FieldHardware({ id }: { id: 'NODE-01' | 'NODE-02' }) {
  const cover = useRef<Group>(null)
  const spark = useRef<Group>(null)
  const position = id === 'NODE-01' ? node : relay
  const regional = useGame(regionalView)
  const mode = useGame((state) => state.mode)
  const control = useGame((state) => state.control)
  const focus = useGame(worldFocus)
  const packetStep = useGame((state) => state.scenario.packet?.step)
  const field = id === 'NODE-01'
  const sampled = useGame((state) => state.scenario.vibrationAt !== null)
  const inspection = focus === id
  const radioActive = field ? packetStep === 'sending-NODE-01' : packetStep === 'at-NODE-02' || packetStep === 'forwarding-NODE-02'
  const processing = field && sampled && (packetStep === undefined || packetStep === 'ready' || radioActive)
  useFrame((_, delta) => {
    const game = useGame.getState()
    const t = clock.time
    const active = worldFocus(game) === id || radioActive || (field && processing)
    if (cover.current && game.mode !== 'paused') cover.current.rotation.x += ((active ? -2.08 : 0) - cover.current.rotation.x) * (1 - Math.exp(-delta * 5))
    if (spark.current && processing) {
      const input = (t * 1.1 % 2 + 2) % 2
      const traversal = packetStep === undefined ? input : 2 + (t * .95 % 1 + 1) % 1
      const baseline = flowLines[Math.floor(traversal)]
      const amount = (traversal % 1) * 3
      localPulse.fromArray(baseline[Math.floor(amount)]).lerp(localNext.fromArray(baseline[Math.min(3, Math.floor(amount) + 1)]), amount % 1)
      spark.current.position.copy(localPulse)
    }
  })
  if (regional) return null
  return <group position={position} onClick={(e) => {
    if (control !== 'auto' && e.delta < 5) { e.stopPropagation(); useGame.getState().inspect(id) }
  }}>
    {mode !== 'menu' && !inspection && <NodeMarker id={id} role={field ? "Slope monitoring station" : "LoRa relay"} />}
    <Box size={[6.55, .48, 3.95]} position={[0, -.18, .05]} color="#716f5b" shadow />
    <Box size={[1.8, .22, 1.66]} position={[0, .13, 0]} color="#7b7e66" />
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
    {field && <>
      <group position={[-2.05, 1.59, .67]}><Vibration /></group>
      <group position={[-2.05, 1.59, -.67]}><Mpu /></group>
      <group position={[-.94, 1.60, .95]}><SoilProbe /></group>
      <group position={[.88, 1.60, .94]}><ThermalSwitch /></group>
      <Line points={[[-.90, 1.67, .95], [-.53, 1.74, .76], [-.21, 1.7, .35]]} color="#b7aa7b" lineWidth={1.35} />
      <Line points={[[.88, 1.67, .94], [.54, 1.74, .74], [.12, 1.7, .34]]} color="#b7aa7b" lineWidth={1.35} />
    </>}
    <group position={[-.22, 1.59, -.05]}><Controller active={processing || radioActive} /></group>
    <group position={[1.83, 1.59, 0]}><Radio active={radioActive} /></group>
    {(field ? flowLines : [flowLines[2]]).map((points, i) =>
      <Line key={i} points={points} color={processing || radioActive ? '#a4ecdd' : '#ad925d'} lineWidth={processing || radioActive ? 2.6 : 1.45} />)}
    <group ref={spark} visible={processing}>
      <mesh><sphereGeometry args={[.1, 12, 8]} /><meshBasicMaterial color="#dcffcd" toneMapped={false} /></mesh>
    </group>
    {inspection && <Labels labels={field ? fieldLabels : relayLabels} />}
  </group>
}

export function GatewayHardware() {
  const mode = useGame((state) => state.mode)
  const control = useGame((state) => state.control)
  const focus = useGame(worldFocus)
  const regional = useGame(regionalView)
  const step = useGame((state) => state.scenario.packet?.step)
  const spark = useRef<Group>(null)
  const active = focus === 'GW-01'
  useFrame(() => {
    if (!spark.current) return
    const t = (clock.time % 1.8) / 1.8
    spark.current.position.set(-1.91 + t * 2.1, 1.72 + Math.sin(t * Math.PI) * .18, .28 - t * 1.06)
  })
  if (regional) return null
  return <group position={gateway} onClick={(e) => {
    if (control !== 'auto' && e.delta < 5) { e.stopPropagation(); useGame.getState().inspect('GW-01') }
  }}>
    {mode !== 'menu' && !active && <NodeMarker id="GW-01" role="Main headquarters" />}
    <Box size={[5.95, .34, 2.86]} position={[0, 1.3, 0]} color="#4c574b" shadow />
    <Box size={[5.82, .055, 2.66]} position={[0, 1.51, 0]} color="#7d8371" />
    <Box size={[.21, 1.37, 1.66]} position={[-2.59, .61, 0]} color="#626d63" shadow />
    <Box size={[.21, 1.37, 1.66]} position={[2.59, .61, 0]} color="#626d63" shadow />
    <group position={[-2.05, 1.59, .1]}><Radio active={step === 'at-GW-01' || step === 'processing'} /></group>
    <group position={[.76, 1.59, -.19]}><Tinker /></group>
    <Line points={[[-1.93, 1.68, .31], [-1.53, 1.87, .44], [-1.28, 1.78, .06], [-.60, 1.68, -.63], [.23, 1.72, -.78]]}
      color={active ? '#93f3ca' : '#a6915b'} lineWidth={active ? 2.8 : 1.5} />
    {active && <Labels labels={gatewayLabels} />}
    {(step === 'at-GW-01' || step === 'processing') && <group ref={spark}>
      <mesh><sphereGeometry args={[.10, 10, 6]} /><meshBasicMaterial color="#d7ffe4" toneMapped={false} /></mesh>
    </group>}
  </group>
}
