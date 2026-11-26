import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { PerspectiveCamera, Vector3 } from 'three'
import { clock, useGame } from '../game/GameEngine'
import { cueIndex, CUES, phase } from '../game/Timeline'
import { cloud, closurePoint, elevationAt, gateway, node, phone, rfCurve, slope, vehicleAt } from '../world/layout'

type Pose = { position: Vector3; target: Vector3; fov: number; shift: number }
type Vec = [number, number, number]
const ease = gsap.parseEase('sine.inOut')

function pose(position: Vec, target: Vec, fov = 47, shift = 0): Pose {
  return { position: new Vector3(...position), target: new Vector3(...target), fov, shift }
}

function near(anchor: Vector3, position: Vec, target: Vec, fov: number, shift = .07): Pose {
  const shot = pose(position, target, fov, shift)
  shot.position.add(anchor)
  shot.target.add(anchor)
  return shot
}

function mix(a: Pose, b: Pose, t: number): Pose {
  return {
    position: a.position.lerp(b.position, t),
    target: a.target.lerp(b.target, t),
    fov: a.fov + (b.fov - a.fov) * t,
    shift: a.shift + (b.shift - a.shift) * t,
  }
}

function vista(drift = 0) {
  return pose([2 + drift, 81, 130], [-8, 42, -82], 52)
}

function follow(time: number) {
  const { road, u } = vehicleAt(time)
  const p = road.getPointAt(u)
  const direction = road.getTangentAt(u)
  return {
    position: p.clone().addScaledVector(direction, -12.8).add(new Vector3(direction.z * 2.2, 6.5, -direction.x * 2.2)),
    target: p.clone().addScaledVector(direction, 6.9).add(new Vector3(0, 1.72, 0)),
    fov: 48,
    shift: .04,
  }
}

const shots: { from: number; blend: number; at: (time: number) => Pose }[] = [
  { from: CUES.intro, blend: 0, at: (t) => mix(vista(), pose([29, 67, 129], [24, 30, 13], 51), ease(phase(t, 0, 8))) },
  { from: CUES.drive, blend: 5.2, at: follow },
  { from: CUES.node, blend: 3.0, at: (t) => near(node, [1.04 - phase(t, 21, 31) * 1.7, 6.9, 8.55], [0, 1.98, 0], 42, .10) },
  { from: CUES.vibration, blend: 3.0, at: (t) => {
    const drift = phase(t, 35, 40)
    return near(slope, [-22 + drift * 3, 14.3, 24], [-6.5, -4.2, 4.7], 45, .10)
  } },
  { from: 39.4, blend: 2.9, at: () => near(node, [-6.2, 7.6, 10.8], [-.12, 2.3, 0], 45, .11) },
  { from: CUES.processing, blend: 3, at: (t) => near(node, [-.35 + phase(t, 46, 55) * 2.5, 6.3, 8.15], [.1, 1.79, 0], 41, .11) },
  { from: CUES.radio, blend: 3.0, at: (t) => {
    const packet = rfCurve.getPointAt(phase(t, 56, 65))
    return near(packet, [8 - 2.1 * phase(t, 60, 65), 5.4, 12.8], [0, .35, -.4], 55, .10)
  } },
  { from: CUES.gateway, blend: 2.9, at: (t) => near(gateway, [1.8 - phase(t, 71, 80) * 2.25, 6.9, 8.35], [.05, 1.8, 0], 42, .10) },
  { from: CUES.cloud, blend: 4.2, at: (t) => near(cloud, [7.0 - phase(t, 83, 91) * 5.4, 3.9, 19.7], [0, .3, 0], 44, .12) },
  { from: CUES.mobile, blend: 3.1, at: (t) => near(phone, [1.65 - phase(t, 94, 103) * .39, .52, 7.8 - phase(t, 94, 103) * .32], [0, .01, 0], 43, .12) },
  { from: CUES.review, blend: 3.4, at: (t) => {
    const { road, u } = vehicleAt(t)
    const subject = road.getPointAt(u)
    const shot = near(subject, [9, 15, 24], [0, 1.1, 0], 51, .04)
    shot.target.lerp(closurePoint.clone().add(new Vector3(0, 1.1, 0)), .33)
    return shot
  } },
  { from: CUES.diversion, blend: 3.3, at: (t) => {
    const { road, u } = vehicleAt(t)
    const subject = road.getPointAt(u)
    return near(subject, [18 - phase(t, 124, 133) * 10, 23.7, 21.5], [-6.5, 1.8, -9], 49, .08)
  } },
  { from: CUES.offline, blend: 3.2, at: (t) => near(gateway, [4.0 + phase(t, 138, 147) * 4.5, 6.1, 10.5], [0, 2.55 + phase(t, 142.7, 147) * 6.0, -.5], 50, .11) },
  { from: CUES.overview, blend: 5.5, at: (t) => mix(
    pose([12, 87, 71], [-7, 43, -28], 49, .05),
    pose([10, 111, 135], [-5, 47, -58], 52, .08),
    ease(phase(t, CUES.overview, CUES.end)),
  ) },
]

export function Director() {
  useFrame(({ camera, size }) => {
    if (!(camera instanceof PerspectiveCamera)) return
    const menu = useGame.getState().mode === 'menu'
    const time = clock.time
    let shot: Pose
    if (menu) shot = vista(Math.sin(clock.idle * .105) * 4.3)
    else {
      const i = cueIndex(shots, time)
      const current = shots[i]
      const previous = shots[i - 1]
      const transition = current.blend ? ease(phase(time, current.from, current.from + current.blend)) : 1
      shot = previous && transition < 1 ? mix(previous.at(time), current.at(time), transition) : current.at(time)
    }
    const { x, y, z } = shot.position
    if (z > -228 && z < 200 && x > -190 && x < 185) shot.position.y = Math.max(y, elevationAt(x, z) + 1.03)
    camera.position.copy(shot.position)
    camera.lookAt(shot.target)
    const narrow = size.width / size.height < 1.06
    camera.fov = shot.fov + (narrow ? (menu ? 4 : 10) : 0)
    camera.setViewOffset(size.width, size.height, narrow ? 0 : -shot.shift * size.width, 0, size.width, size.height)
  }, -2)
  return null
}
