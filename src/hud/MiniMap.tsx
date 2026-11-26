import { useId } from 'react'
import { ChevronUp, MapPin } from 'lucide-react'
import { driveHeading, drivePosition } from '../game/Drive'
import { useGame } from '../game/GameEngine'
import { roadIsBlocked } from '../game/Scenario'
import { closurePoint, gateway, node, relay, vehicleAt } from '../world/layout'
import { bypassSvg, closureSvg, contourSvg, mapPoint, mapSize, riverSvg, roadSvg } from '../world/map'

export function MiniMap({ inline = false }: { inline?: boolean }) {
  const mode = useGame((state) => state.mode)
  const second = useGame((state) => state.second)
  const scenario = useGame((state) => state.scenario)
  const closed = scenario.verification === 'Confirmed closure'
  const blocked = roadIsBlocked(scenario)
  const route = scenario.routeAt !== null
  const control = useGame((state) => state.control)
  const drive = useGame((state) => state.drive)
  const manual = control === 'drive' && mode !== 'menu'
  const id = useId()
  const time = mode === 'menu' ? 21 : second
  const { road, u } = vehicleAt(time, scenario.turnAt)
  const [vx, vy] = mapPoint(manual ? drivePosition(drive) : road.getPointAt(u))
  const [nx, ny] = mapPoint(node)
  const [rx, ry] = mapPoint(relay)
  const [gx, gy] = mapPoint(gateway)
  const [hx, hy] = mapPoint(closurePoint)
  const tangent = manual ? driveHeading(drive) : road.getTangentAt(u)
  const rotation = Math.atan2(tangent.x, -tangent.z) * 180 / Math.PI
  return <aside className={inline ? "mini-map embedded-map" : "mini-map"} aria-label="Ridge Sector route map">
    <div className="map-heading"><MapPin size={14} /><span>RIDGE SECTOR</span><span className="map-north">N <ChevronUp size={12} /></span></div>
    <svg className="map-drawing" viewBox={`0 0 ${mapSize.w} ${mapSize.h}`} role="img" aria-label="Mountain road with the vehicle, field node, and gateway">
      <defs>
        <pattern id={id} width="23" height="19" patternUnits="userSpaceOnUse"><path d="M23 0 H0 V19" fill="none" stroke="#6d8a7d" strokeWidth=".5" opacity=".48" /></pattern>
      </defs>
      <rect width="240" height="152" fill={`url(#${id})`} />
      <path d={contourSvg} stroke="#879984" strokeWidth=".62" fill="none" opacity=".56" />
      <path d={riverSvg} stroke="#528e94" strokeWidth="2" fill="none" opacity=".74" />
      <path d={bypassSvg} stroke={route ? '#9ff1cc' : '#8eae9a'} strokeWidth={route ? '2.8' : '1.35'} strokeDasharray="3 2" fill="none" opacity=".9" />
      <path d={roadSvg} stroke="#112b26" strokeWidth="4.6" fill="none" />
      <path d={roadSvg} stroke="#cbb68b" strokeWidth="2.1" fill="none" />
      {closed && <path d={closureSvg} stroke="#ff7b65" strokeWidth="4" fill="none" />}
      {blocked && <circle cx={hx} cy={hy} r="8" fill={closed ? '#f47764' : '#e8b464'} fillOpacity=".26" stroke={closed ? '#ff8774' : '#efbd72'} strokeWidth="1.3" />}
      <rect x={gx - 2.8} y={gy - 2.8} width="5.6" height="5.6" fill="#a8d9c6" transform={`rotate(45 ${gx} ${gy})`} />
      <circle cx={nx} cy={ny} r="7.2" stroke="#e8b566" fill="#e8b566" fillOpacity=".16" strokeOpacity=".79" />
      <circle cx={nx} cy={ny} r="2.5" fill="#f6c77f" />
      <circle cx={rx} cy={ry} r="3" fill="#92cbd8" stroke="#243d38" strokeWidth="1" />
      {mode !== 'menu' && <g fill="#edf1db" fontSize="7.2" fontFamily="monospace">
        <text x={nx + 5} y={ny - 6}>01</text><text x={rx - 4} y={ry + 10}>02</text><text x={gx - 17} y={gy - 6}>GW</text>
      </g>}
      <g transform={`translate(${vx} ${vy}) rotate(${rotation})`}>
        <circle r="7" fill="#142d28" />
        <path d="M0 -6 L4.8 4 L0 2.3 L-4.8 4 Z" fill="#f3efdf" />
      </g>
    </svg>
    <div className="map-legend"><span><i /> Vehicle</span><span><i /> Field nodes</span><span><i /> GW-01</span></div>
  </aside>
}
