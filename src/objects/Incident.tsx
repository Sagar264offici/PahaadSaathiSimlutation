import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { TriangleAlert } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, DoubleSide, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Object3D, PlaneGeometry, Vector3 } from 'three'
import { clock, useGame, type Quality } from '../game/GameEngine'
import { roadIsBlocked } from '../game/Scenario'
import { phase } from '../game/Timeline'
import { randomSeed } from '../world/geometry'
import { Box } from '../world/Infrastructure'
import { closurePoint, closureStart, mainRoad, node } from '../world/layout'
import { fragmentPose, fragments } from '../world/rockfall'

const barrierAt = mainRoad.getPointAt(closureStart + .007)
const direction = mainRoad.getTangentAt(closureStart + .007)
const dummy = new Object3D()
const p = new Vector3()
const rockGeometry = new IcosahedronGeometry(1, 1)
const rockPosition = rockGeometry.getAttribute('position')
for (let i = 0; i < rockPosition.count; i++) {
  const x = rockPosition.getX(i), y = rockPosition.getY(i), z = rockPosition.getZ(i)
  const crust = 1 + .17 * Math.sin(x * 9.1 + z * 5) * Math.cos(y * 8.7 - z * 6.2)
  rockPosition.setXYZ(i, x * crust, y * crust, z * crust)
}
rockGeometry.computeVertexNormals()

function Dust({ quality }: { quality: Quality }) {
  const mesh = useRef<InstancedMesh>(null)
  const count = quality === 'High' ? 56 : quality === 'Medium' ? 39 : 22
  const { motes, geometry, alpha } = useMemo(() => {
    const rng = randomSeed(77390)
    const geometry = new PlaneGeometry(2, 2)
    const alpha = new InstancedBufferAttribute(new Float32Array(count), 1)
    geometry.setAttribute('aOpacity', alpha)
    const motes = Array.from({ length: count }, (_, i) => {
      const rock = fragments[9 + i % 9]
      return { at: rock.impact.clone().lerp(rock.end, rng() * .55),
        delay: rock.delay + rock.fall - .28 + rng() * 1.45,
        life: 5.1 + rng() * 3.5, dx: -2 - rng() * 11, dz: 3 + rng() * 10,
        size: 1.4 + rng() * 2.65, opacity: .29 + rng() * .28 }
    })
    return { motes, geometry, alpha }
  }, [count])
  useFrame(() => {
    const rockAt = useGame.getState().scenario.rockAt
    if (!mesh.current) return
    const t = rockAt === null ? -1 : clock.time - rockAt
    mesh.current.visible = t >= 3 && t <= 17.5
    if (!mesh.current.visible) return
    motes.forEach((mote, i) => {
      const u = phase(t, mote.delay, mote.delay + mote.life)
      const drift = 1 - (1 - u) ** 2
      const size = mote.size * (.36 + drift * 1.92)
      dummy.position.set(mote.at.x + drift * mote.dx, mote.at.y + .9 + Math.sin(u * Math.PI * .76) * 3.75, mote.at.z + drift * mote.dz)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(size * 1.35, size * .70, 1)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
      alpha.setX(i, Math.min(u * 7, 1) * (1 - u) ** 1.25 * mote.opacity)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    alpha.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geometry, undefined, count]} visible={false} frustumCulled={false} renderOrder={6}>
    <shaderMaterial transparent depthWrite={false} side={DoubleSide} uniforms={{ dustColor: { value: new Color('#d5b593') } }}
      vertexShader={`
        attribute float aOpacity; varying float opacity; varying vec2 tex;
        void main() {
          vec4 center = modelViewMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
          vec2 extent = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          gl_Position = projectionMatrix * (center + vec4(position.xy * extent, 0., 0.));
          tex = uv * 2. - 1.; opacity = aOpacity;
        }
      `}
      fragmentShader={`
        varying float opacity; varying vec2 tex; uniform vec3 dustColor;
        void main(){
          float edge = length(tex) + sin(tex.x * 17. + tex.y * 20.) * .052;
          float cloud = pow(1. - smoothstep(.02, 1., edge), 1.3);
          gl_FragColor = vec4(dustColor, cloud * opacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `} />
  </instancedMesh>
}

export function Incident({ quality }: { quality: Quality }) {
  const rocks = useRef<InstancedMesh>(null)
  const rings = useRef<Group>(null)
  const last = useRef<number | null>(null)
  const focus = useGame((state) => state.focus)
  const control = useGame((state) => state.control)
  const blocked = useGame((state) => roadIsBlocked(state.scenario))
  const closed = useGame((state) => state.scenario.verification === 'Confirmed closure')
  const settled = useGame((state) => state.scenario.settled)
  const blockedByBarrier = useGame((state) => state.scenario.barrier)
  const incident = useGame((state) => state.scenario.rockAt !== null)
  useLayoutEffect(() => {
    const mesh = rocks.current
    if (!mesh) return
    fragments.forEach((rock, i) => mesh.setColorAt(i, new Color(rock.color)))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])
  useFrame(() => {
    const { scenario } = useGame.getState()
    if (rocks.current) {
      const age = scenario.rockAt === null ? -1 : clock.time - scenario.rockAt
      const frame = Math.min(age, 13)
      if (last.current !== frame) {
        fragments.forEach((rock, i) => {
          const turn = fragmentPose(rock, age, p)
          dummy.position.copy(p)
          const latched = i >= 9 && i <= 17
          const loose = age >= rock.delay
          const scale = latched || loose ? rock.size : .00001
          if (latched) {
            const tremor = age > 0 && !loose ? Math.sin(age * 17.2 + i) * .045 : 0
            dummy.position.x += tremor
            dummy.position.y += tremor - (1 - phase(age, rock.delay, rock.delay + .45)) * rock.size * .37
          }
          dummy.scale.set(scale * (1.13 + i % 4 * .06), scale * .94, scale * (1 + i % 3 * .12))
          dummy.rotation.set(i * 2.17 + rock.turn * turn, i * 1.39 + turn * .81, i * .88 + rock.turn * turn * .63)
          dummy.updateMatrix()
          rocks.current!.setMatrixAt(i, dummy.matrix)
        })
        rocks.current.instanceMatrix.needsUpdate = true
      }
      last.current = frame
    }
    if (rings.current) {
      const age = scenario.vibrationAt === null ? -1 : clock.time - scenario.vibrationAt
      rings.current.visible = age >= 0 && age < 6
      if (rings.current.visible) rings.current.children.forEach((object, i) => {
        object.scale.setScalar(.45 + ((age * .58 + i / 3) % 1) * 6)
      })
    }
  })
  function inspect() { useGame.getState().inspect('rockfall') }
  return <>
    <instancedMesh ref={rocks} args={[rockGeometry, undefined, fragments.length]} frustumCulled={false}
      castShadow={quality !== 'Low'} receiveShadow onClick={(e) => { if (control === 'presenter' && e.delta < 5) { e.stopPropagation(); inspect() } }}>
      <meshLambertMaterial flatShading />
    </instancedMesh>
    <Dust quality={quality} />
    <group ref={rings} position={node.clone().add(new Vector3(0, .29, 0))} visible={false}>
      {[0, 1, 2].map((i) => <mesh key={i} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[.958, 1, 36]} /><meshBasicMaterial color="#ffc470" transparent opacity={.63} depthWrite={false} />
      </mesh>)}
    </group>
    {blocked && (control === 'auto' || focus === 'rockfall' || focus === 'vehicle') &&
      <Html position={closurePoint.clone().add(new Vector3(0, 5, 0))} center pointerEvents="none" zIndexRange={[15, 10]}>
        <div className={`world-tag warning-tag ${closed ? 'is-closed' : ''}`}><TriangleAlert size={16} /><span>{closed ? 'CONFIRMED ROAD CLOSURE' : settled ? 'MAJOR ROCKFALL · ROAD COMPLETELY BLOCKED' : 'PRIMARY ROAD BLOCKED'}</span></div>
      </Html>}
    {control === 'presenter' && !incident && <mesh position={closurePoint.clone().add(new Vector3(0, 1, 0))} onClick={(e) => {
      if (e.delta < 5) { e.stopPropagation(); inspect() }
    }}>
      <boxGeometry args={[9, 2, 7]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>}
    {(closed || blockedByBarrier) && <group position={barrierAt} rotation-y={Math.atan2(direction.x, direction.z)} onClick={inspect}>
      {[-2.2, 2.2].map((x) => <Box key={x} size={[.23, 1.65, .24]} position={[x, .75, 0]} color="#666758" />)}
      {Array.from({ length: 11 }, (_, i) => <Box key={i} size={[.45, .45, .16]} position={[(i - 5) * .45, 1.4, .03]} color={i % 2 ? '#e3d694' : '#ae4f3a'} />)}
      <Box size={[5, .07, .17]} position={[0, 1.65, .03]} color="#e7c17d" />
    </group>}
  </>
}
