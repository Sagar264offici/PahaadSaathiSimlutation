import type { DriveInput } from './Drive'

export type Pedal = 'forward' | 'reverse' | 'left' | 'right' | 'brake'
const bindings: Record<string, Pedal> = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'reverse', ArrowDown: 'reverse',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'brake',
}
const keys = new Set<string>()
const touch = new Map<number, Pedal>()
let gamepadLocked = false

export function setTouchDrive(pointer: number, pedal?: Pedal) {
  if (pedal) touch.set(pointer, pedal)
  else touch.delete(pointer)
}

export function clearDriveInput() {
  keys.clear()
  touch.clear()
  gamepadLocked = true
}

export function bindDriveInput(enabled: () => boolean) {
  function press(event: KeyboardEvent) {
    if (!enabled() || !bindings[event.code] || event.altKey || event.ctrlKey || event.metaKey ||
      (event.target as HTMLElement | null)?.closest('textarea, select, input, [contenteditable]')) return
    event.preventDefault()
    keys.add(event.code)
  }
  function release(event: KeyboardEvent) { keys.delete(event.code) }
  window.addEventListener('keydown', press)
  window.addEventListener('keyup', release)
  window.addEventListener('blur', clearDriveInput)
  document.addEventListener('visibilitychange', clearDriveInput)
  return () => {
    window.removeEventListener('keydown', press)
    window.removeEventListener('keyup', release)
    window.removeEventListener('blur', clearDriveInput)
    document.removeEventListener('visibilitychange', clearDriveInput)
    clearDriveInput()
  }
}

function connectedGamepad() {
  try { return Array.from(navigator.getGamepads?.() ?? []).find((pad) => pad?.connected) }
  catch { return undefined }
}

export function readDriveInput(): DriveInput {
  const held = new Set([...keys].map((key) => bindings[key]))
  for (const pedal of touch.values()) held.add(pedal)
  const pad = connectedGamepad()
  const horizontal = pad?.axes[0] ?? 0
  const pedals = Math.max(pad?.buttons[7]?.value ?? 0, pad?.buttons[0]?.pressed ? 1 : 0) - (pad?.buttons[6]?.value ?? 0)
  const dpad = Number(pad?.buttons[15]?.pressed ?? false) - Number(pad?.buttons[14]?.pressed ?? false)
  const padBrake = pad?.buttons[2]?.pressed ?? false
  const neutral = Math.abs(horizontal) <= .16 && Math.abs(pedals) <= .08 && !dpad && !padBrake
  if (neutral) gamepadLocked = false
  const steer = Number(held.has('right')) - Number(held.has('left'))
  const throttle = Number(held.has('forward')) - Number(held.has('reverse'))
  return {
    steer: steer || (!gamepadLocked ? dpad || (Math.abs(horizontal) > .16 ? horizontal : 0) : 0),
    throttle: throttle || (!gamepadLocked && Math.abs(pedals) > .08 ? pedals : 0),
    brake: held.has('brake') || (!gamepadLocked && padBrake),
  }
}
