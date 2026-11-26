import { BufferGeometry, Color, Float32BufferAttribute, type CatmullRomCurve3 } from 'three'

export function randomSeed(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export const shade = (color: string, amount: number) => new Color(color).multiplyScalar(amount)

export function coloredGeometry(positions: number[], colors: number[]) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function strip(path: CatmullRomCurve3, width: number, lift: number, offset = 0, from = 0, to = 1, steps = 240) {
  const positions: number[] = []
  const indices: number[] = []
  for (let index = 0; index <= steps; index++) {
    const u = from + (to - from) * index / steps
    const p = path.getPointAt(u)
    const dir = path.getTangentAt(u)
    for (const side of [-1, 1]) {
      const lateral = offset + side * width * 0.5
      positions.push(p.x - dir.z * lateral, p.y + lift, p.z + dir.x * lateral)
    }
    if (!index) continue
    const n = index * 2
    indices.push(n - 2, n - 1, n, n, n - 1, n + 1)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
