import { Activity, Antenna, ArrowDown, Database, Radio, ShieldCheck, Smartphone } from 'lucide-react'
import { useGame } from '../game/GameEngine'
import { FLIGHT, OBSERVATION, REPORT_ID, roadIsBlocked, type Focus, type Scenario } from '../game/Scenario'
import { logTime } from './Presenter'

export const focusLabels: Record<Focus, [title: string, description: string]> = {
  world: ['Ridge sector overview', 'Inspect the mountain road, three prototype nodes, and the nearby settlement.'],
  vehicle: ['Survey vehicle', 'The SUV follows the ridge road and waits at the bypass junction when the primary route is blocked.'],
  rockfall: ['Exposed road cut', 'A failure on this slope can send debris onto both lanes below.'],
  '1E': ['1E — Sensor / relay node', 'Arduino UNO R3 reads the SW-420 module and the GY-521 / MPU-6050. Its HC-12 sends and relays wireless serial traffic.'],
  '2L': ['2L — Sensor / relay node', 'Arduino UNO R3, SW-420, GY-521 / MPU-6050, and HC-12. Here, the node checks packet structure before custom firmware forwards it.'],
  '3MH': ['3MH — Main headquarters', 'An HC-12 endpoint passes packets to the original ASUS Tinker Board through UART.'],
  packet: ['HC-12 packet in flight', 'The prototype uses two scripted hops with custom firmware behavior and a decrementing TTL.'],
  cloud: ['Supabase and hazard verification', 'The backend associates the 1E observation and the community report. A human moderator reviews the evidence.'],
  community: ['Ridge Hamlet community report', 'A witness uses PahaadSaathi to report the blocked road from the settlement.'],
  production: ['Real-world deployment', 'Proposed Himalayan regional coverage combines targeted sensing and community reporting.'],
}

export function Facts({ data }: { data: readonly (readonly [string, string])[] }) {
  return <dl>{data.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

function PacketInspector({ scenario, now }: { scenario: Scenario; now: number }) {
  const packet = scenario.packet
  if (!packet) return null
  const step = {
    ready: 'READY TO TRANSMIT',
    'sending-1E': now >= packet.at + FLIGHT ? 'AT 2L · AWAITING RECEPTION' : 'TRANSMITTING',
    'at-2L': 'RECEIVED · STRUCTURE VALIDATED',
    'forwarding-2L': now >= packet.at + FLIGHT ? 'AT 3MH · AWAITING RECEPTION' : 'FORWARDED',
    'at-3MH': 'PACKET RECEIVED AT 3MH',
    processing: 'GATEWAY PROCESSING',
    processed: 'GATEWAY PROCESSING COMPLETE',
  }[packet.step]
  return <details className="packet-inspector" open>
    <summary><Radio size={14} /> Packet inspector <span>SIMULATED HC-12</span></summary>
    <Facts data={[
      ['Packet type', packet.type], ['Origin / Sender', packet.origin + ' / ' + packet.sender],
      ['Sequence ID', packet.sequence], ['Hop count / TTL', packet.hop + ' / ' + packet.ttl], ['Status', step],
    ]} />
  </details>
}

function GatewaySteps({ scenario, now }: { scenario: Scenario; now: number }) {
  const packet = scenario.packet
  const processing = packet?.step === 'processing'
  const done = packet?.step === 'processed'
  const elapsed = processing ? now - packet.at : 0
  const steps = [
    ['RF packet received', Boolean(packet?.sender === '2L' && (packet.step === 'at-3MH' || processing || done))],
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
      ['UART endpoint', 'HC-12 → Tinker Board'], ['Duplicate check', scenario.duplicate],
      ['Cloud sync', scenario.sync], ['RF diagnostic', scenario.probeReceived ? '00422 received locally' : scenario.probeAt === null ? 'Standby' : '00422 in transit'], ['Internet', scenario.internet ? 'Online' : 'Offline'],
    ]} />
  </div>
}

export function Inspection({ focus }: { focus: Focus }) {
  const scenario = useGame((state) => state.scenario)
  const second = useGame((state) => state.second)
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
  if (focus === '1E') return <>
    <div className="inspection-extra"><span className="eyebrow"><Activity size={14} /> SIMULATED SENSOR DATA</span>
      <Facts data={[
        ['Node', '1E'], ['SW-420', scenario.vibrationAt === null ? 'Digital trigger idle' : 'Vibration triggered · digital'],
        ['GY-521 MPU-6050', scenario.motion ? 'Abnormal motion observed' : 'Acceleration / angular velocity'],
        ...(scenario.motion ? [['Acceleration X / Y / Z', '0.42 / 0.81 / 1.37 g']] : []) as [string, string][],
        ['Arduino UNO R3', scenario.packet ? 'Event generated · HC-12 ready' : 'Monitoring'],
      ]} />
    </div>
    {scenario.packet && <PacketInspector scenario={scenario} now={second} />}
  </>
  if (focus === '2L' || focus === 'packet') return <>
    <PacketInspector scenario={scenario} now={second} />
    {focus === '2L' && !scenario.packet && <Facts data={[
      ['Node', '2L · Sensor / relay'], ['MCU', 'Arduino UNO R3'], ['Sensors', 'SW-420 · GY-521 MPU-6050'], ['Radio', 'HC-12 wireless serial'],
    ]} />}
  </>
  if (focus === '3MH') return <GatewaySteps scenario={scenario} now={second} />
  if (focus === 'cloud') return <div className="inspection-extra">
    <span className="eyebrow"><Database size={14} /> SIMULATED SUPABASE RECORDS</span>
    <Facts data={[
      ['Machine evidence', scenario.sensorInCloud ? '1E · event 00421' : 'Awaiting synchronized event'],
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
      ['Prototype radios', '2 physical HC-12 modules confirmed'],
      ['3MH endpoint', 'Virtual third endpoint. Hardware needs another compatible HC-12 or a designed interface.'],
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
      <span><Radio size={15} /> 1E → 2L → 3MH <small>Prototype · HC-12</small></span>
      <span><Smartphone size={15} /> Community reports <small>Populated areas</small></span>
    </div>
    <ArrowDown size={14} />
    <div className="fusion-results"><span>Supabase</span><span>Correlation</span><span>Verification</span><span>Alerts + routing</span></div>
  </div>
}
