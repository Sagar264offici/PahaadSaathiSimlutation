import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Activity, ArrowRight, Clock3, Crosshair, Database, MapPin, Maximize, Minimize, Mountain, Pause, Play, Radio, RotateCcw, Settings2, Smartphone, Volume2, VolumeX, CircuitBoard, Cpu, BadgeCheck } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { unlockAudio, updateScore } from '../audio/Score'
import { useGame, type Quality } from '../game/GameEngine'
import { CUES, DURATION, STAGES } from '../game/Timeline'
import { MiniMap } from './MiniMap'

const timecode = (seconds: number) => String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
const chapterTimes = STAGES.filter((stage, i) => !i || stage.chapter !== STAGES[i - 1].chapter)
const components = [
  [Activity, 'Field sensor'], [CircuitBoard, 'Arduino UNO'], [Radio, 'HC-12 RF'],
  [Cpu, 'Tinker Board'], [Database, 'Supabase'], [Smartphone, 'PahaadSaathi app'],
] as const

function Control({ label, children, action, active, text = false }: {
  label: string; children: ReactNode; action: () => void; active?: boolean; text?: boolean
}) {
  return <button className={`control ${text ? 'control-text' : ''}`} type="button" onClick={action} aria-label={label}
    title={label} aria-pressed={active}>{children}{text && <span>{label}</span>}</button>
}

function Architecture() {
  return <div className="architecture" aria-label="Field sensor to Arduino UNO to HC-12 RF to Tinker Board to Supabase to PahaadSaathi app">
    {components.map(([Icon, label], i) => <div className="architecture-step" key={label}>
      {i > 0 && <ArrowRight className="architecture-arrow" aria-hidden="true" size={13} />}
      <div><Icon size={17} /><span>{label}</span></div>
    </div>)}
  </div>
}

export function Hud({ ready, fallback }: { ready: boolean; fallback: boolean }) {
  const mode = useGame((state) => state.mode)
  const stageIndex = useGame((state) => state.stage)
  const second = useGame((state) => state.second)
  const run = useGame((state) => state.run)
  const sound = useGame((state) => state.sound)
  const quality = useGame((state) => state.quality)
  const stage = STAGES[stageIndex]
  const reducedMotion = useReducedMotion()
  const [settings, setSettings] = useState(false)
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))
  const [feedback, setFeedback] = useState('')
  const lastCue = useRef('')
  const startButton = useRef<HTMLButtonElement>(null)
  const replayButton = useRef<HTMLButtonElement>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const pauseButton = useRef<HTMLButtonElement>(null)
  const menu = mode === 'menu'
  const complete = mode === 'complete'
  const overview = !complete && second >= CUES.overview

  useEffect(() => {
    const cue = run + '/' + stageIndex + '/' + complete
    updateScore(sound, mode, stage.chapter, cue !== lastCue.current && mode !== 'menu')
    lastCue.current = cue
  }, [sound, mode, stageIndex, run, stage.chapter, complete])

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

  useEffect(() => {
    if (complete) replayButton.current?.focus()
  }, [complete])

  function start() {
    if (!ready) return
    if (sound) unlockAudio()
    setSettings(false)
    useGame.getState().start()
    requestAnimationFrame(() => pauseButton.current?.focus({ preventScroll: true }))
  }

  function soundToggle() {
    if (!useGame.getState().sound) unlockAudio()
    useGame.getState().toggleSound()
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
      if (event.code === 'Space' && !menu && !complete) {
        event.preventDefault()
        useGame.getState().togglePause()
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [menu, complete, settings])

  const Icon = sound ? Volume2 : VolumeX
  const FullIcon = fullscreen ? Minimize : Maximize
  return <div className={`hud ${menu ? 'hud-menu' : 'hud-active'} ${complete ? 'hud-complete' : ''} ${overview ? 'hud-overview' : ''}`}>
    <div className="cinema-wash" />
    <header className="hud-header">
      <div className="brand-lockup">
        <img src="/mark.svg" width="42" height="42" alt="" />
        <div>{menu ? <strong>PAHAADSAATHI</strong> : <strong>MOUNTAIN ROAD SAFETY</strong>}
          <span>{menu ? 'FIELD SIMULATION' : 'DEMONSTRATION ENVIRONMENT'}</span></div>
      </div>
      {menu && <div className="compass" aria-hidden="true"><span>NW</span><i /><i /><i /><Crosshair size={13} /><i /><i /><i /><span>NE</span></div>}
      <div className="header-actions">
        <div className={`system-tag ${stage.tone ?? ''}`}>
          <span className="status-light" />
          <span>{fallback ? '2D FALLBACK' : menu ? 'DEMONSTRATION ENVIRONMENT' : stage.status}</span>
        </div>
        {!menu && <>
          {!complete && <button ref={pauseButton} className="control" type="button" title={mode === 'paused' ? 'Resume' : 'Pause'}
            aria-label={mode === 'paused' ? 'Resume' : 'Pause'} onClick={useGame.getState().togglePause}>
            {mode === 'paused' ? <Play size={17} /> : <Pause size={17} />}
          </button>}
          {!complete && <Control label="Restart" action={start}><RotateCcw size={17} /></Control>}
          <Control label={sound ? 'Sound on' : 'Sound off'} action={soundToggle} active={sound}><Icon size={17} /></Control>
        </>}
        <Control label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} action={() => void full()}><FullIcon size={17} /></Control>
      </div>
    </header>

    {menu ? <>
      <main className="menu-copy">
        <div className="eyebrow"><span className="accent-rule" /> HIMALAYAN ROAD SAFETY</div>
        <h1><span>PAHAAD</span><span>SAATHI</span></h1>
        <p className="menu-subtitle">Mountain safety simulation</p>
        <p className="menu-description">Follow a roadside sensor alert from a Himalayan slope to a driver’s route decision.</p>
        <button className="start-button" ref={startButton} type="button" disabled={!ready} onClick={start}>
          <Play size={17} fill="currentColor" /> {ready ? 'START SIMULATION' : 'LOADING ENVIRONMENT'}
        </button>
        <div className="runtime"><Clock3 size={14} /><span>{timecode(DURATION)} MIN</span><i /><span>AUTONOMOUS PLAYBACK</span></div>
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
      <h1>PAHAAD<span>SAATHI</span></h1>
      <p>From detection to decision.</p>
      <Architecture />
      <button className="start-button" type="button" ref={replayButton} onClick={start}><RotateCcw size={17} /> REPLAY SIMULATION</button>
    </main> : <>
      <main className="stage-area">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section key={stageIndex} aria-live="polite" aria-atomic="true" className="event-panel"
            initial={reducedMotion ? false : { opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .19 }}>
            <div className="eyebrow"><Activity size={15} /><span>{String(stage.chapter).padStart(2, '0')} / 11</span><i /> CURRENT EVENT</div>
            <h1>{stage.title}</h1>
            <p>{stage.description}</p>
            {stage.facts && <dl>{stage.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
          </motion.section>
        </AnimatePresence>
      </main>
      {overview && <div className="overview-chain"><Architecture /></div>}
      <div className="mission-progress">
        <div className="progress-label"><Mountain size={14} /><span>MISSION PROGRESS</span><time>{timecode(second)} / {timecode(DURATION)}</time></div>
        <div className="progress-rail" role="progressbar" aria-label="Mission progress" aria-valuemin={0} aria-valuemax={DURATION} aria-valuenow={second}>
          <div className="progress-fill" style={{ width: (second / DURATION) * 100 + '%' }} />
          {chapterTimes.slice(1).map(({ from }) => <i key={from} style={{ left: (from / DURATION) * 100 + '%' }} />)}
        </div>
      </div>
      <div className="simulated-tag"><span className="status-light" /> SIMULATED DATA</div>
    </>}
    {!complete && <MiniMap />}
    {mode === 'paused' && <div className="paused-layer"><div><span className="eyebrow">MISSION PAUSED</span>
      <button type="button" className="start-button" onClick={useGame.getState().togglePause}><Play size={17} fill="currentColor" /> RESUME SIMULATION</button>
    </div></div>}
    {feedback && <div className="control-feedback" role="status">{feedback}</div>}
    {fallback && !complete && <div className="fallback-note"><MapPin size={14} /> The mission plays in map view on this device.</div>}
  </div>
}
