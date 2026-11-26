import type { Vector3 } from 'three'
import { bypass, closureEnd, closureStart, elevationAt, mainRoad, riverX, safeReturnU } from './layout'

export const mapSize = { w: 240, h: 152 }
const minX = -179, minZ = -195, extentX = 271, extentZ = 329
export function mapPoint(p: Pick<Vector3, 'x' | 'z'>): [number, number] {
  return [((p.x - minX) / extentX) * mapSize.w, ((p.z - minZ) / extentZ) * mapSize.h]
}

const path = (points: Pick<Vector3, 'x' | 'z'>[]) => points.map((p, i) => {
  const [x, y] = mapPoint(p)
  return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)
}).join(' ')

export const roadSvg = path(mainRoad.getSpacedPoints(93))
export const bypassSvg = path(bypass.getSpacedPoints(125))
export const returnSvg = path(Array.from({ length: 25 }, (_, i) => bypass.getPointAt(safeReturnU * i / 24)))
export const closureSvg = path(Array.from({ length: 21 }, (_, i) => mainRoad.getPointAt(closureStart + (closureEnd - closureStart) * i / 20)))
export const riverSvg = path(Array.from({ length: 88 }, (_, i) => {
  const z = minZ + i * extentZ / 87
  return { x: riverX(z), z }
}))

const columns = 39
const rows = 36
const heights = Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => elevationAt(minX + c * extentX / (columns - 1), minZ + r * extentZ / (rows - 1))))
export const contourSvg = [14, 19, 24, 29, 34, 39, 44, 49, 54, 59, 64, 70, 76].map((height) => {
  let d = ''
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < columns - 1; col++) {
      const corners = [[col, row], [col + 1, row], [col + 1, row + 1], [col, row + 1]]
      const crossings: string[] = []
      for (let edge = 0; edge < 4; edge++) {
        const [x, y] = corners[edge]
        const [u, v] = corners[(edge + 1) % 4]
        const a = heights[y][x]
        const b = heights[v][u]
        if ((a < height) === (b < height)) continue
        const t = (height - a) / (b - a)
        crossings.push(((x + (u - x) * t) * mapSize.w / (columns - 1)).toFixed(1) + ' ' + ((y + (v - y) * t) * mapSize.h / (rows - 1)).toFixed(1))
      }
      for (let i = 0; i < crossings.length - 1; i += 2) d += 'M' + crossings[i] + 'L' + crossings[i + 1]
    }
  }
  return d
}).join('')
