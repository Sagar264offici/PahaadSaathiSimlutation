export type Focus = 'world' | 'vehicle' | 'rockfall' | 'NODE-01' | 'NODE-02' | 'GW-01' | 'packet' | 'cloud' | 'community' | 'production' | 'route'
export type Verification = 'Normal' | 'Reported' | 'Under review' | 'Corroborated' | 'Confirmed closure' | 'Resolved' | 'Rejected'
type PacketStep = 'ready' | 'sending-NODE-01' | 'at-NODE-02' | 'forwarding-NODE-02' | 'at-GW-01' | 'processing' | 'processed'
export type Command = 'rockfall' | 'resetRockfall' | 'block' | 'vibration' | 'motion' | 'generate' |
  'send' | 'receiveRelay' | 'forward' | 'receiveGateway' | 'process' | 'validate' | 'sync' |
  'app' | 'draft' | 'submit' | 'correlate' | 'acknowledge' | 'review' | 'corroborate' | 'fieldCheck' | 'confirmHazard' |
  'requestEvidence' | 'confirm' | 'reject' | 'rejectReport' | 'resolve' | 'reopen' | 'nodeOutage' | 'nodeRestore' |
  'planRoute' | 'driveRoute' | 'offline' | 'online' | 'retry' | 'prototype' | 'production' | 'alert'

export const ROCK_SETTLES = 8.75
export const FLIGHT = 1.45
export const GATEWAY_WORK = 1.15
export const CLOUD_WORK = .85
export const COMMUNITY_FLIGHT = 1.55
export const REPORT_ID = 'CR-008'
export const REPORT_CATEGORIES = ['Rockfall', 'Landslide', 'Road blockage', 'Fresh cracks', 'Flooding', 'Fallen tree', 'Damaged road', 'Other dangerous condition'] as const
export type ReportCategory = typeof REPORT_CATEGORIES[number]
export const EVENT_SEQUENCE = 'PS-001'
export const OBSERVATION = { zone: 'RIDGE-CUT 07', gps: '30.3274° N, 79.6128° E', category: 'Landslide', description: 'Slope debris is blocking both lanes.' } as const
const sensorLocation = { latitude: 30.3275, longitude: 79.6126, zone: OBSERVATION.zone }
const reportLocation = { latitude: 30.3274, longitude: 79.6128, zone: OBSERVATION.zone }
const relativeDistance = Math.hypot(
  (sensorLocation.latitude - reportLocation.latitude) * 111320,
  (sensorLocation.longitude - reportLocation.longitude) * 111320 * Math.cos(sensorLocation.latitude * Math.PI / 180),
)

function validPacket(packet: Pick<Packet, 'sequence' | 'hop' | 'ttl'> & { origin: string; type: string; sender: string }, hop: 0 | 1) {
  return packet.type === 'LANDSLIDE WARNING' && packet.origin === 'NODE-01' && /^PS-\d{3}$/.test(packet.sequence) &&
    packet.hop === hop && packet.ttl === 8 - hop && packet.sender === (hop === 0 ? 'NODE-01' : 'NODE-02')
}

export function inspectGatewayPacket(packet: Parameters<typeof validPacket>[0] & { createdAt: number } | null,
  seen: readonly string[], at: number) {
  if (!packet) return 'Communication lost'
  if (packet.origin !== 'NODE-01') return 'Unknown node'
  if (!validPacket(packet, 1) || !Number.isFinite(packet.createdAt) || packet.createdAt > at) return 'Invalid packet'
  if (seen.includes(packet.origin + '/' + packet.sequence)) return 'Duplicate packet'
  if (at - packet.createdAt > 15) return 'Delayed packet'
  return 'Valid packet'
}

function observationsMatch(s: Scenario) {
  return s.packet !== null && s.observedAt !== null && s.reportAt !== null && s.reportAt >= s.observedAt &&
    (['Landslide', 'Rockfall', 'Road blockage'] as ReportCategory[]).includes(s.reportCategory) && sensorLocation.zone === reportLocation.zone &&
    relativeDistance < 50 && Math.abs(s.packet.createdAt - s.observedAt) <= 1800
}

type Packet = {
  type: 'LANDSLIDE WARNING'
  origin: 'NODE-01'
  sender: 'NODE-01' | 'NODE-02'
  sequence: string
  hop: number
  ttl: number
  step: PacketStep
  at: number
  createdAt: number
}
type Entry = { at: number; text: string }
type Sync = 'idle' | 'pending' | 'syncing' | 'complete'

export type Scenario = {
  rockAt: number | null
  settled: boolean
  barrier: boolean
  vibrationAt: number | null
  motion: boolean
  packet: Packet | null
  internet: boolean
  sync: Sync
  syncAt: number | null
  sensorInCloud: boolean
  pendingSensor: boolean
  pendingProbe: boolean
  writingSensor: boolean
  writingProbe: boolean
  probeAt: number | null
  probeReceived: boolean
  seen: string[]
  duplicate: 'Unchecked' | 'Passed' | 'Suppressed'
  gatewayReceipt: ReturnType<typeof inspectGatewayPacket> | null
  report: 'none' | 'open' | 'draft' | 'sending' | 'submitted'
  reportRejected: boolean
  reportAt: number | null
  observedAt: number | null
  reportCategory: ReportCategory
  reportDescription: string
  correlated: boolean
  validated: boolean
  acknowledgedAt: number | null
  hazardConfirmed: boolean
  fieldChecked: boolean
  evidenceRequested: boolean
  reopened: boolean
  nodeOnline: boolean
  lastTelemetryAt: number | null
  verification: Verification
  routeAt: number | null
  turnAt: number | null
  architecture: 'prototype' | 'production'
  alert: boolean
  log: Entry[]
}

export function initialScenario(): Scenario {
  return {
    rockAt: null, settled: false, barrier: false, vibrationAt: null, motion: false, packet: null,
    internet: true, sync: 'idle', syncAt: null, sensorInCloud: false, pendingSensor: false, pendingProbe: false,
    writingSensor: false, writingProbe: false, probeAt: null, probeReceived: false,
    seen: [], duplicate: 'Unchecked', gatewayReceipt: null, report: 'none', reportRejected: false, reportAt: null, observedAt: null,
    reportCategory: OBSERVATION.category, reportDescription: OBSERVATION.description, correlated: false, validated: false,
    acknowledgedAt: null, hazardConfirmed: false, fieldChecked: false, evidenceRequested: false, reopened: false,
    nodeOnline: true, lastTelemetryAt: null,
    verification: 'Normal', routeAt: null, turnAt: null, architecture: 'prototype', alert: false, log: [],
  }
}

const logged = (s: Scenario, at: number, text: string, changes: Partial<Scenario> = {}): Scenario => ({
  ...s, ...changes, log: [...s.log, { at, text }],
})

export const roadIsBlocked = (s: Scenario) => s.settled || s.barrier || s.verification === 'Confirmed closure'
export const preliminaryAlert = (s: Scenario) => s.sensorInCloud && !s.reopened && s.verification !== 'Rejected' && s.verification !== 'Resolved'

function syncNow(s: Scenario, t: number) {
  if (s.sync === 'syncing' || (!s.pendingSensor && !s.pendingProbe)) return s
  return s.internet
    ? logged(s, t, 'SIMULATED SYNC STARTED', {
      sync: 'syncing', syncAt: t, writingSensor: s.pendingSensor, writingProbe: s.pendingProbe,
      pendingSensor: false, pendingProbe: false,
    })
    : logged(s, t, 'CLOUD SYNC PENDING · DEMO QUEUE', { sync: 'pending', syncAt: null })
}

function settleAt(s: Scenario, now: number) {
  let next = s
  // Resolve in chronological order so large frame steps and chapter seeks yield the same log.
  for (;;) {
    const rock = !next.settled && next.rockAt !== null ? next.rockAt + ROCK_SETTLES : Infinity
    const packet = next.packet?.step === 'processing' ? next.packet.at + GATEWAY_WORK : Infinity
    const cloud = next.sync === 'syncing' && next.syncAt !== null ? next.syncAt + CLOUD_WORK : Infinity
    const phone = next.report === 'sending' && next.reportAt !== null && next.internet ? next.reportAt + COMMUNITY_FLIGHT : Infinity
    const probe = next.probeAt !== null && !next.probeReceived ? next.probeAt + 8 : Infinity
    const at = Math.min(rock, packet, cloud, phone, probe)
    if (at > now) return next
    if (at === rock) next = logged(next, at, 'LANDSLIDE DEBRIS · BOTH LANES BLOCKED', { settled: true })
    else if (at === packet && next.packet) {
      const key = next.packet.origin + '/' + next.packet.sequence
      const duplicate = next.seen.includes(key)
      next = logged(next, at, duplicate ? 'GW-01 SUPPRESSED DUPLICATE PACKET' : 'GW-01 VALIDATED ORIGIN AND SEQUENCE · GATEWAY PROCESSING COMPLETE', {
        packet: { ...next.packet, step: 'processed', at },
        duplicate: duplicate ? 'Suppressed' : 'Passed',
        seen: duplicate ? next.seen : [...next.seen, key],
        pendingSensor: next.pendingSensor || (!duplicate && !next.internet),
        sync: !duplicate && !next.internet ? 'pending' : next.sync,
      })
    } else if (at === cloud) {
      const arrived = next.writingSensor
      next = logged(next, at, 'SUPABASE UPDATED · SIMULATED SYNC COMPLETE', {
        sync: 'complete', syncAt: null, sensorInCloud: next.sensorInCloud || arrived,
        writingSensor: false, writingProbe: false,
        verification: arrived && (next.verification === 'Normal' || next.verification === 'Rejected' && next.reportRejected && !next.sensorInCloud)
          ? 'Reported' : next.verification,
      })
      if (next.pendingSensor || next.pendingProbe) next = syncNow(next, at)
    }
    else if (at === phone) next = logged(next, at, 'SIMULATED COMMUNITY REPORT RECEIVED · ' + REPORT_ID, {
      report: 'submitted', verification: next.verification === 'Normal' ? 'Reported' : next.verification,
    })
    else if (at === probe) {
      next = logged(next, at, 'GW-01 RECEIVED RF DIAGNOSTIC PS-002 · LOCAL LINK ACTIVE', {
        probeReceived: true, pendingProbe: true,
        sync: next.internet ? next.sync : 'pending',
      })
      if (next.internet && next.sync !== 'syncing') next = syncNow(next, at)
    }
  }
}

export const advanceScenario = settleAt

export function commandIssue(s: Scenario, command: Command, now: number): string | undefined {
  const packet = s.packet
  const reviewable = s.verification === 'Reported' || s.verification === 'Under review' || s.verification === 'Corroborated'
  switch (command) {
    case 'rockfall': return s.rockAt !== null ? 'Reset the current rockfall first.' : undefined
    case 'resetRockfall': return s.rockAt === null && !s.barrier && s.verification === 'Normal' && s.packet === null && s.vibrationAt === null && s.report === 'none' && !s.motion ? 'No incident to reset.' : undefined
    case 'block': return roadIsBlocked(s) ? 'The primary road is already blocked.' : undefined
    case 'vibration': return !s.nodeOnline ? 'NODE-01 is offline.' : s.vibrationAt !== null ? 'The digital trigger has already been recorded.' : undefined
    case 'motion': return !s.nodeOnline ? 'NODE-01 is offline.' : s.motion ? 'Motion observation already recorded.' : undefined
    case 'generate': return packet ? 'An event packet already exists.' : s.vibrationAt === null && !s.motion ? 'Record vibration or motion at NODE-01 first.' : undefined
    case 'send': return !s.nodeOnline ? 'NODE-01 is offline.' : !packet || (packet.step !== 'ready' && packet.step !== 'processed') ? 'Generate a packet at NODE-01, or let the current delivery finish.' : undefined
    case 'receiveRelay':
      return packet?.step !== 'sending-NODE-01' ? 'Send the packet from NODE-01 first.' : now < packet.at + FLIGHT ? 'Packet is still in flight to NODE-02.' : !validPacket(packet, 0) ? 'NODE-02 rejected the packet structure.' : undefined
    case 'forward': return packet?.step !== 'at-NODE-02' ? 'Receive and validate the packet at NODE-02 first.' : undefined
    case 'receiveGateway': {
      if (packet?.step !== 'forwarding-NODE-02') return 'Forward the packet from NODE-02 first.'
      if (now < packet.at + FLIGHT) return 'Packet is still in flight to GW-01.'
      const outcome = inspectGatewayPacket(packet, s.seen, now)
      return outcome === 'Unknown node' || outcome === 'Invalid packet' ? 'GW-01 rejected reception · ' + outcome : undefined
    }
    case 'process': return packet?.step !== 'at-GW-01' ? 'Receive the forwarded packet at GW-01 first.' : undefined
    case 'validate': return packet?.step !== 'processed' ? 'Complete gateway processing first.' : s.validated ? 'The evidence metadata has already been reviewed.' : undefined
    case 'sync': return packet?.step !== 'processed' ? 'Complete gateway processing first.' : s.writingSensor || s.sensorInCloud ? 'The NODE-01 record is already synchronizing or in Supabase.' : undefined
    case 'app': return undefined
    case 'draft': return s.report === 'sending' || s.report === 'submitted' ? 'A report is already submitted or in transit.' : undefined
    case 'submit': return s.report !== 'draft' ? 'Create a community report first.' : !s.reportDescription.trim() ? 'Enter a description for the report.' : !s.internet ? 'Restore internet to submit the community report.' : undefined
    case 'correlate': return s.correlated ? 'The nearby observations are already associated.' : !s.sensorInCloud || s.report !== 'submitted' || s.reportRejected ? 'A synced sensor event and active community report are required.' : !reviewable ? 'An active report is required.' : !observationsMatch(s) ? 'The simulated observations must describe a matching hazard nearby and close in time.' : undefined
    case 'acknowledge': return s.acknowledgedAt !== null || !reviewable ? 'An unacknowledged incident is required.' : undefined
    case 'review': return s.verification !== 'Reported' ? 'A reported observation is required.' : undefined
    case 'corroborate': return s.verification !== 'Under review' ? 'Mark the report under review first.' : !s.correlated ? 'Correlate the two evidence sources first.' : undefined
    case 'fieldCheck': return !roadIsBlocked(s) || !reviewable || s.fieldChecked ? 'An active incident and a visible blockage are required.' : undefined
    case 'confirmHazard': return s.hazardConfirmed || !reviewable || s.acknowledgedAt === null || !s.fieldChecked && s.verification !== 'Corroborated' ?
      'Acknowledge the incident and obtain a field check or corroborated evidence first.' : undefined
    case 'requestEvidence': return !reviewable || s.evidenceRequested ? 'An active incident is required.' : undefined
    case 'confirm': return !s.hazardConfirmed || s.verification === 'Confirmed closure' ? 'Confirm the hazard first.' : !roadIsBlocked(s) ? 'Field verification must find a blockage first.' : undefined
    case 'reject': return !reviewable ? 'Only an active unconfirmed report can be rejected.' : undefined
    case 'rejectReport': return s.report !== 'submitted' || s.reportRejected ? 'An active witness submission is required.' : undefined
    case 'resolve': return s.verification !== 'Confirmed closure' ? 'Only a confirmed closure can be resolved.' : undefined
    case 'reopen': return s.verification !== 'Resolved' || s.reopened ? 'Resolve the closure before reopening the road.' : undefined
    case 'nodeOutage': return !s.nodeOnline ? 'NODE-01 is already offline.' : undefined
    case 'nodeRestore': return s.nodeOnline ? 'NODE-01 is already online.' : undefined
    case 'planRoute': return s.routeAt !== null ? 'The simulated bypass is already available.' : !roadIsBlocked(s) ? 'Block the primary road first.' : undefined
    case 'driveRoute': return s.routeAt === null ? 'Generate the alternate route first.' : s.turnAt !== null ? 'The SUV has already been routed onto the bypass.' : undefined
    case 'offline': return !s.internet ? 'The internet is already offline.' : undefined
    case 'online': return s.internet ? 'The internet is already online.' : undefined
    case 'retry': return !s.internet ? 'Restore internet first.' : (!s.pendingSensor && !s.pendingProbe && s.sync !== 'syncing') ? 'There is no pending or active simulated synchronization.' : undefined
    case 'prototype': return s.architecture === 'prototype' ? 'Prototype view is already active.' : undefined
    case 'production': return s.architecture === 'production' ? 'The real-world proposal is already active.' : undefined
    case 'alert': return s.verification !== 'Confirmed closure' ? 'Only an authorized closure sends this simulated alert.' : undefined
  }
}

export function applyCommand(s: Scenario, command: Command, t: number): Scenario {
  const packet = s.packet
  if (commandIssue(s, command, t)) return s
  switch (command) {
    case 'rockfall': return logged(s, t, 'LANDSLIDE INITIATED ON THE DISTANT SLOPE', { rockAt: t, settled: false })
    case 'resetRockfall': return logged(initialScenario(), t, 'EXERCISE INCIDENT RESET · ROAD OPEN', { internet: s.internet, architecture: s.architecture, log: s.log })
    case 'block': return logged(s, t, 'SIMULATED FIELD BARRIER · PRIMARY ROAD BLOCKED', { barrier: true })
    case 'vibration': return logged(s, t, 'NODE-01 · SW-420 DIGITAL TRIGGER ACTIVE', { vibrationAt: t, lastTelemetryAt: t })
    case 'motion': return logged(s, t, 'NODE-01 · MPU6050 ABNORMAL MOTION OBSERVED', { motion: true, lastTelemetryAt: t })
    case 'generate': return logged(s, t, 'NODE-01 · ESP32-C3 GENERATED LANDSLIDE WARNING PS-001', {
      packet: { type: 'LANDSLIDE WARNING', origin: 'NODE-01', sender: 'NODE-01', sequence: EVENT_SEQUENCE, hop: 0, ttl: 8, step: 'ready', at: t, createdAt: t },
    })
    case 'send': return packet ? logged(s, t, 'NODE-01 TRANSMITTING TO NODE-02 OVER LoRa', { packet: { ...packet, sender: 'NODE-01', hop: 0, ttl: 8, step: 'sending-NODE-01', at: t }, duplicate: 'Unchecked' }) : s
    case 'receiveRelay': return packet ? logged(s, t, 'NODE-02 RECEIVED PS-001 · PACKET STRUCTURE VALIDATED', { packet: { ...packet, step: 'at-NODE-02', at: t } }) : s
    case 'forward': return packet && packet.ttl > 0 ? logged(s, t, 'NODE-02 FORWARDED PS-001 · CUSTOM FORWARDING PROTOCOL', { packet: { ...packet, sender: 'NODE-02', hop: packet.hop + 1, ttl: packet.ttl - 1, step: 'forwarding-NODE-02', at: t } }) : s
    case 'receiveGateway': return packet ? logged(s, t, 'GW-01 RECEIVED LoRa PACKET PS-001 · TINKER BOARD INTERFACE', {
      gatewayReceipt: inspectGatewayPacket(packet, s.seen, t), packet: { ...packet, step: 'at-GW-01', at: t },
    }) : s
    case 'process': return packet ? logged(s, t, 'GW-01 GATEWAY PROCESSING STARTED', { packet: { ...packet, step: 'processing', at: t } }) : s
    case 'validate': return logged(s, t, 'GATEWAY EVIDENCE METADATA REVIEWED', { validated: true })
    case 'sync': return syncNow({ ...s, pendingSensor: true }, t)
    case 'retry': return s.sync === 'syncing' ? syncNow(logged(s, t, 'SIMULATED SYNC RETRY REQUESTED', {
      sync: 'pending', syncAt: null, pendingSensor: s.pendingSensor || s.writingSensor,
      pendingProbe: s.pendingProbe || s.writingProbe, writingSensor: false, writingProbe: false,
    }), t) : syncNow(s, t)
    case 'app': return s.report === 'none' ? { ...s, report: 'open' } : s
    case 'draft': return logged(s, t, 'COMMUNITY REPORT DRAFTED · SIMULATED PHOTO ATTACHED', { report: 'draft', observedAt: t })
    case 'submit': return logged(s, t, 'SETTLEMENT REPORT SUBMITTED TO SUPABASE', { report: 'sending', reportAt: t })
    case 'correlate': return logged(s, t, 'NODE-01 AND COMMUNITY OBSERVATIONS MATCHED AT ' + OBSERVATION.zone, { correlated: true })
    case 'acknowledge': return logged(s, t, 'HQ OPERATOR HQ-01 ACKNOWLEDGED THE INCIDENT', { acknowledgedAt: t })
    case 'review': return logged(s, t, 'HQ MODERATOR MOD-01 OPENED HAZARD REVIEW', { verification: 'Under review' })
    case 'corroborate': return logged(s, t, 'HQ MODERATOR MOD-01 CORROBORATED MULTI-SOURCE EVIDENCE', { verification: 'Corroborated' })
    case 'fieldCheck': return logged(s, t, 'FIELD TEAM FIELD-01 REPORTED DEBRIS ACROSS BOTH LANES', { fieldChecked: true })
    case 'confirmHazard': return logged(s, t, 'HQ MODERATOR MOD-01 CONFIRMED THE HAZARD', { hazardConfirmed: true })
    case 'confirm': return logged(s, t, 'ROAD AUTHORITY MOD-01 CONFIRMED ROAD CLOSURE', { verification: 'Confirmed closure' })
    case 'requestEvidence': return logged(s, t, 'HQ MODERATOR MOD-01 REQUESTED MORE EVIDENCE', { evidenceRequested: true })
    case 'reject': return logged(s, t, 'HQ MODERATOR MOD-01 REJECTED THE REPORT', { verification: 'Rejected', alert: false })
    case 'rejectReport': return logged(s, t, 'HQ MODERATOR MOD-01 REJECTED COMMUNITY REPORT ' + REPORT_ID, {
      reportRejected: true,
      correlated: false,
      verification: !s.sensorInCloud && s.verification === 'Reported' ? 'Rejected' : s.verification === 'Corroborated' ? 'Under review' : s.verification,
    })
    case 'resolve': return logged(s, t, 'ROAD AUTHORITY MOD-01 RECORDED CLEARANCE · HAZARD RESOLVED', { verification: 'Resolved', alert: false })
    case 'reopen': return logged(s, t, 'ROAD AUTHORITY MOD-01 REOPENED THE ROAD', {
      reopened: true, rockAt: null, settled: false, barrier: false, routeAt: null, alert: false,
    })
    case 'nodeOutage': return logged(s, t, 'NODE-01 TELEMETRY LOST · HAZARD STATUS UNKNOWN', { nodeOnline: false })
    case 'nodeRestore': return logged(s, t, 'NODE-01 TELEMETRY RESTORED', { nodeOnline: true, lastTelemetryAt: t })
    case 'planRoute': return logged(s, t, 'ILLUSTRATIVE LONG DETOUR AND SAFE RETURN POINT AVAILABLE', { routeAt: t })
    case 'driveRoute': return logged(s, t, 'ROUTE UPDATED · SUV FOLLOWING THE U-TURN ROUTE', { turnAt: t })
    case 'offline': return logged(s, t, 'INTERNET OFFLINE · RF DIAGNOSTIC PS-002 SENT', {
      internet: false, sync: 'pending', syncAt: null,
      pendingSensor: s.pendingSensor || s.writingSensor, pendingProbe: s.pendingProbe || s.writingProbe,
      writingSensor: false, writingProbe: false,
      probeAt: t, probeReceived: false, report: s.report === 'sending' ? 'draft' : s.report,
    })
    case 'online': {
      const online = logged(s, t, 'INTERNET RESTORED', { internet: true })
      return online.pendingSensor || online.pendingProbe ? syncNow(online, t) : { ...online, sync: online.sensorInCloud ? 'complete' : 'idle' }
    }
    case 'prototype': return { ...s, architecture: 'prototype' }
    case 'production': return { ...s, architecture: 'production' }
    case 'alert': return logged(s, t, 'SIMULATED ROAD CLOSURE ALERT DELIVERED', { alert: true })
  }
}
