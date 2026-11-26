import { useGame } from '../game/GameEngine'

let context: AudioContext | undefined
let master: GainNode | undefined
let bed: GainNode | undefined

function note(frequency: number, start: number, length: number, level: number, type: OscillatorType = 'sine') {
  if (!context || !master) return
  const envelope = context.createGain()
  envelope.gain.setValueAtTime(.0001, start)
  envelope.gain.exponentialRampToValueAtTime(level, start + .045)
  envelope.gain.exponentialRampToValueAtTime(.0001, start + length)
  const tone = context.createOscillator()
  tone.type = type
  tone.frequency.value = frequency
  tone.connect(envelope).connect(master)
  tone.start(start)
  tone.stop(start + length + .01)
}

const motifs: Record<number, number[]> = {
  1: [196, 293.66, 392], 2: [329.63, 392], 3: [174.61, 155.56], 4: [261.63, 392],
  5: [329.63, 493.88, 659.25], 6: [392, 523.25], 7: [440, 587.33, 659.25],
  8: [587.33, 783.99], 9: [261.63, 293.66], 10: [261.63, 392], 11: [196, 174.61], 12: [261.63, 392, 523.25, 659.25],
}

export function unlockAudio() {
  if (!context) {
    const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Audio) return
    try {
      context = new Audio()
      master = context.createGain()
      master.gain.value = useGame.getState().sound ? .35 : 0
      master.connect(context.destination)
      bed = context.createGain()
      bed.gain.value = .0001
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 235
      bed.connect(filter).connect(master)
      for (const [frequency, type] of [[65.406, 'sine'], [98, 'sine'], [130.813, 'triangle'], [196.23, 'sine']] as const) {
        const oscillator = context.createOscillator()
        oscillator.type = type
        oscillator.frequency.value = frequency
        const gain = context.createGain()
        gain.gain.value = frequency < 100 ? .23 : .11
        oscillator.connect(gain).connect(bed)
        oscillator.start()
      }
    } catch { return }
  }
  void context.resume().catch(() => undefined)
}

export function updateScore(sound: boolean, mode: string, stage: number, cue: boolean) {
  if (!context || !master || !bed) return
  const now = context.currentTime
  master.gain.setTargetAtTime(sound && mode !== 'paused' ? .40 : 0, now, .09)
  bed.gain.setTargetAtTime(mode === 'menu' || mode === 'complete' ? .04 : .14, now, .5)
  if (!cue || !sound || mode === 'paused') return
  const motif = motifs[stage] ?? []
  motif.forEach((frequency, i) => note(frequency, now + i * .16, 1.22, .075, i === 0 ? 'triangle' : 'sine'))
}
