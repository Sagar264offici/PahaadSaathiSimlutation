import { Matrix3, Matrix4, Vector3 } from 'three'
import { OBB } from 'three/addons/math/OBB.js'
import { bypass, junctionU, mainRoad } from '../world/layout'
import { advanceScenario, applyCommand, FLIGHT, type Command, type Scenario } from './Scenario'

type Route = 'ridge' | 'bypass'
export type Gate = 'rockfall' | 'sensors' | 'junction' | 'finish'
export type DriveInput = { throttle: number; brake: boolean; steer: number }
export type DriveState = {
  route: Route
  distance: number
  lane: number
  speed: number
  steering: number
  odometer: number
  gates: readonly Gate[]
}

const roads = { ridge: mainRoad, bypass }
const lengths = { ridge: mainRoad.getLength(), bypass: bypass.getLength() }
const junction = junctionU * lengths.ridge
export const TOP_SPEED = 19

export function newDrive(): DriveState {
  return { route: 'ridge', distance: lengths.ridge * .045, lane: 0, speed: 0, steering: 0, odometer: 0, gates: [] }
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
  { id: 'rockfall', route: 'ridge', ...roadBox('ridge', .348, 3.35, 3.2) },
  { id: 'sensors', route: 'ridge', ...roadBox('ridge', .411, 3.35, 3.3) },
  { id: 'junction', route: 'ridge', ...roadBox('ridge', .478, 3.4, 3.2) },
  { id: 'finish', route: 'bypass', ...roadBox('bypass', .94, 3.35, 3.35) },
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
  const target = input.brake ? 0 : input.throttle >= 0 ? input.throttle * TOP_SPEED : input.throttle * 5
  const rate = input.brake ? 24 : target === 0 ? 5 : state.speed * target < 0 ? 14 : 7
  const speed = approach(state.speed, target, dt * rate)
  const steering = approach(state.steering, input.steer, dt * 7.5)
  const lane = Math.min(1.78, Math.max(-1.78, state.lane + steering * speed * .17 * dt))
  let route = state.route
  let distance = state.distance + speed * dt

  if (route === 'ridge' && bypassOpen && input.steer < -.32 && speed > 0 && distance >= junction && state.distance <= junction + 3) {
    route = 'bypass'
    distance = Math.max(0, distance - junction)
  } else if (route === 'bypass' && distance < 0) {
    route = 'ridge'
    distance += junction
  }

  const limit = lengths[route]
  const next: DriveState = {
    ...state, route, distance: Math.min(limit, Math.max(0, distance)), lane, steering,
    speed: distance < 0 || distance > limit ? 0 : speed,
  }
  if (blocked && route === 'ridge' && speed > 0 && vehicleBox(next).intersectsOBB(ROADBLOCK.collider)) {
    next.distance = state.distance
    next.speed = 0
  }
  next.odometer += route === state.route ? next.distance - state.distance : speed * dt

  const box = vehicleBox(next)
  for (const gate of DRIVE_GATES) {
    if (gate.route === next.route && !next.gates.includes(gate.id) && box.intersectsOBB(gate.collider)) {
      next.gates = [...next.gates, gate.id]
    }
  }
  if (next.gates.includes('finish')) next.speed = 0
  return next
}

export function driveIncident(scenario: Scenario, drive: DriveState, at: number) {
  let next = advanceScenario(scenario, at)
  const run = (command: Command) => { next = applyCommand(next, command, at) }
  if (!drive.gates.includes('rockfall')) return next
  if (next.rockAt === null) run('rockfall')
  if (!drive.gates.includes('sensors')) return next

  // Spatial gates authorize the work. The shared scenario clocks only the reactions and packet travel.
  if (next.vibrationAt === null) {
    run('vibration')
    run('motion')
    run('generate')
    run('send')
  }
  const packet = next.packet
  if (packet?.step === 'sending-1E' && at >= packet.at + FLIGHT) run('receiveRelay')
  if (packet?.step === 'at-2L' && at >= packet.at + .7) run('forward')
  if (packet?.step === 'forwarding-2L' && at >= packet.at + FLIGHT) run('receiveGateway')
  if (packet?.step === 'at-3MH' && at >= packet.at + .4) run('process')
  if (packet?.step === 'processed') {
    if (!next.validated) run('validate')
    if (next.sync === 'idle') run('sync')
  }
  if (next.settled && next.report === 'none') {
    run('draft')
    run('submit')
  }
  if (next.sensorInCloud && next.report === 'submitted') {
    if (next.verification === 'Reported') run('review')
    if (!next.correlated) run('correlate')
    if (next.verification === 'Under review') run('corroborate')
    if (drive.gates.includes('junction') && next.verification === 'Corroborated') {
      run('confirm')
      run('alert')
    }
  }
  if (next.verification === 'Confirmed closure' && next.routeAt === null) run('planRoute')
  if (drive.route === 'bypass' && next.turnAt === null) {
    run('driveRoute')
    if (next.turnAt !== null) next = { ...next, turnAt: at }
  }
  return next
}
