import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import { Component, Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { advance, useGame } from './game/GameEngine'
import { Hud } from './hud/Hud'
import { CUES } from './game/Timeline'
import { closurePoint, vehicleAt } from './world/layout'
import { bypassSvg, closureSvg, contourSvg, mapPoint, riverSvg, roadSvg } from './world/map'
import './styles.css'

const World = lazy(() => import('./world/World'))

class WorldBoundary extends Component<{ fallback: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.fallback() }
  render() { return this.state.failed ? null : this.props.children }
}

function canRenderWorld() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch { return false }
}

function MapBackdrop() {
  const second = useGame((state) => state.second)
  const mode = useGame((state) => state.mode)
  const { road, u } = vehicleAt(mode === 'menu' ? 44 : second)
  const [x, y] = mapPoint(road.getPointAt(u))
  const [hazardX, hazardY] = mapPoint(closurePoint)
  return <svg className="map-backdrop" viewBox="0 0 240 152" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><radialGradient id="relief"><stop stopColor="#52695a" /><stop offset="1" stopColor="#172b27" /></radialGradient></defs>
    <rect width="240" height="152" fill="url(#relief)" />
    <path d={contourSvg} fill="none" stroke="#a2ad96" strokeOpacity=".34" strokeWidth=".42" />
    <path d={riverSvg} fill="none" stroke="#579595" strokeWidth="2.3" opacity=".66" />
    <path d={roadSvg} fill="none" stroke="#b8aa83" strokeWidth="1.35" />
    <path d={bypassSvg} fill="none" stroke={second >= CUES.diversion ? '#a1eacb' : '#889889'} strokeWidth="1.4" strokeDasharray="2 1.7" />
    {second >= CUES.review && <circle cx={hazardX} cy={hazardY} r="4" fill="#e5b566" />}
    {second >= CUES.confirmed && <path d={closureSvg} fill="none" stroke="#f9876f" strokeWidth="2.1" />}
    <circle cx={x} cy={y} r="2.3" fill="#fbefc9" stroke="#31453c" strokeWidth="1" />
  </svg>
}

function App() {
  const [fallback, setFallback] = useState(() => !canRenderWorld())
  const [loaded, setLoaded] = useState(false)
  const onReady = useCallback(() => setLoaded(true), [])
  const onFallback = useCallback(() => setFallback(true), [])
  useEffect(() => {
    let id = 0
    let previous = performance.now()
    function frame(now: number) {
      if (!document.hidden) advance((now - previous) / 1000)
      previous = now
      id = requestAnimationFrame(frame)
    }
    function visibility() { previous = performance.now() }
    id = requestAnimationFrame(frame)
    document.addEventListener('visibilitychange', visibility)
    return () => { cancelAnimationFrame(id); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  return <div className="game-screen">
    {fallback ? <MapBackdrop /> : <WorldBoundary fallback={onFallback}>
      <Suspense fallback={<MapBackdrop />}><World onReady={onReady} onFallback={onFallback} /></Suspense>
    </WorldBoundary>}
    <Hud ready={loaded || fallback} fallback={fallback} />
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
