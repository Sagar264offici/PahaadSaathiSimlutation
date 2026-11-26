import { advanceScenario, applyCommand, initialScenario, ROCK_SETTLES, type Command, type Focus, type Scenario } from './Scenario'

const onset = 6
const response = {
  detection: .15, motion: .42, processing: .64, radio: .98, relay: 2.48, forward: 2.78,
  gateway: 4.29, gatewayWork: 4.51, validated: 5.72, cloud: 5.87, received: 6.77,
  acknowledge: 7.18, review: 7.66, field: 9.12, diversion: 10,
} as const

export const CUES = {
  intro: 0, drive: 2.6, lookout: 3.5, rockfall: onset,
  detection: onset + response.detection, radio: onset + response.radio,
  approach: onset + 3.4, gateway: onset + response.gateway, cloud: onset + response.cloud,
  received: onset + response.received, acknowledge: onset + response.acknowledge, review: onset + response.review,
  blocked: onset + ROCK_SETTLES, diversion: onset + response.diversion, turn: 22, detourDuration: 36,
  community: 31, draft: 33, submit: 35, corroborated: 38.5, confirmed: 40, alert: 40.4,
  offline: 54, restored: 64, production: 69, overview: 77, end: 86,
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
  { from: CUES.intro, chapter: 1, title: 'Himalayan road safety', description: 'Watch the survey SUV and the exposed slope across the valley.', focus: 'world' },
  { from: CUES.drive, chapter: 1, title: 'The first 10 metres', description: 'The SUV sets off. A distance trigger starts this exercise once per run.', focus: 'vehicle' },
  { from: CUES.rockfall, chapter: 2, title: 'Landslide on the far slope', description: 'The slope shakes, debris falls, and NODE-01 detects abnormal movement.', focus: 'rockfall', tone: 'red' },
  { from: CUES.approach, chapter: 3, title: 'The warning travels by LoRa', description: 'An ESP32-C3 creates PS-001. NODE-02 relays it to the Tinker Board gateway.', focus: 'packet', tone: 'blue' },
  { from: CUES.received, chapter: 4, title: 'Headquarters and app alerted', description: 'Supabase delivers the remote-sensor event to headquarters and the nearby driver.', focus: 'cloud' },
  { from: CUES.review, chapter: 4, title: 'Acknowledged · under review', description: 'An operator has received the alert. The notification remains a preliminary warning.', focus: 'cloud', tone: 'amber' },
  { from: CUES.diversion, chapter: 5, title: 'U-turn and long detour', description: 'The driver turns around, retraces the ridge to the last accessible junction, and takes a different mountain corridor.', focus: 'vehicle', tone: 'blue' },
  { from: CUES.community, chapter: 6, title: 'A witness documents the debris', description: 'The witness opens a separate, illustrated camera report from Ridge Hamlet.', focus: 'community' },
  { from: CUES.submit, chapter: 6, title: 'Community evidence submitted', description: 'The new scene capture is sent with simulated location and time. Headquarters checks whether the two sources match.', focus: 'community' },
  { from: CUES.corroborated, chapter: 6, title: 'Two sources corroborate the hazard', description: 'The moderator compares the road segment and timestamps. A separate authority confirms the closure.', focus: 'cloud', tone: 'amber' },
  { from: CUES.confirmed, chapter: 7, title: 'Road closure confirmed', description: 'Headquarters records the authorized closure. The app updates the preliminary warning to a formal alert.', focus: 'cloud', tone: 'red' },
  { from: CUES.offline, chapter: 8, title: 'Internet offline · local LoRa active', description: 'Gateway buffers a diagnostic locally while cloud synchronization is unavailable.', focus: 'GW-01', tone: 'amber' },
  { from: CUES.restored, chapter: 8, title: 'Cloud synchronization resumes', description: 'The pending diagnostic reaches the cloud after connectivity returns.', focus: 'cloud' },
  { from: CUES.production, chapter: 9, title: 'Regional deployment', description: 'Targeted sensors, relay sites, gateways, and community reporting cover different needs.', focus: 'production', tone: 'blue' },
  { from: CUES.overview, chapter: 9, title: 'From detection to decision', description: 'Detect early, acknowledge fast, and verify before declaring a closure.', focus: 'world' },
]

export const CHAPTERS = [
  [CUES.intro, 'Mountain environment'], [CUES.rockfall, 'Landslide'], [CUES.approach, 'LoRa network'],
  [CUES.received, 'Headquarters and app'], [CUES.diversion, 'Mountain detour'], [CUES.community, 'Community evidence'],
  [CUES.confirmed, 'Authorized closure'], [CUES.offline, 'Offline resilience'], [CUES.production, 'Regional deployment'],
] as const

type Scheduled = readonly [number, Command]

// The same sensor workflow drives both sessions. Community submissions have their own entry point.
const RESPONSE_COMMANDS: readonly Scheduled[] = [
  [response.detection, 'vibration'], [response.motion, 'motion'], [response.processing, 'generate'], [response.radio, 'send'],
  [response.relay, 'receiveRelay'], [response.forward, 'forward'], [response.gateway, 'receiveGateway'],
  [response.gatewayWork, 'process'], [response.validated, 'validate'], [response.cloud, 'sync'],
  [response.acknowledge, 'acknowledge'], [response.review, 'review'], [response.field, 'fieldCheck'], [response.diversion, 'planRoute'],
]

export const AUTO_COMMANDS: readonly Scheduled[] = [
  [CUES.rockfall, 'rockfall'], ...RESPONSE_COMMANDS.map(([at, command]): Scheduled => [onset + at, command]),
  [CUES.turn, 'driveRoute'], [CUES.community, 'app'], [CUES.draft, 'draft'], [CUES.submit, 'submit'],
  [CUES.corroborated - .2, 'correlate'], [CUES.corroborated, 'corroborate'],
  [CUES.confirmed - .4, 'confirmHazard'], [CUES.confirmed, 'confirm'], [CUES.alert, 'alert'],
  [CUES.offline, 'offline'], [CUES.offline + 1, 'nodeOutage'], [CUES.restored, 'online'], [CUES.restored + 1, 'nodeRestore'],
  [CUES.production, 'production'], [CUES.overview, 'prototype'],
]

function applyCommands(s: Scenario, timeline: readonly Scheduled[], start: number, from: number, through: number) {
  let next = s
  for (const [offset, command] of timeline) {
    const at = start + offset
    if (at > through) break
    if (at > from) next = applyCommand(advanceScenario(next, at), command, at)
  }
  return advanceScenario(next, through)
}

export const applyResponse = (s: Scenario, from: number, through: number) =>
  s.rockAt === null ? advanceScenario(s, through) : applyCommands(s, RESPONSE_COMMANDS, s.rockAt, from, through)

export const applyTimeline = (s: Scenario, from: number, through: number) => applyCommands(s, AUTO_COMMANDS, 0, from, through)
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
