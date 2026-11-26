import { create } from 'zustand'
import { driveIncident, driveMission, newDrive, stepDrive, type DriveState } from './Drive'
import { clearDriveInput, readDriveInput } from './DrivingInput'
import { advanceScenario, applyCommand, initialScenario, type Command, type Focus, type ReportCategory, type Scenario } from './Scenario'
import { applyTimeline, CHAPTERS, cueIndex, CUES, DURATION, scenarioAt, STAGES } from './Timeline'

export type Quality = 'High' | 'Medium' | 'Low'
export type Session = 'drive' | 'auto' | 'presenter'
type Mode = 'menu' | 'running' | 'paused' | 'complete'

const device = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { deviceMemory?: number }
const defaultQuality: Quality = (typeof matchMedia !== 'undefined' && matchMedia('(max-width: 650px)').matches) || (device?.deviceMemory ?? 8) < 6 ? 'Low' : 'Medium'
const settings = (() => {
  try { return JSON.parse(localStorage.getItem('pahaadsaathi-settings') ?? '{}') ?? {} }
  catch { return {} }
})()

// Camera and actor time advance together. HUD renders at cue and whole-second boundaries.
export const clock = { time: 0, idle: 0 }
export const driving = { frame: newDrive() }
let telemetryTick = -1
const prototypeFocus: readonly Focus[] = ['NODE-01', 'NODE-02', 'GW-01', 'packet', 'cloud', 'community']

type Game = {
  mode: Mode
  control: Session
  stage: number
  second: number
  run: number
  speed: number
  sound: boolean
  quality: Quality
  drive: DriveState
  scenario: Scenario
  focus: Focus
  focusVersion: number
  cameraOverride: Focus | null
  start: (control?: Session) => void
  menu: () => void
  togglePause: () => void
  toggleSound: () => void
  setQuality: (quality: Quality) => void
  setSpeed: (speed: number) => void
  command: (action: Command, focus?: Focus) => void
  inspect: (focus: Focus) => void
  setCameraOverride: (focus: Focus | null) => void
  interact: () => void
  editReport: (changes: { reportCategory?: ReportCategory; reportDescription?: string }) => void
  seek: (time: number) => void
  chapter: (direction: number) => void
}

export function worldFocus(game: Game) {
  return game.control === 'auto' ? game.cameraOverride ?? STAGES[game.stage].focus : game.focus
}

export function regionalView(game: Game) {
  return game.cameraOverride !== null ? game.cameraOverride === 'production' : game.scenario.architecture === 'production'
}

export const useGame = create<Game>((set, get) => ({
  mode: 'menu', control: 'auto', stage: 0, second: 0, run: 0, speed: 1,
  sound: settings.sound !== false,
  quality: ['High', 'Medium', 'Low'].includes(settings.quality) ? settings.quality : defaultQuality,
  drive: driving.frame, scenario: initialScenario(), focus: 'world', focusVersion: 0, cameraOverride: null,
  start(control = 'drive') {
    clock.time = control === 'presenter' ? CUES.approach : 0
    const game = get()
    clearDriveInput()
    driving.frame = newDrive()
    telemetryTick = -1
    set({
      mode: 'running', control, stage: 0, second: Math.floor(clock.time),
      run: game.run + 1, cameraOverride: null, drive: driving.frame, scenario: initialScenario(), focus: control === 'drive' ? 'vehicle' : 'world', focusVersion: game.focusVersion + 1,
    })
  },
  menu() { clearDriveInput(); clock.time = 0; set({ mode: 'menu', stage: 0, second: 0, scenario: initialScenario(), focus: 'world', cameraOverride: null }) },
  togglePause() {
    const { mode } = get()
    if (mode === 'running' || mode === 'paused') {
      clearDriveInput()
      set({ mode: mode === 'running' ? 'paused' : 'running' })
    }
  },
  toggleSound() { set({ sound: !get().sound }) },
  setQuality(quality) { set({ quality }) },
  setSpeed(speed) { set({ speed }) },
  command(action, focus) {
    const game = get()
    if (game.control !== 'presenter' || game.mode === 'menu') return
    const scenario = applyCommand(game.scenario, action, clock.time)
    if (scenario === game.scenario) {
      if (action === 'app' && focus) game.inspect(focus)
      return
    }
    if (!focus) { set({ scenario }); return }
    const visible = prototypeFocus.includes(focus) ? applyCommand(scenario, 'prototype', clock.time) : scenario
    set({ scenario: visible, focus, focusVersion: game.focusVersion + 1 })
  },
  inspect(focus) {
    const game = get()
    if (game.mode === 'menu') return
    if (game.control === 'auto') { game.setCameraOverride(focus); return }
    const scenario = prototypeFocus.includes(focus) ? applyCommand(game.scenario, 'prototype', clock.time) : game.scenario
    if (game.control === 'drive') clearDriveInput()
    set({ scenario, focus, focusVersion: game.focusVersion + 1 })
  },
  setCameraOverride(focus) {
    set({ cameraOverride: focus, focusVersion: get().focusVersion + 1 })
  },
  interact() {
    const game = get()
    if (game.control !== 'drive' || game.mode !== 'running') return
    const { action, focus } = driveMission(driving.frame, game.scenario)
    if (!action || !focus) return
    clearDriveInput()
    driving.frame = { ...driving.frame, inspectedAt: { ...driving.frame.inspectedAt, [action]: clock.time } }
    const scenario = driveIncident(game.scenario, driving.frame, clock.time)
    set({ drive: driving.frame, focus, focusVersion: game.focusVersion + 1, scenario })
  },
  editReport(changes) {
    const game = get()
    if (game.control === 'presenter' && game.scenario.report === 'draft') {
      set({ scenario: { ...game.scenario, ...changes } })
    }
  },
  seek(time) {
    const game = get()
    const target = Math.max(0, Math.min(time, DURATION - .02))
    const stage = cueIndex(STAGES, target)
    clock.time = target
    set({
      mode: game.mode === 'complete' ? 'running' : game.mode,
      stage, second: Math.floor(target), scenario: scenarioAt(target),
      focus: STAGES[stage].focus, cameraOverride: null, focusVersion: game.focusVersion + 1,
    })
  },
  chapter(direction) {
    const game = get()
    if (game.control === 'auto') {
      const index = Math.min(STAGES.length - 1, Math.max(0, game.stage + direction))
      game.seek(STAGES[index].from)
      return
    }
    const index = Math.min(CHAPTERS.length - 1, Math.max(0, STAGES[game.stage].chapter - 1 + direction))
    game.seek(CHAPTERS[index][0])
  },
}))

useGame.subscribe((state, previous) => {
  if (state.sound === previous.sound && state.quality === previous.quality) return
  try { localStorage.setItem('pahaadsaathi-settings', JSON.stringify({ sound: state.sound, quality: state.quality })) }
  catch { /* The settings remain available in this session. */ }
})

export function advance(delta: number) {
  const game = useGame.getState()
  if (game.mode === 'menu') clock.idle += delta
  if (game.mode !== 'running') return
  if (game.control === 'drive') {
    let remaining = Math.min(delta, .15)
    let scenario = game.scenario
    const input = game.focus === 'vehicle' ? readDriveInput() : { throttle: 0, steer: 0, brake: true }
    while (remaining > .00001) {
      const step = Math.min(remaining, 1 / 60)
      clock.time += step
      driving.frame = stepDrive(driving.frame, input, scenario.rockAt !== null, scenario.routeAt !== null, step)
      scenario = driveIncident(scenario, driving.frame, clock.time)
      remaining -= step
    }
    const tick = Math.floor(clock.time * 12)
    const finish = driving.frame.gates.includes('finish') && scenario.verification === 'Confirmed closure'
    if (finish || tick !== telemetryTick || scenario !== game.scenario || driving.frame.gates !== game.drive.gates) {
      telemetryTick = tick
      useGame.setState({ mode: finish ? 'complete' : 'running', second: Math.floor(clock.time), drive: driving.frame, scenario })
    }
    return
  }
  const previous = clock.time
  const auto = game.control === 'auto'
  clock.time = auto ? Math.min(DURATION, previous + delta * game.speed) : previous + delta
  const stage = auto ? cueIndex(STAGES, clock.time) : game.stage
  const second = Math.floor(clock.time)
  const scenario = auto ? applyTimeline(game.scenario, previous, clock.time) : advanceScenario(game.scenario, clock.time)
  if (auto && clock.time === DURATION) useGame.setState({ mode: 'complete', stage, second, scenario })
  else if (stage !== game.stage || second !== game.second || scenario !== game.scenario) useGame.setState({ stage, second, scenario })
}
