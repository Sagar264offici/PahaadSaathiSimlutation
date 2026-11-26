import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BackSide, Color, IcosahedronGeometry, Matrix4, Mesh, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { clock, useGame } from '../game/GameEngine'
import { randomSeed } from './geometry'

const sun = new Vector3(0.36, 0.23, -0.9).normalize()
const skyUniforms = {
  sun: { value: sun },
  zenith: { value: new Color('#6fabbf') },
  horizon: { value: new Color('#f8dfb6') },
  mid: { value: new Color('#a5c6cb') },
}
const cloudLayout = [
  [-113, 68, -163, 1.12], [43, 79, -218, 1.24], [143, 94, -294, 1.32],
  [-221, 122, -341, 1.5], [45, 153, -505, 1.72], [-325, 82, -330, 1.45],
  [235, 45, -123, 0.83], [-91, 149, -400, 1.12], [109, 63, -152, 0.65],
] as const

export function Atmosphere({ shadows }: { shadows: boolean }) {
  const clouds = useRef<(Mesh | null)[]>([])
  const geometry = useMemo(() => {
    const rand = randomSeed(10)
    const chunks = Array.from({ length: 13 }, (_, index) => {
      const body = new IcosahedronGeometry(1, 1)
      const bulge = .46 + .64 * Math.sin((index + 1) * Math.PI / 14)
      const transform = new Matrix4().makeScale(7 + rand() * 13, (2.25 + rand() * 7.4) * bulge, 5 + rand() * 10)
      transform.setPosition(index * 4.9 - 31, rand() * 3.0 * bulge, (rand() - 0.5) * 9)
      return body.applyMatrix4(transform)
    })
    const merged = mergeGeometries(chunks)
    chunks.forEach((chunk) => chunk.dispose())
    return merged
  }, [])
  useFrame(() => {
    const time = useGame.getState().mode === 'menu' ? clock.idle : clock.time
    cloudLayout.forEach(([x], index) => {
      const mesh = clouds.current[index]
      if (mesh) mesh.position.x = x + (0.22 + index % 3 * 0.09) * time
    })
  })
  return <>
    <fog attach="fog" args={['#abc6ca', 128, 950]} />
    <mesh frustumCulled={false}>
      <sphereGeometry args={[1400, 32, 18]} />
      <shaderMaterial side={BackSide} depthWrite={false} uniforms={skyUniforms}
        vertexShader={`
          varying vec3 vWorld;
          void main() {
            vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vWorld;
          uniform vec3 sun;
          uniform vec3 zenith;
          uniform vec3 horizon;
          uniform vec3 mid;
          void main(){
            vec3 ray = normalize(vWorld - cameraPosition);
            float y = max(0., ray.y);
            float light = max(0., dot(sun, ray));
            vec3 sky = mix(horizon, mid, smoothstep(0., .26, y));
            sky = mix(sky, zenith, smoothstep(.09, .69, y));
            sky += vec3(.25,.13,.045) * pow(light, 15.);
            sky += vec3(.75,.54,.29) * pow(light, 130.);
            sky = mix(sky, vec3(1.0,.90,.66), .94 * smoothstep(.99915, .99967, light));
            gl_FragColor = vec4(sky, 1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `} />
    </mesh>
    <hemisphereLight args={['#e2edfa', '#69755c', 1.62]} />
    <directionalLight color="#ffe2a8" intensity={1.7} position={[-80, 115, 45]} castShadow={shadows}
      shadow-mapSize-width={2048} shadow-mapSize-height={2048}
      shadow-camera-left={-100} shadow-camera-right={100} shadow-camera-top={100} shadow-camera-bottom={-100}
      shadow-camera-far={285} shadow-normalBias={0.24} shadow-bias={-0.00015} />
    <directionalLight color="#b3d7e2" intensity={0.32} position={[90, 40, -110]} />
    {cloudLayout.map(([x, y, z, scale], index) => <mesh
      key={index} ref={(mesh) => { clouds.current[index] = mesh }} position={[x, y, z]} scale={scale} geometry={geometry}>
      <meshLambertMaterial color={index % 3 === 0 ? '#dddcd0' : '#eee9df'} emissive='#98abae' emissiveIntensity={.20} flatShading />
    </mesh>)}
  </>
}
