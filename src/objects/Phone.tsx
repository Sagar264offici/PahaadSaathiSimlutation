import { RoundedBox } from '@react-three/drei/core/RoundedBox.js'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Group, SRGBColorSpace } from 'three'
import { clock, useGame } from '../game/GameEngine'
import { OBSERVATION, REPORT_ID, type Scenario } from '../game/Scenario'
import { CUES, STAGES } from '../game/Timeline'
import { Box } from '../world/Infrastructure'
import { closurePoint, phone, witness } from '../world/layout'
import { bypassSvg, closureSvg, contourSvg, mapPoint, riverSvg, roadSvg } from '../world/map'

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
  function map(y: number, height: number, pin: boolean, alternate = false) {
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
    if (alternate) {
      ctx.strokeStyle = '#378c76'; ctx.lineWidth = 1.95; ctx.setLineDash([3, 2])
      ctx.stroke(new Path2D(bypassSvg)); ctx.setLineDash([])
    }
    if (pin) {
      ctx.strokeStyle = '#af5640'; ctx.lineWidth = 3.3
      ctx.stroke(new Path2D(closureSvg))
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

  function draw(report: Scenario['report'], alert: boolean, timestamp: string, alternate = false, category: string = OBSERVATION.category, description: string = OBSERVATION.description) {
    block(0, 0, 414, 828, 0, '#f0f3ea')
    block(0, 0, 414, 138, 0, green)
    label('09:41', 26, 35, 16, 600, '#ebf4e8')
    label('PahaadSaathi', 28, 94, 34, 740, '#ffffff')
    label('Ridge Hamlet · field exercise', 29, 119, 15, 560, '#c2e3d4')
    if (alert) {
      map(138, 455, true, alternate)
      block(19, 475, 376, 249, 23, '#fffef9')
      label('SIMULATED ROAD ALERT', 40, 515, 16, 760, gold)
      label('Confirmed road closure', 40, 560, 28, 780, dark)
      label('Both lanes blocked by rockfall.', 40, 602, 18, 550, dark)
      label(OBSERVATION.zone + '  ·  3MH', 40, 636, 16, 700, green)
      block(40, 658, 334, 40, 9, green)
      label('HAZARD MAP', 150, 685, 16, 740, '#fff')
    } else if (report === 'draft' || report === 'sending' || report === 'submitted') {
      label(report === 'submitted' ? 'Report received' : 'Report a hazard', 27, 184, 32, 770, dark)
      label('SIMULATED COMMUNITY REPORT', 28, 215, 15, 710, gold)
      block(22, 236, 370, 108, 13, '#fffef9')
      label('HAZARD CATEGORY', 42, 267, 14, 740, green)
      label(category, 42, 302, 24, 750, dark)
      label(description.length > 40 ? description.slice(0, 39) + '…' : description, 42, 327, 17, 520, dark)
      block(22, 354, 370, 108, 13, '#fffef9')
      label('SIMULATED GPS LOCATION', 42, 383, 13, 730, green)
      label(OBSERVATION.gps, 42, 410, 18, 670, dark)
      label('Simulated time  ·  ' + timestamp, 42, 439, 16, 550, dark)
      block(22, 475, 370, 161, 13, '#fffef9')
      label('PHOTO ATTACHED · ILLUSTRATIVE', 42, 502, 13, 720, green)
      block(42, 514, 330, 99, 6, '#b4c5b1')
      ctx.fillStyle = '#7b845e'
      ctx.beginPath()
      ctx.moveTo(43, 590); ctx.lineTo(171, 522); ctx.lineTo(234, 581); ctx.lineTo(299, 535); ctx.lineTo(369, 584); ctx.lineTo(369, 607); ctx.lineTo(43, 607)
      ctx.fill()
      block(43, 582, 326, 25, 2, '#4a534b')
      for (const [x, y, size] of [[144, 581, 21], [183, 568, 25], [221, 575, 28], [253, 583, 18]]) {
        ctx.fillStyle = '#a49377'; ctx.beginPath()
        ctx.moveTo(x - size, y + 12); ctx.lineTo(x - size * .56, y - 4); ctx.lineTo(x + size * .41, y - 13); ctx.lineTo(x + size, y + 12); ctx.fill()
      }
      block(22, 661, 370, 61, 12, green)
      label(report === 'draft' ? 'SUBMIT REPORT' : report === 'sending' ? 'SENDING TO SUPABASE' : REPORT_ID + ' · RECEIVED', 87, 700, 19, 770, '#fff')
    } else {
      map(138, 449, false)
      label('Ridge Sector', 25, 620, 24, 750, dark)
      label('Record a hazard near the settlement.', 25, 653, 17, 560, green)
      block(24, 670, 366, 49, 12, green)
      label('CREATE REPORT', 126, 701, 18, 750, '#fff')
    }
    block(0, 762, 414, 66, 0, '#fffef9')
    label('Map', 51, 799, 17, 740, green)
    label('Alerts', 182, 799, 17, 660, '#5d6f61')
    label('Report', 309, 799, 17, 660, '#5d6f61')
    block(139, 815, 136, 5, 3, '#273931')
    texture.needsUpdate = true
  }

  draw('none', false, '')
  return { texture, draw }
}

export function Witness() {
  const rig = useRef<Group>(null)
  useFrame(() => {
    if (!rig.current) return
    const s = useGame.getState().scenario
    rig.current.rotation.y = s.report === 'none' ? -.54 : -.27 + Math.sin(clock.time * .8) * .07
  })
  return <group ref={rig} position={witness} onClick={(e) => {
    if (useGame.getState().control === 'presenter' && e.delta < 5) { e.stopPropagation(); useGame.getState().command('app', 'community') }
  }}>
    {[-.15, .15].map((x) => <group key={x}>
      <Box size={[.21, .7, .22]} position={[x, .46, 0]} color="#35443e" shadow />
      <Box size={[.23, .14, .34]} position={[x, .1, .075]} color="#282d2b" />
    </group>)}
    <Box size={[.49, .64, .31]} position={[0, 1.07, 0]} color="#945d3d" shadow />
    <Box size={[.31, .31, .31]} position={[0, 1.58, 0]} color="#ae7652" />
    <Box size={[.38, .15, .39]} position={[0, 1.71, 0]} color="#3f6354" />
    {[-.32, .32].map((x) => <Box key={x} size={[.16, .52, .16]} position={[x, 1.09, .19]} rotation={[-.75, 0, 0]} color="#ab704d" />)}
    <Box size={[.22, .34, .06]} position={[.03, 1.27, .39]} rotation={[-.24, 0, 0]} color="#253732" glow />
  </group>
}

export function Phone() {
  const mesh = useRef<Group>(null)
  const last = useRef('')
  const display = useMemo(createDisplay, [])
  useEffect(() => () => display.texture.dispose(), [display])
  useFrame(() => {
    if (!mesh.current) return
    const game = useGame.getState()
    const { scenario, mode } = game
    const focus = game.control === 'presenter' ? game.focus : STAGES[game.stage].focus
    const time = clock.time
    mesh.current.visible = mode !== 'menu' && scenario.architecture === 'prototype' &&
      (focus === 'community' || (game.control === 'auto' && time >= CUES.overview))
    if (!mesh.current.visible) return
    mesh.current.position.copy(phone).y += Math.sin(time * 1.18) * .09
    mesh.current.rotation.set(-.06, .10, .015)
    const key = scenario.report + '/' + scenario.alert + '/' + scenario.observedAt + '/' + scenario.routeAt + '/' + scenario.reportCategory + '/' + scenario.reportDescription
    if (last.current === key) return
    last.current = key
    const seconds = Math.floor(scenario.observedAt ?? 0)
    const timestamp = '14:' + String(2 + Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
    display.draw(scenario.report, scenario.alert, timestamp, scenario.routeAt !== null, scenario.reportCategory, scenario.reportDescription)
  })
  return <group ref={mesh} position={phone} visible={false} onClick={(e) => {
    if (useGame.getState().control === 'presenter' && e.delta < 5) { e.stopPropagation(); useGame.getState().command('app', 'community') }
  }}>
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
