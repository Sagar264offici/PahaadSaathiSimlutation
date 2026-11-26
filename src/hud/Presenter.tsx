import { Activity, Antenna, Binoculars, ChevronLeft, ChevronRight, ClipboardList, Cloud, Compass, GitBranch, List, Map, Radio, RotateCcw, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useGame } from '../game/GameEngine'
import { commandIssue, REPORT_CATEGORIES, type Command, type Focus, type ReportCategory, type Scenario } from '../game/Scenario'
import { CHAPTERS, STAGES } from '../game/Timeline'
import { MiniMap } from './MiniMap'

type Action = { label: string; command?: Command; focus?: Focus; primary?: boolean }
const sections = [
  { title: 'World', icon: Binoculars, actions: [
    { label: 'Mountain Overview', focus: 'world' }, { label: 'Focus NODE-01', focus: 'NODE-01' }, { label: 'Focus NODE-02', focus: 'NODE-02' },
    { label: 'Focus GW-01', focus: 'GW-01' }, { label: 'Focus Vehicle', focus: 'vehicle' }, { label: 'Focus Rockfall', focus: 'rockfall' },
  ] },
  { title: 'Disaster', icon: TriangleAlert, actions: [
    { label: 'Trigger Rockfall', command: 'rockfall', focus: 'rockfall', primary: true },
    { label: 'Reset Rockfall', command: 'resetRockfall', focus: 'rockfall' },
    { label: 'Block Road', command: 'block', focus: 'rockfall' },
  ] },
  { title: 'Sensors', icon: Activity, actions: [
    { label: 'Trigger Vibration', command: 'vibration', focus: 'NODE-01' },
    { label: 'Generate Motion Alert', command: 'motion', focus: 'NODE-01' },
    { label: 'Generate Hazard Event', command: 'generate', focus: 'NODE-01', primary: true },
  ] },
  { title: 'RF network', icon: Radio, actions: [
    { label: 'Send Packet from NODE-01', command: 'send', focus: 'packet', primary: true },
    { label: 'Receive Packet at NODE-02', command: 'receiveRelay', focus: 'NODE-02' },
    { label: 'Forward Packet from NODE-02', command: 'forward', focus: 'packet' },
    { label: 'Receive Packet at GW-01', command: 'receiveGateway', focus: 'GW-01' },
  ] },
  { title: 'Gateway', icon: Cloud, actions: [
    { label: 'Process Packet', command: 'process', focus: 'GW-01', primary: true },
    { label: 'Validate Hazard', command: 'validate', focus: 'GW-01' },
    { label: 'Sync Supabase', command: 'sync', focus: 'cloud' },
  ] },
  { title: 'Community', icon: Smartphone, actions: [
    { label: 'Open Mobile App', command: 'app', focus: 'community' },
    { label: 'Create Community Report', command: 'draft', focus: 'community', primary: true },
    { label: 'Submit Community Report', command: 'submit', focus: 'community' },
    { label: 'Correlate Evidence', command: 'correlate', focus: 'cloud' },
  ] },
  { title: 'Verification', icon: ShieldCheck, actions: [
    { label: 'Mark Under Review', command: 'review', focus: 'cloud' },
    { label: 'Corroborate Hazard', command: 'corroborate', focus: 'cloud' },
    { label: 'Confirm Road Closure', command: 'confirm', focus: 'rockfall', primary: true },
    { label: 'Send Closure Alert', command: 'alert', focus: 'community' },
    { label: 'Reject Report', command: 'reject', focus: 'cloud' },
    { label: 'Resolve Hazard', command: 'resolve', focus: 'rockfall' },
  ] },
  { title: 'Routing', icon: Map, actions: [
    { label: 'Block Primary Route', command: 'block', focus: 'rockfall' },
    { label: 'Generate Alternate Route', command: 'planRoute', focus: 'vehicle', primary: true },
    { label: 'Move Vehicle to Alternate Route', command: 'driveRoute', focus: 'vehicle' },
  ] },
  { title: 'Internet', icon: Antenna, actions: [
    { label: 'Internet OFF', command: 'offline', focus: 'GW-01' },
    { label: 'Internet ON', command: 'online', focus: 'cloud' },
    { label: 'Retry Sync', command: 'retry', focus: 'cloud' },
  ] },
  { title: 'Architecture', icon: GitBranch, actions: [
    { label: 'Show Prototype Architecture', command: 'prototype', focus: 'world' },
    { label: 'Show Production Architecture', command: 'production', focus: 'production', primary: true },
  ] },
] satisfies { title: string; icon: typeof Radio; actions: Action[] }[]

export function logTime(at: number) {
  const seconds = 14 * 3600 + 2 * 60 + Math.floor(at)
  const pad = (number: number) => String(number).padStart(2, '0')
  return [pad(Math.floor(seconds / 3600) % 24), pad(Math.floor(seconds / 60) % 60), pad(seconds % 60)].join(':')
}

export function EventLog({ entries }: { entries: Scenario['log'] }) {
  return <div className="event-log">
    <div className="eyebrow"><ClipboardList size={13} /> SIMULATED TIMESTAMPS</div>
    {entries.length ? <ol aria-label="Simulation event log">
      {entries.map(({ at, text }, i) => <li key={i}><time>{logTime(at)}</time><span>{text}</span></li>)}
    </ol> : <p>Events appear here as the exercise progresses.</p>}
  </div>
}

function GuidedTimeline() {
  const active = useGame((state) => STAGES[state.stage].chapter)
  const { seek, chapter, inspect } = useGame.getState()
  return <div className="guided-timeline">
    <p>Jump to a checkpoint. The incident state is restored to that point in the guided exercise.</p>
    <ol>{CHAPTERS.map(([at, label], i) => <li key={at}>
      <button type="button" aria-current={active === i + 1 ? 'step' : undefined} onClick={() => seek(at)}>
        <span className="checkpoint-number">{String(i + 1).padStart(2, '0')}</span>{label}
      </button>
    </li>)}</ol>
    <div className="guided-controls">
      <button className="control" disabled={active === 1} onClick={() => chapter(-1)}><ChevronLeft size={15} />Previous</button>
      <button className="control" disabled={active === CHAPTERS.length} onClick={() => chapter(1)}>Next<ChevronRight size={15} /></button>
      <button className="control" onClick={() => chapter(0)}><RotateCcw size={14} />Replay current event</button>
      <button className="control" onClick={() => inspect('world')}><Compass size={14} />World overview</button>
    </div>
  </div>
}

export function Presenter() {
  const [section, setSection] = useState('Disaster')
  const [tab, setTab] = useState<'actions' | 'timeline' | 'map' | 'log'>('actions')
  const [collapsed, setCollapsed] = useState(false)
  const scenario = useGame((state) => state.scenario)
  const now = useGame((state) => state.second)
  const paused = useGame((state) => state.mode === 'paused')
  const focus = useGame((state) => state.focus)
  const { command, editReport, inspect } = useGame.getState()
  const current = sections.find(({ title }) => title === section)!
  return <aside className={`presenter-panel ${collapsed ? 'collapsed' : ''}`} aria-label="Presenter controls">
    <div className="presenter-heading">
      <div><span className="eyebrow">FIELD COMMANDS</span><h2>Presenter controls</h2></div>
      <button className="control" aria-label={collapsed ? 'Expand presenter controls' : 'Collapse presenter controls'} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
      </button>
    </div>
    {!collapsed && <>
      <nav className="presenter-tabs" aria-label="Presenter panels">
        {(['actions', 'timeline', 'map', 'log'] as const).map((item) => <button key={item} type="button" aria-pressed={item === tab} onClick={() => setTab(item)}>
          {item === 'actions' ? <Compass size={14} /> : item === 'timeline' ? <List size={14} /> : item === 'map' ? <Map size={14} /> : <ClipboardList size={14} />}
          {item === 'log' ? 'Event log' : item === 'timeline' ? 'Timeline' : item === 'map' ? 'Map' : 'Actions'}
        </button>)}
      </nav>
      <div className="presenter-content">
        {tab === 'actions' && <>
          <div className="section-grid" aria-label="Command groups">
            {sections.map(({ icon: Icon, title }) => <button key={title} aria-pressed={title === section} type="button"
              onClick={() => setSection(title)}><Icon size={14} /><span>{title}</span></button>)}
          </div>
          <div className="command-list" aria-label={section + ' controls'}>
            {section === 'Community' && scenario.report === 'draft' && <div className="report-fields">
              <label>Hazard category<select value={scenario.reportCategory} onChange={(e) => editReport({ reportCategory: e.target.value as ReportCategory })}>
                {REPORT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select></label>
              <label>Observation<textarea rows={2} maxLength={160} value={scenario.reportDescription}
                onChange={(e) => editReport({ reportDescription: e.target.value })} /></label>
            </div>}
            {current.actions.map(({ command: key, focus: target, label, primary }: Action) => {
              const reason = key && commandIssue(scenario, key, now)
              return <div className="command-entry" key={label}>
                <button className={`command ${primary ? 'primary-command' : ''}`} type="button" disabled={Boolean(reason)} title={reason || label}
                  onClick={() => key ? command(key, target) : target && inspect(target)}>
                  {label}<ChevronRight size={15} />
                </button>
                {reason && <small>{reason}</small>}
              </div>
            })}
            {section === 'World' && <button className="control reset-view" onClick={() => inspect(focus)}><RotateCcw size={14} />Reset camera</button>}
          </div>
        </>}
        {tab === 'timeline' && <GuidedTimeline />}
        {tab === 'log' && <EventLog entries={scenario.log} />}
        {tab === 'map' && <MiniMap inline />}
      </div>
      <div className="presenter-footer">{paused ? 'Paused · actions apply when selected' : 'Drag to orbit · right-drag to pan · scroll to zoom'}</div>
    </>}
  </aside>
}
