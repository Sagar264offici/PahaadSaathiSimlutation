let track: HTMLAudioElement | undefined

export function updateDriveMusic(playing: boolean, fromBeginning = false, volume = .35) {
  if (!playing) {
    track?.pause()
    if (fromBeginning && track) track.currentTime = 0
    return
  }
  if (!track) {
    track = new Audio('/audio/dr-driving.mp3')
    track.loop = true
    track.preload = 'none'
  }
  track.volume = volume
  if (fromBeginning) track.currentTime = 0
  void track.play().catch(() => { /* A later sound-button gesture can start playback. */ })
}
