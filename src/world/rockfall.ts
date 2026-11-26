import { Vector3 } from 'three'
import { randomSeed } from './geometry'
import { elevationAt, mainRoad } from './layout'
import { phase } from '../game/Timeline'

const random = randomSeed(20747)
const keyframesPerSecond = 24
export const ROCK_COUNT = 73
const palette = ['#817565', '#a49072', '#9a8a78', '#706c61', '#b2a18b', '#837d6d']

export type Fragment = {
  start: Vector3
  impact: Vector3
  end: Vector3
  delay: number
  fall: number
  bounce: number
  size: number
  turn: number
  color: string
  ground: Float32Array
  slab: boolean
}

function onRoad(u: number, offset: number) {
  const point = mainRoad.getPointAt(u)
  const tangent = mainRoad.getTangentAt(u)
  point.x -= tangent.z * offset
  point.z += tangent.x * offset
  return point
}

const stranded = [
  [.612, -2.64, 1.31], [.612, -.18, 1.40], [.612, 2.46, 1.42],
  [.621, -2.4, 1.54], [.620, .45, 1.68], [.620, 2.68, 1.45],
  [.631, -1.4, 1.70], [.633, 1.57, 1.55], [.641, -.18, 1.49],
]

export const fragments: Fragment[] = Array.from({ length: ROCK_COUNT }, (_, index) => {
  const large = index >= 9 && index < 9 + stranded.length
  const scree = index >= 57
  const [u, spread, baseSize] = large ? stranded[index - 9] : [
    .606 + random() * .038, (random() - .5) * 6.75,
    index < 9 ? .09 + random() * .14 : .22 + random() ** 2 * .58,
  ]
  const size = scree ? .78 + random() * 1.18 : large ? baseSize * 1.21 : baseSize
  const startX = (scree ? 36.75 : 39.3) + random() * (scree ? 14 : 8.2)
  const startZ = -59.8 + (random() - .5) * (scree ? 18 : 10.6)
  const start = new Vector3(startX, elevationAt(startX, startZ) + size * .63, startZ)
  const impact = onRoad(.589 + random() * .023, 2.5 + random() * .7)
  const end = onRoad(u, spread)
  if (scree) {
    impact.lerp(start, .20 + random() * .36)
    end.lerp(start, .30 + random() * .30)
    end.y = elevationAt(end.x, end.z)
  }
  const fall = (large ? 2.35 : 1.7) + random() * 1.38
  const bounce = 1.12 + random() * 1.5
  const delay = index < 9 ? .48 + index * .19 : large ? 2.35 + (index - 9) * .21 : 2.6 + random() * 3.3
  const frames = Math.ceil((fall + bounce) * keyframesPerSecond)
  const ground = new Float32Array(frames + 1)
  const probe = new Vector3()
  for (let tick = 0; tick <= frames; tick++) {
    const t = tick / frames * (fall + bounce)
    const first = Math.min(1, t / fall)
    const last = phase(t, fall, fall + bounce)
    if (t < fall) probe.lerpVectors(start, impact, first ** 1.42)
    else probe.lerpVectors(impact, end, 1 - (1 - last) ** 2)
    const surface = elevationAt(probe.x, probe.z) + .27
    ground[tick] = surface
  }
  return { start, impact, end, delay, fall, bounce, size, slab: scree || large, turn: (index % 2 ? -1 : 1) * (3.8 + random() * 5.2), color: palette[index % palette.length], ground }
})

export function fragmentPose(rock: Fragment, age: number, position: Vector3) {
  const t = age - rock.delay
  const duration = rock.fall + rock.bounce
  const first = phase(t, 0, rock.fall)
  const last = phase(t, rock.fall, duration)
  const trace = phase(t, 0, duration) * (rock.ground.length - 1)
  const i = Math.floor(trace)
  const floor = rock.ground[i] + (rock.ground[Math.min(i + 1, rock.ground.length - 1)] - rock.ground[i]) * (trace - i)
  if (t < rock.fall) {
    position.lerpVectors(rock.start, rock.impact, first ** 1.42)
    position.y = Math.max(floor + rock.size * .58, rock.start.y + (rock.impact.y + rock.size * .61 - rock.start.y) * first ** 1.83)
  } else {
    position.lerpVectors(rock.impact, rock.end, 1 - (1 - last) ** 2)
    const impacts = Math.abs(Math.sin(last * Math.PI * 2.74)) * (1 - last) ** 2.2
    position.y = floor + rock.size * (.58 + impacts) + (1 - last) * impacts * .58
  }
  return first * .73 + (1 - (1 - last) ** 2) * .27
}
