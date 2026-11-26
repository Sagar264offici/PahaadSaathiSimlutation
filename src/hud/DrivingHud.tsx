import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CircleStop, Flag, Gamepad2, Route, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TOP_SPEED } from '../game/Drive'
import { setTouchDrive, type Pedal } from '../game/DrivingInput'
import { useGame } from '../game/GameEngine'

function HoldButton({ name, pedal, icon: Icon }: { name: string; pedal: Pedal; icon: LucideIcon }) {
  return <button className={`pedal pedal-${pedal}`} type="button" aria-label={name} title={name}
    onPointerDown={(event) => {
      if (event.button !== 0 || useGame.getState().mode !== 'running') return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      setTouchDrive(event.pointerId, pedal)
    }}
    onPointerUp={(event) => setTouchDrive(event.pointerId)}
    onPointerCancel={(event) => setTouchDrive(event.pointerId)}
    onLostPointerCapture={(event) => setTouchDrive(event.pointerId)}>
    <Icon size={23} />
  </button>
}

export function DrivingHud() {
  const scenario = useGame((state) => state.scenario)
  const drive = useGame((state) => state.drive)
  const paused = useGame((state) => state.mode === 'paused')
  const atJunction = drive.gates.includes('junction')
  const finished = drive.gates.includes('finish')
  const onBypass = drive.route === 'bypass'
  const cleared = scenario.routeAt !== null
  const packet = scenario.packet
  let title = 'Drive to the watch zone'
  let description = 'Follow the ridge road toward the amber checkpoint.'
  if (scenario.rockAt !== null) {
    title = 'Rockfall ahead'
    description = atJunction ? 'Stop at the roadblock. Wait for the left bypass to open.' : 'Slow down and continue to the junction ahead of the debris.'
  }
  if (cleared) {
    title = onBypass ? 'Follow the bypass' : 'Take the left bypass'
    description = onBypass ? 'Drive along the marked route to the exit checkpoint.' : 'Hold left while accelerating through the junction.'
  }
  if (finished) {
    title = 'Bypass exit reached'
    description = 'The SUV is stopped while the simulated closure check finishes.'
  }

  const network = scenario.verification === 'Confirmed closure' ? 'Closure verified'
    : scenario.sensorInCloud ? 'Supabase record received'
      : scenario.sync === 'syncing' ? 'Simulated cloud sync'
        : packet?.step === 'at-3MH' || packet?.step === 'processing' || packet?.step === 'processed' ? '3MH gateway processing'
          : packet?.sender === '2L' ? 'RF hop 2L → 3MH'
            : packet ? 'RF hop 1E → 2L' : drive.gates.includes('rockfall') ? 'Awaiting field checkpoint' : 'Monitoring active'
  const Icon = finished ? Flag : cleared ? Route : TriangleAlert
  return <>
    <main className="drive-objective">
      <div className="eyebrow"><Icon size={15} /> RIDGE ROAD</div>
      <h1 aria-live="polite">{title}</h1>
      <p>{description}</p>
      <div className="drive-network"><span className="status-light" />{network}</div>
    </main>
    <div className="drive-instruments">
      <div className="drive-speed" aria-label="Vehicle speed">
        <span className="drive-gear">{drive.speed < -.2 ? 'R' : drive.speed > .2 ? 'D' : 'P'}</span>
        <div><strong>{Math.round(Math.abs(drive.speed) * 3.6)}</strong><span>KM/H</span></div>
        <div className="drive-speed-bar"><i style={{ width: Math.abs(drive.speed) / TOP_SPEED * 100 + '%' }} /></div>
      </div>
      <div className="drive-help"><Gamepad2 size={14} /><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows</span><span><kbd>Space</kbd> brake</span></div>
    </div>
    {!paused && <div className="touch-pedals" aria-label="Touch driving controls">
      <div><HoldButton name="Steer left" pedal="left" icon={ArrowLeft} /><HoldButton name="Steer right" pedal="right" icon={ArrowRight} /></div>
      <div><HoldButton name="Brake" pedal="brake" icon={CircleStop} /><HoldButton name="Reverse" pedal="reverse" icon={ArrowDown} /><HoldButton name="Accelerate" pedal="forward" icon={ArrowUp} /></div>
    </div>}
  </>
}
