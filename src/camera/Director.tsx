import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { DRIVE_GATES, driveHeading, drivePosition } from '../game/Drive'
import { clock, driving, useGame } from '../game/GameEngine'
import { type Focus, type Scenario } from '../game/Scenario'
import { cueIndex, CUES, phase } from '../game/Timeline'
import { bypass, cloud, closurePoint, elevationAt, gateway, junctionU, mainRoad, node, phone, radioFlight, receiver, relay, relayRadio, slope, vehicleAt } from '../world/layout'

type Pose = { position: Vector3; target: Vector3; fov: number; shift: number }
type Vec = [number, number, number]
const ease = gsap.parseEase('sine.inOut')
const slopeFocus = slope.clone().add(new Vector3(0, 7, 0))
const lookoutPoint = DRIVE_GATES[0].point

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

function distantSlope(t: number, s: Scenario) {
  const { road, u } = vehicleAt(t, s.turnAt)
  const car = road.getPointAt(u)
  const shot = near(car, [-30, 48, 65], [0, 4, 0], 59, -.09)
  shot.target.lerp(slopeFocus, .54)
  return shot
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

const inspectStation = () => near(node, [1.05, 6.8, 8.5], [0, 1.95, 0], 43, .10)
const inspectRelay = () => near(relay, [.56, 6.8, 8.9], [0, 1.9, 0], 44, .10)
const inspectGateway = () => near(gateway, [1.8, 6.9, 8.64], [.05, 1.78, 0], 43, .10)
const cloudView = () => near(cloud, [3.5, 3.8, 20.4], [0, .3, 0], 44, .12)
const phoneView = () => near(phone, [1.15, .49, 9], [0, .02, 0], 44, .13)
const proposal = () => pose([-11, 170, 187], [-13, 40, -56], 59, .04)
const routeOverview = () => pose([-41, 231, 152], [-41, 30, -39], 58, -.12)

function packetView(t: number, s: Scenario) {
  const flight = radioFlight(s)
  if (!flight) return near(s.packet?.sender === 'NODE-02' ? receiver : relayRadio, [8.4, 5.8, 13.5], [0, .44, -.43], 55, .10)
  const packet = flight.path.getPointAt(phase(t, flight.from, flight.to))
  return near(packet, [8.4, 5.8, 13.5], [0, .44, -.43], 55, .10)
}

function routeView(t: number, s: Scenario) {
  const { road, u } = vehicleAt(t, s.turnAt)
  if (road !== bypass) return routeOverview()
  const car = road.getPointAt(u)
  const heading = road.getTangentAt(u)
  return {
    position: car.clone().addScaledVector(heading, -16).add(new Vector3(0, 10.5, 0)),
    target: car.clone().addScaledVector(heading, 12).add(new Vector3(0, 2.6, 0)),
    fov: 55, shift: -.12,
  }
}

const shots: { from: number; blend: number; at: (time: number, scenario: Scenario) => Pose }[] = [
  { from: CUES.intro, blend: 0, at: (t, s) => mix(vista(), distantSlope(t, s), ease(phase(t, 0, CUES.drive + 1))) },
  { from: CUES.approach, blend: 1.8, at: (t, s) => mix(
    near(slope, [-19, 74, 113], [-30, -3, 20], 54, -.12), packetView(t, s), .2) },
  { from: CUES.gateway + .65, blend: 1.9, at: inspectGateway },
  { from: CUES.diversion, blend: 2.2, at: routeOverview },
  { from: CUES.turn - 1.6, blend: 1.5, at: () => near(mainRoad.getPointAt(junctionU), [6, 35, 32], [-8, 0, 0], 51, -.12) },
  { from: CUES.turn + 3.2, blend: 2.6, at: routeView },
  { from: CUES.community, blend: 2.25, at: routeOverview },
  { from: CUES.confirmed + 3, blend: 2.4, at: routeView },
  { from: CUES.offline, blend: 2.4, at: (t) => mix(inspectGateway(),
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
    case 'world': {
      const car = drivePosition(driving.frame)
      return near(car, [17, 25, 29], [0, 1.3, 0], 55, .03)
    }
    case 'vehicle': return scenario.routeAt === null ? follow(time, scenario) : routeOverview()
    case 'rockfall': return rockfall(time, scenario)
    case 'NODE-01': return inspectStation()
    case 'NODE-02': return inspectRelay()
    case 'GW-01': return inspectGateway()
    case 'packet': return packetView(time, scenario)
    case 'cloud': return cloudView()
    case 'community': return phoneView()
    case 'production': return proposal()
    case 'route': return routeOverview()
  }
}

export function Director() {
  const canvas = useThree((state) => state.gl.domElement)
  const camera = useThree((state) => state.camera)
  const orbit = useRef<OrbitControls | null>(null)
  const manual = useRef({ version: -1, began: 0, owned: false, start: vista() })
  const previous = useRef(vista())
  const wasInspecting = useRef(false)
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
    const inspection = !menu && (game.control === 'presenter' || game.control === 'drive' && game.focus !== 'vehicle' || game.cameraOverride !== null)
    const focus = game.cameraOverride ?? game.focus
    if (controls) controls.enabled = inspection
    let shot: Pose
    const returning = wasInspecting.current && !inspection
    wasInspecting.current = inspection
    if (!inspection && !menu && game.control === 'drive') {
      const cameraRig = driveCamera.current
      drivePosition(driving.frame, cameraRig.wanted)
      driveHeading(driving.frame, cameraRig.heading)
      const distanceToLookout = cameraRig.wanted.distanceTo(lookoutPoint)
      cameraRig.look.copy(cameraRig.wanted).addScaledVector(cameraRig.heading, 9.8)
      cameraRig.look.y += size.width / size.height < 1.06 ? -.6 : 1.65
      cameraRig.wanted.addScaledVector(cameraRig.heading, -11.9)
      cameraRig.wanted.y += 5.95
      const rockAt = game.scenario.rockAt
      const raised = rockAt === null ? 1 - .25 * ease(phase(distanceToLookout, 5, 16)) : 1 - ease(phase(time - rockAt, 6.5, 10))
      if (raised > 0 && driving.frame.route === 'ridge') {
        cameraRig.wanted.x += (-30 + cameraRig.heading.x * 11.9) * raised
        cameraRig.wanted.y += 42 * raised
        cameraRig.wanted.z += (65 + cameraRig.heading.z * 11.9) * raised
        cameraRig.look.lerp(slopeFocus, .56 * raised)
      }
      if (cameraRig.run !== game.run) {
        cameraRig.run = game.run
        cameraRig.position.copy(cameraRig.wanted)
        cameraRig.target.copy(cameraRig.look)
      } else if (returning) {
        cameraRig.position.copy(camera.position)
        cameraRig.target.copy(previous.current.target)
      }
      const follow = 1 - Math.exp(-8.5 * delta)
      cameraRig.position.lerp(cameraRig.wanted, follow)
      cameraRig.target.lerp(cameraRig.look, follow)
      shot = { position: cameraRig.position, target: cameraRig.target, fov: 52 + raised * 7, shift: -.11 }
    } else if (inspection && controls) {
      if (manual.current.version !== game.focusVersion) {
        manual.current = {
          version: game.focusVersion, began: renderClock.elapsedTime, owned: false,
          start: { position: camera.position.clone(), target: previous.current.target.clone(), fov: camera.fov, shift: previous.current.shift },
        }
      }
      if (manual.current.owned) { controls.update(); previous.current.target.copy(controls.target); return }
      const target = manualShot(focus, time, game.scenario)
      if (focus !== 'world' && game.control !== 'auto') target.shift = focus === 'rockfall' ? -.04 : -.085
      const transition = ease(phase(renderClock.elapsedTime, manual.current.began, manual.current.began + 1.35))
      shot = mix(manual.current.start, target, transition)
    } else if (menu) shot = vista(Math.sin(clock.idle * .105) * 4.3)
    else {
      const i = cueIndex(shots, time)
      const current = shots[i]
      const prior = shots[i - 1]
      const ramp = current.blend ? ease(phase(time, current.from, current.from + current.blend)) : 1
      // Between hops the perspective should continue toward the current receiver.
      shot = prior && ramp < 1 ? mix(prior.at(time, game.scenario), current.at(time, game.scenario), ramp) : current.at(time, game.scenario)
    }
    const { x, y, z } = shot.position
    if (z > -228 && z < 200 && x > -190 && x < 185) shot.position.y = Math.max(y, elevationAt(x, z) + 1.03)
    camera.position.copy(shot.position)
    camera.lookAt(shot.target)
    const narrow = size.width / size.height < 1.06
    camera.fov = shot.fov + (narrow ? (menu ? 4 : 10) : 0)
    camera.setViewOffset(size.width, size.height, narrow ? 0 : -shot.shift * size.width, 0, size.width, size.height)
    if (controls && inspection) controls.target.copy(shot.target)
    previous.current = shot
  }, -2)
  return null
}
