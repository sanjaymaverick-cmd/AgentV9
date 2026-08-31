# Agent V9: Velocity City

A child-safe 3D open-world spy action-adventure for ages ~8–12. Ride the intelligent **V9
motorcycle** across Velocity City, use non-lethal gadgets, and solve every mission three
different ways: **Speed**, **Stealth**, or **Smarts**.

> Status: **playable vertical slice**. Runs in any modern browser at 60 FPS on desktop.
> Android packaging is the next milestone — see [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run smoke` | Build, then boot the game in headless Chromium and fail on any runtime error |

Requires Node 20+ (see `.nvmrc`).

---

## What's in the game right now

**World.** One open city district with road network, districts, traffic, pedestrians,
landmarks, fuel stations, collectibles and points of interest.

**V9 motorcycle.** Custom arcade physics — throttle, braking, speed-sensitive steering,
leaning, drifting, nitro boost, ramp jumps, crash reset, fuel and engine gauges,
full visual customisation (paint, rims, underglow, decals, exhaust).

**On foot.** Third-person agent with mount/dismount, crouch/silent mode, contextual
interaction, and five disguises.

**Stealth.** Patrolling CHAOS security bots and sweeping security cameras with vision
cones and a rising alert meter. Getting caught escorts you out — nobody gets hurt.

**Gadgets.** EMP Tagger, Foam Launcher, Mini Recon Drone, Hologram Decoy, Remote V9.

**Missions.** `The Midnight Prototype` — a five-step story mission ending in a giant
cargo-drone interception, with genuine Speed / Stealth / Smarts hints at every step.

**Support systems.** GPS routing and minimap radar, XP and agent ranks, credits,
side quests from city NPCs, fully procedural Web Audio soundtrack and effects,
in-game walkthrough, and a parental controls panel with a play timer.

**Privacy.** The game is entirely offline. No accounts, no analytics, no ads, no network
calls, no personal data. Progress is stored only in the browser's own local storage.

## Controls

**Keyboard** — `W A S D` move · `Shift` boost · `Space` jump / brake · `E` interact ·
`C` crouch / silent · `F` fire gadget · `1`–`5` select gadget · `V` cycle camera · `R` reset V9

**Touch** — on-screen joystick or D-pad (switchable), throttle, brake, boost, drift,
jump, fire, dismount, horn.

---

## Project layout

```
src/
  main.tsx              React entry point
  App.tsx               Top-level state, save/load, modal orchestration
  types/game.ts         Shared domain types (missions, stats, world entities)
  game/
    gameEngine.ts       Three.js scene, game loop, physics, AI, missions
    world.ts            Procedural construction of Velocity City
    models.ts           Procedural meshes — bike, agent, bots, drones, props
    missionEngine.ts    Mission data (ScriptableObject equivalent)
    audio.ts            Procedural Web Audio synth engine + speech
  components/           React HUD and modal UI
docs/
  SPEC.md               The original master build brief — the source of truth
  ARCHITECTURE.md       How the code is organised and why
  ROADMAP.md            What's done, what's missing, and in what order to build it
  CLAUDE_CODE_PROMPT.md Ready-to-paste working brief for a coding agent
```

## Tech

TypeScript · React 19 · Three.js · Vite 6 · Tailwind CSS 4 · Web Audio API

No game engine, no build-time asset pipeline — every mesh, texture and sound is generated
procedurally in code, which keeps the whole game a single ~1 MB bundle that works offline.

---

*A personal project built for one nine-year-old. Not for distribution.*
