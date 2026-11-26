import { Radio, ShieldCheck } from 'lucide-react'
import { clock, useGame, type HqAction } from '../game/GameEngine'
import { commandIssue, COMMUNITY_FLIGHT, OBSERVATION, REPORT_ID, type Scenario } from '../game/Scenario'
import { MiniMap } from './MiniMap'
import { logTime } from './Presenter'

export function incidentStatus(s: Scenario) {
  if (s.reopened) return 'Road reopened'
  if (s.verification === 'Confirmed closure') return 'Road closure confirmed'
  if (s.verification === 'Resolved' || s.verification === 'Rejected') return s.verification
  if (s.hazardConfirmed) return 'Hazard confirmed'
  if (s.verification === 'Under review' || s.verification === 'Corroborated') return s.verification
  if (s.acknowledgedAt !== null) return 'Acknowledged'
  return s.verification === 'Reported' ? 'Received' : 'Monitoring'
}

const moderation: readonly { action: HqAction; text: string }[] = [
  { action: 'acknowledge', text: 'Acknowledge incident' }, { action: 'review', text: 'Verify report' },
  { action: 'fieldCheck', text: 'Record field check' }, { action: 'correlate', text: 'Match observations' },
  { action: 'corroborate', text: 'Corroborate evidence' }, { action: 'confirmHazard', text: 'Confirm hazard' },
  { action: 'confirm', text: 'Mark road closed' }, { action: 'requestEvidence', text: 'Request more evidence' },
  { action: 'rejectReport', text: 'Reject community report' }, { action: 'reject', text: 'Reject incident' },
  { action: 'resolve', text: 'Mark resolved' }, { action: 'reopen', text: 'Mark road reopened' },
]

export function Headquarters({ onClose, standalone = false }: { onClose: () => void; standalone?: boolean }) {
  const scenario = useGame((s) => s.scenario)
  const role = useGame((s) => s.role)
  const active = useGame((s) => s.mode !== 'menu')
  const capture = useGame((s) => s.capture)
  const received = scenario.sensorInCloud
  const report = scenario.report === 'submitted'
  return <aside className={standalone ? "headquarters hq-standalone" : "headquarters"} aria-label="Headquarters incident control">
    <div className="hq-header">
      <ShieldCheck size={21} /><h2>Headquarters</h2><button type="button" onClick={onClose}>{standalone ? 'Back to help' : 'Close'}</button>
    </div>
    <p className="hq-status">{incidentStatus(scenario)}{scenario.acknowledgedAt !== null && ` · HQ-01 acknowledged at ${logTime(scenario.acknowledgedAt)}`}</p>
    <div className="hq-queues">
      <section><h3>Remote sensor queue</h3>
        {received ? <><strong>PS-001 · Potential landslide</strong><p>NODE-01 → NODE-02 → GW-01 · {OBSERVATION.zone}</p>
          <p>{scenario.gatewayReceipt} · Duplicate check {scenario.duplicate.toLowerCase()}</p>
          <p>Simulated SW-420 trigger and abnormal MPU6050 motion · {logTime(scenario.packet?.createdAt ?? 0)}</p></> :
          <p>{scenario.sync === 'pending' ? 'Gateway is retaining the pending event locally.' : 'Awaiting cloud receipt.'}</p>}
      </section>
      <section><h3>Community queue</h3>
        {report ? <><strong>{REPORT_ID} · {scenario.reportCategory}</strong>
          {scenario.reportRejected && <p>Rejected by moderator.</p>}
          {capture && <img src={capture.image} alt="Fresh community evidence from the scene camera" />}
          <p>Captured {logTime(scenario.observedAt ?? 0)} · Submitted {logTime(scenario.reportAt ?? 0)} · Received {logTime((scenario.reportAt ?? 0) + COMMUNITY_FLIGHT)}.</p>
          <p>Simulated GPS · {OBSERVATION.gps}. {capture ? 'Scene camera · SHA-256 ' + capture.hash.slice(0, 12) + '… · no EXIF' : 'Scripted witness exercise evidence'}</p>
          <p>Simulated AI assessment · {scenario.reportCategory} reported. Human review required.</p>
          <p>{scenario.correlated ? 'Road segment and event timing match the sensor observation.' : 'Evidence sources remain separate until reviewed.'}</p>
        </> : <p>No witness submission received.</p>}
      </section>
    </div>
    {scenario.evidenceRequested && <p role="status">Moderator requested additional evidence.</p>}
    <details className="hq-history"><summary>Incident map</summary><MiniMap inline navigation /></details>
    <section className="hq-health"><Radio size={15} /><div><strong>{scenario.nodeOnline ? 'NODE-01 online' : 'NODE-01 offline · telemetry unavailable'}</strong>
      <p>{scenario.nodeOnline ? 'Sensor link available' : 'Sensor link lost · hazard status unknown'} · Last telemetry {scenario.lastTelemetryAt === null ? 'awaiting first sample' : logTime(scenario.lastTelemetryAt)}. Battery unreported.</p>
      <button disabled={!active} type="button" onClick={() => useGame.getState().operate(scenario.nodeOnline ? 'nodeOutage' : 'nodeRestore')}>{scenario.nodeOnline ? 'Simulate node outage' : 'Restore node'}</button>
    </div></section>
    <label className="hq-role">Exercise role <select value={role} onChange={(event) => useGame.getState().setRole(event.target.value === 'moderator' ? 'moderator' : 'operator')}>
      <option value="operator">HQ operator · HQ-01</option><option value="moderator">Authorized moderator · MOD-01</option>
    </select></label>
    <div className="hq-actions">{moderation.map(({ action, text }) => <button key={action} type="button"
      disabled={!active || (role !== 'moderator' && action !== 'acknowledge') || !!commandIssue(scenario, action, clock.time)}
      onClick={() => useGame.getState().operate(action)}>{text}</button>)}</div>
    <details className="hq-history"><summary>Incident audit history</summary><ol>{scenario.log.map(({ at, text }, index) =>
      <li key={index}><time>{logTime(at)}</time> {text}</li>)}</ol></details>
  </aside>
}
