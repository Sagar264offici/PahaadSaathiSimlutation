import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { clock, useGame } from '../game/GameEngine'
import { CUES, phase } from '../game/Timeline'
import { randomSeed, strip } from './geometry'
import { bypass, closureEnd, closureStart, elevationAt, gateway, lodges, mainRoad, riverX } from './layout'

const roadMaterial = new MeshStandardMaterial({ color: '#414947', roughness: 0.96, side: DoubleSide })
const shoulderMaterial = new MeshStandardMaterial({ color: '#a19777', roughness: 1, side: DoubleSide })
const edgeMaterial = new MeshStandardMaterial({ color: '#ddd4b6', roughness: 1, side: DoubleSide })
const centerMaterial = new MeshStandardMaterial({ color: '#d4a966', roughness: 1, side: DoubleSide })
const roadSurfaces = [mainRoad, bypass].map((path) => ({
  gravel: strip(path, 8.4, -0.045),
  tarmac: strip(path, 6.6, 0.012),
  stripes: [-3.03, 3.03].map((offset) => strip(path, 0.12, 0.033, offset)),
}))

function roadRails() {
  const posts: Matrix4[] = []
  const beams: Matrix4[] = []
  const block = new Object3D()
  const mid = new Vector3()
  const next = new Vector3()
  for (const [path, ranges] of [
    [mainRoad, [[0.03, 0.18, 1], [0.20, 0.36, -1], [0.61, 0.75, 1], [0.86, 0.98, -1]]],
    [bypass, [[0.23, 0.73, -1]]],
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
          block.rotation.set(0, Math.atan2(next.x, next.z), 0)
          block.scale.set(.14, .2, next.length() + .08)
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
  const route = useMemo(() => strip(bypass, 0.59, 0.085, 0, 0, 1, 145), [])
  const closure = useMemo(() => strip(mainRoad, 6.56, 0.078, 0, closureStart, closureEnd, 42), [])
  useLayoutEffect(() => {
    rails.posts.forEach((matrix, i) => posts.current?.setMatrixAt(i, matrix))
    rails.beams.forEach((matrix, i) => beams.current?.setMatrixAt(i, matrix))
    const stamp = new Object3D()
    const segments = Math.floor(mainRoad.getLength() / 4.85)
    for (let i = 0; i < segments; i++) {
      const u = (i + 0.5) / segments
      stamp.position.copy(mainRoad.getPointAt(u)).y += .041
      const direction = mainRoad.getTangentAt(u)
      stamp.rotation.set(0, Math.atan2(direction.x, direction.z), 0)
      stamp.scale.set(.125, .014, 2.04)
      stamp.updateMatrix()
      dash.current?.setMatrixAt(i, stamp.matrix)
    }
    for (const mesh of [posts.current, beams.current, dash.current]) {
      if (mesh) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere() }
    }
  }, [])
  useFrame(() => {
    if (alternate.current) {
      alternate.current.visible = clock.time > CUES.diversion
      route.setDrawRange(0, Math.floor(145 * phase(clock.time, CUES.diversion, CUES.turn)) * 6)
    }
    if (closed.current) closed.current.visible = clock.time >= CUES.confirmed
  })
  return <>
    {roadSurfaces.map(({ gravel, tarmac, stripes }, index) => <group key={index}>
      <mesh geometry={gravel} material={shoulderMaterial} receiveShadow />
      <mesh geometry={tarmac} material={roadMaterial} receiveShadow />
      {stripes.map((stripe, i) => <mesh key={i} geometry={stripe} material={edgeMaterial} receiveShadow />)}
    </group>)}
    <instancedMesh ref={dash} args={[unitBox, centerMaterial, Math.floor(mainRoad.getLength() / 4.85)]} receiveShadow />
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

function Lodge({ at, scale, angle, roof }: { at: [number, number, number]; scale: number; angle: number; roof: string }) {
  return <group position={at} scale={scale} rotation-y={angle}>
    <Box size={[5.2, 1.3, 4.35]} position={[0, .02, 0]} color="#67695c" shadow />
    <Box size={[4.9, 3.35, 4.15]} position={[0, 2, 0]} color="#c2af87" shadow />
    <Box size={[5.86, .25, 2.66]} position={[0, 4.13, 1.12]} color={roof} rotation={[.52, 0, 0]} shadow />
    <Box size={[5.86, .25, 2.66]} position={[0, 4.13, -1.12]} color={roof} rotation={[-.52, 0, 0]} shadow />
    <mesh rotation-z={Math.PI / 2} position={[0, 3.91, 0]} castShadow>
      <cylinderGeometry args={[1.37, 1.37, 4.88, 3]} />
      <meshLambertMaterial color="#89735c" />
    </mesh>
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
  const bridgeZ = 56
  const bridgeX = riverX(bridgeZ)
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: .36, metalness: .16, side: DoubleSide }), [])
  useFrame(() => {
    const time = useGame.getState().mode === 'menu' ? clock.idle : clock.time
    material.emissive.setRGB(.01, .036 + .010 * Math.sin(time * .58), .033)
  })
  return <>
    <mesh geometry={river} material={material} />
    {lodges.map(([x, z, scale, angle, roof]) => <Lodge key={x} at={[x, elevationAt(x, z), z]} scale={scale} angle={angle} roof={roof} />)}
    <group position={[bridgeX, 5.8, bridgeZ]} rotation-y={-.11}>
      <Box size={[18, .5, 3.1]} color="#897256" shadow />
      <Box size={[19, .16, .17]} position={[0, 1.35, 1.49]} color="#a18b65" />
      <Box size={[19, .16, .17]} position={[0, 1.35, -1.49]} color="#a18b65" />
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
