# PahaadSaathi

PahaadSaathi is a standalone, real-time 3D simulation of a Himalayan road safety mission. One press of **Start Simulation** runs the 2 minute 48 second scenario through the final aerial shot and replay screen.

## Run locally

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Settings offers Low, Medium, and High graphics quality. Sound is off initially. The HUD provides pause, resume, restart, sound, and fullscreen. A browser without WebGL 2 plays the same timeline in a 2D route map.

## Build and deploy

```sh
npm run build
npm run preview
```

Import this directory into Vercel as a Vite project. The build command is `npm run build` and the output directory is `dist`. The project uses Node.js 22 for local verification. The production site needs no environment variables or backend services. All fonts, models, and textures are served by the app.

## Demonstration behavior

The browser uses a configured demonstration location and a scripted event. It represents the SW-420 digital trigger and MPU6050 acceleration and angular velocity inputs, the UNO R3 and two HC-12 modules, an original ASUS Tinker Board gateway, Supabase, and an Android app concept. The alert starts under review. A simulated field inspection confirms the closure before the bypass is displayed. The bypass and offline cloud-sync behavior are illustrative.

The mission clock and chapter cues live in `src/game`, the continuous environment and vehicle layout in `src/world`, the shot direction in `src/camera`, and the hardware, network and phone in `src/objects`.

See [asset credits](ASSETS.md) for the bundled models, fonts, and hardware references.
