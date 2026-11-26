import { create } from 'zustand'
import { cueIndex, DURATION, STAGES } from './Timeline'

export type Quality = 'High' | 'Medium' | 'Low'
type Mode = 'menu' | 'running' | 'paused' | 'complete'

const device = navigator as Navigator & { deviceMemory?: number }
const defaultQuality: Quality = matchMedia('(max-width: 650px)').matches || (device.deviceMemory ?? 8) < 6 ? 'Low' : 'Medium'
const settings = (() => {
  try { return JSON.parse(localStorage.getItem('pahaadsaathi-settings') ?? '{}') ?? {} }
  catch { return {} }
})()

// One clock drives every 3D actor. React updates only at stage and whole-second boundaries.
export const clock = { time: 0, idle: 0 }

type Game = {
  mode: Mode
  stage: number
  second: number
  run: number
  sound: boolean
  quality: Quality
  start: () => void
  togglePause: () => void
  toggleSound: () => void
  setQuality: (quality: Quality) => void
}

export const useGame = create<Game>((set, get) => ({
  mode: 'menu',
  stage: 0,
  second: 0,
  run: 0,
  sound: settings.sound === true,
  quality: ['High', 'Medium', 'Low'].includes(settings.quality) ? settings.quality : defaultQuality,
  start() {
    clock.time = 0
    set({ mode: 'running', stage: 0, second: 0, run: get().run + 1 })
  },
  togglePause() {
    const { mode } = get()
    if (mode === 'running' || mode === 'paused') set({ mode: mode === 'running' ? 'paused' : 'running' })
  },
  toggleSound() { set({ sound: !get().sound }) },
  setQuality(quality) { set({ quality }) },
}))

useGame.subscribe((state, previous) => {
  if (state.sound === previous.sound && state.quality === previous.quality) return
  try { localStorage.setItem('pahaadsaathi-settings', JSON.stringify({ sound: state.sound, quality: state.quality })) }
  catch { /* Settings remain available for the current session. */ }
})

export function advance(delta: number) {
  const game = useGame.getState()
  if (game.mode === 'menu') clock.idle += delta
  if (game.mode !== 'running') return
  clock.time = Math.min(DURATION, clock.time + delta)
  const stage = cueIndex(STAGES, clock.time)
  const second = Math.floor(clock.time)
  if (clock.time === DURATION) useGame.setState({ mode: 'complete', stage, second })
  else if (stage !== game.stage || second !== game.second) useGame.setState({ stage, second })
}
