import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Activity, ArrowUpRight, BadgeCheck, CarFront, ClipboardList, Compass, Crosshair, House, MapPin, Maximize, Minimize, Mountain, Pause, Play, Radio, RotateCcw, ShieldCheck, SkipBack, Settings2, SkipForward, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { updateDriveMusic } from '../audio/DriveMusic'
import { syncRockfallAudio, unlockAudio, updateScore } from '../audio/Score'
import { regionalView, useGame, worldFocus, type Quality, type Session } from '../game/GameEngine'
import { roadIsBlocked } from '../game/Scenario'
import { CHAPTERS, CUES, DURATION, STAGES } from '../game/Timeline'
import { focusLabels, FusionFlow, Inspection } from './Inspection'
import { DrivingHud } from './DrivingHud'
import { MiniMap } from './MiniMap'
import { Headquarters } from './Operations'
import { appHref, appScreen, SafetyApp } from './SafetyApp'
import { EventLog, Presenter } from './Presenter'

const timecode = (seconds: number) => String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')

function Control({ label, children, action, active, text = false, disabled = false }: {
  label: string; children: ReactNode; action: () => void; active?: boolean; text?: boolean; disabled?: boolean
}) {
  return <button className={`control ${text ? 'control-text' : ''}`} type="button" onClick={action} aria-label={label}
    title={label} aria-pressed={active} disabled={disabled}>{children}{text && <span>{label}</span>}</button>
}

function AudioSettings() {
  const volume = useGame((state) => state.volume)
  return <div className="volume-settings">
    {(['master', 'environment', 'events'] as const).map((channel) => <label key={channel}>{channel === 'events' ? 'Rockfall' : channel === 'master' ? 'Master' : 'Environment'}
      <input type="range" min={0} max={1} step={.05} value={volume[channel]}
        onChange={(event) => useGame.getState().setVolume(channel, Number(event.target.value))} />
    </label>)}
  </div>
}

function NetworkStatus() {
  const regional = useGame(regionalView)
  const control = useGame((state) => state.control)
  const scenario = useGame((state) => state.scenario)
  const blocked = roadIsBlocked(scenario)
  const holding = control === 'drive' && scenario.rockAt !== null
  const WifiIcon = scenario.internet ? Wifi : WifiOff
  return <div className="network-status" aria-label="Network and hazard status">
    {!regional ? <div className="node-status" aria-label="LoRa network nodes">
      {(['NODE-01', 'NODE-02', 'GW-01'] as const).map((id) =>
        <button key={id} type="button" onClick={() => useGame.getState().inspect(id)} aria-label={'Focus node ' + id}>
          <span className="status-light" />{id}<small>{id === 'NODE-01' && !scenario.nodeOnline ? 'OFFLINE' : 'ONLINE'}</small>
        </button>)}
      <span className="rf-status"><Radio size={13} /> LoRa ACTIVE</span>
    </div> : <span className="rf-status"><Radio size={13} /> REAL-WORLD DEPLOYMENT · PROPOSED LoRa</span>}
    <div className="hazard-status">
      <span className={scenario.internet ? '' : 'warn'}><WifiIcon size={14} /> INTERNET {scenario.internet ? 'ONLINE' : 'OFFLINE'}</span>
      <span className={blocked || holding ? 'warn' : ''}>ROAD {scenario.verification === 'Confirmed closure' ? 'CLOSED' : blocked ? 'BLOCKED' : holding ? 'HOLD' : 'OPEN'}</span>
      <span>HAZARD {!scenario.nodeOnline && scenario.verification === 'Normal' ? 'UNKNOWN' : scenario.rockAt !== null && !scenario.settled ? 'LANDSLIDE DETECTED' : scenario.verification === 'Normal' && blocked ? 'LANDSLIDE / BLOCKAGE' : scenario.verification.toUpperCase()}</span>
    </div>
  </div>
}

export function Hud({ ready, fallback, appPage }: { ready: boolean; fallback: boolean; appPage: ReturnType<typeof appScreen> }) {
  const mode = useGame((state) => state.mode)
  const control = useGame((state) => state.control)
  const stageIndex = useGame((state) => state.stage)
  const second = useGame((state) => state.second)
  const run = useGame((state) => state.run)
  const sound = useGame((state) => state.sound)
  const speed = useGame((state) => state.speed)
  const volume = useGame((state) => state.volume)
  const focusVersion = useGame((state) => state.focusVersion)
  const quality = useGame((state) => state.quality)
  const focus = useGame(worldFocus)
  const cameraOverride = useGame((state) => state.cameraOverride)
  const scenario = useGame((state) => state.scenario)
  const stage = STAGES[stageIndex]
  const reducedMotion = useReducedMotion()
  const [presentationReady, setPresentationReady] = useState(false)
  const [settings, setSettings] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showHq, setShowHq] = useState(false)
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
  const nowBlocked = roadIsBlocked(scenario)
  const status = scenario.architecture === 'production' ? 'PRODUCTION PROPOSAL'
    : !scenario.internet ? 'INTERNET OFFLINE'
      : scenario.verification !== 'Normal' ? scenario.verification.toUpperCase()
        : nowBlocked ? 'ROAD BLOCKED' : scenario.rockAt !== null ? 'LANDSLIDE TRIGGERED' : 'MONITORING'

  useEffect(() => {
    const cue = run + '/' + stageIndex + '/' + complete
    updateScore(sound && control !== 'drive', mode, stage.chapter, cue !== lastCue.current && mode !== 'menu')
    lastCue.current = cue
  }, [sound, mode, stageIndex, run, stage.chapter, complete, control, volume])

  useEffect(() => {
    function syncMusic() { updateDriveMusic(sound && driveMode && mode === 'running' && !document.hidden, false, volume.master * volume.environment * .46) }
    syncMusic()
    document.addEventListener('visibilitychange', syncMusic)
    return () => document.removeEventListener('visibilitychange', syncMusic)
  }, [sound, driveMode, mode, volume])

  useEffect(() => {
    syncRockfallAudio()
    document.addEventListener('visibilitychange', syncRockfallAudio)
    return () => document.removeEventListener('visibilitychange', syncRockfallAudio)
  }, [sound, mode, scenario.rockAt, run, speed, focusVersion, volume])

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
    if (sound) unlockAudio()
    if (session === 'drive') updateDriveMusic(sound, true, volume.master * volume.environment * .46)
    setSettings(false)
    setShowLog(false)
    setShowHq(false)
    setPresentationReady(false)
    useGame.getState().start(session)
    if (session === 'auto') requestAnimationFrame(() => pauseButton.current?.focus({ preventScroll: true }))
  }

  function soundToggle() {
    const state = useGame.getState()
    if (!state.sound) unlockAudio()
    if (driveMode) updateDriveMusic(!state.sound && state.mode === 'running', false, volume.master * volume.environment * .46)
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
      if (appPage) return
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return
      if (event.key === 'Escape' && settings) {
        setSettings(false)
        settingsButton.current?.focus()
        return
      }
      if ((event.target as HTMLElement | null)?.closest(driveMode ? 'input, select, textarea' : 'button, input, select, textarea')) return
      if ((driveMode ? event.code === 'Escape' : event.code === 'Space') && !menu && !complete) {
        event.preventDefault()
        useGame.getState().togglePause()
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [menu, complete, settings, driveMode, appPage])

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
  return <><div inert={!!appPage} className={`hud ${appPage ? 'hud-hidden' : ''} ${menu ? 'hud-menu' : 'hud-active'} ${complete ? 'hud-complete' : ''} ${overview ? 'hud-overview' : ''} ${presenter ? 'hud-presenter' : ''} ${driveMode ? 'hud-driving' : ''} ${scenario.architecture === 'production' ? 'hud-production' : ''}`}>
    <div className="cinema-wash" />
    <header className="hud-header">
      <div className="brand-lockup">
        <img src="/mark.svg" width="42" height="42" alt="" />
        <div><strong>PAHAADSAATHI</strong>
          <span>{menu ? 'FIELD SIMULATION' : '3D DISASTER SIMULATION'}</span></div>
      </div>
      {menu && <div className="compass" aria-hidden="true"><span>NW</span><i /><i /><i /><Crosshair size={13} /><i /><i /><i /><span>NE</span></div>}
      {!menu && <div className="mode-label"><span className="status-light" />{presenter ? 'FIELD CONTROLS' : driveMode ? 'GAME MODE' : 'PRESENTATION MODE'}</div>}
      <div className="header-actions">
        <div className={`system-tag ${nowBlocked || scenario.rockAt !== null && !scenario.settled ? 'red' : stage.tone ?? ''}`}>
          <span className="status-light" />
          <span>{fallback ? '2D FALLBACK' : menu ? 'DEMONSTRATION ENVIRONMENT' : complete ? 'MISSION COMPLETE' : status}</span>
        </div>
        {!menu && <>
          <Control label="Main menu" action={() => { setPresentationReady(false); setShowHq(false); setSettings(false); useGame.getState().menu() }}><House size={17} /></Control>
          {!complete && <button ref={pauseButton} className="control" type="button" title={mode === 'paused' ? 'Resume' : 'Pause'}
            aria-label={mode === 'paused' ? 'Resume' : 'Pause'} onClick={useGame.getState().togglePause}>
            {mode === 'paused' ? <Play size={17} /> : <Pause size={17} />}
          </button>}
          {!complete && <Control label={presenter ? 'Restart Entire Simulation' : 'Restart'} action={() => start(control)}><RotateCcw size={17} /></Control>}
          {complete && <Control label="Event log" active={showLog} action={() => setShowLog(!showLog)}><ClipboardList size={17} /></Control>}
          <Control label={sound ? 'Sound on' : 'Sound off'} action={soundToggle} active={sound}><Icon size={17} /></Control>
          {!complete && <Control label="Headquarters" action={() => setShowHq(!showHq)} active={showHq}><ShieldCheck size={17} /></Control>}
          <Control label="Audio settings" action={() => setSettings(!settings)} active={settings}><Settings2 size={17} /></Control>
        </>}
        <Control label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} action={() => void full()}><FullIcon size={17} /></Control>
      </div>
    </header>
    {!menu && !complete && <NetworkStatus />}

    {menu ? <>
      <main className="menu-copy">
        <div className="eyebrow"><span className="accent-rule" /> HIMALAYAN ROAD SAFETY</div>
        <h1><span>PAHAAD</span><span>SAATHI</span></h1>
        <p className="menu-subtitle">Mountain Safety Simulation</p>
        {presentationReady ? <>
          <p className="menu-description">Watch the SUV trigger a distant landslide, then follow the sensor warning to headquarters, the phone, and the long detour.</p>
          <div className="menu-entry">
            <button className="start-button" type="button" disabled={!ready} onClick={() => start('auto')}>
              <Play size={17} fill="currentColor" /> START PRESENTATION
            </button>
            <button className="presenter-launch" type="button" onClick={() => setPresentationReady(false)}>BACK TO MODES</button>
          </div>
        </> : <div className="mode-choices">
          <button className="mode-choice" type="button" disabled={!ready} onClick={() => setPresentationReady(true)} aria-label="Presentation Mode">
            <Play size={19} /><strong>PRESENTATION MODE</strong><span>Cinematic autonomous system demonstration</span>
          </button>
          <button className="mode-choice" type="button" disabled={!ready} onClick={() => start('drive')} aria-label="Game Mode">
            <CarFront size={20} /><strong>GAME MODE</strong><span>Drive the ridge, explore sensors and track LoRa packets</span>
          </button>
        </div>}

      </main>
      <div className="menu-bottom">
        <div className="menu-controls">
          <a href={appHref()} className="control control-text safety-launch">Open PahaadSaathi app <ArrowUpRight size={15} /></a>
          <Control label={sound ? 'Sound on' : 'Sound off'} action={soundToggle} active={sound} text><Icon size={16} /></Control>
          <button ref={settingsButton} className="control control-text" type="button" aria-label="Settings" aria-expanded={settings} aria-controls="quality-panel"
            onClick={() => setSettings(!settings)}><Settings2 size={16} /><span>Settings</span></button>
        </div>
        {settings && <div className="settings-panel" id="quality-panel">
          <span className="eyebrow">GRAPHICS QUALITY</span>
          <div className="quality-options">{(['Low', 'Medium', 'High'] as Quality[]).map((option) => <button type="button" key={option}
            aria-pressed={quality === option} onClick={() => useGame.getState().setQuality(option)}>{option}</button>)}</div>
          <AudioSettings />
        </div>}
      </div>
    </> : complete ? <main className="ending">
      <div className="eyebrow"><BadgeCheck size={18} /> MISSION COMPLETE</div>
      <h1>{driveMode ? <>BYPASS <span>COMPLETE</span></> : <>PAHAAD<span>SAATHI</span></>}</h1>
      <p>{driveMode ? `Ridge Road drive complete · ${timecode(second)}` : 'Detect early. Verify collectively. Route safely.'}</p>
      <FusionFlow />
      <div className="menu-entry">
        <button className="start-button" type="button" ref={replayButton} onClick={() => start(control)}><RotateCcw size={17} /> {driveMode ? 'DRIVE AGAIN' : 'REPLAY PRESENTATION'}</button>
        <button className="presenter-launch" type="button" onClick={() => {
          if (!driveMode) { start('drive'); return }
          useGame.getState().menu()
          setSettings(false)
          setPresentationReady(true)
        }}><Compass size={17} /> {driveMode ? 'PRESENTATION MODE' : 'GAME MODE'}</button>
        <a className="control control-text safety-launch" href={appHref('alerts')}>Open PahaadSaathi app <ArrowUpRight size={15} /></a>
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
          <label className="presentation-focus"><span className="sr-only">Camera focus</span>
            <select aria-label="Camera focus" value={cameraOverride ?? ''} onChange={(event) => {
              const value = event.target.value
              useGame.getState().setCameraOverride(value ? value as import('../game/Scenario').Focus : null)
            }}>
              <option value="">Cinematic camera</option><option value="rockfall">Landslide face</option><option value="NODE-01">NODE-01</option>
              <option value="NODE-02">NODE-02</option><option value="GW-01">GW-01</option><option value="packet">LoRa packet</option>
              <option value="production">Regional deployment</option><option value="vehicle">SUV</option><option value="route">Aerial detour</option>
            </select>
          </label>
          <Control label="Previous event" disabled={stageIndex === 0} action={() => useGame.getState().chapter(-1)}><SkipBack size={15} /></Control>
          <Control label="Replay event" action={() => useGame.getState().chapter(0)}><RotateCcw size={15} /></Control>
          <Control label="Next event" disabled={stageIndex === STAGES.length - 1} action={() => useGame.getState().chapter(1)}><SkipForward size={16} /></Control>
          <Control label="Event log" active={showLog} action={() => setShowLog(!showLog)}><ClipboardList size={16} /></Control>
        </div>
      </>}
      <div className="simulated-tag"><span className="status-light" /> SIMULATION MODE — EVENTS ARE VIRTUALLY GENERATED</div>
    </>}
    {showLog && !presenter && !menu && <aside className="auto-log"><EventLog entries={scenario.log} /></aside>}
    {menu && <MiniMap />}
    {!menu && !complete && !presenter && <SafetyApp key={run} />}
    {!menu && !complete && showHq && <Headquarters onClose={() => setShowHq(false)} />}
    {!menu && settings && <div className="active-settings settings-panel"><AudioSettings /></div>}
    {mode === 'paused' && !presenter && <div className="paused-layer"><div><span className="eyebrow">MISSION PAUSED</span>
      <button type="button" className="start-button" onClick={useGame.getState().togglePause}><Play size={17} fill="currentColor" /> {driveMode ? 'RESUME DRIVE' : 'RESUME PRESENTATION'}</button>
    </div></div>}
    {feedback && <div className="control-feedback" role="status">{feedback}</div>}
    {fallback && !complete && <div className="fallback-note"><MapPin size={14} /> Map view</div>}
  </div>
    {appPage && <SafetyApp key={run} full={{ screen: appPage, ready, startDrive: () => {
      if (ready) { start('drive'); window.location.hash = 'simulation' }
    } }} />}
  </>
}
