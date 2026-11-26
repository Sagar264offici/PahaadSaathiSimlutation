import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import { Component, Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { drivePosition } from './game/Drive'
import { bindDriveInput } from './game/DrivingInput'
import { advance, useGame } from './game/GameEngine'
import { Hud } from './hud/Hud'
import { roadIsBlocked } from './game/Scenario'
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
  const control = useGame((state) => state.control)
  const drive = useGame((state) => state.drive)
  const scenario = useGame((state) => state.scenario)
  const { road, u } = vehicleAt(mode === 'menu' ? 21 : second, scenario.turnAt)
  const [x, y] = mapPoint(control === 'drive' && mode !== 'menu' ? drivePosition(drive) : road.getPointAt(u))
  const [hazardX, hazardY] = mapPoint(closurePoint)
  return <svg className="map-backdrop" viewBox="0 0 240 152" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><radialGradient id="relief"><stop stopColor="#52695a" /><stop offset="1" stopColor="#172b27" /></radialGradient></defs>
    <rect width="240" height="152" fill="url(#relief)" />
    <path d={contourSvg} fill="none" stroke="#a2ad96" strokeOpacity=".34" strokeWidth=".42" />
    <path d={riverSvg} fill="none" stroke="#579595" strokeWidth="2.3" opacity=".66" />
    <path d={roadSvg} fill="none" stroke="#b8aa83" strokeWidth="1.35" />
    <path d={bypassSvg} fill="none" stroke={scenario.routeAt !== null ? '#a1eacb' : '#889889'} strokeWidth="1.4" strokeDasharray="2 1.7" />
    {roadIsBlocked(scenario) && <circle cx={hazardX} cy={hazardY} r="4" fill="#e5b566" />}
    {scenario.verification === 'Confirmed closure' && <path d={closureSvg} fill="none" stroke="#f9876f" strokeWidth="2.1" />}
    <circle cx={x} cy={y} r="2.3" fill="#fbefc9" stroke="#31453c" strokeWidth="1" />
  </svg>
}

function App() {
  const [fallback, setFallback] = useState(() => !canRenderWorld())
  const [loaded, setLoaded] = useState(false)
  const onReady = useCallback(() => setLoaded(true), [])
  const onFallback = useCallback(() => setFallback(true), [])
  useEffect(() => bindDriveInput(() => {
    const game = useGame.getState()
    return game.control === 'drive' && game.mode === 'running'
  }), [])
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
