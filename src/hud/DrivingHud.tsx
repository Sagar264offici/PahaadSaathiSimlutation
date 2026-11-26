import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CircleStop, Gamepad2, Route } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { driveMission, TOP_SPEED } from '../game/Drive'
import { setTouchDrive, type Pedal } from '../game/DrivingInput'
import { useGame } from '../game/GameEngine'
import { Inspection, focusLabels } from './Inspection'
import { landslideDistance } from '../world/layout'

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
  const focus = useGame((state) => state.focus)
  const viewing = focus !== 'vehicle'
  const mission = driveMission(drive, scenario)
  const packet = scenario.packet
  const network = scenario.verification === 'Confirmed closure' ? 'Closure verified'
    : scenario.acknowledgedAt !== null ? 'Headquarters acknowledged'
      : scenario.sensorInCloud ? 'Supabase record received'
      : scenario.sync === 'syncing' ? 'Simulated cloud sync'
        : packet?.step === 'processed' || packet?.step === 'processing' ? 'GW-01 gateway processing'
          : packet?.sender === 'NODE-02' ? 'LoRa hop NODE-02 → GW-01'
            : packet?.step === 'at-NODE-02' ? 'NODE-02 validating the packet'
              : packet?.step === 'sending-NODE-01' ? 'LoRa hop NODE-01 → NODE-02' : 'Monitoring active'
  const { interact, inspect } = useGame.getState()
  return <>
    <main className="drive-objective">
      <div className="eyebrow"><Route size={15} /> {scenario.rockAt === null ? `${Math.max(0, Math.min(landslideDistance, Math.floor(drive.odometer)))} / 10 M` : 'FIELD EXERCISE'}</div>
      <h1 aria-live="polite">{mission.title}</h1>
      <p>{mission.cue}</p>
      <div className="drive-network"><span className="status-light" />{network}</div>
      {!viewing && mission.focus && scenario.rockAt !== null && <button className="drive-action" disabled={paused} onClick={interact}>Inspect event <kbd>E</kbd></button>}
      {!viewing && scenario.routeAt !== null && <button className="drive-action" disabled={paused} onClick={() => inspect('route')}>View aerial route</button>}
      {viewing && <button className="control reset-view" onClick={() => inspect('vehicle')}>Return to SUV <kbd>C</kbd></button>}
    </main>
    {viewing ? <aside className="game-inspection event-panel" aria-label="Game inspection">
      <div className="eyebrow">FIELD INSPECTION</div>
      <h2>{focusLabels[focus][0]}</h2>
      <p>{focusLabels[focus][1]}</p>
      <Inspection focus={focus} />
      <p className="inspection-camera-help">Drag to orbit · scroll or pinch to zoom</p>
    </aside> : <button className="control survey-camera" onClick={() => inspect('world')}>Orbit camera <kbd>C</kbd></button>}
    <div className="drive-instruments">
      <div className="drive-speed" aria-label="Vehicle speed">
        <span className="drive-gear">{drive.speed < -.2 ? 'R' : drive.speed > .2 ? 'D' : 'P'}</span>
        <div><strong>{Math.round(Math.abs(drive.speed) * 3.6)}</strong><span>KM/H</span></div>
        <div className="drive-speed-bar"><i style={{ width: Math.abs(drive.speed) / TOP_SPEED * 100 + '%' }} /></div>
      </div>
      <div className="drive-help"><Gamepad2 size={14} /><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows</span><span><kbd>Space</kbd> brake</span><span><kbd>E</kbd> inspect</span></div>
    </div>
    {!paused && !viewing && <div className="touch-pedals" aria-label="Touch driving controls">
      <div><HoldButton name="Steer left" pedal="left" icon={ArrowLeft} /><HoldButton name="Steer right" pedal="right" icon={ArrowRight} /></div>
      <div><HoldButton name="Brake" pedal="brake" icon={CircleStop} /><HoldButton name="Reverse" pedal="reverse" icon={ArrowDown} /><HoldButton name="Accelerate" pedal="forward" icon={ArrowUp} /></div>
    </div>}
  </>
}
