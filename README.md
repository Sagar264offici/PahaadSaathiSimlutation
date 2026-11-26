# PahaadSaathi

PahaadSaathi is a browser-based 3D Himalayan road safety exercise. In **Start Driving**, you control the SUV along the existing winding road. Entering the road's 3D trigger boxes starts the rockfall, logs sensor activity, and checks arrival at the junction and bypass exit. The SUV stops against the roadblock until you steer left onto the open bypass. The community and gateway reactions run in the background.

| Input | Accelerate | Reverse | Steer | Brake |
| --- | --- | --- | --- | --- |
| Keyboard | W or ↑ | S or ↓ | A/D or ←/→ | Space |
| Gamepad | RT or A | LT | Left stick or D-pad | X |
| Touch | Up pedal | Down pedal | Left/right pedals | Center brake |

Use Escape or the pause button to pause. The supplied soundtrack loops during driving and follows the sound toggle.

**Presenter Mode** exposes the same scenario through field commands. The **Timeline** tab loads checkpoints, **Map** shows the road, and **Event log** shows what happened. Drag to orbit, right-drag to pan, and scroll to zoom.

## Run and verify

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Use the local URL Vite prints. Graphics settings include Low, Medium, and High. Sound follows your saved preference. A browser without WebGL 2 uses the same controls and event state with a 2D route map.

## Demonstration sequence

1. Trigger the rockfall and let the debris settle across both lanes. The SUV stops short of the damaged section.
2. At **1E**, trigger vibration, generate a motion alert, build the event, and transmit. Receive at **2L**, forward, then receive at **3MH**. The packet inspector shows origin, sender, sequence, hop count, and TTL.
3. Process at **3MH**, validate the evidence metadata, and sync Supabase. Open the PahaadSaathi phone at Ridge Hamlet, create a report, and submit it. The presenter can change the hazard category and description before submission. The report uses a synthetic location, timestamp, and illustration.
4. Mark the hazard under review, correlate the evidence, corroborate it, and confirm closure. Generate the simulated bypass and move the SUV onto it. The verification controls also support rejecting an unconfirmed report and resolving a confirmed closure.
5. Switch internet off to demonstrate that the local RF diagnostic reaches 3MH. Restore internet to resume the simulation’s in-memory sync. The same controls let the presenter retry an active sync.
6. Select **Show Production Architecture** for the regional LoRa proposal. This view distinguishes sensing stations, coverage-only relays, gateways, and community reporting points.

The prototype models three virtual HC-12 endpoints. Two physical modules are confirmed in the project inventory. A third compatible module or designed radio interface is needed at 3MH for a three-endpoint build. All measurements, packets, moderation actions, synchronization, GPS locations, and route decisions in the browser are simulated. The bypass is illustrative and its safety is unverified.

## Vercel

The existing Vite configuration builds to `dist`. The application needs no environment variables, backend services, or external asset URLs. Use the existing Vercel project and domain. Verify a preview build before promoting it to production. The previous working commit is `3e8c721` and can be redeployed from the project’s deployment history if needed.

See [asset credits](ASSETS.md) for third-party licenses and hardware references.
