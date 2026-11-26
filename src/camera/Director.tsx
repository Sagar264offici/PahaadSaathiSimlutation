import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { driveHeading, drivePosition } from '../game/Drive'
import { clock, driving, useGame } from '../game/GameEngine'
import { type Focus, type Scenario } from '../game/Scenario'
import { cueIndex, CUES, phase } from '../game/Timeline'
import { cloud, closurePoint, elevationAt, gateway, junctionU, mainRoad, node, phone, radioFlight, receiver, relay, relayRadio, slope, vehicleAt, witness } from '../world/layout'

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
    position: a.position.clone().lerp(b.position, t),
    target: a.target.clone().lerp(b.target, t),
    fov: a.fov + (b.fov - a.fov) * t,
    shift: a.shift + (b.shift - a.shift) * t,
  }
}

function vista(drift = 0) {
  return pose([2 + drift, 81, 130], [-8, 42, -82], 52)
}

function follow(time: number, s: Scenario) {
  const { road, u } = vehicleAt(time, s.turnAt)
  const p = road.getPointAt(u)
  const direction = road.getTangentAt(u)
  return {
    position: p.clone().addScaledVector(direction, -12.8).add(new Vector3(direction.z * 2.2, 6.5, -direction.x * 2.2)),
    target: p.clone().addScaledVector(direction, 6.9).add(new Vector3(0, 1.72, 0)),
    fov: 48,
    shift: .04,
  }
}

function rockfall(t: number, s: Scenario) {
  const age = s.rockAt === null ? 0 : Math.max(0, t - s.rockAt)
  const close = near(slope, [-25, 13, 32], [-8, -2.5, 1], 46, .07)
  const { road, u } = vehicleAt(t, s.turnAt)
  const vehicle = road === mainRoad ? mainRoad.getPointAt(u) : mainRoad.getPointAt(junctionU)
  const blocked = near(vehicle, [9, 17, 26], [0, 1.5, 0], 53, .06)
  blocked.target.lerp(closurePoint.clone().add(new Vector3(0, 2.4, 0)), .39)
  const view = mix(close, blocked, ease(phase(age, 8.0, 11.4)))
  if (s.rockAt !== null && age < 9) {
    const kick = Math.sin(age * 12.8) * (.095 + .18 * Math.sin(phase(age, 0, 9) * Math.PI))
    view.position.x += kick
    view.position.y += Math.cos(age * 17.1) * kick * .64
  }
  return view
}

const inspect1E = () => near(node, [1.05, 6.8, 8.5], [0, 1.95, 0], 43, .10)
const inspect2L = () => near(relay, [.56, 6.8, 8.9], [0, 1.9, 0], 44, .10)
const inspect3MH = () => near(gateway, [1.8, 6.9, 8.64], [.05, 1.78, 0], 43, .10)
const cloudView = () => near(cloud, [3.5, 3.8, 20.4], [0, .3, 0], 44, .12)
const phoneView = () => near(phone, [1.15, .49, 9], [0, .02, 0], 44, .13)
const proposal = () => pose([-11, 170, 187], [-13, 40, -56], 59, .04)

function packetView(t: number, s: Scenario) {
  const flight = radioFlight(s)
  if (!flight) return near(s.packet?.sender === '2L' ? receiver : relayRadio, [8.4, 5.8, 13.5], [0, .44, -.43], 55, .10)
  const packet = flight.path.getPointAt(phase(t, flight.from, flight.to))
  return near(packet, [8.4, 5.8, 13.5], [0, .44, -.43], 55, .10)
}

function routeView(t: number, s: Scenario) {
  const { road, u } = vehicleAt(t, s.turnAt)
  return near(road.getPointAt(u), [17, 24, 24], [-5.6, 2.8, -8.4], 50, .08)
}

const shots: { from: number; blend: number; at: (time: number, scenario: Scenario) => Pose }[] = [
  { from: CUES.intro, blend: 0, at: (t) => mix(vista(), pose([29, 67, 129], [24, 30, 13], 51), ease(phase(t, 0, CUES.drive))) },
  { from: CUES.drive, blend: 4.2, at: follow },
  { from: CUES.node, blend: 3.0, at: inspect1E },
  { from: CUES.approach, blend: 3.1, at: follow },
  { from: CUES.rockfall - 1.2, blend: 2.1, at: rockfall },
  { from: CUES.detection, blend: 2.8, at: inspect1E },
  { from: CUES.radio, blend: 1.4, at: packetView },
  { from: CUES.relay, blend: 2.2, at: inspect2L },
  { from: CUES.forward, blend: 1.45, at: packetView },
  { from: CUES.gateway, blend: 2.1, at: inspect3MH },
  { from: CUES.cloud, blend: 3.25, at: cloudView },
  { from: CUES.community, blend: 2.35, at: (t) => mix(
    near(witness, [-4.8, 4.2, 7.3], [0, 1.25, 0], 44, .10),
    phoneView(), ease(phase(t, CUES.community + 2.35, CUES.community + 5.3)),
  ) },
  { from: CUES.submit + 5, blend: 2.6, at: cloudView },
  { from: CUES.confirmed, blend: 2.25, at: rockfall },
  { from: CUES.alert, blend: 2.3, at: phoneView },
  { from: CUES.diversion, blend: 3.0, at: routeView },
  { from: CUES.offline, blend: 2.4, at: (t) => mix(inspect3MH(),
    near(gateway, [16.5, 20, 33], [11, 5, 4], 53, .06),
    ease(phase(t, CUES.offline + 2, CUES.offline + 6))) },
  { from: CUES.restored, blend: 2.4, at: cloudView },
  { from: CUES.production, blend: 3.5, at: proposal },
  { from: CUES.overview, blend: 3.4, at: (t) => mix(
    pose([18, 83, 84], [-3, 38, -33], 49, .055),
    pose([8, 106, 131], [-5, 42, -48], 52, .08),
    ease(phase(t, CUES.overview, CUES.end)),
  ) },
]

function manualShot(focus: Focus, time: number, scenario: Scenario) {
  switch (focus) {
    case 'world': return vista()
    case 'vehicle': return scenario.routeAt === null ? follow(time, scenario) : routeView(time, scenario)
    case 'rockfall': return rockfall(time, scenario)
    case '1E': return inspect1E()
    case '2L': return inspect2L()
    case '3MH': return inspect3MH()
    case 'packet': return packetView(time, scenario)
    case 'cloud': return cloudView()
    case 'community': return phoneView()
    case 'production': return proposal()
  }
}

export function Director() {
  const canvas = useThree((state) => state.gl.domElement)
  const camera = useThree((state) => state.camera)
  const orbit = useRef<OrbitControls | null>(null)
  const manual = useRef({ version: -1, began: 0, owned: false, start: vista() })
  const previous = useRef(vista())
  const driveCamera = useRef({ run: -1, position: new Vector3(), target: new Vector3(), wanted: new Vector3(), look: new Vector3(), heading: new Vector3() })


  useEffect(() => {
    const controls = new OrbitControls(camera, canvas)
    controls.enabled = false
    controls.enableDamping = true
    controls.dampingFactor = .115
    controls.minDistance = 2.5
    controls.maxDistance = 270
    controls.maxPolarAngle = Math.PI * .48
    controls.zoomSpeed = .78
    const takeover = () => { manual.current.owned = true }
    controls.addEventListener('start', takeover)
    orbit.current = controls
    return () => { orbit.current = null; controls.removeEventListener('start', takeover); controls.dispose() }
  }, [camera, canvas])

  useFrame(({ camera, size, clock: renderClock }, delta) => {
    if (!(camera instanceof PerspectiveCamera)) return
    const game = useGame.getState()
    const time = clock.time
    const controls = orbit.current
    const menu = game.mode === 'menu'
    const presenter = !menu && game.control === 'presenter'
    if (controls) controls.enabled = presenter
    let shot: Pose
    if (!menu && game.control === 'drive') {
      const cameraRig = driveCamera.current
      drivePosition(driving.frame, cameraRig.wanted)
      driveHeading(driving.frame, cameraRig.heading)
      cameraRig.look.copy(cameraRig.wanted).addScaledVector(cameraRig.heading, 9.8)
      cameraRig.look.y += size.width / size.height < 1.06 ? -.6 : 1.65
      cameraRig.wanted.addScaledVector(cameraRig.heading, -11.9)
      cameraRig.wanted.y += 5.95
      const rockAt = game.scenario.rockAt
      if (rockAt !== null && driving.frame.route === 'ridge') {
        const raised = ease(phase(time, rockAt, rockAt + 2.1))
        cameraRig.wanted.x += (9 + cameraRig.heading.x * 11.9) * raised
        cameraRig.wanted.y += 10.6 * raised
        cameraRig.wanted.z += (22 + cameraRig.heading.z * 11.9) * raised
        cameraRig.look.x += (closurePoint.x - cameraRig.look.x) * .32 * raised
        cameraRig.look.y += (closurePoint.y + 3.1 - cameraRig.look.y) * .32 * raised
        cameraRig.look.z += (closurePoint.z - cameraRig.look.z) * .32 * raised
      }
      if (cameraRig.run !== game.run) {
        cameraRig.run = game.run
        cameraRig.position.copy(cameraRig.wanted)
        cameraRig.target.copy(cameraRig.look)
      }
      const follow = 1 - Math.exp(-8.5 * delta)
      cameraRig.position.lerp(cameraRig.wanted, follow)
      cameraRig.target.lerp(cameraRig.look, follow)
      shot = { position: cameraRig.position, target: cameraRig.target, fov: 52, shift: .014 }
    } else if (presenter && controls) {
      if (manual.current.version !== game.focusVersion) {
        manual.current = {
          version: game.focusVersion, began: renderClock.elapsedTime, owned: false,
          start: { position: camera.position.clone(), target: previous.current.target.clone(), fov: camera.fov, shift: previous.current.shift },
        }
      }
      if (manual.current.owned) { controls.update(); previous.current.target.copy(controls.target); return }
      const target = manualShot(game.focus, time, game.scenario)
      if (game.focus !== 'world') target.shift = game.focus === 'rockfall' ? -.04 : -.095
      const transition = ease(phase(renderClock.elapsedTime, manual.current.began, manual.current.began + 1.35))
      shot = mix(manual.current.start, target, transition)
    } else if (menu) shot = vista(Math.sin(clock.idle * .105) * 4.3)
    else {
      const i = cueIndex(shots, time)
      const current = shots[i]
      const prior = shots[i - 1]
      const ramp = current.blend ? ease(phase(time, current.from, current.from + current.blend)) : 1
      // Between hops the perspective should continue toward the current receiver.
      const priorTime = current.from === CUES.relay || current.from === CUES.gateway ? current.from - .05 : time
      shot = prior && ramp < 1 ? mix(prior.at(priorTime, game.scenario), current.at(time, game.scenario), ramp) : current.at(time, game.scenario)
    }
    const { x, y, z } = shot.position
    if (z > -228 && z < 200 && x > -190 && x < 185) shot.position.y = Math.max(y, elevationAt(x, z) + 1.03)
    camera.position.copy(shot.position)
    camera.lookAt(shot.target)
    const narrow = size.width / size.height < 1.06
    camera.fov = shot.fov + (narrow ? (menu ? 4 : 10) : 0)
    camera.setViewOffset(size.width, size.height, narrow ? 0 : -shot.shift * size.width, 0, size.width, size.height)
    if (controls && presenter) controls.target.copy(shot.target)
    previous.current = shot
  }, -2)
  return null
}
