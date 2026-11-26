import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
after(() => vite.close())
const { applyCommand, advanceScenario, commandIssue, initialScenario, inspectGatewayPacket, preliminaryAlert, roadIsBlocked } = await vite.ssrLoadModule('/src/game/Scenario.ts')
const { applyResponse, applyTimeline, CUES, DURATION, scenarioAt } = await vite.ssrLoadModule('/src/game/Timeline.ts')
const { fragmentPose, fragments } = await vite.ssrLoadModule('/src/world/rockfall.ts')
const { Vector3 } = await import('three')
const { bypass, detourExit, elevationAt, footbridge, junctionU, landslideDistance, lodges, mainRoad, nearestRoad, retraceU, safeReturnPoint, safeReturnU, vehicleAt, witness } = await vite.ssrLoadModule('/src/world/layout.ts')
const { newDrive, stepDrive, driveIncident, drivePosition, ROADBLOCK } = await vite.ssrLoadModule('/src/game/Drive.ts')

function issue(s, command, time) {
  const result = advanceScenario(s, time)
  assert.equal(commandIssue(result, command, time), undefined, command)
  return applyCommand(result, command, time)
}

test('Auto playback and a single timeline seek produce the same ordered state', () => {
  let played = initialScenario()
  for (let t = 0; t < DURATION; t += .25) played = applyTimeline(played, t, t + .25)
  assert.deepEqual(played, scenarioAt(DURATION))
  assert.ok(played.log.every((event, i, log) => !i || event.at >= log[i - 1].at))
  assert.equal(played.log.some(({ text }) => text.includes('SUPPRESSED')), false)
  assert.equal(played.verification, 'Confirmed closure')
  assert.equal(played.report, 'submitted')
  assert.equal(played.sync, 'complete')
  assert.equal(played.packet.origin, 'NODE-01')
  assert.equal(played.packet.sender, 'NODE-02')
  assert.equal(played.packet.hop, 1)
  assert.equal(played.packet.ttl, 7)
  assert.equal(played.turnAt, CUES.turn)
  assert.equal(played.architecture, 'prototype')
})

test('Debris persists, the SUV stays at the junction, and reset reopens the road', () => {
  const fall = issue(initialScenario(), 'rockfall', 30)
  assert.equal(roadIsBlocked(advanceScenario(fall, 37)), false)
  const blocked = advanceScenario(fall, 90)
  assert.equal(roadIsBlocked(blocked), true)
  assert.equal(advanceScenario(blocked, 200).rockAt, 30)
  const stationary = vehicleAt(50)
  const diverted = vehicleAt(53, 53)
  assert.ok(stationary.road.getPointAt(stationary.u).distanceTo(diverted.road.getPointAt(diverted.u)) < .001)
  assert.equal(roadIsBlocked(issue(blocked, 'resetRockfall', 91)), false)
})

test('Acknowledgement, hazard confirmation, closure, and reopening are distinct', () => {
  assert.ok(commandIssue(scenarioAt(CUES.cloud), 'confirm', CUES.cloud))
  assert.equal(scenarioAt(CUES.review).verification, 'Under review')
  assert.equal(scenarioAt(CUES.corroborated).verification, 'Corroborated')
  assert.ok(commandIssue(scenarioAt(CUES.corroborated), 'confirm', CUES.corroborated))
  assert.equal(scenarioAt(CUES.confirmed).verification, 'Confirmed closure')
  const rejected = issue(scenarioAt(CUES.review), 'reject', CUES.review + .1)
  assert.equal(rejected.verification, 'Rejected')
  assert.equal(preliminaryAlert(rejected), false)
  const resolved = issue(scenarioAt(CUES.confirmed), 'resolve', CUES.confirmed + .1)
  assert.equal(resolved.verification, 'Resolved')
  assert.equal(roadIsBlocked(resolved), true)
  const reopened = issue(resolved, 'reopen', CUES.confirmed + .2)
  assert.equal(roadIsBlocked(reopened), false)
  assert.ok(reopened.log.some(({ text }) => text.includes('MOD-01 REOPENED')))
})

test('The diagnostic is received offline and does not create a fake NODE-01 event', () => {
  const offline = issue(initialScenario(), 'offline', 24)
  assert.equal(offline.sync, 'pending')
  const received = advanceScenario(offline, 35)
  assert.equal(received.probeReceived, true)
  assert.equal(received.sensorInCloud, false)
  const online = issue(received, 'online', 35)
  const complete = advanceScenario(online, 40)
  assert.equal(complete.sync, 'complete')
  assert.equal(complete.sensorInCloud, false)
})

test('Retransmission keeps origin and sequence, and the gateway suppresses the duplicate', () => {
  let state = scenarioAt(CUES.cloud + 4)
  for (const [command, time] of [
    ['send', 105], ['receiveRelay', 111], ['forward', 113], ['receiveGateway', 119], ['process', 120],
  ]) state = issue(state, command, time)
  state = advanceScenario(state, 126)
  assert.equal(state.duplicate, 'Suppressed')
  assert.equal(state.gatewayReceipt, 'Duplicate packet')
  assert.deepEqual(state.seen, ['NODE-01/PS-001'])
  assert.equal(state.sensorInCloud, true)
})

test('Gateway distinguishes a delayed frame, malformed data, an unknown sender, and lost communication', () => {
  const packet = scenarioAt(CUES.received).packet
  assert.equal(inspectGatewayPacket(packet, [], CUES.received), 'Valid packet')
  assert.equal(inspectGatewayPacket(packet, [], CUES.received + 30), 'Delayed packet')
  assert.equal(inspectGatewayPacket({ ...packet, ttl: 1 }, [], CUES.received), 'Invalid packet')
  assert.equal(inspectGatewayPacket({ ...packet, origin: 'UNKNOWN' }, [], CUES.received), 'Unknown node')
  assert.equal(inspectGatewayPacket(null, [], CUES.received), 'Communication lost')
})

test('The in-memory demo queue resumes an interrupted sensor upload cleanly', () => {
  const syncing = scenarioAt(CUES.cloud)
  assert.equal(syncing.writingSensor, true)
  const interrupted = issue(syncing, 'offline', CUES.cloud + .3)
  assert.equal(interrupted.pendingSensor, true)
  assert.equal(interrupted.writingSensor, false)
  const restored = issue(interrupted, 'online', CUES.cloud + 2)
  assert.equal(restored.writingSensor, true)
  assert.equal(advanceScenario(restored, CUES.cloud + 12).sensorInCloud, true)
})

test('An in-flight retry restarts the same queued payload', () => {
  const at = CUES.cloud + .35
  const retried = issue(scenarioAt(CUES.cloud), 'retry', at)
  assert.equal(retried.syncAt, at)
  assert.equal(retried.writingSensor, true)
  assert.equal(advanceScenario(retried, at + 4).sensorInCloud, true)
})

test('An unrelated community category cannot corroborate a road-cut rockfall', () => {
  const at = CUES.corroborated - .4
  const reviewed = scenarioAt(at)
  const unrelated = { ...reviewed, reportCategory: 'Flooding' }
  assert.ok(commandIssue(unrelated, 'correlate', at))
  assert.equal(commandIssue(reviewed, 'correlate', at), undefined)
  const rejected = issue(reviewed, 'rejectReport', at)
  assert.equal(rejected.reportRejected, true)
  assert.equal(preliminaryAlert(rejected), true)
  assert.ok(commandIssue(rejected, 'correlate', at))
})

test('Large debris reaches both sides of the road and remains at the same settled pose', () => {
  const majorRocks = fragments.slice(9, 18)
  assert.equal(majorRocks.length, 9)
  for (const rock of majorRocks) {
    const settled = new Vector3()
    const later = new Vector3()
    fragmentPose(rock, 14, settled)
    fragmentPose(rock, 140, later)
    assert.deepEqual(settled.toArray(), later.toArray())
    assert.ok(settled.y > rock.end.y)
    assert.ok(settled.y < rock.start.y)
  }
  const laneRow = majorRocks.slice(0, 3)
  assert.ok(laneRow[0].end.distanceTo(laneRow[2].end) + laneRow[0].size + laneRow[2].size > 6.6)
})

test('Lodge footprints sit on level ground away from roads and the footbridge has both landings', () => {
  const up = new Vector3(0, 1, 0)
  for (const { position, scale, angle } of lodges) {
    for (const x of [-2.62, 0, 2.62]) {
      for (const z of [-2.21, 0, 2.21]) {
        const ground = new Vector3(x * scale, 0, z * scale).applyAxisAngle(up, angle).add(position)
        assert.ok(nearestRoad(ground.x, ground.z).distance > 5.5)
        assert.ok(Math.abs(elevationAt(ground.x, ground.z) - position.y) < .12)
      }
    }
  }
  for (const side of [-1, 1]) {
    assert.ok(Math.abs(elevationAt(footbridge.x + 9.5 * side, footbridge.z) - (footbridge.y - .2)) < .02)
  }
  assert.ok(elevationAt(footbridge.x, footbridge.z) < 3.14)
  assert.ok(witness.distanceTo(lodges[0].position) < 4)
})


test('A parked player can wait indefinitely without starting the rockfall or creating a packet', () => {
  const parked = newDrive()
  const still = stepDrive(parked, { throttle: 0, steer: 0, brake: false }, false, false, 1 / 60)
  assert.deepEqual(still, parked)
  assert.deepEqual(driveIncident(initialScenario(), still, 0, 10000), initialScenario())
})

test('The same distance trigger and remote sensor flow reach HQ and the phone before a report exists', () => {
  const intro = vehicleAt(0)
  const atTrigger = vehicleAt(CUES.rockfall)
  assert.ok(Math.abs((atTrigger.u - intro.u) * mainRoad.getLength() - landslideDistance) < .001)
  const initial = issue(initialScenario(), 'rockfall', 29)
  const warned = applyResponse(initial, 29, 36)
  assert.equal(warned.packet.step, 'processed')
  assert.equal(warned.packet.origin, 'NODE-01')
  assert.equal(preliminaryAlert(warned), true)
  assert.equal(warned.acknowledgedAt, null)
  assert.equal(warned.report, 'none')
  const routed = applyResponse(warned, 36, 39)
  assert.equal(routed.routeAt, 39)
  assert.equal(routed.verification, 'Under review')
  assert.equal(routed.alert, false)
  assert.equal(routed.report, 'none')
  const offline = issue(initialScenario(), 'nodeOutage', 27)
  const missed = applyResponse(issue(offline, 'rockfall', 29), 29, 39)
  assert.equal(missed.sensorInCloud, false)
  assert.equal(missed.packet, null)
  assert.equal(missed.nodeOnline, false)
  assert.equal(missed.routeAt, 39)
})

test('The SUV stops at the barrier, turns back to the verified junction, then takes the long corridor', () => {
  const spawn = newDrive()
  let car = spawn
  let scenario = initialScenario()
  let time = 0
  let triggerDistance
  function run(duration, steer = 0, throttle = 1) {
    for (let i = 0; i < duration * 60; i++) {
      const previous = time
      time += 1 / 60
      car = stepDrive(car, { throttle, steer, brake: false }, scenario.rockAt !== null, scenario.routeAt !== null, 1 / 60)
      scenario = driveIncident(scenario, car, previous, time)
      if (triggerDistance === undefined && scenario.rockAt !== null) triggerDistance = car.distance - spawn.distance
    }
  }
  run(18)
  assert.ok(triggerDistance >= 10 && triggerDistance < 10.3)
  assert.deepEqual(car.gates, ['rockfall', 'junction'])
  assert.equal(car.speed, 0)
  assert.ok(drivePosition(car).distanceTo(ROADBLOCK.point) > 3)
  assert.ok(Math.abs(scenario.routeAt - scenario.rockAt - 10) < .0001)
  car = { ...car, choice: 'safe-return' }
  run(15)
  assert.equal(car.route, 'bypass')
  assert.ok(car.gates.includes('safe-return'))
  assert.ok(drivePosition(car).distanceTo(safeReturnPoint) < .1)
  assert.equal(car.speed, 0)
  car = { ...car, choice: 'detour' }
  run(55)
  assert.deepEqual(car.gates, ['rockfall', 'junction', 'safe-return', 'finish'])
  assert.ok(drivePosition(car).distanceTo(detourExit) < 6)
  assert.equal(car.speed, 0)
  assert.equal(scenario.log.filter(({ text }) => text.includes('LANDSLIDE INITIATED')).length, 1)
  assert.equal(scenario.log.filter(({ text }) => text.includes('ROUTE UPDATED')).length, 1)
  assert.ok(bypass.getLength() > mainRoad.getLength() * 1.5)
  assert.ok(bypass.getTangentAt(retraceU + .02).dot(mainRoad.getTangentAt(junctionU)) < -.75)
  assert.ok(bypass.getPointAt(safeReturnU + .44).x < -135)
})

test('Steering, braking and reverse act independently of the incident', () => {
  let car = newDrive()
  for (let i = 0; i < 60; i++) car = stepDrive(car, { throttle: 1, steer: -1, brake: false }, false, false, 1 / 60)
  assert.ok(car.lane < -0.3)
  assert.ok(car.speed > 5)
  const forward = car.distance
  for (let i = 0; i < 60; i++) car = stepDrive(car, { throttle: 1, steer: 0, brake: true }, false, false, 1 / 60)
  assert.equal(car.speed, 0)
  assert.ok(car.distance > forward)
  const stopped = car.distance
  for (let i = 0; i < 60; i++) car = stepDrive(car, { throttle: -1, steer: 0, brake: false }, false, false, 1 / 60)
  assert.ok(car.speed < 0)
  assert.ok(car.distance < stopped)
  assert.deepEqual(car.gates, [])
})
