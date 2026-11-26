import { useMemo } from 'react'
import { Color, Vector3 } from 'three'
import { coloredGeometry, randomSeed, shade } from './geometry'
import { elevationAt, nearestRoad, riverX, slope } from './layout'
import type { Quality } from '../game/GameEngine'

const grass = new Color('#637445')
const dryGrass = new Color('#8b8951')
const rock = new Color('#686b57')
const darkRock = new Color('#444f4b')
const bank = new Color('#a29772')

function valleyGeometry(step: number) {
  const rand = randomSeed(558)
  const points: Vector3[][] = []
  const positions: number[] = []
  const colors: number[] = []
  for (let z = -264; z <= 234; z += step) {
    const row: Vector3[] = []
    for (let x = -248; x <= 252; x += step) {
      const xx = x + (rand() - 0.5) * step * 0.65
      const zz = z + (rand() - 0.5) * step * 0.65
      row.push(new Vector3(xx, elevationAt(xx, zz), zz))
    }
    points.push(row)
  }
  const normal = new Vector3()
  const edge = new Vector3()
  const color = new Color()
  const triangle = (a: Vector3, b: Vector3, c: Vector3) => {
    normal.subVectors(b, a).cross(edge.subVectors(c, a)).normalize()
    const x = (a.x + b.x + c.x) / 3
    const z = (a.z + b.z + c.z) / 3
    const riverDistance = Math.abs(x - riverX(z))
    const gully = Math.min(1, Math.hypot((x - slope.x) / 15, (z - slope.z) / 14))
    const grain = 0.5 + 0.25 * Math.sin(x * 0.081 + z * 0.023) + 0.24 * Math.sin(z * 0.102)
    color.copy(grass).lerp(dryGrass, grain).lerp(rock, Math.max(1 - gully, Math.max(0, 0.85 - normal.y) * 1.8))
    if (normal.y < 0.65) color.lerp(darkRock, (0.65 - normal.y) * 1.3)
    if (riverDistance < 12) color.lerp(bank, (12 - riverDistance) / 16)
    if (nearestRoad(x, z).distance < 5.2) color.lerp(bank, 0.38)
    color.multiplyScalar(0.89 + rand() * 0.22)
    positions.push(...a.toArray(), ...b.toArray(), ...c.toArray())
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b)
  }
  for (let row = 0; row < points.length - 1; row++) {
    for (let index = 0; index < points[row].length - 1; index++) {
      const a = points[row][index], b = points[row][index + 1]
      const c = points[row + 1][index], d = points[row + 1][index + 1]
      if ((index + row) % 2) { triangle(a, c, d); triangle(a, d, b) }
      else { triangle(a, c, b); triangle(b, c, d) }
    }
  }
  return coloredGeometry(positions, colors)
}

type Peak = [x: number, z: number, height: number, width: number, depth: number, tilt: number, snowLine: number]
const ranges: { peaks: Peak[]; stone: string; flank: string; snow: string }[] = [
  {
    stone: '#567487', flank: '#6d8b99', snow: '#c9d8d7',
    peaks: [[-526,-660,165,195,123,26,0.56],[-365,-644,147,144,120,-24,0.57],[-202,-675,198,176,176,15,0.45],[-35,-676,156,180,133,-12,0.58],[125,-648,181,164,110,12,0.48],[293,-646,203,167,117,-16,0.46],[451,-642,162,153,117,-24,0.54]],
  },
  {
    stone: '#526a76', flank: '#6e8590', snow: '#f0ece0',
    peaks: [[-384,-454,128,140,137,21,0.63],[-282,-450,156,132,128,-25,0.55],[-177,-463,115,101,111,-8,0.62],[-94,-421,177,149,139,24,0.50],[-37,-435,142,98,120,-25,0.49],[46,-409,185,144,117,-21,0.43],[101,-412,137,104,110,18,0.52],[184,-437,166,138,105,20,0.56],[286,-414,149,141,92,34,0.59],[364,-426,155,160,130,-14,0.58]],
  },
  {
    stone: '#3c5357', flank: '#69817a', snow: '#d8dfd6',
    peaks: [[-263,-266,95,125,90,-22,0.89],[-190,-275,89,103,88,14,0.89],[-128,-286,69,78,75,10,0.95],[-62,-314,102,82,82,16,0.82], [101,-275,103,103,80,-11,0.91],[169,-249,125,114,95,-11,0.86],[226,-247,113,91,104,-14,0.9],[285,-261,105,128,108,11,0.91]],
  },
]

function mountainGeometry() {
  const rand = randomSeed(290)
  const positions: number[] = []
  const colors: number[] = []
  const aEdge = new Vector3()
  const bEdge = new Vector3()
  for (const { peaks, stone, flank, snow } of ranges) {
    for (const [x, z, height, width, depth, tilt, snowLine] of peaks) {
      const count = 19
      const levels = [0, 0.20, 0.43, 0.62, 0.81, 0.93]
      const seams = Array.from({ length: count }, (_, index) => ({
        angle: (index + (rand() - 0.5) * 0.45) * Math.PI * 2 / count,
        rib: (index % 2 ? 0.78 : 1.14) + rand() * 0.26,
        snow: (rand() - 0.5) * 0.26,
      }))
      const rings = levels.map((level) => seams.map(({ angle, rib }) => {
        const reach = (1 - level) ** 0.91 * rib * (0.94 + rand() * 0.12)
        return new Vector3(
          x + Math.cos(angle) * reach * width + tilt * level,
          -7 + height * (level + (rand() - 0.5) * 0.125 * Math.sin(level * Math.PI)),
          z + Math.sin(angle) * reach * depth - level * 13,
        )
      }))
      const top = new Vector3(x + tilt, height - 7, z - 13)
      const triangle = (a: Vector3, b: Vector3, c: Vector3, seam: number) => {
        const ratio = ((a.y + b.y + c.y) / 3 + 7) / height
        const n = aEdge.subVectors(b, a).cross(bEdge.subVectors(c, a)).normalize()
        const snowed = ratio > snowLine + seams[seam].snow - n.y * 0.13
        const tint = snowed ? snow : n.x < 0.06 || ratio < 0.31 ? flank : stone
        const color = shade(tint, 0.84 + rand() * 0.23)
        positions.push(...a.toArray(), ...b.toArray(), ...c.toArray())
        for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b)
      }
      for (let j = 0; j < rings.length; j++) {
        for (let i = 0; i < count; i++) {
          const next = (i + 1) % count
          const a = rings[j][i], b = rings[j][next]
          if (j === rings.length - 1) { triangle(a, top, b, i); continue }
          const c = rings[j + 1][i], d = rings[j + 1][next]
          triangle(a, c, b, i)
          triangle(b, c, d, i)
        }
      }
    }
  }
  return coloredGeometry(positions, colors)
}

const mountains = mountainGeometry()

export function Terrain({ quality }: { quality: Quality }) {
  const terrain = useMemo(() => valleyGeometry(quality === 'High' ? 2.35 : quality === 'Medium' ? 2.8 : 3.4), [quality])
  return <>
    <mesh geometry={mountains}><meshLambertMaterial vertexColors flatShading /></mesh>
    <mesh geometry={terrain} receiveShadow><meshLambertMaterial vertexColors flatShading /></mesh>
  </>
}
