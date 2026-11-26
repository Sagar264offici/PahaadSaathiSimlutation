import { CatmullRomCurve3, Vector3 } from 'three'
import { FLIGHT, VEHICLE_AT_JUNCTION, type Scenario } from '../game/Scenario'
import { phase, smooth } from '../game/Timeline'

type XYZ = [number, number, number]
export const spline = (points: XYZ[]) => new CatmullRomCurve3(points.map((p) => new Vector3(...p)), false, 'centripetal')

export const mainRoad = spline([
  [74, 19, 124], [59, 22, 98], [48, 23, 76], [37, 25, 61], [7, 27, 56],
  [-9, 29, 44], [-6, 32, 29], [15, 35, 12], [37, 37, -7], [45, 39, -25],
  [35, 41, -44], [11, 43, -54], [-13, 45, -67], [-14, 47, -89],
  [10, 50, -102], [43, 51, -109], [60, 52, -128],
])
export const junctionU = 0.485
const junction = mainRoad.getPointAt(junctionU)
const merge = mainRoad.getPointAt(0.805)
const incoming = mainRoad.getTangentAt(junctionU)
export const bypass = spline([
  junction.toArray() as XYZ, junction.clone().addScaledVector(incoming, 6).toArray() as XYZ, [35, 37.4, -18],
  [15, 37, -33], [-4, 38, -38], [-26, 41, -51], [-30, 42, -68], [-25, 45, -81], merge.toArray() as XYZ,
])
export const lodges: [number, number, number, number, string][] = [
  [42, 51, 1.12, .3, '#764b3b'], [46, 45, .82, -.23, '#59676a'], [27, 72, .79, .24, '#685847'],
  [-28, 37, 1.1, .25, '#8e5b43'], [-36, 24, .82, -.2, '#636962'], [-46, -44, .9, .3, '#745442'],
  [-56, -48, .73, -.22, '#627573'], [-33, -80, .69, -.15, '#775b48'],
]

export const roadSamples = [...mainRoad.getSpacedPoints(460), ...bypass.getSpacedPoints(160)]
export const roadHalfWidth = 3.3
export const closureStart = 0.57
export const closureEnd = 0.68
export const closurePoint = mainRoad.getPointAt(0.623)
export const slope = closurePoint.clone().add(new Vector3(12, 6, -9))
export const gateway = new Vector3(-43, 38, -35)
export const cloud = new Vector3(-19, 72, -45)
export const node = new Vector3(50.8, 39.47, -29.5)
export const relay = new Vector3(-21, 19.44, 38)
const fieldPlatforms = [node, relay]
export function nearestRoad(x: number, z: number) {
  let gap = Infinity
  let elevation = 0
  for (const p of roadSamples) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2
    if (d < gap) { gap = d; elevation = p.y }
  }
  return { distance: Math.sqrt(gap), elevation }
}

export function riverX(z: number) {
  return -61 + 11 * Math.sin(z * 0.024) + 5 * Math.sin(z * 0.052 + 2)
}

export function elevationAt(x: number, z: number, near = nearestRoad(x, z)) {
  const riverDistance = Math.abs(x - riverX(z))
  const valley = 5 + 29 * (1 - Math.exp(-((riverDistance / 47) ** 1.72)))
  const northRise = Math.max(-8, Math.min(17, -z * 0.115))
  const eastRidge = 37 * Math.exp(-(((x - 95) / 39) ** 2 + ((z + 27) / 105) ** 2))
  const westRidge = 42 * Math.exp(-(((x + 143) / 50) ** 2 + ((z + 37) / 107) ** 2))
  const folds = 3.3 * Math.sin(x * 0.15 + z * 0.10) + 2.1 * Math.cos(z * 0.17 - x * 0.06) + 3.8 * Math.sin(z * 0.051 + x * 0.078)
  const rockShelf = 15 * Math.exp(-(((x - slope.x) / 11) ** 2 + ((z - slope.z) / 15) ** 2))
  const bank = smooth(phase(riverDistance, 2, 17))
  const natural = 2.7 + bank * (valley + northRise + eastRidge + westRidge + folds + rockShelf - 2.7)
  const gatewayBlend = 1 - smooth(phase(Math.hypot(x - gateway.x, z - gateway.z), 7, 18))
  const platform = natural + (gateway.y - 0.08 - natural) * gatewayBlend
  let ground = near.elevation - .3 + (platform - near.elevation + .3) * smooth(phase(near.distance, 5.05, 13.8))
  for (const pad of fieldPlatforms) {
    const distance = Math.hypot(x - pad.x, z - pad.z)
    const weight = (1 - smooth(phase(distance, 3.55, 8.5))) * smooth(phase(near.distance, 3.84, 5.55))
    ground += (pad.y - .16 - ground) * weight
  }
  return ground
}

export function groundPoint(x: number, z: number, lift = 0) {
  return new Vector3(x, elevationAt(x, z) + lift, z)
}

export const witness = groundPoint(41, 43.5, -.1)
export const phone = witness.clone().add(new Vector3(-7.1, 6.55, -.9))
export const transmitter = node.clone().add(new Vector3(2.35, 2.42, -.11))
export const relayRadio = relay.clone().add(new Vector3(2.35, 2.42, -.11))
export const receiver = gateway.clone().add(new Vector3(-1.53, 2.38, -.01))
export const firstHop = spline([transmitter.toArray() as XYZ, [39, 57, -12], [7, 52, 13], [-14, 31, 32], relayRadio.toArray() as XYZ])
export const secondHop = spline([relayRadio.toArray() as XYZ, [-26, 35, 23], [-33, 54, -10], receiver.toArray() as XYZ])
export const uplink = spline([gateway.clone().add(new Vector3(1, 2.3, 0)).toArray() as XYZ, [-39, 55, -31], cloud.toArray() as XYZ])
export const downlink = spline([cloud.toArray() as XYZ, [-5, 77, -16], [25, 63, 25], phone.toArray() as XYZ])
export const communityUplink = spline([...downlink.points].reverse().map((p) => p.toArray() as XYZ))

export function radioFlight(scenario: Scenario) {
  const packet = scenario.packet
  if (packet?.step === 'sending-1E') return { path: firstHop, from: packet.at, to: packet.at + FLIGHT }
  if (packet?.step === 'forwarding-2L') return { path: secondHop, from: packet.at, to: packet.at + FLIGHT }
  return null
}

export type VehicleSample = { road: CatmullRomCurve3; u: number }

export function vehicleAt(time: number, turnAt: number | null = null): VehicleSample {
  if (turnAt !== null && time >= turnAt) {
    const moving = phase(time, turnAt, turnAt + 16.5)
    return { road: bypass, u: .96 * smooth(moving) }
  }
  const cruise = .04 + .281 * smooth(phase(time, 1, 22)) + .075 * smooth(phase(time, 18, 32))
  const approaching = phase(time, 30, VEHICLE_AT_JUNCTION)
  return { road: mainRoad, u: Math.min(junctionU, cruise + (junctionU - .396) * smooth(approaching)) }
}
