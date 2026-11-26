# PahaadSaathi

PahaadSaathi is a browser-based mountain safety simulation set in a continuous 3D Himalayan valley.

- **Presentation Mode** opens the Start Presentation screen. The cinematic tour shows the distant landslide, the field station detecting movement, two LoRa hops, gateway validation, community evidence, the closure, the bypass, and regional deployment. Pause, restart, replay an event, step between events, or choose a camera focus from the HUD.
- **Game Mode** lets you drive the SUV through 3D checkpoints. Observe the distant slide, inspect NODE-01, transmit and follow PS-001 through NODE-02, inspect GW-01, compare the two sources of evidence, and confirm the closure before taking the bypass.

## Game controls

| Input | Accelerate | Reverse | Steer | Brake |
| --- | --- | --- | --- | --- |
| Keyboard | W or ↑ | S or ↓ | A/D or ←/→ | Space |
| Gamepad | RT or A | LT | Left stick or D-pad | X |
| Touch | Up pedal | Down pedal | Left/right pedals | Center brake |

Press **E** or use the highlighted action to advance an inspection. Press **C** to enter orbit view or return to the SUV. Drag to orbit, right-drag to pan, and scroll or pinch to zoom. Escape pauses or resumes Game Mode. The supplied soundtrack loops during driving and follows the sound toggle.

## Simulated architecture

At NODE-01, the ESP32-C3 SuperMini receives a digital SW-420 trigger and MPU6050 acceleration and angular-velocity observations. The soil probe and bimetallic switch represent independent context signals. A separate LoRa module transmits the warning. NODE-02 uses a custom forwarding protocol to relay it to GW-01, whose ASUS Tinker Board validates and synchronizes the packet. A simulated field check combines the warning with a community report before confirming the closure.

All sensor readings, radio activity, synchronization, moderation, GPS and routing are simulated. Packet timing is paced for the demonstration. Regional placement illustrates the proposed architecture, with field coverage subject to a site survey. The bypass is illustrative.

## Run and verify

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Graphics settings include Low, Medium, and High. Browsers without WebGL 2 keep the simulation and game controls in a 2D route map.

## Vercel

The existing Vite configuration builds to `dist`. The application needs no environment variables, backend services, or external asset URLs. The previous driving release is commit `b5ef93f`.

See [asset credits](ASSETS.md) for third-party licenses and hardware references.
