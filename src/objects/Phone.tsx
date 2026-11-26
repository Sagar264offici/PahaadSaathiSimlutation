import { RoundedBox } from '@react-three/drei/core/RoundedBox.js'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Group, SRGBColorSpace } from 'three'
import { clock } from '../game/GameEngine'
import { CUES, phase, smooth } from '../game/Timeline'
import { Box } from '../world/Infrastructure'
import { closurePoint, phone } from '../world/layout'
import { contourSvg, mapPoint, riverSvg, roadSvg } from '../world/map'

const green = '#185b4a'
const dark = '#172e27'
const gold = '#ad5f22'

function createDisplay() {
  const canvas = document.createElement('canvas')
  canvas.width = 414
  canvas.height = 828
  const ctx = canvas.getContext('2d')!
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace

  function block(x: number, y: number, w: number, h: number, radius: number, fill: string) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, radius)
    ctx.fillStyle = fill
    ctx.fill()
  }
  function label(value: string, x: number, y: number, size: number, weight: number, color: string) {
    ctx.font = weight + ' ' + size + 'px system-ui, sans-serif'
    ctx.fillStyle = color
    ctx.fillText(value, x, y)
  }
  function map(y: number, height: number, pin: boolean) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, y, 414, height)
    ctx.clip()
    ctx.fillStyle = '#d9e3cf'
    ctx.fillRect(0, y, 414, height)
    ctx.translate(-18, y + (height - 402) / 2)
    ctx.scale(1.87, 2.65)
    for (const [path, color, width] of [[contourSvg, '#a8bea5', .65], [riverSvg, '#7bb1b0', 2.1], [roadSvg, '#ffffff', 4.6], [roadSvg, '#9d9173', 1.2]] as const) {
      ctx.lineWidth = width
      ctx.strokeStyle = color
      ctx.stroke(new Path2D(path))
    }
    if (pin) {
      const [x, z] = mapPoint(closurePoint)
      ctx.beginPath()
      ctx.ellipse(x, z, 14, 9, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#db953959'
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(x, z, 5, 3.7, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#b76928'
      ctx.fill()
    }
    ctx.restore()
  }

  function draw(time: number) {
    const showMap = time >= 100.7
    const arrival = smooth(phase(time, 94, 95.1))
    block(0, 0, 414, 828, 0, '#f0f3ea')
    block(0, 0, 414, 138, 0, green)
    label('09:41', 26, 35, 16, 600, '#ebf4e8')
    label('PahaadSaathi', 28, 94, 34, 740, '#ffffff')
    label('Configured demonstration location', 29, 119, 15, 560, '#c2e3d4')
    map(138, showMap ? 505 : 388, arrival > .32)
    block(25, 157, 111, 33, 15, '#edf3e6')
    label('RIDGE SECTOR', 37, 179, 12, 760, green)
    if (showMap) {
      block(21, 613, 372, 143, 19, '#ffffff')
      label('Hazard location', 42, 654, 27, 740, dark)
      label('PS-001  ·  NODE-01', 43, 687, 18, 550, green)
      label('UNDER REVIEW', 43, 726, 16, 750, gold)
    } else if (arrival > 0) {
      const y = 422 + (1 - arrival) * 320
      block(17, y + 7, 380, 285, 23, '#23423932')
      block(17, y, 380, 285, 23, '#fffef9')
      block(38, y + 20, 170, 29, 13, '#f7e8d4')
      label('SIMULATED ALERT', 51, y + 39, 14, 760, gold)
      label('Potential road hazard', 38, y + 87, 26, 780, dark)
      label('A vibration-related event has been', 38, y + 124, 17, 550, '#3d554c')
      label('reported near your route.', 38, y + 148, 17, 550, '#3d554c')
      label('STATUS  ·  UNDER REVIEW', 38, y + 190, 16, 760, gold)
      block(38, y + 212, 338, 48, 12, green)
      label('VIEW HAZARD', 140, y + 243, 18, 760, '#fff')
    }
    block(0, 762, 414, 66, 0, '#fffef9')
    label('Map', 51, 799, 17, 740, green)
    label('Alerts', 182, 799, 17, 660, '#5d6f61')
    label('About', 315, 799, 17, 660, '#5d6f61')
    block(139, 815, 136, 5, 3, '#273931')
    texture.needsUpdate = true
  }

  draw(0)
  return { texture, draw }
}

export function Phone() {
  const mesh = useRef<Group>(null)
  const last = useRef(-1)
  const display = useMemo(createDisplay, [])
  useEffect(() => () => display.texture.dispose(), [display])
  useFrame(() => {
    if (!mesh.current) return
    const time = clock.time
    mesh.current.visible = time >= CUES.mobile - .8 && time < CUES.review + 2.5 || time >= CUES.overview
    if (!mesh.current.visible) { last.current = -1; return }
    mesh.current.position.copy(phone).y += Math.sin(time * 1.18) * .14
    const angle = smooth(phase(time, CUES.mobile - .8, CUES.mobile + 2.5))
    mesh.current.rotation.set(-.06, -.55 + angle * .71, .045 - .035 * angle)
    const step = Math.floor(time * 24)
    if (last.current === step || (time >= 95.2 && time < 100.7 && last.current >= 95.2 * 24) || (time >= 101 && last.current >= 101 * 24)) return
    if (time < 94 && last.current >= 0 && last.current < 94 * 24) return
    last.current = step
    display.draw(time)
  })
  return <group ref={mesh} position={phone} visible={false}>
    <RoundedBox args={[2.53, 4.85, .265]} radius={.18} smoothness={3}>
      <meshStandardMaterial color="#212e2b" roughness={.42} metalness={.45} />
    </RoundedBox>
    <mesh position-z={.137}>
      <planeGeometry args={[2.315, 4.63]} />
      <meshBasicMaterial map={display.texture} toneMapped={false} />
    </mesh>
    <mesh position={[0, 2.19, .14]}>
      <circleGeometry args={[.052, 16]} /><meshBasicMaterial color="#142b25" />
    </mesh>
    <Box size={[.06, .39, .09]} position={[1.285, .92, .018]} color="#84948a" />
    <Box size={[.06, .19, .09]} position={[1.285, .40, .018]} color="#84948a" />
  </group>
}
