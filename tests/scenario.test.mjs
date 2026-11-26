import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
after(() => vite.close())
const { applyCommand, advanceScenario, commandIssue, initialScenario, roadIsBlocked } = await vite.ssrLoadModule('/src/game/Scenario.ts')
const { applyTimeline, CUES, DURATION, scenarioAt } = await vite.ssrLoadModule('/src/game/Timeline.ts')
const { fragmentPose, fragments } = await vite.ssrLoadModule('/src/world/rockfall.ts')
const { Vector3 } = await import('three')
const { vehicleAt } = await vite.ssrLoadModule('/src/world/layout.ts')
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
  assert.equal(played.packet.origin, '1E')
  assert.equal(played.packet.sender, '2L')
  assert.equal(played.packet.hop, 1)
  assert.equal(played.packet.ttl, 7)
  assert.equal(played.turnAt, CUES.turn)
  assert.equal(played.architecture, 'prototype')
})

test('Debris persists, the SUV stays at the junction, and reset reopens the road', () => {
  const fall = issue(initialScenario(), 'rockfall', 30)
  assert.equal(roadIsBlocked(advanceScenario(fall, 39)), false)
  const blocked = advanceScenario(fall, 90)
  assert.equal(roadIsBlocked(blocked), true)
  assert.equal(advanceScenario(blocked, 200).rockAt, 30)
  const stationary = vehicleAt(50)
  const diverted = vehicleAt(53, 53)
  assert.ok(stationary.road.getPointAt(stationary.u).distanceTo(diverted.road.getPointAt(diverted.u)) < .001)
  assert.equal(roadIsBlocked(issue(blocked, 'resetRockfall', 91)), false)
})

test('Confirmation requires both sources, review, metadata validation, and field blockage', () => {
  assert.ok(commandIssue(scenarioAt(CUES.cloud), 'confirm', CUES.cloud))
  assert.equal(scenarioAt(CUES.review).verification, 'Under review')
  assert.equal(scenarioAt(CUES.corroborated).verification, 'Corroborated')
  assert.ok(commandIssue(scenarioAt(CUES.corroborated), 'confirm', CUES.corroborated))
  assert.equal(scenarioAt(CUES.confirmed).verification, 'Confirmed closure')
  const rejected = issue(scenarioAt(CUES.review), 'reject', CUES.review + .1)
  assert.equal(rejected.verification, 'Rejected')
  assert.equal(roadIsBlocked(rejected), true)
  const resolved = issue(scenarioAt(CUES.confirmed), 'resolve', CUES.confirmed + .1)
  assert.equal(resolved.verification, 'Resolved')
  assert.equal(roadIsBlocked(resolved), false)
})

test('The diagnostic is received offline and does not create a fake 1E event', () => {
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
  assert.deepEqual(state.seen, ['1E/00421'])
  assert.equal(state.sensorInCloud, true)
})

test('The in-memory demo queue resumes an interrupted sensor upload cleanly', () => {
  const syncing = scenarioAt(CUES.cloud)
  assert.equal(syncing.writingSensor, true)
  const interrupted = issue(syncing, 'offline', CUES.cloud + 1)
  assert.equal(interrupted.pendingSensor, true)
  assert.equal(interrupted.writingSensor, false)
  const restored = issue(interrupted, 'online', CUES.cloud + 2)
  assert.equal(restored.writingSensor, true)
  assert.equal(advanceScenario(restored, CUES.cloud + 12).sensorInCloud, true)
})

test('An in-flight retry restarts the same queued payload', () => {
  const at = CUES.cloud + 1
  const retried = issue(scenarioAt(CUES.cloud), 'retry', at)
  assert.equal(retried.syncAt, at)
  assert.equal(retried.writingSensor, true)
  assert.equal(advanceScenario(retried, at + 4).sensorInCloud, true)
})

test('An unrelated community category cannot corroborate a road-cut rockfall', () => {
  const reviewed = scenarioAt(CUES.review)
  const unrelated = { ...reviewed, reportCategory: 'Flooding' }
  assert.ok(commandIssue(unrelated, 'correlate', CUES.review))
  assert.equal(commandIssue(reviewed, 'correlate', CUES.review), undefined)
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


test('A parked player can wait indefinitely without starting the rockfall or creating a packet', () => {
  const parked = newDrive()
  const still = stepDrive(parked, { throttle: 0, steer: 0, brake: false }, false, false, 1 / 60)
  assert.deepEqual(still, parked)
  assert.deepEqual(driveIncident(initialScenario(), still, 10000), initialScenario())
})

test('The SUV crosses the physical boxes in order, stops at the barrier and can steer onto the bypass', () => {
  let car = newDrive()
  let scenario = initialScenario()
  let time = 0
  function run(duration, steer = 0, throttle = 1, brake = false) {
    for (let i = 0; i < duration * 60; i++) {
      time += 1 / 60
      car = stepDrive(car, { throttle, steer, brake }, scenario.rockAt !== null, scenario.routeAt !== null, 1 / 60)
      scenario = driveIncident(scenario, car, time)
    }
  }
  run(18)
  assert.deepEqual(car.gates, ['rockfall', 'sensors', 'junction'])
  assert.equal(car.speed, 0)
  assert.equal(car.route, 'ridge')
  assert.ok(drivePosition(car).distanceTo(ROADBLOCK.point) > 3)
  assert.equal(scenario.routeAt, null)
  run(23)
  assert.equal(scenario.verification, 'Confirmed closure')
  assert.notEqual(scenario.routeAt, null)
  assert.equal(car.route, 'ridge')
  run(10, -1)
  assert.equal(car.route, 'bypass')
  assert.deepEqual(car.gates, ['rockfall', 'sensors', 'junction', 'finish'])
  assert.equal(car.speed, 0)
  assert.equal(scenario.log.filter(({ text }) => text.includes('TREMOR')).length, 1)
  assert.equal(scenario.log.filter(({ text }) => text.includes('ROUTE UPDATED')).length, 1)
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
