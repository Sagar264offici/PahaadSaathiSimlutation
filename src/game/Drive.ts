import { Matrix3, Matrix4, Vector3 } from 'three'
import { OBB } from 'three/addons/math/OBB.js'
import { bypass, junctionU, mainRoad } from '../world/layout'
import { advanceScenario, applyCommand, FLIGHT, type Command, type Focus, type Scenario } from './Scenario'

type Route = 'ridge' | 'bypass'
export type Gate = 'rockfall' | 'sensors' | 'junction' | 'finish'
export type DriveAction = 'station' | 'monitor' | 'track' | 'gateway' | 'evidence' | 'confirm'
export type DriveInput = { throttle: number; brake: boolean; steer: number }
export type DriveState = {
  route: Route
  distance: number
  lane: number
  speed: number
  steering: number
  odometer: number
  gates: readonly Gate[]
  inspectedAt: Readonly<Partial<Record<DriveAction, number>>>
}

const roads = { ridge: mainRoad, bypass }
const lengths = { ridge: mainRoad.getLength(), bypass: bypass.getLength() }
const junction = junctionU * lengths.ridge
export const TOP_SPEED = 19

export function newDrive(): DriveState {
  return { route: 'ridge', distance: lengths.ridge * .045, lane: 0, speed: 0, steering: 0, odometer: 0, gates: [], inspectedAt: {} }
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
  { id: 'rockfall', route: 'ridge', ...roadBox('ridge', .219, 3.35, 3.2) },
  { id: 'sensors', route: 'ridge', ...roadBox('ridge', .449, 3.35, 3.3) },
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

type Mission = {
  number: number
  title: string
  cue: string
  action?: DriveAction
  label?: string
  focus?: Focus
}

export function driveMission(drive: DriveState, scenario: Scenario): Mission {
  const has = (action: DriveAction) => drive.inspectedAt[action] !== undefined
  if (!drive.gates.includes('rockfall')) return { number: 1, title: 'Identify the hazard', cue: 'Drive through the lookout checkpoint and watch the slope across the valley.' }
  if (!has('station')) return {
    number: 2, title: 'Inspect the sensor station', cue: drive.gates.includes('sensors') ? 'Inspect the live sensor inputs at NODE-01.' : 'Follow the road to the NODE-01 checkpoint.',
    ...(drive.gates.includes('sensors') && { action: 'station', label: 'Inspect NODE-01', focus: 'NODE-01' }),
  }
  if (!has('monitor')) return {
    number: 3, title: 'Monitor the LoRa module',
    cue: scenario.packet?.step === 'ready' ? 'The ESP32-C3 has prepared a warning packet. Send it over the separate LoRa module.' : 'Watch the ESP32-C3 process the motion and vibration inputs.',
    ...(scenario.packet?.step === 'ready' && { action: 'monitor', label: 'Transmit warning', focus: 'NODE-01' }),
  }
  if (!has('track')) return { number: 4, title: 'Track the packet', cue: 'Follow the two simulated LoRa hops through NODE-02.', action: 'track', label: 'Track PS-001', focus: 'packet' }
  if (!has('gateway')) {
    const received = scenario.packet?.step === 'at-GW-01' || scenario.packet?.step === 'processing' || scenario.packet?.step === 'processed'
    return { number: 5, title: 'Inspect the gateway', cue: received ? 'GW-01 has the packet. Inspect the receiver and Tinker Board.' : 'Wait for NODE-02 to forward the warning to GW-01.',
      ...(received && { action: 'gateway', label: 'Inspect GW-01', focus: 'GW-01' }),
    }
  }
  if (!has('evidence')) return {
    number: 6, title: 'Verify the hazard',
    cue: scenario.correlated ? 'Compare the field warning and the witness report in Supabase.' : 'Wait for the sensor record and community report to reach Supabase.',
    ...(scenario.correlated && { action: 'evidence', label: 'Compare evidence', focus: 'cloud' }),
  }
  if (!has('confirm')) return {
    number: 6, title: 'Verify the hazard', cue: 'The evidence is corroborated. Confirm the simulated field closure.',
    ...(scenario.verification === 'Corroborated' && { action: 'confirm', label: 'Confirm closure', focus: 'vehicle' }),
  }
  return { number: 7, title: 'Find an alternative route', cue: drive.route === 'bypass' ?
    'Drive along the illustrative bypass to the exit checkpoint.' : 'Return to the SUV and hold left while accelerating at the junction.' }
}

export function driveIncident(scenario: Scenario, drive: DriveState, at: number) {
  let next = advanceScenario(scenario, at)
  const run = (command: Command) => { next = applyCommand(next, command, at) }
  const inspected = drive.inspectedAt
  if (!drive.gates.includes('rockfall')) return next
  if (next.rockAt === null) run('rockfall')
  if (!drive.gates.includes('sensors')) return next

  if (next.vibrationAt === null) run('vibration')
  if (!next.motion && next.vibrationAt !== null && at >= next.vibrationAt + .65) run('motion')
  if (next.motion && next.packet === null && inspected.station !== undefined && at >= inspected.station + 3) run('generate')
  if (next.packet?.step === 'ready' && inspected.monitor !== undefined) run('send')
  const packet = next.packet
  if (packet?.step === 'sending-NODE-01' && at >= packet.at + FLIGHT) run('receiveRelay')
  if (packet?.step === 'at-NODE-02' && at >= packet.at + 1.5) run('forward')
  if (packet?.step === 'forwarding-NODE-02' && at >= packet.at + FLIGHT) run('receiveGateway')
  if (packet?.step === 'at-GW-01' && inspected.gateway !== undefined) run('process')
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
    if (next.verification === 'Under review' && inspected.evidence !== undefined) run('corroborate')
    if (next.verification === 'Corroborated' && inspected.confirm !== undefined) {
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
