import { Canvas, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei/core/Gltf.js'
import { ACESFilmicToneMapping } from 'three'
import { Suspense, useEffect } from 'react'
import { Director } from '../camera/Director'
import { useGame } from '../game/GameEngine'
import { FieldHardware, GatewayHardware } from '../objects/Hardware'
import { Incident } from '../objects/Incident'
import { Network } from '../objects/Network'
import { DriveMarkers } from '../objects/DriveMarkers'
import { Deployment } from '../objects/Deployment'
import { Phone, Witness } from '../objects/Phone'
import { Atmosphere } from './Atmosphere'
import { Forest } from './Forest'
import { Roads, ValleyStructures } from './Infrastructure'
import { Terrain } from './Terrain'
import { Vehicle } from './Vehicle'

const settings = {
  High: { dpr: [1, 1.8] as [number, number], shadows: true, antialias: true },
  Medium: { dpr: [1, 1.25] as [number, number], shadows: true, antialias: true },
  Low: { dpr: [0.75, 1] as [number, number], shadows: false, antialias: false },
}

function Ready({ onReady, onFallback }: { onReady: () => void; onFallback: () => void }) {
  useGLTF(['/models/suv.glb', '/models/rock_largeA.glb'], false, false)
  const canvas = useThree((state) => state.gl.domElement)
  useEffect(() => {
    canvas.addEventListener('webglcontextlost', onFallback)
    onReady()
    return () => canvas.removeEventListener('webglcontextlost', onFallback)
  }, [canvas, onReady, onFallback])
  return null
}

export default function World({ onReady, onFallback }: { onReady: () => void; onFallback: () => void }) {
  const quality = useGame((game) => game.quality)
  const config = settings[quality]
  return <Canvas key={String(config.antialias)} className="world" aria-label="3D Himalayan demonstration environment"
    dpr={config.dpr} shadows={config.shadows ? 'percentage' : false}
    camera={{ position: [2, 81, 130], fov: 52, near: .08, far: 1950 }}
    gl={{ antialias: config.antialias, powerPreference: 'high-performance' }}
    onCreated={({ gl }) => {
      gl.toneMapping = ACESFilmicToneMapping
      gl.toneMappingExposure = 1.20
      gl.setClearColor('#98adad')
    }}
    fallback={<span className="webgl-fallback">WebGL unavailable</span>}
  >
    <Suspense fallback={null}><Ready onReady={onReady} onFallback={onFallback} /></Suspense>
    <Director />
    <Atmosphere shadows={config.shadows} />
    <Terrain quality={quality} />
    <Roads />
    <DriveMarkers />
    <ValleyStructures />
    <Forest quality={quality} />
    <Vehicle />
    <FieldHardware id="1E" />
    <FieldHardware id="2L" />
    <GatewayHardware />
    <Incident quality={quality} />
    <Network />
    <Witness />
    <Phone />
    <Deployment />
  </Canvas>
}
