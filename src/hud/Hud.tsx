import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Activity, BadgeCheck, CarFront, ClipboardList, Gamepad2, Compass, Crosshair, House, MapPin, Maximize, Minimize, Mountain, Pause, Play, Radio, RotateCcw, Settings2, SkipForward, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { updateDriveMusic } from '../audio/DriveMusic'
import { unlockAudio, updateScore } from '../audio/Score'
import { useGame, type Quality, type Session } from '../game/GameEngine'
import { roadIsBlocked } from '../game/Scenario'
import { CHAPTERS, CUES, DURATION, STAGES } from '../game/Timeline'
import { Facts, focusLabels, FusionFlow, Inspection } from './Inspection'
import { DrivingHud } from './DrivingHud'
import { MiniMap } from './MiniMap'
import { EventLog, Presenter } from './Presenter'

const timecode = (seconds: number) => String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')

function Control({ label, children, action, active, text = false, disabled = false }: {
  label: string; children: ReactNode; action: () => void; active?: boolean; text?: boolean; disabled?: boolean
}) {
  return <button className={`control ${text ? 'control-text' : ''}`} type="button" onClick={action} aria-label={label}
    title={label} aria-pressed={active} disabled={disabled}>{children}{text && <span>{label}</span>}</button>
}

function NetworkStatus() {
  const control = useGame((state) => state.control)
  const scenario = useGame((state) => state.scenario)
  const blocked = roadIsBlocked(scenario)
  const holding = control === 'drive' && scenario.rockAt !== null
  const WifiIcon = scenario.internet ? Wifi : WifiOff
  return <div className="network-status" aria-label="Network and hazard status">
    {scenario.architecture === 'prototype' ? <div className="node-status" aria-label="Prototype nodes">
      {(['1E', '2L', '3MH'] as const).map((id) => control === 'presenter' ?
        <button key={id} type="button" title={id + ' · Online'} onClick={() => useGame.getState().inspect(id)} aria-label={'Focus node ' + id}>
          <span className="status-light" />{id}<small>ONLINE</small>
        </button> :
        <span key={id}><span className="status-light" />{id}<small>ONLINE</small></span>)}
      <span className="rf-status"><Radio size={13} /> RF ACTIVE</span>
    </div> : <span className="rf-status"><Radio size={13} /> REAL-WORLD DEPLOYMENT · PROPOSED LoRa</span>}
    <div className="hazard-status">
      <span className={scenario.internet ? '' : 'warn'}><WifiIcon size={14} /> INTERNET {scenario.internet ? 'ONLINE' : 'OFFLINE'}</span>
      <span className={blocked || holding ? 'warn' : ''}>ROAD {scenario.verification === 'Confirmed closure' ? 'CLOSED' : blocked ? 'BLOCKED' : holding ? 'HOLD' : 'OPEN'}</span>
      <span>HAZARD {scenario.rockAt !== null && !scenario.settled ? 'ROCKFALL DETECTED' : scenario.verification === 'Normal' && blocked ? 'ROCKFALL / BLOCKAGE' : scenario.verification.toUpperCase()}</span>
    </div>
  </div>
}

export function Hud({ ready, fallback }: { ready: boolean; fallback: boolean }) {
  const mode = useGame((state) => state.mode)
  const control = useGame((state) => state.control)
  const stageIndex = useGame((state) => state.stage)
  const second = useGame((state) => state.second)
  const run = useGame((state) => state.run)
  const sound = useGame((state) => state.sound)
  const speed = useGame((state) => state.speed)
  const quality = useGame((state) => state.quality)
  const manualFocus = useGame((state) => state.focus)
  const scenario = useGame((state) => state.scenario)
  const stage = STAGES[stageIndex]
  const reducedMotion = useReducedMotion()
  const [settings, setSettings] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))
  const [feedback, setFeedback] = useState('')
  const lastCue = useRef('')
  const replayButton = useRef<HTMLButtonElement>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const pauseButton = useRef<HTMLButtonElement>(null)
  const menu = mode === 'menu'
  const complete = mode === 'complete'
  const presenter = !menu && control === 'presenter'
  const driveMode = !menu && control === 'drive'
  const overview = !complete && control === 'auto' && second >= CUES.overview
  const focus = presenter ? manualFocus : stage.focus
  const nowBlocked = roadIsBlocked(scenario)
  const status = scenario.architecture === 'production' ? 'PRODUCTION PROPOSAL'
    : !scenario.internet ? 'INTERNET OFFLINE'
      : scenario.verification !== 'Normal' ? scenario.verification.toUpperCase()
        : nowBlocked ? 'ROAD BLOCKED' : driveMode && scenario.rockAt !== null ? 'ROCKFALL TRIGGERED' : 'MONITORING'

  useEffect(() => {
    const cue = run + '/' + stageIndex + '/' + complete
    updateScore(sound && control !== 'drive', mode, stage.chapter, cue !== lastCue.current && mode !== 'menu')
    lastCue.current = cue
  }, [sound, mode, stageIndex, run, stage.chapter, complete, control])

  useEffect(() => {
    function syncMusic() { updateDriveMusic(sound && driveMode && mode === 'running' && !document.hidden) }
    syncMusic()
    document.addEventListener('visibilitychange', syncMusic)
    return () => document.removeEventListener('visibilitychange', syncMusic)
  }, [sound, driveMode, mode])

  useEffect(() => {
    const listener = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', listener)
    return () => document.removeEventListener('fullscreenchange', listener)
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  useEffect(() => { if (complete) replayButton.current?.focus() }, [complete])

  function start(session: Session) {
    if (!ready) return
    if (session === 'drive') updateDriveMusic(sound, true)
    else if (sound) unlockAudio()
    setSettings(false)
    setShowLog(false)
    useGame.getState().start(session)
    if (session === 'auto') requestAnimationFrame(() => pauseButton.current?.focus({ preventScroll: true }))
  }

  function soundToggle() {
    const state = useGame.getState()
    if (driveMode) updateDriveMusic(!state.sound && state.mode === 'running')
    else if (!state.sound) unlockAudio()
    state.toggleSound()
  }

  async function full() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen()
      else setFeedback('Fullscreen is unavailable in this browser.')
    } catch { setFeedback('Fullscreen is unavailable in this browser.') }
  }

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return
      if (event.key === 'Escape' && settings) {
        setSettings(false)
        settingsButton.current?.focus()
        return
      }
      if ((event.target as HTMLElement | null)?.closest('button, input, select, textarea')) return
      if ((driveMode ? event.code === 'Escape' : event.code === 'Space') && !menu && !complete) {
        event.preventDefault()
        useGame.getState().togglePause()
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [menu, complete, settings, driveMode])

  const Icon = sound ? Volume2 : VolumeX
  const FullIcon = fullscreen ? Minimize : Maximize
  const [title, description] = presenter ? focusLabels[focus] : [stage.title, stage.description]
  let inspectionDescription = description
  if (presenter && focus === 'vehicle' && scenario.turnAt !== null) {
    inspectionDescription = 'The SUV follows the predesigned bypass. The route is simulated and its safety is unverified.'
  }
  if (presenter && focus === 'rockfall' && scenario.settled) {
    inspectionDescription = 'Debris spans both lanes. The SUV stops upstream of the obstruction while the dust clears.'
  }
  const routeTitle = presenter && focus === 'vehicle' && scenario.routeAt !== null ?
    scenario.turnAt !== null ? 'Route updated — avoiding the rockfall zone' : 'Alternate route available' : title
  return <div className={`hud ${menu ? 'hud-menu' : 'hud-active'} ${complete ? 'hud-complete' : ''} ${overview ? 'hud-overview' : ''} ${presenter ? 'hud-presenter' : ''} ${driveMode ? 'hud-driving' : ''} ${scenario.architecture === 'production' ? 'hud-production' : ''}`}>
    <div className="cinema-wash" />
    <header className="hud-header">
      <div className="brand-lockup">
        <img src="/mark.svg" width="42" height="42" alt="" />
        <div><strong>PAHAADSAATHI</strong>
          <span>{menu ? 'FIELD SIMULATION' : '3D DISASTER SIMULATION'}</span></div>
      </div>
      {menu && <div className="compass" aria-hidden="true"><span>NW</span><i /><i /><i /><Crosshair size={13} /><i /><i /><i /><span>NE</span></div>}
      {!menu && <div className="mode-label"><span className="status-light" />{presenter ? 'PRESENTER MODE' : driveMode ? 'DRIVE MODE' : 'AUTO MODE'}</div>}
      <div className="header-actions">
        <div className={`system-tag ${nowBlocked ? 'red' : stage.tone ?? ''}`}>
          <span className="status-light" />
          <span>{fallback ? '2D FALLBACK' : menu ? 'DEMONSTRATION ENVIRONMENT' : complete ? 'MISSION COMPLETE' : status}</span>
        </div>
        {!menu && <>
          <Control label="Main menu" action={() => useGame.getState().menu()}><House size={17} /></Control>
          {!complete && <button ref={pauseButton} className="control" type="button" title={mode === 'paused' ? 'Resume' : 'Pause'}
            aria-label={mode === 'paused' ? 'Resume' : 'Pause'} onClick={useGame.getState().togglePause}>
            {mode === 'paused' ? <Play size={17} /> : <Pause size={17} />}
          </button>}
          {!complete && <Control label={presenter ? 'Restart Entire Simulation' : 'Restart'} action={() => start(control)}><RotateCcw size={17} /></Control>}
          {complete && <Control label="Event log" active={showLog} action={() => setShowLog(!showLog)}><ClipboardList size={17} /></Control>}
          <Control label={sound ? 'Sound on' : 'Sound off'} action={soundToggle} active={sound}><Icon size={17} /></Control>
        </>}
        <Control label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} action={() => void full()}><FullIcon size={17} /></Control>
      </div>
    </header>
    {!menu && !complete && <NetworkStatus />}

    {menu ? <>
      <main className="menu-copy">
        <div className="eyebrow"><span className="accent-rule" /> HIMALAYAN ROAD SAFETY</div>
        <h1><span>PAHAAD</span><span>SAATHI</span></h1>
        <p className="menu-subtitle">3D disaster simulation</p>
        <p className="menu-description">Drive the ridge road, react to a rockfall, and steer onto the mountain bypass.</p>
        <div className="menu-entry">
          <button className="start-button" type="button" disabled={!ready} onClick={() => start('drive')}>
            <CarFront size={18} /> {ready ? 'START DRIVING' : 'LOADING ENVIRONMENT'}
          </button>
          <button className="presenter-launch" type="button" disabled={!ready} onClick={() => start('presenter')}>
            <Compass size={17} /> PRESENTER MODE
          </button>
        </div>
        <div className="runtime"><Gamepad2 size={15} /><span>KEYBOARD · GAMEPAD · TOUCH</span></div>
      </main>
      <div className="menu-bottom">
        <div className="menu-controls">
          <Control label={sound ? 'Sound on' : 'Sound off'} action={soundToggle} active={sound} text><Icon size={16} /></Control>
          <button ref={settingsButton} className="control control-text" type="button" aria-label="Settings" aria-expanded={settings} aria-controls="quality-panel"
            onClick={() => setSettings(!settings)}><Settings2 size={16} /><span>Settings</span></button>
        </div>
        {settings && <div className="settings-panel" id="quality-panel">
          <span className="eyebrow">GRAPHICS QUALITY</span>
          <div className="quality-options">{(['Low', 'Medium', 'High'] as Quality[]).map((option) => <button type="button" key={option}
            aria-pressed={quality === option} onClick={() => useGame.getState().setQuality(option)}>{option}</button>)}</div>
        </div>}
      </div>
    </> : complete ? <main className="ending">
      <div className="eyebrow"><BadgeCheck size={18} /> MISSION COMPLETE</div>
      <h1>{driveMode ? <>BYPASS <span>COMPLETE</span></> : <>PAHAAD<span>SAATHI</span></>}</h1>
      <p>{driveMode ? `Ridge Road drive complete · ${timecode(second)}` : 'Detect early. Verify collectively. Route safely.'}</p>
      <FusionFlow />
      <div className="menu-entry">
        <button className="start-button" type="button" ref={replayButton} onClick={() => start(control)}><RotateCcw size={17} /> {driveMode ? 'DRIVE AGAIN' : 'REPLAY SIMULATION'}</button>
        <button className="presenter-launch" type="button" onClick={() => start('presenter')}><Compass size={17} /> PRESENTER MODE</button>
      </div>
    </main> : driveMode ? <>
      <DrivingHud />
      <div className="simulated-tag"><span className="status-light" /> SIMULATED ROAD SAFETY EXERCISE</div>
    </> : <>
      <main className="stage-area">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section key={presenter ? focus : stageIndex} aria-label="Current event inspection" className="event-panel"
            initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .16 }}>
            <div className="eyebrow"><Activity size={15} />{presenter ? 'FIELD INSPECTION' : <><span>{String(stage.chapter).padStart(2, '0')} / {CHAPTERS.length}</span><i /> CURRENT EVENT</>}</div>
            <h1 aria-live="polite">{focus === 'rockfall' && presenter && scenario.settled ? 'Major rockfall — road completely blocked' : routeTitle}</h1>
            <p>{inspectionDescription}</p>
            {!overview && <Inspection focus={focus} />}
            {!presenter && stageIndex === 2 && <Facts data={[['Physical inventory', '2 HC-12 modules confirmed'], ['3MH radio', 'Third virtual endpoint · additional hardware required']]} />}
          </motion.section>
        </AnimatePresence>
      </main>
      {overview && <div className="overview-chain"><FusionFlow /></div>}
      {presenter && <Presenter key={run} />}
      {!presenter && <>
        <div className="mission-progress">
          <div className="progress-label"><Mountain size={14} /><span>MISSION PROGRESS</span><time>{timecode(second)} / {timecode(DURATION)}</time></div>
          <div className="progress-rail" role="progressbar" aria-label="Mission progress" aria-valuemin={0} aria-valuemax={DURATION} aria-valuenow={second}>
            <div className="progress-fill" style={{ width: (second / DURATION) * 100 + '%' }} />
            {CHAPTERS.slice(1).map(([from]) => <i key={from} style={{ left: (from / DURATION) * 100 + '%' }} />)}
          </div>
        </div>
        <div className="timeline-controls">
          <label title="Simulation speed"><span className="sr-only">Simulation speed</span>
            <select aria-label="Simulation speed" value={speed} onChange={(event) => useGame.getState().setSpeed(Number(event.target.value))}>
              {[.5, 1, 1.5, 2, 4].map((value) => <option key={value} value={value}>{value}×</option>)}
            </select>
          </label>
          <Control label="Replay event" action={() => useGame.getState().chapter(0)}><RotateCcw size={15} /></Control>
          <Control label="Skip to next event" disabled={stageIndex === STAGES.length - 1} action={() => useGame.getState().chapter(1)}><SkipForward size={16} /></Control>
          <Control label="Event log" active={showLog} action={() => setShowLog(!showLog)}><ClipboardList size={16} /></Control>
        </div>
      </>}
      <div className="simulated-tag"><span className="status-light" /> SIMULATION MODE — EVENTS ARE VIRTUALLY GENERATED</div>
    </>}
    {showLog && !presenter && !menu && <aside className="auto-log"><EventLog entries={scenario.log} /></aside>}
    {!complete && !presenter && <MiniMap />}
    {mode === 'paused' && !presenter && <div className="paused-layer"><div><span className="eyebrow">MISSION PAUSED</span>
      <button type="button" className="start-button" onClick={useGame.getState().togglePause}><Play size={17} fill="currentColor" /> {driveMode ? 'RESUME DRIVE' : 'RESUME SIMULATION'}</button>
    </div></div>}
    {feedback && <div className="control-feedback" role="status">{feedback}</div>}
    {fallback && !complete && <div className="fallback-note"><MapPin size={14} /> Map view</div>}
  </div>
}
