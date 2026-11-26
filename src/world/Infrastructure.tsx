import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { clock, useGame } from '../game/GameEngine'
import { phase } from '../game/Timeline'
import { roadIsBlocked } from '../game/Scenario'
import { randomSeed, strip } from './geometry'
import { bypass, closureEnd, closureStart, elevationAt, footbridge, gateway, lodges, mainRoad, retraceU, riverX, safeReturnU } from './layout'

const roadMaterial = new MeshStandardMaterial({ color: '#414947', roughness: 0.96, side: DoubleSide })
const shoulderMaterial = new MeshStandardMaterial({ color: '#a19777', roughness: 1, side: DoubleSide })
const edgeMaterial = new MeshStandardMaterial({ color: '#ddd4b6', roughness: 1, side: DoubleSide })
const centerMaterial = new MeshStandardMaterial({ color: '#d4a966', roughness: 1, side: DoubleSide })
const roadSegments = 400
const roadSurfaces = [[mainRoad, 0, 1], [bypass, 0, retraceU], [bypass, safeReturnU, 1]] as const
const ridgeJunctions = [[.344, .36], [.439, .463], [.479, .508], [.967, .997]] as const

function ridgeEdgeMarkings() {
  const starts = [0, ...ridgeJunctions.map(([, end]) => end)]
  const ends = [...ridgeJunctions.map(([start]) => start), 1]
  return starts.map((from, i) => strip(mainRoad, .12, .049, -3.03, from, ends[i], 180))
}

const roadMeshes = roadSurfaces.map(([path, from, to]) => ({
  gravel: strip(path, 8.4, -.045, 0, from, to, roadSegments),
  tarmac: strip(path, 6.6, .027, 0, from, to, roadSegments),
  stripes: path === mainRoad ? [
    strip(path, .12, .049, 3.03, from, to, roadSegments),
    ...ridgeEdgeMarkings(),
  ] : [-3.03, 3.03].map((offset) => strip(path, .12, .049, offset, from + .011, to - .007, roadSegments)),
}))
const dashSegments = Math.floor(mainRoad.getLength() / 4.85)
const laneDashes = Array.from({ length: dashSegments }, (_, i) => (i + .5) / dashSegments)
  .filter((u) => !ridgeJunctions.some(([start, end]) => u >= start && u <= end))
const bridgeSpans: { start: number; end: number }[] = []
for (let i = 0; i <= roadSegments; i++) {
  const u = i / roadSegments
  const point = bypass.getPointAt(u)
  if (Math.abs(point.x - riverX(point.z)) > 12.5) continue
  const previous = bridgeSpans.at(-1)
  if (previous && u - previous.end < 1.5 / roadSegments) previous.end = u
  else bridgeSpans.push({ start: u, end: u })
}
const bridgeMaterial = new MeshStandardMaterial({ color: '#898777', roughness: .88, side: DoubleSide })
const bridgeDecks = bridgeSpans.map(({ start, end }) => {
  const vertices: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= 24; i++) {
    const u = start + (end - start) * i / 24
    const point = bypass.getPointAt(u)
    const heading = bypass.getTangentAt(u)
    for (const [side, lift] of [[-1, -.08], [-1, -.85], [1, -.85], [1, -.08]]) {
      vertices.push(point.x - heading.z * 3.9 * side, point.y + lift, point.z + heading.x * 3.9 * side)
    }
    const first = (i - 1) * 4
    if (i) for (let side = 0; side < 3; side++) {
      const a = first + side
      indices.push(a, a + 1, a + 4, a + 1, a + 5, a + 4)
    }
  }
  const mesh = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3)).setIndex(indices)
  mesh.computeVertexNormals()
  return mesh
})
const bridgeSupports = bridgeSpans.flatMap(({ start, end }) => [.18, .5, .82].map((t) => {
  const u = start + (end - start) * t
  const point = bypass.getPointAt(u)
  const heading = bypass.getTangentAt(u)
  return { point, yaw: Math.atan2(heading.x, heading.z), base: elevationAt(point.x, point.z) - .45 }
}))
const forward = new Vector3(0, 0, 1)

function roadRails() {
  const posts: Matrix4[] = []
  const beams: Matrix4[] = []
  const block = new Object3D()
  const mid = new Vector3()
  const next = new Vector3()
  for (const [path, ranges] of [
    [mainRoad, [[0.03, 0.18, 1], [0.20, 0.342, -1], [0.61, 0.75, 1], [0.86, 0.966, -1]]],
    [bypass, [[0.23, 0.95, -1], ...bridgeSpans.map(({ start, end }) => [start, end, 1] as const)]],
  ] as const) {
    for (const [from, to, side] of ranges) {
      const count = Math.ceil((to - from) * path.getLength() / 3.6)
      let previous: Vector3 | undefined
      for (let i = 0; i <= count; i++) {
        const u = from + (to - from) * i / count
        const p = path.getPointAt(u)
        const tangent = path.getTangentAt(u)
        p.x -= tangent.z * 3.86 * side
        p.z += tangent.x * 3.86 * side
        block.position.copy(p).y += 0.32
        block.rotation.set(0, 0, 0)
        block.scale.set(0.16, 1.05, 0.17)
        block.updateMatrix()
        posts.push(block.matrix.clone())
        if (previous) {
          mid.copy(p).lerp(previous, .5)
          next.copy(p).sub(previous)
          block.position.copy(mid).y += 0.82
          const length = next.length()
          block.quaternion.setFromUnitVectors(forward, next.normalize())
          block.scale.set(.14, .2, length + .08)
          block.updateMatrix()
          beams.push(block.matrix.clone())
        }
        previous = p
      }
    }
  }
  return { posts, beams }
}

const rails = roadRails()
const unitBox = new BoxGeometry(1, 1, 1)
const postMaterial = new MeshStandardMaterial({ color: '#77786d', roughness: .95 })
const railMaterial = new MeshStandardMaterial({ color: '#a1aaa2', roughness: .64, metalness: .25 })

export function Roads() {
  const posts = useRef<InstancedMesh>(null)
  const beams = useRef<InstancedMesh>(null)
  const alternate = useRef<Mesh>(null)
  const closed = useRef<Mesh>(null)
  const dash = useRef<InstancedMesh>(null)
  const route = useMemo(() => strip(bypass, 1.18, .17, 0, 0, 1, roadSegments), [])
  const closure = useMemo(() => strip(mainRoad, 6.56, 0.078, 0, closureStart, closureEnd, 42), [])
  useLayoutEffect(() => {
    rails.posts.forEach((matrix, i) => posts.current?.setMatrixAt(i, matrix))
    rails.beams.forEach((matrix, i) => beams.current?.setMatrixAt(i, matrix))
    const stamp = new Object3D()
    laneDashes.forEach((u, i) => {
      stamp.position.copy(mainRoad.getPointAt(u)).y += .041
      const direction = mainRoad.getTangentAt(u)
      stamp.quaternion.setFromUnitVectors(forward, direction)
      stamp.scale.set(.125, .014, 2.04)
      stamp.updateMatrix()
      dash.current?.setMatrixAt(i, stamp.matrix)
    })
    for (const mesh of [posts.current, beams.current, dash.current]) {
      if (mesh) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere() }
    }
  }, [])
  useFrame(() => {
    const { scenario } = useGame.getState()
    if (alternate.current) {
      alternate.current.visible = scenario.routeAt !== null
      if (scenario.routeAt !== null) route.setDrawRange(0, Math.floor(roadSegments * phase(clock.time, scenario.routeAt, scenario.routeAt + .7)) * 6)
    }
    if (closed.current) {
      closed.current.visible = roadIsBlocked(scenario)
      const material = closed.current.material
      if (material instanceof MeshBasicMaterial) {
        const confirmed = scenario.verification === 'Confirmed closure'
        material.color.set(confirmed ? '#fd6355' : '#edaa60')
        material.opacity = confirmed ? .62 : .22
      }
    }
  })
  return <>
    {bridgeDecks.map((deck) => <mesh key={deck.uuid} geometry={deck} material={bridgeMaterial} receiveShadow />)}
    {bridgeSupports.map(({ point, yaw, base }) => {
      const height = Math.max(.75, point.y - base - .7)
      return <group key={point.z} position={[point.x, point.y - .73, point.z]} rotation-y={yaw}>
        <Box size={[2.25, height, 2.65]} position={[0, -height / 2, 0]} color="#797e71" shadow />
        <Box size={[6.8, .58, 3.4]} position={[0, -.25, 0]} color="#77756b" />
      </group>
    })}
    {roadMeshes.map(({ gravel, tarmac, stripes }, index) => <group key={index}>
      <mesh geometry={gravel} material={shoulderMaterial} receiveShadow />
      <mesh geometry={tarmac} material={roadMaterial} receiveShadow />
      {stripes.map((stripe, i) => <mesh key={i} geometry={stripe} material={edgeMaterial} receiveShadow />)}
    </group>)}
    <instancedMesh ref={dash} args={[unitBox, centerMaterial, laneDashes.length]} receiveShadow />
    <instancedMesh ref={posts} args={[unitBox, postMaterial, rails.posts.length]} castShadow />
    <instancedMesh ref={beams} args={[unitBox, railMaterial, rails.beams.length]} castShadow />
    <mesh ref={closed} geometry={closure} visible={false}>
      <meshBasicMaterial color="#fd6355" transparent opacity={0.69} side={DoubleSide} depthWrite={false} />
    </mesh>
    <mesh ref={alternate} geometry={route} visible={false}>
      <meshBasicMaterial color="#79ffdf" toneMapped={false} side={DoubleSide} />
    </mesh>
  </>
}

const river = (() => {
  const random = randomSeed(5)
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= 210; i++) {
    const z = 225 - i * 2.2
    for (let bank = 0; bank < 5; bank++) {
      const x = riverX(z) + (bank - 2) * (2.2 + 0.3 * Math.sin(z * 0.1))
      positions.push(x, 3.14, z)
      const color = new Color(bank % 2 ? '#74ada2' : '#477f7e').multiplyScalar(.86 + random() * .26)
      colors.push(...color.toArray())
      if (i && bank) {
        const n = i * 5 + bank
        indices.push(n - 6, n - 5, n, n - 6, n, n - 1)
      }
    }
  }
  return new BufferGeometry()
    .setAttribute('position', new Float32BufferAttribute(positions, 3))
    .setAttribute('color', new Float32BufferAttribute(colors, 3))
    .setIndex(indices)
})()
river.computeVertexNormals()

type BoxArgs = [width: number, height: number, depth: number]
export function Box({ size, position = [0, 0, 0], color, rotation = [0, 0, 0], glow = false, shadow = false }: {
  size: BoxArgs; position?: BoxArgs; color: string; rotation?: BoxArgs; glow?: boolean; shadow?: boolean
}) {
  return <mesh position={position} rotation={rotation} castShadow={shadow} receiveShadow={shadow}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.86} emissive={glow ? color : '#000'} emissiveIntensity={glow ? 0.55 : 0} />
  </mesh>
}

const roofAngle = Math.atan2(1.15, 2.08)
const roofWidth = 2.72 / Math.cos(roofAngle)
const gables = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([
  -2.447, 3.54, -2.08, -2.447, 3.54, 2.08, -2.447, 4.69, 0,
   2.447, 3.54, 2.08,  2.447, 3.54, -2.08, 2.447, 4.69, 0,
], 3))
gables.computeVertexNormals()

function Lodge({ position, scale, angle, roof }: (typeof lodges)[number]) {
  return <group position={position} scale={scale} rotation-y={angle}>
    <Box size={[5.24, .92, 4.42]} position={[0, -.25, 0]} color="#67695c" shadow />
    <Box size={[4.9, 3.4, 4.16]} position={[0, 1.87, 0]} color="#c2af87" shadow />
    <Box size={[5.83, .17, roofWidth]} position={[0, 4.01, 1.36]} color={roof} rotation={[roofAngle, 0, 0]} shadow />
    <Box size={[5.83, .17, roofWidth]} position={[0, 4.01, -1.36]} color={roof} rotation={[-roofAngle, 0, 0]} shadow />
    <Box size={[5.95, .11, .18]} position={[0, 4.80, 0]} color={roof} shadow />
    <mesh geometry={gables}><meshLambertMaterial color="#c2af87" side={DoubleSide} /></mesh>
    <Box size={[1.55, .18, .65]} position={[.22, .02, 2.28]} color="#777563" />
    <Box size={[.62, 1.62, .75]} position={[1.32, 4.35, -.54]} color="#777369" shadow />
    <Box size={[1.04, 1.94, .12]} position={[.22, 1.38, 2.09]} color="#483d34" />
    {[-1.52, 1.56].map((x) => <group key={x} position={[x, 2.42, 2.11]}>
      <Box size={[.81, .90, .11]} color="#55483b" />
      <Box size={[.59, .67, .12]} color="#ce9e56" glow />
      <Box size={[.055, .68, .14]} color="#55483b" />
      <Box size={[.67, .055, .14]} color="#55483b" />
    </group>)}
    <Box size={[5.1, .19, .23]} position={[0, 3.11, 2.05]} color="#8b6a45" />
  </group>
}

export function ValleyStructures() {
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: .36, metalness: .16, side: DoubleSide }), [])
  useFrame(() => {
    const time = useGame.getState().mode === 'menu' ? clock.idle : clock.time
    material.emissive.setRGB(.01, .036 + .010 * Math.sin(time * .58), .033)
  })
  return <>
    <mesh geometry={river} material={material} />
    {lodges.map((lodge) => <Lodge key={lodge.position.x} {...lodge} />)}
    <group position={footbridge}>
      <Box size={[19, .44, 3.1]} color="#897256" shadow />
      <Box size={[19, .16, .17]} position={[0, 1.35, 1.49]} color="#a18b65" />
      <Box size={[19, .16, .17]} position={[0, 1.35, -1.49]} color="#a18b65" />
      {[-8.8, 8.8].map((x) => <Box key={x} size={[1.3, 1.6, 3.48]} position={[x, -.65, 0]} color="#706c57" />)}
      {[-8, -4, 0, 4, 8].map((x) => <group key={x} position-x={x}>
        <Box size={[.18, 1.55, .19]} position={[0, .65, 1.49]} color="#6e604b" />
        <Box size={[.18, 1.55, .19]} position={[0, .65, -1.49]} color="#6e604b" />
      </group>)}
    </group>
    <group position={gateway}>
      <Box size={[9.4, .46, 6.1]} position={[0, -.13, 0]} color="#8b8573" />
      <Box size={[.20, 4.8, .20]} position={[-3.83, 2.2, -2.2]} color="#555e56" shadow />
      <Box size={[.8, .1, .20]} position={[-3.83, 4.15, -2.2]} color="#c4b881" />
    </group>
  </>
}
