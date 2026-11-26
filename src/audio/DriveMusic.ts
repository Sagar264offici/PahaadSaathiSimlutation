let track: HTMLAudioElement | undefined

export function updateDriveMusic(playing: boolean, fromBeginning = false) {
  if (!playing) {
    track?.pause()
    if (fromBeginning && track) track.currentTime = 0
    return
  }
  if (!track) {
    track = new Audio('/audio/dr-driving.mp3')
    track.loop = true
    track.volume = .46
    track.preload = 'none'
  }
  if (fromBeginning) track.currentTime = 0
  void track.play().catch(() => { /* A later sound-button gesture can start playback. */ })
}
