import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import { Group, Mesh, Vector3 } from 'three'
import { clock, useGame } from '../game/GameEngine'
import { CUES } from '../game/Timeline'
import { vehicleAt } from './layout'

const suvURL = '/models/suv.glb'
useGLTF.preload(suvURL, false, false)
const point = new Vector3(), tangent = new Vector3()
const visualScale = 1.63
const wheelNames = ['wheel-back-left', 'wheel-back-right', 'wheel-front-left', 'wheel-front-right']

function Model({ wheelRig }: { wheelRig: React.RefObject<Group | null> }) {
  const { scene } = useGLTF(suvURL, false, false)
  const clone = useMemo(() => {
    const car = scene.clone(true)
    car.traverse((object) => {
      if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true }
    })
    return car
  }, [scene])
  return <group ref={wheelRig} scale={visualScale}>
    <primitive object={clone} />
    <mesh position={[0, .018, .06]} rotation-x={-Math.PI / 2} scale={[1.02, 1.6, 1]}>
      <circleGeometry args={[.91, 20]} />
      <meshBasicMaterial color="#20241f" transparent opacity={.33} depthWrite={false} polygonOffset polygonOffsetFactor={-3} />
    </mesh>
  </group>
}

export function Vehicle() {
  const vehicle = useRef<Group>(null)
  const rig = useRef<Group>(null)
  useFrame(() => {
    if (!vehicle.current) return
    const time = useGame.getState().mode === 'menu' ? 43 : clock.time
    const { road, u } = vehicleAt(time)
    road.getPointAt(u, point)
    road.getTangentAt(u, tangent)
    vehicle.current.position.copy(point).y += .045
    vehicle.current.rotation.set(-Math.asin(tangent.y), Math.atan2(tangent.x, tangent.z), 0, 'YXZ')
    if (rig.current) {
      const rotation = (u * road.getLength() + (time >= CUES.turn ? vehicleAt(CUES.turn - .01).u * vehicleAt(CUES.turn - .01).road.getLength() : 0)) / (.30 * visualScale)
      for (const name of wheelNames) {
        const wheel = rig.current.getObjectByName(name)
        if (wheel) wheel.rotation.x = rotation
      }
    }
  })
  return <group ref={vehicle}><Suspense fallback={null}><Model wheelRig={rig} /></Suspense></group>
}
