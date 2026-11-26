# PahaadSaathi

PahaadSaathi is a mountain safety simulation set in a continuous 3D Himalayan valley.

- **Presentation Mode** runs an 86-second exercise. The SUV travels 10 metres and triggers a distant landslide. The sensor warning reaches headquarters and the phone after about seven seconds. Around ten seconds after the slide, the app shows a turnaround, the last accessible junction, and a long detour through the west valley.
- **Game Mode** uses the same incident sequence. Drive the SUV to trigger the event. Choose **Return to safe location** or **Select long detour** in Routes, then accelerate at the turnaround. The first option parks at the return junction. Select the long detour to continue to the destination.

## PahaadSaathi app

Choose **Open PahaadSaathi app** from the simulation menu or open `/#app/home`. The standalone view and in-simulation panel share the current exercise. **Home** summarizes road status, **Alerts** explains the source and status of each warning, and **Routes** shows the road network and available detours. **Community** shows witness evidence and opens the camera reporting form. **Help** links to **Headquarters** for moderation, telemetry, and incident history.

## Controls

| Input | Accelerate | Reverse | Steer | Brake |
| --- | --- | --- | --- | --- |
| Keyboard | W or ↑ | S or ↓ | A/D or ←/→ | Space |
| Gamepad | RT or A | LT | Left stick or D-pad | X |
| Touch | Up pedal | Down pedal | Left/right pedals | Center brake |

Press **E** to inspect the current event. Press **C** to enter orbit view or return to the SUV. Drag to orbit and scroll or pinch to zoom. Use the shield button to open headquarters. The audio settings provide independent master, environment, and rockfall levels.

## Incident flow

NODE-01 uses simulated SW-420 and MPU6050 readings. An ESP32-C3 sends the event over a separate LoRa module. NODE-02 relays it to the Tinker Board gateway at GW-01 using a custom forwarding protocol. Simulated Supabase synchronization publishes the preliminary sensor warning to the app and headquarters without waiting for witness evidence.

The headquarters operator acknowledges receipt. A separate moderator role verifies evidence and records hazard confirmation, closure, resolution, or reopening. The audit records simulated actor identities and timestamps. The Game Mode phone has a separate camera-only reporting flow that captures the current 3D scene and hashes the image. Presentation Mode demonstrates a scripted witness separately from the sensor warning.

## Simulation boundaries

The exercise uses simulated radio, cloud synchronization, positions, roles, and evidence assessment. The camera captures the rendered scene and uses simulated GPS. The 64 km regional detour is compressed into the modeled terrain and does not represent road safety certification. Node outage is displayed as unavailable telemetry. Offline cloud writes are held in a session-local queue.

## Run and verify

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

The existing Vite configuration builds to `dist`. WebGL 2 provides the 3D scene and scene camera. A 2D route map remains available without WebGL 2. See [asset credits](ASSETS.md).
