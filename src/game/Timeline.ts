import { advanceScenario, applyCommand, initialScenario, type Command, type Focus, type Scenario } from './Scenario'

export const CUES = {
  intro: 0, drive: 6, lookout: 13, rockfall: 22, blocked: 33, approach: 35, detection: 43, processing: 55,
  radio: 61, relay: 67, forward: 72, gateway: 78, gatewayWork: 83, cloud: 92, community: 101,
  submit: 110, review: 119, corroborated: 125, confirmed: 131, alert: 135,
  diversion: 141, turn: 145, offline: 153, restored: 162, production: 167, overview: 177, end: 188,
} as const

export const DURATION = CUES.end

type Stage = {
  from: number
  chapter: number
  title: string
  description: string
  focus: Focus
  tone?: 'amber' | 'red' | 'blue'
}

export const STAGES: readonly Stage[] = [
  { from: CUES.intro, chapter: 1, title: 'Enter the mountains', description: 'The survey vehicle descends into the Himalayan ridge sector.', focus: 'world' },
  { from: CUES.drive, chapter: 1, title: 'Follow the ridge road', description: 'The survey SUV follows the existing mountain route toward an exposed road cut.', focus: 'vehicle' },
  { from: CUES.lookout, chapter: 2, title: 'The distant slope', description: 'As the SUV climbs, trace the exposed slope above the far bend and the NODE-01 installation beside the junction.', focus: 'rockfall' },
  { from: CUES.rockfall, chapter: 3, title: 'Landslide on the far slope', description: 'A tremor loosens the face. Large slabs and loose debris slide down the chute as dust spreads above the distant road.', focus: 'rockfall', tone: 'red' },
  { from: CUES.blocked, chapter: 3, title: 'Landslide debris blocks the road', description: 'Debris crosses both lanes. The survey vehicle slows upstream of the obstruction.', focus: 'rockfall', tone: 'red' },
  { from: CUES.approach, chapter: 4, title: 'From the slope to NODE-01', description: 'The camera follows the affected road toward the monitoring installation as the ground vibration reaches its sensors.', focus: 'NODE-01' },
  { from: CUES.detection, chapter: 4, title: 'NODE-01 samples the movement', description: 'The SW-420 registers a digital vibration trigger. The MPU6050 observes acceleration and angular velocity. Moisture and temperature are separate inputs.', focus: 'NODE-01', tone: 'amber' },
  { from: CUES.processing, chapter: 4, title: 'NODE-01 builds the event packet', description: 'ESP32-C3 SuperMini combines the observations and passes the warning packet to the separate LoRa transceiver.', focus: 'NODE-01' },
  { from: CUES.radio, chapter: 5, title: 'LoRa transmission from NODE-01', description: 'The first simulated LoRa RF hop carries the packet to field relay NODE-02.', focus: 'packet', tone: 'blue' },
  { from: CUES.relay, chapter: 5, title: 'NODE-02 checks and relays', description: 'NODE-02 checks packet structure. Its custom forwarding logic preserves origin and sequence, adds a hop, and decrements TTL.', focus: 'NODE-02', tone: 'blue' },
  { from: CUES.forward, chapter: 5, title: 'NODE-02 forwards to GW-01', description: 'The second LoRa hop carries the same event to headquarters.', focus: 'packet', tone: 'blue' },
  { from: CUES.gateway, chapter: 6, title: 'GW-01 receives the packet', description: 'A separate LoRa receiver passes the packet to the ASUS Tinker Board for validation.', focus: 'GW-01' },
  { from: CUES.gatewayWork, chapter: 6, title: 'Tinker Board processing', description: 'The gateway validates sequence and origin, checks for duplicates, decodes the payload, and prepares a cloud record.', focus: 'GW-01' },
  { from: CUES.cloud, chapter: 7, title: 'Supabase synchronization', description: 'The simulated backend records the NODE-01 event as reported, awaiting review.', focus: 'cloud' },
  { from: CUES.community, chapter: 8, title: 'A witness opens PahaadSaathi', description: 'At Ridge Hamlet, a resident documents the blocked road using the mobile app. Community reporting extends observation into populated areas.', focus: 'community' },
  { from: CUES.submit, chapter: 8, title: 'Community report submitted', description: 'The app sends a synthetic location, time, description, and illustrative photo to Supabase.', focus: 'community' },
  { from: CUES.submit + 5, chapter: 8, title: 'Community evidence reaches Supabase', description: 'The simulated witness report and NODE-01 event now share the same road-cut location in the backend.', focus: 'cloud' },
  { from: CUES.review, chapter: 9, title: 'Hazard under review', description: 'A moderator associates the nearby machine event and witness report from the same road cut.', focus: 'cloud', tone: 'amber' },
  { from: CUES.corroborated, chapter: 9, title: 'Multi-source corroboration', description: 'The two observations support the investigation. An authorized field check is required to confirm closure.', focus: 'cloud', tone: 'amber' },
  { from: CUES.confirmed, chapter: 9, title: 'Confirmed road closure', description: 'The simulated authority confirms that debris blocks both lanes. The marked section is closed.', focus: 'rockfall', tone: 'red' },
  { from: CUES.alert, chapter: 9, title: 'Closure alert delivered', description: 'PahaadSaathi shows the confirmed road closure and the blocked segment on the hazard map.', focus: 'community', tone: 'red' },
  { from: CUES.diversion, chapter: 10, title: 'Alternate route available', description: 'The predesigned 3D bypass lights up. Its safety is unverified and the result is simulated.', focus: 'vehicle', tone: 'blue' },
  { from: CUES.turn, chapter: 10, title: 'Route updated', description: 'The SUV follows the marked bypass, avoiding the illustrated landslide zone.', focus: 'vehicle', tone: 'blue' },
  { from: CUES.offline, chapter: 11, title: 'Internet offline · local LoRa active', description: 'A simulated diagnostic travels through NODE-01, NODE-02, and GW-01. The demo queue waits for internet access.', focus: 'GW-01', tone: 'amber' },
  { from: CUES.restored, chapter: 11, title: 'Internet restored', description: 'GW-01 resumes synchronization and Supabase receives the pending diagnostic in the simulation.', focus: 'cloud' },
  { from: CUES.production, chapter: 12, title: 'Real-world deployment', description: 'A proposed regional LoRa network separates site instrumentation, coverage relays, gateways, and community reporting.', focus: 'production', tone: 'blue' },
  { from: CUES.overview, chapter: 12, title: 'From detection to decision', description: 'Physical sensing and community reports inform verification, alerts, and route decisions.', focus: 'world' },
]

export const CHAPTERS = [
  [CUES.intro, 'Mountain environment'], [CUES.lookout, 'Distant slope'], [CUES.rockfall, 'Distant landslide'],
  [CUES.detection, 'Sensor detection'], [CUES.radio, 'LoRa network'], [CUES.gateway, 'Gateway processing'],
  [CUES.cloud, 'Supabase'], [CUES.community, 'Community report'], [CUES.review, 'Verification'],
  [CUES.diversion, 'Alternate route'], [CUES.offline, 'Offline mode'], [CUES.production, 'Production architecture'],
] as const

export const AUTO_COMMANDS: readonly (readonly [number, Command])[] = [
  [CUES.rockfall, 'rockfall'], [CUES.detection, 'vibration'], [CUES.detection + 2, 'motion'],
  [CUES.processing, 'generate'], [CUES.radio, 'send'], [CUES.relay, 'receiveRelay'], [CUES.forward, 'forward'],
  [CUES.gateway, 'receiveGateway'], [CUES.gatewayWork, 'process'], [CUES.cloud, 'sync'],
  [CUES.community, 'app'], [CUES.community + 4, 'draft'], [CUES.submit, 'submit'],
  [CUES.review, 'review'], [CUES.review + 2, 'correlate'], [CUES.corroborated, 'corroborate'],
  [CUES.corroborated + 2, 'validate'], [CUES.confirmed, 'confirm'], [CUES.alert, 'alert'],
  [CUES.diversion, 'planRoute'], [CUES.turn, 'driveRoute'], [CUES.offline, 'offline'],
  [CUES.restored, 'online'], [CUES.production, 'production'], [CUES.overview, 'prototype'],
]

export function applyTimeline(s: Scenario, from: number, through: number) {
  let next = s
  for (const [at, command] of AUTO_COMMANDS) {
    if (at > through) break
    if (at > from) next = applyCommand(advanceScenario(next, at), command, at)
  }
  return advanceScenario(next, through)
}

export const scenarioAt = (time: number) => applyTimeline(initialScenario(), -1, time)

export function cueIndex(timeline: readonly { from: number }[], time: number) {
  for (let index = timeline.length - 1; index > 0; index--) {
    if (time >= timeline[index].from) return index
  }
  return 0
}

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
export const phase = (time: number, from: number, to: number) => clamp01((time - from) / (to - from))
export const smooth = (value: number) => value * value * (3 - 2 * value)
