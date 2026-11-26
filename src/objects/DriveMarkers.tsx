import { Html } from '@react-three/drei'
import { ArrowLeft, Flag, TriangleAlert } from 'lucide-react'
import { useGame } from '../game/GameEngine'
import { drivePosition, DRIVE_GATES, ROADBLOCK } from '../game/Drive'
import { Box } from '../world/Infrastructure'

function GateLabel({ label, color, icon: Icon }: { label: string; color: string; icon: typeof Flag }) {
  return <Html position={[0, 2.5, 0]} center pointerEvents="none" zIndexRange={[13, 9]}>
    <div className="world-tag drive-marker" style={{ color }}><Icon size={14} />{label}</div>
  </Html>
}

export function DriveMarkers() {
  const active = useGame((state) => state.control === 'drive' && state.mode !== 'menu')
  const drive = useGame((state) => state.drive)
  const { gates } = drive
  const rockfall = useGame((state) => state.scenario.rockAt !== null)
  const bypass = useGame((state) => state.scenario.routeAt !== null)
  if (!active) return null
  const next = drive.route === 'bypass' ? 'finish' : !gates.includes('rockfall') ? 'rockfall' : !gates.includes('sensors') ? 'sensors' : 'junction'
  const player = drivePosition(drive)
  const visible = DRIVE_GATES.filter(({ id, point }) => id === next && player.distanceTo(point) < 82 && !gates.includes('finish'))
  return <>
    {visible.map(({ id, point, yaw, collider }) => {
      const finish = id === 'finish'
      const diversion = id === 'junction' && bypass
      const color = finish || diversion ? '#a3f8cc' : '#f4b75f'
      return <group key={id} position={point} rotation-y={yaw}>
        <mesh position-y={.062} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[collider.halfSize.x * 2 - .25, collider.halfSize.z * 2]} />
          <meshBasicMaterial color={color} transparent opacity={.14} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
        </mesh>
        {[-2.92, 2.92].map((x) => <group key={x} position-x={x}>
          <Box size={[.15, .96, .16]} position={[0, .47, 0]} color="#383b32" />
          <Box size={[.23, .24, .19]} position={[0, .95, 0]} color={color} glow />
        </group>)}
        {id !== 'junction' && <GateLabel label={finish ? 'BYPASS EXIT' : id === 'rockfall' ? 'LANDSLIDE LOOKOUT' : 'NODE-01 CHECKPOINT'} color={color} icon={finish ? Flag : TriangleAlert} />}
      </group>
    })}
    {rockfall && <group position={ROADBLOCK.point} rotation-y={ROADBLOCK.yaw}>
      {drive.route === 'ridge' && <GateLabel label={bypass ? 'TURN LEFT · BYPASS' : 'TEMPORARY ROADBLOCK'} color={bypass ? '#a3f8cc' : '#f4b75f'} icon={bypass ? ArrowLeft : TriangleAlert} />}
      {[-2.25, 2.25].map((x) => <Box key={x} size={[.28, .86, .34]} position={[x, .39, 0]} color="#54584c" />)}
      {Array.from({ length: 6 }, (_, i) =>
        <Box key={i} size={[.8, .24, .16]} position={[(i - 2.5) * .8, .78, 0]} color={i % 2 ? '#e9cd8d' : '#a24935'} />)}
    </group>}
  </>
}
