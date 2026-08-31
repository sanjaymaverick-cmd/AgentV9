# Working brief for Claude Code — Agent V9: Velocity City

Paste this whole file as your first message in a Claude Code session opened at the repo
root. Everything it references is in the repo.

---

## Who you are on this project

You are the gameplay engineer and mobile build engineer for **Agent V9: Velocity City** — a
child-safe 3D open-world motorcycle-spy game built for one nine-year-old player. You are
taking over a **working ~9,000-line codebase**, not starting from scratch.

Read these three files before writing any code:

- `docs/SPEC.md` — the original design brief. The source of truth for *what the game is*.
- `docs/ARCHITECTURE.md` — how the code is organised and the five rules that keep it coherent.
- `docs/ROADMAP.md` — an audit of what genuinely works, what is a stub, and the build order.

## The stack (settled — do not relitigate)

TypeScript · React 19 · Three.js · Vite 6 · Tailwind 4 · Web Audio API.

The spec was written for Unity + C#. It was **deliberately** built on the web stack instead,
because that path reaches a phone in days without Unity Editor work. Every *gameplay*
requirement in the spec still binds. Where the spec names a Unity class, build a module with
that responsibility. **Do not propose porting to Unity.**

## Non-negotiable constraints

1. **Fully offline. Zero network calls.** No analytics, no ads, no accounts, no telemetry,
   no remote assets, no fonts from a CDN. The audience is a child; the game collects
   nothing. If a library you want makes a network request, don't use it.
2. **Non-lethal, always.** Enemies are robots, drones and cameras. Getting caught escorts
   the player out. No weapons that read as firearms, no blood, no death.
3. **Everything procedural.** No external model, texture or audio files. `models.ts` builds
   meshes from primitives; `audio.ts` synthesises every sound. This is why the game is one
   ~1 MB offline bundle. Preserve it.
4. **Forgiving by design.** Age 9 is the target. Checkpoint often, never punish failure
   hard, keep steering assist and waypoint guidance working.
5. **No fake progress.** If you can't finish a subsystem, leave an explicit `TODO` naming
   what's missing. Never ship a stub that looks finished — the codebase already has several
   of those and they're the biggest problem in it (see `ROADMAP.md`).

## How to work

- **Read before you write.** This codebase works. Don't rewrite systems that function.
  Prefer additive, incremental change.
- **Keep it green.** `npm run typecheck` and `npm run smoke` must both pass before you
  call any task done. `npm run smoke` builds the game, boots it in headless Chromium and
  fails on any runtime error — it is your regression net.
- **One task, one commit.** Conventional-commit style: `feat(chase): adaptive pursuit speed`.
- **Report per task:** files created, files modified, how to test it by hand, known
  limitations, next step.
- **Test on the phone early and often** once Phase B lands. Desktop 60 FPS tells you
  nothing about a mid-range Android device.

---

## The work, in order

Phases A and B come first because they unblock and de-risk everything after them. Do not
jump ahead to the fun gameplay work in Phase C — the save system and the phone build are
what make that work verifiable.

### Phase A — foundations

**A1. Versioned save system.** *(spec §21 — currently the worst gap)*
Today only stats, settings and bike customisation persist across a reload. Player position,
current mission, mission step, active disguise, gadget unlocks, collected items and CHAOS
state are all lost.
Build one `SaveManager` owning a single versioned save object with `SAVE_DATA_VERSION = 1`
and a `migrate(data, fromVersion)` path. Autosave on mission-step advance and at
checkpoints. Keep only trivial settings outside the save object.
*Done when:* mid-mission reload restores position, mission step, disguise and inventory,
and a hand-edited older-version save still loads through the migration path.

**A2. Debug menu.** *(spec §33)*
Dev-builds only, stripped from production by `import.meta.env.DEV`. Teleport to mission
step, reset V9, refill gadgets, clear CHAOS alert, unlock any disguise, mission-stage
selector, FPS counter, memory readout, quality-level switch.
*Done when:* it's reachable in `npm run dev`, and absent from the production bundle
(verify by grepping `dist/`).

**A3. Split `gameEngine.ts`.** It's ~2,300 lines doing physics, AI, missions, GPS and camera
work in one class. Extract subsystems that share the `GameState` and `WorldObjects` handles
— start with `MotorcyclePhysics`, `StealthAI`, `MissionRunner`, `GPSNavigator`, `CameraRig`.
Pull magic numbers into a `tunables.ts`.
*Done when:* behaviour is byte-for-byte unchanged (smoke test passes), and no file exceeds
~600 lines.

**A4. Fix the three known bugs.**
- HUD overlap: the rank/XP panel renders under the CHASE CAM / RESET buttons at top-left.
- `THREE.Clock` → `THREE.Timer`; `PCFSoftShadowMap` → a non-deprecated shadow mode.
- Add an explicit "tap to start" gate so AudioContext resumes on a real user gesture
  (Android WebViews silently swallow audio otherwise).

### Phase B — get it onto the phone

This is the milestone that matters. Everything before it is preparation; everything after it
is improvement.

**B1. Capacitor wrapper.** *(spec §27–§30)*
Wrap the Vite build with Capacitor. Package id `com.velocitynine.agentv9`, kept easy to
change. Landscape-left + landscape-right lock. Fullscreen/immersive, no status bar.
Application icon, adaptive icon, splash screen. **Request no permissions at all** — the game
needs none. Confirm the manifest is clean.
*Done when:* `npx cap run android` installs and launches a debug APK on a real phone.

**B2. Gamepad support.** *(spec §6, §38.6)*
Poll the Gamepad API in the game loop and write into `EngineInputState` — the input struct
is already designed for this. Left stick steers, triggers throttle/brake, face buttons for
jump/boost/gadget/interact. Auto-hide the touch HUD while a pad is connected.
*Done when:* a Bluetooth controller drives the bike on the phone with the touch UI hidden.

**B3. Quality presets.** *(spec §26)*
Replace the single `highQualityGraphics` boolean with LOW / MEDIUM / HIGH governing shadow
resolution, renderer pixel ratio, traffic count, pedestrian count, draw distance and
particle budget. Auto-detect a recommended preset on first launch from device pixel ratio,
`hardwareConcurrency` and `deviceMemory`, and let the player override it.
*Done when:* switching presets visibly changes load and the auto-detected default is sane
on the target phone.

**B4. First profiling pass.** Run on the actual device. Measure frame time. Fix the worst
offenders only — don't optimise speculatively.
*Done when:* the target phone holds a stable 30 FPS minimum while riding through traffic.

### Phase C — finish the systems that only pretend to work

**C1. `ChaosAlertManager`.** *(spec §17)*
`chaosAlertLevel` currently only ever takes the values 0 and 2. Build all six levels with
real content: L1 search drone, L2 enhanced cameras, L3 interceptor drones, L4 roadblocks
and trackers, L5 elite pursuit robot. Implement decay: hiding, escaping the pursuit radius,
changing disguise, safe areas, disabling a tracker, underground routes.
*Done when:* sustained bad behaviour escalates through all five levels and each decay route
measurably works.

**C2. Race framework.** *(spec §19)*
`side_race_downtown` is mission text with nothing behind it. Build `RaceManager`,
`RaceCheckpoint` and `RaceParticipant` equivalents: ordered checkpoints, wrong-checkpoint
detection, race and lap timing, results. Place real checkpoint meshes and make the downtown
checkpoint sprint actually playable.
*Done when:* the sprint can be started, run, failed on time, and completed with a recorded
best time that persists through the save system.

**C3. Chase controller.** *(spec §18)*
Story step 3 is a proximity check against a drone on a fixed sine path. Build a reusable
chase controller: target path, adaptive target speed within a distance band, dynamic
checkpoints, shortcuts, obstacle spawning, a fail threshold that allows recovery. **No
unfair rubber-banding.** Rebuild the story chase on top of it.
*Done when:* the chase is losable and winnable, and a small mistake doesn't end it.

**C4. AI state machine.** *(spec §11)*
Bots have a single float `alertLevel`. Build the five named states — Unaware, Curious,
Investigating, Alert, Searching — with real investigate and search behaviours, a sound-event
bus feeding perception, and waypoint-graph navigation instead of straight-line lerps.
Add data-driven restricted zones with an `allowedDisguises[]` list, replacing the hardcoded
disguise string checks inside the bot update.
*Done when:* a bot that hears something walks to investigate, searches, then gives up and
returns to patrol.

**C5. Museum interior + infiltration area.** *(spec §3)*
The museum and station are solid boxes with gates. Build one enterable interior containing
a real stealth infiltration area — cameras, patrols, a disguise-gated door and a hackable
terminal — so all three of Speed, Stealth and Smarts have a physical space to play out in.

### Phase D — polish and ship

**D1.** Object pooling, LOD groups, instancing for repeated props, distance-based
activation. *(spec §25)*
**D2.** Code splitting — the bundle is a single 979 KB chunk. Get the initial chunk under
500 KB.
**D3.** Unit tests on motorcycle physics, mission advancement and save migration.
**D4.** Produce a signed Android App Bundle.

---

## The finish line

Spec §38, restated:

> The objective is not maximum content. The objective is proving that
> **motorcycle + open world + stealth + spy gadgets + multiple solutions**
> is genuinely fun on Android.

The full 19-point checklist is at the bottom of `docs/ROADMAP.md`. Tick items off there as
you land them.

## Start here

Read `docs/ROADMAP.md`, then begin with **A1 (versioned save system)**. Confirm your plan
for A1 before you write it.
