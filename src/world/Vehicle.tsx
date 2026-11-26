import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import { Group, Mesh, Vector3 } from 'three'
import { driveHeading, drivePosition } from '../game/Drive'
import { clock, driving, useGame } from '../game/GameEngine'
import { junctionU, mainRoad, vehicleAt } from './layout'

const suvURL = '/models/suv.glb'
useGLTF.preload(suvURL, false, false)
const point = new Vector3(), tangent = new Vector3()
const visualScale = 1.63
const waitDistance = junctionU * mainRoad.getLength()
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
    const { mode, scenario, control } = useGame.getState()
    const time = mode === 'menu' ? 21 : clock.time
    const manual = mode !== 'menu' && control === 'drive'
    let distance: number
    let steering = 0
    if (manual) {
      drivePosition(driving.frame, point)
      driveHeading(driving.frame, tangent)
      steering = driving.frame.steering
      distance = driving.frame.odometer
    } else {
      const { road, u } = vehicleAt(time, scenario.turnAt)
      road.getPointAt(u, point)
      road.getTangentAt(u, tangent)
      distance = u * road.getLength() + (road === mainRoad ? 0 : waitDistance)
    }
    vehicle.current.position.copy(point).y += .045
    vehicle.current.rotation.set(-Math.asin(tangent.y), Math.atan2(tangent.x, tangent.z) - steering * .13, steering * .042, 'YXZ')
    if (rig.current) {
      const rotation = distance / (.30 * visualScale)
      for (const name of wheelNames) {
        const wheel = rig.current.getObjectByName(name)
        if (wheel) wheel.rotation.x = rotation
      }
    }
  })
  return <group ref={vehicle} onClick={(event) => {
    if (useGame.getState().control !== 'presenter' || event.delta > 4) return
    event.stopPropagation()
    useGame.getState().inspect('vehicle')
  }}><Suspense fallback={null}><Model wheelRig={rig} /></Suspense><BrakeLights /></group>
}

function BrakeLights() {
  const lights = useRef<Group>(null)
  useFrame(() => {
    const { mode, scenario, control } = useGame.getState()
    if (lights.current) lights.current.visible = mode !== 'menu' && (control === 'drive'
      ? driving.frame.speed < .65 && driving.frame.gates.includes('junction') && driving.frame.route === 'ridge'
      : (scenario.rockAt !== null || scenario.barrier) && clock.time >= 31 && scenario.turnAt === null)
  })
  return <group ref={lights} visible={false}>
    {[-.96, .96].map((x) => <mesh key={x} position={[x, .73, -1.955]}>
      <boxGeometry args={[.23, .27, .045]} /><meshBasicMaterial color="#ff5535" toneMapped={false} />
    </mesh>)}
  </group>
}
