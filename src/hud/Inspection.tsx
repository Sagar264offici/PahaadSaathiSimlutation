import { Activity, Antenna, ArrowDown, Database, Radio, ShieldCheck, Smartphone } from 'lucide-react'
import { useGame } from '../game/GameEngine'
import { FLIGHT, OBSERVATION, REPORT_ID, roadIsBlocked, type Focus, type Scenario } from '../game/Scenario'
import { logTime } from './Presenter'
import { MiniMap } from './MiniMap'

export const focusLabels: Record<Focus, [title: string, description: string]> = {
  world: ['Ridge sector overview', 'Inspect the mountain road, three prototype nodes, and the nearby settlement.'],
  vehicle: ['Survey vehicle', 'The SUV follows the ridge road and waits at the bypass junction when the primary route is blocked.'],
  rockfall: ['Exposed road cut', 'A failure on this slope can send debris onto both lanes below.'],
  'NODE-01': ['NODE-01 — Slope monitoring station', 'The ESP32-C3 SuperMini processes the SW-420 and MPU6050 inputs, then hands the warning to a separate LoRa transceiver.'],
  'NODE-02': ['NODE-02 — LoRa relay', 'The relay receives the LoRa packet, checks its structure, and forwards it using the simulated routing protocol.'],
  'GW-01': ['GW-01 — Main headquarters', 'The LoRa receiver passes packets to the ASUS Tinker Board for validation and forwarding to Supabase.'],
  packet: ['Simulated LoRa packet', 'The prototype uses two scripted hops with custom firmware behavior and a decrementing TTL.'],
  cloud: ['Supabase and hazard verification', 'The backend associates the NODE-01 observation and the community report. A human moderator reviews the evidence.'],
  community: ['Ridge Hamlet community report', 'A witness uses PahaadSaathi to report the blocked road from the settlement.'],
  production: ['Real-world deployment', 'Proposed Himalayan regional coverage combines targeted sensing and community reporting.'],
  route: ['West valley detour', 'Turn around, retrace the primary road, and leave it at the last accessible junction.'],
}

export function Facts({ data }: { data: readonly (readonly [string, string])[] }) {
  return <dl>{data.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

function PacketInspector({ scenario, now }: { scenario: Scenario; now: number }) {
  const packet = scenario.packet
  if (!packet) return null
  const step = {
    ready: 'READY TO TRANSMIT',
    'sending-NODE-01': now >= packet.at + FLIGHT ? 'AT NODE-02 · AWAITING RECEPTION' : 'TRANSMITTING',
    'at-NODE-02': 'RECEIVED · STRUCTURE VALIDATED',
    'forwarding-NODE-02': now >= packet.at + FLIGHT ? 'AT GW-01 · AWAITING RECEPTION' : 'FORWARDED',
    'at-GW-01': 'PACKET RECEIVED AT GW-01',
    processing: 'GATEWAY PROCESSING',
    processed: 'GATEWAY PROCESSING COMPLETE',
  }[packet.step]
  return <details className="packet-inspector" open>
    <summary><Radio size={14} /> Packet inspector <span>SIMULATED LoRa</span></summary>
    <Facts data={[
      ['Network', 'LoRa'], ['Packet ID', packet.sequence], ['Origin', packet.origin], ['Source', 'Remote sensor station'],
      ...(packet.hop ? [['Forwarder', packet.sender] as const] : []),
      ['Event', packet.type], ['Sensor status', scenario.motion ? 'Abnormal · simulated' : 'Vibration trigger · simulated'],
      ['Timestamp', logTime(packet.createdAt) + ' · simulated'], ['Hop count', String(packet.hop)], ['Packet status', step],
    ]} />
  </details>
}

function GatewaySteps({ scenario, now }: { scenario: Scenario; now: number }) {
  const packet = scenario.packet
  const processing = packet?.step === 'processing'
  const done = packet?.step === 'processed'
  const elapsed = processing ? now - packet.at : 0
  const steps = [
    ['LoRa packet received', Boolean(packet?.sender === 'NODE-02' && (packet.step === 'at-GW-01' || processing || done))],
    ['Packet validation', done || elapsed >= 1],
    ['Duplicate check', done || elapsed >= 2],
    ['Data decoding', done || elapsed >= 3],
    ['Hazard processing', done || elapsed >= 5],
    ['Supabase synchronization', scenario.sync === 'complete'],
  ] as const
  return <div className="inspection-extra">
    <span className="eyebrow">SIMULATED GATEWAY PROCESSING</span>
    <ol className="gateway-steps">{steps.map(([label, completed]) => <li key={label} data-done={completed}>{label}</li>)}</ol>
    <Facts data={[
      ['Receiver interface', 'LoRa module → Tinker Board'],
      ['Packet validation', steps[1][1] ? 'Passed' : 'Awaiting packet processing'],
      ['Gateway receipt', scenario.gatewayReceipt ?? 'Waiting for a packet'],
      ['Duplicate check', done ? scenario.duplicate : steps[2][1] ? 'Checking origin and sequence' : 'Standby'],
      ['Gateway processing', done ? 'Complete' : processing ? 'Started' : 'Standby'],
      ['Cloud sync', scenario.sync], ['RF diagnostic', scenario.probeReceived ? 'PS-002 received locally' : scenario.probeAt === null ? 'Standby' : 'PS-002 in transit'], ['Internet', scenario.internet ? 'Online' : 'Offline'],
    ]} />
  </div>
}

function MotionReadings({ age }: { age: number }) {
  const amplitude = Math.max(.24, Math.exp(-Math.max(0, age - 3) * .14))
  const pulse = age * 1.67
  const acceleration = [
    (.34 + .08 * Math.sin(pulse)) * amplitude,
    (.68 + .13 * Math.sin(pulse + 1.2)) * amplitude,
    1 + (.29 + .08 * Math.cos(pulse)) * amplitude,
  ]
  const angularVelocity = [7.4, 12.3, 4.1].map((axis, i) =>
    (axis + 1.9 * Math.sin(pulse + i)) * amplitude)
  return <>
    <div><dt>Accel X / Y / Z</dt><dd>{acceleration.map((axis) => axis.toFixed(2)).join(' / ')} g</dd></div>
    <div><dt>Gyro X / Y / Z</dt><dd>{angularVelocity.map((axis) => axis.toFixed(1)).join(' / ')} °/s</dd></div>
  </>
}

export function Inspection({ focus }: { focus: Focus }) {
  const scenario = useGame((state) => state.scenario)
  const second = useGame((state) => state.second)
  if (focus === 'route') return <MiniMap inline navigation />
  if (focus === 'production') return <div className="deployment-copy">
    <div className="eyebrow"><Antenna size={14} /> PRODUCTION PROPOSAL · LoRa</div>
    <Facts data={[
      ['Sensor station', 'Select instruments for the failure mechanism and professional site assessment.'],
      ['Relay station', 'Place by terrain, line of sight, link budget, coverage, and maintenance access.'],
      ['Gateway', 'Internet and cloud uplink. LoRa multi-hop requires a designed network protocol.'],
      ['Community', 'Mobile reporting at settlements.'],
    ]} />
    <details className="packet-inspector">
      <summary>Proposed instrumentation</summary>
      <p>Inclinometers and tilt sensors for slope movement. Piezometers and rain gauges for water conditions. Extensometers for crack displacement. Vibration or seismic instruments where justified.</p>
    </details>
  </div>
  if (focus === 'NODE-01' && !scenario.nodeOnline) return <Facts data={[
    ['NODE-01', 'Offline · communication lost'], ['Sensor data', 'Unavailable · current hazard status unknown'],
    ['Last telemetry', scenario.lastTelemetryAt === null ? 'No sample' : logTime(scenario.lastTelemetryAt)],
  ]} />
  if (focus === 'NODE-01') return <>
    <div className="inspection-extra"><span className="eyebrow"><Activity size={14} /> SIMULATED SENSOR DATA</span>
      <dl>
        <div><dt>Sensor station</dt><dd>NODE-01 · Active</dd></div>
        <div><dt>SW-420</dt><dd>{scenario.vibrationAt === null ? 'Digital trigger idle' : 'Vibration triggered · digital'}</dd></div>
        <div><dt>MPU6050</dt><dd>{scenario.motion ? 'Abnormal motion observed' : 'Acceleration / angular velocity'}</dd></div>
        {scenario.motion && <MotionReadings age={Math.max(0, second - (scenario.vibrationAt ?? second))} />}
        <div><dt>ESP32-C3 SuperMini</dt><dd>{scenario.packet ? 'Warning generated' : scenario.motion ? 'Processing sensor inputs' : 'Monitoring'}</dd></div>
        <div><dt>Soil moisture</dt><dd>Elevated · independent input</dd></div>
        <div><dt>Bimetallic switch</dt><dd>Open · independent input</dd></div>
      </dl>
    </div>
    {scenario.packet && <PacketInspector scenario={scenario} now={second} />}
  </>
  if (focus === 'NODE-02' || focus === 'packet') return <>
    <PacketInspector scenario={scenario} now={second} />
    {focus === 'NODE-02' && !scenario.packet && <Facts data={[
      ['Node', 'NODE-02 · LoRa relay'], ['Controller', 'ESP32-C3 SuperMini'], ['Forwarding', 'Custom routing protocol'],
    ]} />}
  </>
  if (focus === 'GW-01') return <GatewaySteps scenario={scenario} now={second} />
  if (focus === 'cloud') return <div className="inspection-extra">
    <span className="eyebrow"><Database size={14} /> SIMULATED SUPABASE RECORDS</span>
    <Facts data={[
      ['Machine evidence', scenario.sensorInCloud ? 'NODE-01 · event PS-001' : 'Awaiting synchronized event'],
      ['Community evidence', scenario.report === 'submitted' ? 'Ridge Hamlet · ' + REPORT_ID : 'Awaiting witness report'],
      ['Correlation', scenario.correlated ? 'Same road cut · ' + OBSERVATION.zone : 'Awaiting both sources'],
      ['Verification', scenario.verification],
      ['Cloud sync', scenario.sync === 'pending' ? 'Pending · demo queue' : scenario.sync],
    ]} />
    {scenario.correlated && <span className="corroborated"><ShieldCheck size={15} />{scenario.verification === 'Corroborated' || scenario.verification === 'Confirmed closure' ? 'MULTI-SOURCE CORROBORATION' : 'TWO OBSERVATIONS ASSOCIATED'}</span>}
  </div>
  if (focus === 'community') {
    const report = scenario.report
    return <div className="inspection-extra">
      <span className="eyebrow"><Smartphone size={14} /> SIMULATED COMMUNITY REPORT</span>
      <Facts data={report === 'draft' || report === 'sending' || report === 'submitted' ? [
        ['Hazard', scenario.reportCategory], ['Description', scenario.reportDescription],
        ['GPS', OBSERVATION.gps + ' · simulated'], ['Time', logTime(scenario.observedAt ?? 0) + ' · simulated'],
        ['Photo', 'Attached · illustration'], ['Status', scenario.alert ? 'Closure alert delivered' : report],
      ] : [['App', 'PahaadSaathi Android concept'], ['Report', 'Ready to draft']]} />
    </div>
  }
  if (focus === 'vehicle') return <Facts data={[
    ['Primary route', roadIsBlocked(scenario) ? 'Blocked' : 'Open'],
    ['Alternate route', scenario.routeAt !== null ? 'Available · simulated' : 'Awaiting a blockage'],
    ...(scenario.turnAt !== null ? [['Vehicle', 'Route updated · avoiding the rockfall zone']] : []) as [string, string][],
  ]} />
  if (focus === 'world') return <div className="inspection-extra">
    <Facts data={[
      ['Field architecture', 'NODE-01 sensing → NODE-02 relay → GW-01'],
      ['Network', 'Simulated LoRa links with custom forwarding'],
    ]} />
  </div>
  return scenario.settled || scenario.barrier ? <Facts data={[
    ['Road', scenario.settled ? 'Both lanes obstructed' : 'Field barrier active'],
    ['Verification', scenario.verification === 'Normal' ? 'Awaiting report' : scenario.verification],
  ]} /> : null
}

export function FusionFlow() {
  return <div className="fusion-flow" aria-label="Hybrid PahaadSaathi architecture">
    <div className="fusion-sources">
      <span><Radio size={15} /> NODE-01 → NODE-02 → GW-01 <small>Field network · LoRa</small></span>
      <span><Smartphone size={15} /> Community reports <small>Populated areas</small></span>
    </div>
    <ArrowDown size={14} />
    <div className="fusion-results"><span>Supabase</span><span>Correlation</span><span>Verification</span><span>Alerts + routing</span></div>
  </div>
}
