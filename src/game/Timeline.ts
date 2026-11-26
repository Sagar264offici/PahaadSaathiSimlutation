import { advanceScenario, applyCommand, initialScenario, type Command, type Focus, type Scenario } from './Scenario'

export const CUES = {
  intro: 0, drive: 6, node: 14, approach: 23, rockfall: 32, blocked: 43, detection: 47, processing: 55,
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
  { from: CUES.node, chapter: 2, title: 'Risk-based deployment', description: '1E monitors a vulnerable road cut. Station placement weighs exposure, vulnerability, monitoring gaps, and RF feasibility.', focus: '1E' },
  { from: CUES.approach, chapter: 2, title: 'Approaching the rock cut', description: 'The monitored section sits beyond the bypass junction. The valley settlement contributes community observations.', focus: 'vehicle' },
  { from: CUES.rockfall, chapter: 3, title: 'Major rockfall', description: 'Small fragments detach first. Boulders follow, striking the cut and spreading across both lanes as the SUV brakes.', focus: 'rockfall', tone: 'red' },
  { from: CUES.blocked, chapter: 3, title: 'Road completely blocked', description: 'The SUV stops before the debris. Both lanes remain obstructed while dust settles.', focus: 'rockfall', tone: 'red' },
  { from: CUES.detection, chapter: 4, title: '1E detects the disturbance', description: 'The SW-420 supplies a digital vibration trigger. The GY-521 MPU-6050 observes abnormal motion.', focus: '1E', tone: 'amber' },
  { from: CUES.processing, chapter: 4, title: '1E builds the event packet', description: 'Arduino UNO R3 combines the observations and hands a candidate event to the HC-12.', focus: '1E' },
  { from: CUES.radio, chapter: 5, title: 'HC-12 transmission from 1E', description: 'The first wireless serial hop carries the packet to field relay 2L.', focus: 'packet', tone: 'blue' },
  { from: CUES.relay, chapter: 5, title: '2L checks and relays', description: '2L checks packet structure. Its custom forwarding logic preserves origin and sequence, adds a hop, and decrements TTL.', focus: '2L', tone: 'blue' },
  { from: CUES.forward, chapter: 5, title: '2L forwards to 3MH', description: 'The second HC-12 hop carries the same event to headquarters.', focus: 'packet', tone: 'blue' },
  { from: CUES.gateway, chapter: 6, title: '3MH receives the packet', description: 'The HC-12 endpoint sends the wireless serial payload over UART to the original ASUS Tinker Board.', focus: '3MH' },
  { from: CUES.gatewayWork, chapter: 6, title: 'Tinker Board processing', description: 'The gateway validates sequence and origin, checks for duplicates, decodes the payload, and prepares a cloud record.', focus: '3MH' },
  { from: CUES.cloud, chapter: 7, title: 'Supabase synchronization', description: 'The simulated backend records the 1E event as reported, awaiting review.', focus: 'cloud' },
  { from: CUES.community, chapter: 8, title: 'A witness opens PahaadSaathi', description: 'At Ridge Hamlet, a resident documents the blocked road using the mobile app. Community reporting extends observation into populated areas.', focus: 'community' },
  { from: CUES.submit, chapter: 8, title: 'Community report submitted', description: 'The app sends a synthetic location, time, description, and illustrative photo to Supabase.', focus: 'community' },
  { from: CUES.submit + 5, chapter: 8, title: 'Community evidence reaches Supabase', description: 'The simulated witness report and 1E event now share the same road-cut location in the backend.', focus: 'cloud' },
  { from: CUES.review, chapter: 9, title: 'Hazard under review', description: 'A moderator associates the nearby machine event and witness report from the same road cut.', focus: 'cloud', tone: 'amber' },
  { from: CUES.corroborated, chapter: 9, title: 'Multi-source corroboration', description: 'The two observations support the investigation. An authorized field check is required to confirm closure.', focus: 'cloud', tone: 'amber' },
  { from: CUES.confirmed, chapter: 9, title: 'Confirmed road closure', description: 'The simulated authority confirms that debris blocks both lanes. The marked section is closed.', focus: 'rockfall', tone: 'red' },
  { from: CUES.alert, chapter: 9, title: 'Closure alert delivered', description: 'PahaadSaathi shows the confirmed road closure and the blocked segment on the hazard map.', focus: 'community', tone: 'red' },
  { from: CUES.diversion, chapter: 10, title: 'Alternate route available', description: 'The predesigned 3D bypass lights up. Its safety is unverified and the result is simulated.', focus: 'vehicle', tone: 'blue' },
  { from: CUES.turn, chapter: 10, title: 'Route updated', description: 'The SUV follows the marked bypass, avoiding the illustrated rockfall zone.', focus: 'vehicle', tone: 'blue' },
  { from: CUES.offline, chapter: 11, title: 'Internet offline · local RF active', description: 'A simulated diagnostic travels through 1E, 2L, and 3MH. The demo queue waits for internet access.', focus: '3MH', tone: 'amber' },
  { from: CUES.restored, chapter: 11, title: 'Internet restored', description: '3MH resumes synchronization and Supabase receives the pending diagnostic in the simulation.', focus: 'cloud' },
  { from: CUES.production, chapter: 12, title: 'Real-world deployment', description: 'A proposed regional LoRa network separates site instrumentation, coverage relays, gateways, and community reporting.', focus: 'production', tone: 'blue' },
  { from: CUES.overview, chapter: 12, title: 'From detection to decision', description: 'Physical sensing and community reports inform verification, alerts, and route decisions.', focus: 'world' },
]

export const CHAPTERS = [
  [CUES.intro, 'Mountain environment'], [CUES.node, 'Risk-based deployment'], [CUES.rockfall, 'Rockfall'],
  [CUES.detection, 'Sensor detection'], [CUES.radio, 'HC-12 network'], [CUES.gateway, 'Gateway processing'],
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
