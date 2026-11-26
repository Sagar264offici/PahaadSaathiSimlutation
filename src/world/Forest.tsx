import { useLayoutEffect, useMemo, useRef } from 'react'
import { Box3, ConeGeometry, CylinderGeometry, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, Object3D, Vector3, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Suspense } from 'react'
import { useGLTF } from '@react-three/drei'
import { randomSeed, shade } from './geometry'
import { elevationAt, footbridge, gateway, lodges, nearestRoad, node, relay, riverX, slope, witness } from './layout'
import type { Quality } from '../game/GameEngine'

type Stamp = { x: number; y: number; z: number; size: number; angle: number; color: number; tall: boolean }
const rockUrl = '/models/rock_largeA.glb'
useGLTF.preload(rockUrl, false, false)

function canopy(deodar: boolean) {
  const rings = deodar
    ? [[1.1, 1.05, .89], [.97, 1.33, 1.45], [.75, 1.42, 2.02], [.56, 1.27, 2.56], [.38, 1.02, 3.06], [.25, .77, 3.41]]
    : [[.79, 1.54, 1.17], [.69, 1.59, 1.85], [.54, 1.44, 2.55], [.39, 1.32, 3.18], [.25, 1.00, 3.76]]
  const layers = rings.map(([radius, height, y], index) => new ConeGeometry(radius, height, deodar ? 7 : 6, 1)
    .rotateY(index * 0.64).translate(Math.sin(index * 2.4) * .11, y, Math.cos(index * 1.9) * .10))
  const geometry = mergeGeometries(layers)
  layers.forEach((layer) => layer.dispose())
  return geometry
}

const fir = canopy(false)
const cedar = canopy(true)
const trunk = new CylinderGeometry(.068, .16, 1.25, 5).translate(0, .56, 0)
const roughStone = new IcosahedronGeometry(1, 0)
const materials = {
  foliage: new MeshLambertMaterial({ flatShading: true }),
  trunks: new MeshLambertMaterial({ color: '#544f3d' }),
  rocks: new MeshLambertMaterial({ flatShading: true }),
}

function forestLayout(quality: Quality) {
  const rand = randomSeed(8846)
  const trees: Stamp[] = []
  const stones: Stamp[] = []
  const count = quality === 'High' ? 5100 : quality === 'Medium' ? 4100 : 2700
  for (let i = 0; i < count; i++) {
    const x = -188 + rand() * 370
    const z = -234 + rand() * 395
    const density = 0.51 + 0.22 * Math.sin(x * .062 + z * .077) + 0.18 * Math.cos(z * .056 - x * .091)
    const scale = 0.55 + rand() * 1.57
    const angle = rand() * Math.PI * 2
    const color = rand()
    const tall = rand() < .60
    if (rand() > density || Math.abs(x - riverX(z)) < 9) continue
    const near = nearestRoad(x, z)
    if (near.distance < 6.65 + scale * .60 || Math.hypot(x - gateway.x, z - gateway.z) < 9 ||
      Math.hypot(x - node.x, z - node.z) < 8 || Math.hypot(x - relay.x, z - relay.z) < 6.5 || Math.hypot(x - witness.x, z - witness.z) < 5 || Math.hypot(x - slope.x, z - slope.z) < 15 ||
      Math.abs(z - footbridge.z) < 3.2 && Math.abs(x - footbridge.x) < 17 ||
      lodges.some(({ position, radius }) => Math.hypot(x - position.x, z - position.z) < radius + scale * .7 + .7)) continue
    const y = elevationAt(x, z, near)
    trees.push({ x, y: y - .25, z, size: scale, angle, color, tall })
  }
  for (let i = 0; i < 330; i++) {
    const x = -151 + rand() * 269
    const z = -170 + rand() * 304
    const near = nearestRoad(x, z)
    const size = .38 + rand() ** 3 * 3.15
    const angle = rand() * 7
    const color = rand()
    if (near.distance < 4.7 + size || Math.hypot(x - node.x, z - node.z) < 6 ||
      Math.hypot(x - relay.x, z - relay.z) < 5.5 || Math.hypot(x - gateway.x, z - gateway.z) < 7 ||
      lodges.some(({ position, radius }) => Math.hypot(x - position.x, z - position.z) < radius + size) ||
      Math.abs(z - footbridge.z) < 2.7 && Math.abs(x - footbridge.x) < 15) continue
    stones.push({ x, y: elevationAt(x, z, near) - size * .18, z, size, angle, color, tall: i % 5 === 0 })
  }
  return { pines: trees.filter((tree) => tree.tall), deodars: trees.filter((tree) => !tree.tall), trees, stones }
}

function Instances({ geometry, material, data, type, shadow = false }: {
  geometry: BufferGeometry; material: MeshLambertMaterial; data: Stamp[]; type: 'tree' | 'trunk' | 'rock'; shadow?: boolean
}) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const stamp = new Object3D()
    data.forEach(({ x, y, z, size, angle, color, tall }, i) => {
      stamp.position.set(x, y, z)
      stamp.rotation.set(type === 'rock' ? color * .72 : .023 * Math.sin(angle), angle, tall ? .035 : -.07)
      stamp.scale.set(size * (type === 'rock' ? 1.2 : 1), size * (type === 'rock' ? .69 : tall ? 1.09 : .94), size)
      stamp.updateMatrix()
      mesh.current?.setMatrixAt(i, stamp.matrix)
      if (type !== 'trunk') {
        const palette = type === 'rock' ? ['#797c69', '#96947b', '#686e64'] : ['#405942', '#385644', '#57694a', '#65764b', '#2e5145']
        mesh.current?.setColorAt(i, shade(palette[Math.floor(color * palette.length)], .91 + color * .18))
      }
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [data, type])
  return <instancedMesh key={data.length} ref={mesh} args={[geometry, material, data.length]} castShadow={shadow} receiveShadow />
}

function ImportedRocks({ data }: { data: Stamp[] }) {
  const { scene } = useGLTF(rockUrl, false, false)
  const geometry = useMemo(() => {
    scene.updateMatrixWorld(true)
    const parts: BufferGeometry[] = []
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return
      const part = o.geometry.clone().applyMatrix4(o.matrixWorld)
      part.deleteAttribute('uv')
      parts.push(part)
    })
    if (!parts.length) return roughStone
    const result = mergeGeometries(parts)
    parts.forEach((part) => part.dispose())
    const bounds = new Box3().setFromBufferAttribute(result.getAttribute('position') as import('three').BufferAttribute)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    const scale = 2 / Math.max(size.x, size.z)
    return result.applyMatrix4(new Matrix4().makeTranslation(-center.x, -center.y, -center.z)).scale(scale, scale, scale)
  }, [scene])
  return <Instances geometry={geometry} material={materials.rocks} data={data} type="rock" />
}

export function Forest({ quality }: { quality: Quality }) {
  const { pines, deodars, trees, stones } = useMemo(() => forestLayout(quality), [quality])
  const shadows = quality === 'High'
  const local = useMemo(() => stones.filter((rock) => !rock.tall), [stones])
  const imported = useMemo(() => stones.filter((rock) => rock.tall), [stones])
  return <>
    <Instances geometry={fir} material={materials.foliage} data={pines} type="tree" shadow={shadows} />
    <Instances geometry={cedar} material={materials.foliage} data={deodars} type="tree" shadow={shadows} />
    <Instances geometry={trunk} material={materials.trunks} data={trees} type="trunk" />
    <Instances geometry={roughStone} material={materials.rocks} data={local} type="rock" />
    <Suspense fallback={null}><ImportedRocks data={imported} /></Suspense>
  </>
}
