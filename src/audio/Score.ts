import { clock, useGame } from '../game/GameEngine'

let context: AudioContext | undefined
let master: GainNode | undefined
let bed: GainNode | undefined
let impact: AudioBuffer | undefined
let loadingImpact: Promise<void> | undefined
let impactSource: AudioBufferSourceNode | undefined
let impactBus: GainNode | undefined
let rumble: OscillatorNode[] = []

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
      impactBus = context.createGain()
      const pan = context.createStereoPanner()
      pan.pan.value = .22
      impactBus.connect(pan).connect(context.destination)
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
  if (!loadingImpact && context) {
    const audioContext = context
    loadingImpact = fetch('/audio/stone-falling.mp3').then((response) => {
      if (!response.ok) throw new Error('Rockfall audio unavailable')
      return response.arrayBuffer()
    }).then((data) => audioContext.decodeAudioData(data)).then((buffer) => {
      impact = buffer
      syncRockfallAudio()
    }).catch(() => { loadingImpact = undefined })
  }
}

export function updateScore(sound: boolean, mode: string, stage: number, cue: boolean) {
  if (!context || !master || !bed) return
  const now = context.currentTime
  const { volume } = useGame.getState()
  master.gain.setTargetAtTime(sound && mode !== 'paused' ? .40 * volume.master * volume.environment : 0, now, .09)
  bed.gain.setTargetAtTime(mode === 'menu' || mode === 'complete' ? .04 : .14, now, .5)
  if (!cue || !sound || mode === 'paused') return
  const motif = motifs[stage] ?? []
  motif.forEach((frequency, i) => note(frequency, now + i * .16, 1.22, .075, i === 0 ? 'triangle' : 'sine'))
}

export function syncRockfallAudio() {
  if (impactSource) {
    impactSource.stop()
    impactSource = undefined
  }
  for (const source of rumble) source.stop()
  rumble = []
  if (!context || !impact || !impactBus) return
  const { mode, control, sound, volume, scenario, speed } = useGame.getState()
  if (!sound || mode !== 'running' || document.hidden || scenario.rockAt === null) return
  const rate = control === 'auto' ? speed : 1
  const age = clock.time - scenario.rockAt
  const offset = Math.max(0, age - .48)
  impactBus.gain.value = volume.master * volume.events * .82
  // Layer ground vibration and low thuds at the two groups of road impacts.
  for (const [cue, duration, pitch, level] of [[.02, 1.3, 44, .15], [5.27, .8, 57, .25], [6.62, 1.38, 51, .17]]) {
    if (age > cue + .06) continue
    const start = context.currentTime + Math.max(0, cue - age) / rate
    const end = start + duration / rate
    const ground = context.createOscillator()
    const envelope = context.createGain()
    ground.frequency.setValueAtTime(pitch, start)
    ground.frequency.exponentialRampToValueAtTime(28, end)
    envelope.gain.setValueAtTime(.0001, start)
    envelope.gain.linearRampToValueAtTime(level, start + .1 / rate)
    envelope.gain.exponentialRampToValueAtTime(.0001, end)
    ground.connect(envelope).connect(impactBus)
    ground.start(start)
    ground.stop(end)
    rumble.push(ground)
  }
  if (offset >= impact.duration) return
  const source = context.createBufferSource()
  source.buffer = impact
  source.playbackRate.value = rate
  source.connect(impactBus)
  source.start(context.currentTime + Math.max(0, .48 - age) / rate, offset)
  impactSource = source
  source.onended = () => { if (impactSource === source) impactSource = undefined }
}
