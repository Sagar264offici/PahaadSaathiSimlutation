export const CUES = {
  intro: 0,
  drive: 8,
  node: 19,
  vibration: 32,
  processing: 43,
  radio: 55,
  gateway: 68,
  cloud: 80,
  mobile: 91,
  review: 104,
  confirmed: 114,
  diversion: 120,
  turn: 124,
  offline: 133,
  restored: 143,
  overview: 149,
  end: 168,
} as const

export const DURATION = CUES.end

export type Stage = {
  from: number
  chapter: number
  title: string
  description: string
  status: string
  tone?: 'amber' | 'red' | 'blue'
  facts?: readonly (readonly [label: string, value: string])[]
}

export const STAGES: readonly Stage[] = [
  { from: CUES.intro, chapter: 1, title: 'Enter the mountains', description: 'A mountain road safety mission begins in the Himalayan foothills.', status: 'Monitoring' },
  { from: CUES.drive, chapter: 1, title: 'Enter the mountains', description: 'The survey vehicle follows the ridge road toward a roadside monitoring station.', status: 'Monitoring' },
  { from: CUES.node, chapter: 2, title: 'The sensor node', description: 'Two sensors feed an Arduino UNO R3. Its HC-12 sends events over a wireless serial link.', status: 'Monitoring', facts: [['SW-420', 'Digital vibration trigger'], ['GY-521 MPU6050', 'Acceleration + angular velocity']] },
  { from: CUES.vibration, chapter: 3, title: 'Potential hazard event', description: 'Loose rocks shift on the slope. A vibration trigger puts NODE-01 into event mode.', status: 'Sensor triggered', tone: 'amber', facts: [['Node', 'NODE-01'], ['Processing', 'Arduino UNO']] },
  { from: CUES.processing, chapter: 4, title: 'The Arduino builds a packet', description: 'The UNO reads the trigger and motion inputs, then hands the event packet to the HC-12 transmitter.', status: 'Packet ready', facts: [['Simulated packet', 'PS-001'], ['Node', 'NODE-01'], ['Event', 'VIBRATION_TRIGGERED'], ['Transport', 'HC-12']] },
  { from: CUES.radio, chapter: 5, title: 'Across the valley', description: 'A simulated packet travels from the field HC-12 to a second HC-12 at the gateway.', status: 'HC-12 transmitting', tone: 'blue', facts: [['Link', 'Wireless serial'], ['Packet', 'PS-001']] },
  { from: 65, chapter: 5, title: 'Across the valley', description: 'The gateway’s HC-12 acknowledges reception in the simulation.', status: 'Packet received', tone: 'blue', facts: [['Link', 'Wireless serial'], ['Packet', 'PS-001']] },
  { from: CUES.gateway, chapter: 6, title: 'The Tinker Board gateway', description: 'The original ASUS Tinker Board reads the incoming serial event and forwards it over the network.', status: 'Network connected', facts: [['Gateway', 'ASUS Tinker Board'], ['Radio', 'HC-12 receiver'], ['Packet', 'Received']] },
  { from: CUES.cloud, chapter: 7, title: 'The event reaches Supabase', description: 'The simulated gateway synchronizes a new vibration event with the backend.', status: 'Under review', tone: 'amber', facts: [['Event', 'PS-001'], ['Source', 'NODE-01'], ['Type', 'Vibration'], ['Backend', 'Supabase']] },
  { from: CUES.mobile, chapter: 8, title: 'A mobile alert arrives', description: 'The PahaadSaathi Android app alerts the driver to a potential road hazard near the route.', status: 'Under review', tone: 'amber', facts: [['App preview', 'React Native + Expo concept']] },
  { from: CUES.review, chapter: 9, title: 'Road hazard under review', description: 'The driver slows near the warning marker while a simulated field inspection checks the road.', status: 'Under review', tone: 'amber', facts: [['Verification', 'Field inspection underway']] },
  { from: CUES.confirmed, chapter: 9, title: 'Confirmed road closure', description: 'The simulated inspection confirms debris obstructing the road. The vehicle stops before the closure.', status: 'Closure confirmed', tone: 'red', facts: [['Verification', 'Obstruction confirmed']] },
  { from: CUES.diversion, chapter: 9, title: 'Alternative route displayed', description: 'The vehicle takes the bypass through the valley. The displayed route is illustrative and its safety is unverified.', status: 'Illustrative bypass', tone: 'blue' },
  { from: CUES.offline, chapter: 10, title: 'Local link stays active', description: 'The gateway and local HC-12 link remain active in the demonstration. Cloud synchronization is pending.', status: 'Internet offline', tone: 'amber', facts: [['Gateway', 'Online'], ['Internet', 'Offline'], ['Cloud sync', 'Pending · illustrative']] },
  { from: CUES.restored, chapter: 10, title: 'Network restored', description: 'With internet access restored, the demonstration resumes cloud synchronization.', status: 'Sync complete', facts: [['Gateway', 'Online'], ['Internet', 'Restored'], ['Cloud sync', 'Complete · simulated']] },
  { from: CUES.overview, chapter: 11, title: 'From detection to decision', description: 'One event follows the complete path from mountainside sensors to a decision on the road.', status: 'Mission complete' },
]

export function cueIndex(timeline: readonly { from: number }[], time: number) {
  for (let index = timeline.length - 1; index > 0; index--) {
    if (time >= timeline[index].from) return index
  }
  return 0
}

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
export const phase = (time: number, from: number, to: number) => clamp01((time - from) / (to - from))
export const smooth = (value: number) => value * value * (3 - 2 * value)
