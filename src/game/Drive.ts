import { Matrix3, Matrix4, Vector3 } from 'three'
import { OBB } from 'three/addons/math/OBB.js'
import { bypass, junctionU, landslideDistance, landslideU, mainRoad, retraceU, safeReturnU, startU } from '../world/layout'
import { applyCommand, type Focus, type Scenario } from './Scenario'
import { applyResponse } from './Timeline'

type Route = 'ridge' | 'bypass'
export type Gate = 'rockfall' | 'junction' | 'safe-return' | 'finish'
export type RouteChoice = 'safe-return' | 'detour'
export type DriveInput = { throttle: number; brake: boolean; steer: number }
export type DriveState = {
  route: Route
  distance: number
  lane: number
  speed: number
  steering: number
  odometer: number
  gates: readonly Gate[]
  choice: RouteChoice | null
}

const roads = { ridge: mainRoad, bypass }
const lengths = { ridge: mainRoad.getLength(), bypass: bypass.getLength() }
const junction = junctionU * lengths.ridge
const start = startU * lengths.ridge
const safeReturn = safeReturnU * lengths.bypass
export const TOP_SPEED = 19

export function newDrive(): DriveState {
  return { route: 'ridge', distance: start, lane: 0, speed: 0, steering: 0, odometer: 0, gates: [], choice: null }
}

const tangent = new Vector3()
export function drivePosition(state: DriveState, out = new Vector3()) {
  const road = roads[state.route]
  const u = Math.min(1, Math.max(0, state.distance / lengths[state.route]))
  road.getTangentAt(u, tangent)
  road.getPointAt(u, out)
  out.x -= tangent.z * state.lane
  out.z += tangent.x * state.lane
  return out
}

export function driveHeading(state: DriveState, out = new Vector3()) {
  return roads[state.route].getTangentAt(Math.min(1, Math.max(0, state.distance / lengths[state.route])), out)
}

function roadBox(route: Route, u: number, halfWidth: number, halfDepth: number) {
  const point = roads[route].getPointAt(u)
  const direction = roads[route].getTangentAt(u)
  const yaw = Math.atan2(direction.x, direction.z)
  const collider = new OBB(point.clone().add(new Vector3(0, 1, 0)), new Vector3(halfWidth, 2.3, halfDepth),
    new Matrix3().setFromMatrix4(new Matrix4().makeRotationY(yaw)))
  return { point, yaw, collider }
}

export const DRIVE_GATES = [
  { id: 'rockfall', route: 'ridge', ...roadBox('ridge', landslideU, 3.35, 3.2) },
  { id: 'junction', route: 'ridge', ...roadBox('ridge', .478, 3.4, 3.2) },
  { id: 'safe-return', route: 'bypass', ...roadBox('bypass', safeReturnU, 5, 3.8) },
  { id: 'finish', route: 'bypass', ...roadBox('bypass', .985, 3.35, 3.35) },
] as const
export const ROADBLOCK = roadBox('ridge', .497, 3.55, 1.7)
const body = new OBB(new Vector3(), new Vector3(1.27, 1.05, 2.05), new Matrix3())
const turn = new Matrix4()
const bearing = new Vector3()

function vehicleBox(state: DriveState) {
  drivePosition(state, body.center).y += 1
  driveHeading(state, bearing)
  body.rotation.setFromMatrix4(turn.makeRotationY(Math.atan2(bearing.x, bearing.z) - state.steering * .13))
  return body
}

function approach(value: number, target: number, change: number) {
  return value < target ? Math.min(target, value + change) : Math.max(target, value - change)
}

export function stepDrive(state: DriveState, input: DriveInput, blocked: boolean, bypassOpen: boolean, dt: number): DriveState {
  if (state.gates.includes('finish')) return state
  // The caller substeps at 60 Hz, so the SUV cannot jump over a trigger in one render frame.
  const approachLimit = blocked && state.route === 'ridge' ? Math.sqrt(14 * Math.max(1, junction - state.distance)) : TOP_SPEED
  const turnLimit = state.route === 'bypass' && state.distance < retraceU * lengths.bypass ? 8 : TOP_SPEED
  const target = input.brake ? 0 : input.throttle >= 0 ? input.throttle * Math.min(TOP_SPEED, approachLimit, turnLimit) : input.throttle * 5
  const rate = input.brake ? 24 : target === 0 ? 5 : state.speed * target < 0 ? 14 : 7
  const speed = approach(state.speed, target, dt * rate)
  const steering = approach(state.steering, input.steer, dt * 7.5)
  const lane = Math.min(1.78, Math.max(-1.78, state.lane + steering * speed * .17 * dt))
  let route = state.route
  let distance = state.distance + speed * dt

  if (route === 'ridge' && bypassOpen && (state.choice !== null || input.steer < -.32) && speed > 0 && distance >= junction && state.distance <= junction + 3) {
    route = 'bypass'
    distance = Math.max(0, distance - junction)
  } else if (route === 'bypass' && distance < 0) {
    route = 'ridge'
    distance += junction
  }

  const limit = route === 'bypass' && state.choice === 'safe-return' ? Math.max(safeReturn, route === state.route ? state.distance : 0) : lengths[route]
  const next: DriveState = {
    ...state, route, distance: Math.min(limit, Math.max(0, distance)), lane: route !== state.route ? 0 : lane, steering,
    speed: distance < 0 || distance > limit ? 0 : speed,
  }
  if (blocked && route === 'ridge' && speed > 0 && vehicleBox(next).intersectsOBB(ROADBLOCK.collider)) {
    next.distance = state.distance
    next.speed = 0
  }
  next.odometer += route === state.route ? next.distance - state.distance : speed * dt

  const box = vehicleBox(next)
  for (const gate of DRIVE_GATES) {
    if (gate.id === 'rockfall' && next.distance < start + landslideDistance) continue
    if (gate.id === 'finish' && next.distance < lengths.bypass * .981) continue
    if (gate.route === next.route && !next.gates.includes(gate.id) && box.intersectsOBB(gate.collider)) {
      next.gates = [...next.gates, gate.id]
    }
  }
  if (next.gates.includes('finish')) next.speed = 0
  return next
}

type Mission = {
  title: string
  cue: string
  focus?: Focus
}

export function driveMission(drive: DriveState, scenario: Scenario): Mission {
  if (!drive.gates.includes('rockfall')) return { title: 'Drive the first 10 metres', cue: 'Accelerate toward the lookout. The landslide triggers automatically.', focus: 'rockfall' }
  if (scenario.reopened) return { title: 'Primary road reopened', cue: 'Headquarters recorded an authorized reopening.' }
  if (scenario.routeAt !== null) {
    if (drive.route === 'ridge') return { title: 'U-turn ahead', cue: 'At the marked turnaround, hold left while accelerating or select a route on the phone.' }
    if (drive.choice === 'safe-return' && drive.distance >= safeReturn - .02) return { title: 'Last accessible junction reached', cue: 'Park here or select the long detour to keep driving.' }
    return { title: drive.choice === 'safe-return' ? 'Return to the junction' : 'Follow the long detour', cue: drive.gates.includes('safe-return') ? 'Continue through the west valley toward the destination.' : 'Retrace the ridge road to the last accessible junction.' }
  }
  if (scenario.sensorInCloud) return { title: 'Headquarters and app alerted', cue: 'The phone shows a preliminary sensor warning while operators assess the incident.', focus: 'cloud' }
  if (scenario.packet) return { title: 'Warning in transit', cue: 'Track PS-001 from NODE-01 through the relay to the Tinker Board gateway.', focus: 'packet' }
  return { title: 'Landslide ahead', cue: 'NODE-01 is sampling the movement. The warning is sent automatically.', focus: 'NODE-01' }
}

export function driveIncident(scenario: Scenario, drive: DriveState, from: number, at: number) {
  const triggered = !scenario.reopened && scenario.rockAt === null && drive.gates.includes('rockfall')
  const incident = triggered ? applyCommand(scenario, 'rockfall', at) : scenario
  const next = applyResponse(incident, from, at)
  return drive.route === 'bypass' && next.routeAt !== null && next.turnAt === null ? applyCommand(next, 'driveRoute', at) : next
}
