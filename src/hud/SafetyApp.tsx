import {
  ArrowLeft, ArrowRight, ArrowUpRight, Bell, Camera, ChevronDown, CircleHelp, CornerDownLeft,
  House, LocateFixed, Map, MapPin, Maximize2, Mountain, Radio, Route, ShieldCheck, TriangleAlert, Users, Wifi,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { clock, useGame } from '../game/GameEngine'
import { OBSERVATION, preliminaryAlert, REPORT_CATEGORIES, REPORT_ID, roadIsBlocked, type ReportCategory, type Scenario } from '../game/Scenario'
import { regionalDetourKm } from '../world/layout'
import { sceneCamera } from '../world/sceneCamera'
import { MiniMap } from './MiniMap'
import { Headquarters, incidentStatus } from './Operations'
import { logTime } from './Presenter'
import './SafetyApp.css'

const pages = [
  { id: 'home', title: 'Home', Icon: House },
  { id: 'alerts', title: 'Alerts', Icon: Bell },
  { id: 'routes', title: 'Routes', Icon: Map },
  { id: 'community', title: 'Community', Icon: Users },
  { id: 'help', title: 'Help', Icon: CircleHelp },
] as const

type Screen = typeof pages[number]['id'] | 'report' | 'headquarters'
type FullView = { screen: Screen; ready: boolean; startDrive: () => void }
const screens: readonly Screen[] = [...pages.map(({ id }) => id), 'report', 'headquarters']
const pageTitles: Record<Screen, string> = {
  home: 'Ridge Sector', alerts: 'Road alerts', routes: 'Routes', community: 'Community', report: 'Report a hazard', help: 'Help', headquarters: 'Headquarters',
}

export function appScreen(hash: string): Screen | null {
  if (hash !== '#app' && !hash.startsWith('#app/')) return null
  const page = hash.slice(5) as Screen
  return screens.includes(page) ? page : 'home'
}

export const appHref = (screen: Screen = 'home') => '#app/' + screen

function reportStatus(scenario: Scenario) {
  if (scenario.reportRejected) return 'Rejected'
  if (scenario.report === 'submitted') return 'Awaiting review'
  if (scenario.report === 'sending') return 'Sending'
  return 'Draft'
}

function hazardTitle(scenario: Scenario) {
  if (scenario.reopened) return 'Road reopened'
  if (scenario.alert) return 'Confirmed road closure'
  if (preliminaryAlert(scenario)) return 'Potential landslide'
  if (roadIsBlocked(scenario)) return 'Primary road blocked'
  if (!scenario.nodeOnline) return 'Sensor feed offline'
  return 'No active alerts'
}

function AlertCard({ scenario, goToRoutes }: { scenario: Scenario; goToRoutes: () => void }) {
  const warning = preliminaryAlert(scenario)
  const route = scenario.routeAt !== null
  const detail = warning ? 'Remote sensor station · NODE-01'
    : scenario.reopened ? 'Road authority · MOD-01' : 'Ridge Sector'
  return <section className={`safety-card safety-alert ${warning ? 'is-warning' : ''}`} aria-live="polite">
    <div className="safety-card-icon">{warning ? <TriangleAlert size={19} /> : <Bell size={19} />}</div>
    <div className="safety-card-main">
      <span className="safety-muted">{detail}</span>
      <h3>{hazardTitle(scenario)}</h3>
      <p>{warning ? `${incidentStatus(scenario)} · ${OBSERVATION.zone}`
        : scenario.reopened ? 'Headquarters has recorded an authorized reopening.'
          : !scenario.nodeOnline ? 'Current hazard conditions are unknown.'
            : roadIsBlocked(scenario) ? 'The simulation shows debris across the primary road.' : 'Nearby road warnings will appear here.'}</p>
      {warning && <small className="safety-muted">Simulated GPS · {OBSERVATION.gps}</small>}
      {route && <button type="button" className="safety-text" onClick={goToRoutes}>See route options <ArrowRight size={15} /></button>}
    </div>
  </section>
}

function RouteScreen({ scenario }: { scenario: Scenario }) {
  const mode = useGame((s) => s.mode)
  const driving = useGame((s) => s.control === 'drive' && s.mode !== 'menu')
  const selected = useGame((s) => s.drive.choice)
  const { chooseRoute } = useGame.getState()
  const detour = scenario.routeAt !== null
  return <div className="safety-route-grid">
    <div className="safety-map">
      <MiniMap inline navigation />
      <div className="safety-map-legend">
        <span><i /> Primary road</span>
        {detour && <><span><i className="is-return" /> Return</span><span><i className="is-detour" /> Detour</span></>}
        {roadIsBlocked(scenario) && <span><i className="is-closed" /> Blocked</span>}
      </div>
    </div>
    <section className="safety-card safety-route-details">
      <span className="safety-muted">{roadIsBlocked(scenario) ? 'Primary road blocked' : 'Ridge Sector road network'}</span>
      <h3>{detour ? `West valley detour · ${regionalDetourKm} km` : 'Primary route'}</h3>
      <p>{detour
        ? 'Turn around and retrace the ridge to the last accessible junction. From there, the detour takes the west valley.'
        : 'The map shows your position on the primary road. Detour options will appear here when available.'}</p>
      {detour && <>
        <small className="safety-muted">No alternate within 50 km. The 3D route uses a compressed distance.</small>
        {driving && <div className="safety-route-actions">
          <button type="button" className="safety-button secondary" aria-pressed={selected === 'safe-return'}
            disabled={mode !== 'running'} onClick={() => chooseRoute('safe-return')}><CornerDownLeft size={17} /> Return to safe location</button>
          <button type="button" className="safety-button" aria-pressed={selected === 'detour'}
            disabled={mode !== 'running'} onClick={() => chooseRoute('detour')}><Route size={17} /> Select long detour</button>
        </div>}
        {selected && <p className="safety-muted" role="status">Selected. Return to the SUV and accelerate at the marked turnaround.</p>}
      </>}
    </section>
  </div>
}

function CommunityScreen({ scenario, openReport }: { scenario: Scenario; openReport: () => void }) {
  const reported = scenario.report !== 'none'
  return <div className="safety-community">
    <section className="safety-card safety-community-intro">
      <div className="safety-card-icon"><Users size={22} /></div>
      <h3>Report a road hazard</h3>
      <p>Share a new scene-camera photo and a short description with headquarters for review.</p>
      <button type="button" className="safety-button" onClick={openReport}><Camera size={17} /> {reported ? 'Open your report' : 'Start a report'}</button>
    </section>
    <section className="safety-card safety-community-list">
      <h3>Community reports</h3>
      {reported ? <button className="safety-report-row" type="button" onClick={openReport}>
        <div><strong>{scenario.reportCategory}</strong><small>{REPORT_ID} · Ridge Hamlet</small></div>
        <span>{reportStatus(scenario)}</span><ArrowRight size={15} />
      </button> : <p>No community reports have been submitted in this exercise.</p>}
    </section>
  </div>
}

function ReportScreen({ full, back }: { full?: FullView; back: () => void }) {
  const scenario = useGame((s) => s.scenario)
  const run = useGame((s) => s.run)
  const mode = useGame((s) => s.mode)
  const session = useGame((s) => s.control)
  const capture = useGame((s) => s.capture)
  const [category, setCategory] = useState<ReportCategory>(scenario.reportCategory)
  const [description, setDescription] = useState(scenario.report === 'draft' ? scenario.reportDescription : '')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const canCapture = mode === 'running' && session === 'drive'
  const sent = scenario.report === 'submitted' || scenario.report === 'sending'

  useEffect(() => {
    if (!full || !cameraOpen) return
    const frame = window.setTimeout(() => {
      try { setPreview(sceneCamera.capture?.() ?? '') }
      catch { setMessage('A camera preview is unavailable. Return to the scene to try again.') }
    }, 1400)
    return () => window.clearTimeout(frame)
  }, [full?.screen, cameraOpen])

  function openCamera() {
    setCameraOpen(true)
    setMessage(full ? 'The preview frames the road. Capture a photo to save this view.' : 'Orbit the 3D camera to frame the hazard.')
    useGame.getState().inspect('rockfall')
  }

  async function takePhoto() {
    const at = clock.time
    setBusy(true)
    try {
      const image = sceneCamera.capture?.()
      if (!image) { setMessage('The scene camera is unavailable in 2D map view.'); return }
      const bytes = Uint8Array.from(atob(image.split(',')[1]), (char) => char.charCodeAt(0))
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (byte) => byte.toString(16).padStart(2, '0')).join('')
      const state = useGame.getState()
      if (state.run !== run || state.mode !== 'running' || state.control !== 'drive') return
      state.recordCapture({ image, hash, at })
      state.editReport({ reportCategory: category, reportDescription: description.trim() || (category === OBSERVATION.category ? OBSERVATION.description : category + ' reported by a witness.') })
      setCameraOpen(false)
      setMessage('')
    } catch {
      setMessage('Could not save the camera capture. Try again.')
    } finally { setBusy(false) }
  }

  function submit() {
    const state = useGame.getState()
    state.editReport({
      reportCategory: category,
      reportDescription: description.trim() || (category === OBSERVATION.category ? OBSERVATION.description : category + ' reported by a witness.'),
    })
    state.submitCapture()
    if (useGame.getState().scenario.report === 'sending') state.inspect('vehicle')
  }

  return <section className="safety-card safety-report">
    <button type="button" className="safety-text" onClick={back}><ArrowLeft size={15} /> Community</button>
    {sent ? <>
      <div className="safety-card-icon"><ShieldCheck size={22} /></div>
      <h3>{scenario.reportRejected ? 'Report rejected' : scenario.report === 'sending' ? 'Sending report' : 'Report received'}</h3>
      <p>{REPORT_ID} · {scenario.reportCategory} · {reportStatus(scenario)}</p>
      <p>{scenario.reportDescription}</p>
      {capture && <img src={capture.image} alt="Evidence captured through the simulation camera" />}
      {scenario.reportAt !== null && <small className="safety-muted">Submitted at {logTime(scenario.reportAt)} in the exercise.</small>}
    </> : <>
      {!canCapture && !capture && <p>{mode === 'menu' ? 'Start a driving exercise to capture a hazard from the scene.'
        : session === 'auto' ? 'The presentation follows a scripted witness. Open Game Mode to capture your own scene photo.'
          : 'Resume the exercise to capture or submit a report.'}</p>}
      {mode === 'menu' && full && <button type="button" className="safety-button" disabled={!full.ready} onClick={full.startDrive}>Start driving exercise <ArrowRight size={16} /></button>}
      {(session === 'drive' && mode !== 'menu') && <>
        <label>Hazard category<select value={category} onChange={(event) => {
          const value = event.target.value as ReportCategory
          setCategory(value)
          useGame.getState().editReport({ reportCategory: value })
        }}>
          {REPORT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label>What happened? <span className="safety-muted">(optional)</span>
          <textarea value={description} maxLength={240} rows={3} placeholder="Describe what is blocking or damaging the road"
            onChange={(event) => {
              setDescription(event.target.value)
              useGame.getState().editReport({ reportDescription: event.target.value })
            }} />
        </label>
        {(cameraOpen && preview || capture?.image) && <img src={cameraOpen && preview ? preview : capture?.image}
          alt={cameraOpen && preview ? 'Scene camera preview' : 'Evidence captured through the simulation camera'} />}
        <div className="safety-route-actions">
          {cameraOpen ? <button type="button" className="safety-button" disabled={busy || !canCapture} onClick={() => void takePhoto()}><Camera size={17} /> Capture photo</button>
            : <button type="button" className={`safety-button ${capture ? 'secondary' : ''}`} disabled={!canCapture} onClick={openCamera}><Camera size={17} /> {capture ? 'Retake photo' : 'Open in-app camera'}</button>}
          {capture && !cameraOpen && <button type="button" className="safety-button" disabled={!canCapture || !scenario.internet}
            onClick={submit}><ArrowUpRight size={17} /> Submit camera report</button>}
        </div>
        {!scenario.internet && <small role="status">Internet is offline. Your draft will stay in this exercise.</small>}
      </>}
    </>}
    <small className="safety-muted">Scene-camera photo and simulated GPS. No device camera or location access.</small>
    {message && <small role="status">{message}</small>}
  </section>
}

function HomeScreen({ scenario, full, go }: { scenario: Scenario; full?: FullView; go: (screen: Screen) => void }) {
  return <>
    {full && <section className="safety-hero">
      <div>
        <span><MapPin size={16} /> Himalayan road network</span>
        <h2>Plan your mountain route</h2>
        <p>Check road warnings, plan a detour, or share what you’ve seen with headquarters.</p>
        <button className="safety-button" type="button" onClick={() => go(preliminaryAlert(scenario) ? 'alerts' : 'routes')}>
          {preliminaryAlert(scenario) ? 'See active alert' : 'Open route map'} <ArrowRight size={17} />
        </button>
      </div>
    </section>}
    <div className="safety-home-grid">
      <div>
        <h3 className="safety-section-title">Road status</h3>
        <AlertCard scenario={scenario} goToRoutes={() => go('routes')} />
      </div>
      <div>
        <h3 className="safety-section-title">Quick actions</h3>
        <button type="button" className="safety-shortcut" onClick={() => go('routes')}><Map size={19} /><span><strong>View routes</strong><small>Primary road and detours</small></span><ArrowRight size={16} /></button>
        <button type="button" className="safety-shortcut" onClick={() => go('report')}><Camera size={19} /><span><strong>Report a hazard</strong><small>Send evidence to headquarters</small></span><ArrowRight size={16} /></button>
      </div>
    </div>
    {full && <div className="safety-network" aria-label="Exercise network">
      <span><Radio size={15} /> {scenario.nodeOnline ? 'NODE-01 online' : 'NODE-01 offline'}</span>
      <span><Wifi size={15} /> Internet {scenario.internet ? 'online' : 'offline'}</span>
    </div>}
  </>
}

export function SafetyApp({ full }: { full?: FullView }) {
  const scenario = useGame((s) => s.scenario)
  const session = useGame((s) => s.control)
  const run = useGame((s) => s.run)
  const [selected, setSelected] = useState<Screen | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const content = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const warning = preliminaryAlert(scenario)
  const automatic = session === 'auto' && ['open', 'draft', 'sending'].includes(scenario.report) ? 'report'
    : scenario.routeAt !== null ? 'routes' : warning || scenario.reopened ? 'alerts' : 'home'
  const screen = full?.screen ?? selected ?? automatic
  const navigationScreen = screen === 'report' ? 'community' : screen
  function go(target: Screen) {
    if (full || target === 'headquarters') window.location.hash = appHref(target)
    else setSelected(target)
  }

  useEffect(() => {
    if (content.current) content.current.scrollTop = 0
    if (full) title.current?.focus({ preventScroll: true })
  }, [screen, Boolean(full)])

  const nav = <nav className="safety-nav" aria-label="PahaadSaathi screens">
    {pages.map(({ id, title, Icon }) => <button key={id} type="button" aria-label={title}
      aria-current={navigationScreen === id ? 'page' : undefined} title={title} onClick={() => go(id)}>
      <Icon size={18} /><span>{title}</span>{id === 'alerts' && warning && <i aria-hidden="true" />}
    </button>)}
  </nav>
  const brand = <><img src="/mark.svg" width="36" height="36" alt="" /><div><strong>PahaadSaathi</strong>{full && <small>Road safety simulation</small>}</div></>
  const body = <>
    {screen === 'home' && <HomeScreen scenario={scenario} full={full} go={go} />}
    {screen === 'alerts' && <AlertCard scenario={scenario} goToRoutes={() => go('routes')} />}
    {screen === 'routes' && <RouteScreen scenario={scenario} />}
    {screen === 'community' && <CommunityScreen scenario={scenario} openReport={() => go('report')} />}
    {screen === 'report' && <ReportScreen key={run} full={full} back={() => go('community')} />}
    {screen === 'help' && <div className="safety-help-grid">
      <section className="safety-card"><div className="safety-card-icon"><TriangleAlert size={20} /></div><h3>On the road</h3><p>Keep clear of blocked sections. Use the last accessible junction to turn back and follow the directions shown in Routes.</p></section>
      <section className="safety-card"><div className="safety-card-icon"><LocateFixed size={20} /></div><h3>About this exercise</h3><p>Road status, location, emergency response and device readings are simulated. Scene photos are held in this exercise.</p>
        <button type="button" className="safety-text" onClick={() => go('headquarters')}>Open headquarters <ArrowRight size={15} /></button></section>
    </div>}
    {screen === 'headquarters' && <Headquarters standalone onClose={() => go('help')} />}
  </>

  if (full) return <div className="safety-app safety-full">
    <aside className="safety-sidebar">
      <div className="safety-brand">{brand}</div>
      {nav}
      <button type="button" className="safety-hq-link" onClick={() => go('headquarters')} aria-current={screen === 'headquarters' ? 'page' : undefined}><ShieldCheck size={18} /> Headquarters</button>
      <a className="safety-back-link" href="#simulation"><Mountain size={18} /> Back to simulation <ArrowUpRight size={14} /></a>
    </aside>
    <main className="safety-main" ref={content}>
      <header className="safety-page-header">
        <h1 ref={title} tabIndex={-1}>{pageTitles[screen]}</h1>
        <span><MapPin size={15} /> Simulation</span>
      </header>
      {body}
    </main>
  </div>

  return <aside className={`safety-app safety-panel ${expanded ? 'is-expanded' : ''} ${collapsed ? 'is-collapsed' : ''}`} aria-label="PahaadSaathi app simulation">
    <header className="safety-panel-header">
      <div className="safety-brand">{brand}</div>
      <a href={appHref(screen)} className="safety-tool" aria-label="Open full app" title="Open full app"><ArrowUpRight size={16} /></a>
      <button type="button" className="safety-tool" aria-label={collapsed ? 'Open app preview' : expanded ? 'Restore app size' : 'Expand app'}
        onClick={() => { if (collapsed) setCollapsed(false); else setExpanded(!expanded) }}><Maximize2 size={15} /></button>
      {!collapsed && <button type="button" className="safety-tool" aria-label="Collapse app" onClick={() => setCollapsed(true)}><ChevronDown size={16} /></button>}
    </header>
    {collapsed ? <p className="safety-collapsed-status">{hazardTitle(scenario)}</p> : <>
      <div ref={content} className="safety-panel-content"><h2 className="safety-panel-title">{pageTitles[screen]}</h2>{body}</div>
      {nav}
    </>}
  </aside>
}
