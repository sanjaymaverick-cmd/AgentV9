# Roadmap — what's done, what's left

Audited against [`SPEC.md`](SPEC.md) on 2026-08-31, from the actual code, with the game
booted in a headless browser to confirm it runs clean (zero runtime errors).

## Verdict

The vertical slice described in spec §3 is **roughly 70% real**. The world, the bike, the
gadgets, the disguises, the stealth detection and the story mission all genuinely work.
What's missing splits into three buckets: **systems that are stubs pretending to be
finished**, **the entire Android delivery path**, and **structural debt** that will make
the next six months slower if it isn't paid down early.

---

## ✅ Done and working

| Spec | System | Notes |
| --- | --- | --- |
| §3, §9 | Open city district | Roads, junctions, districts, colliders, landmarks, POIs |
| §4 | Third-person agent | Walk/run, gravity, ground check, interaction raycast, crouch |
| §5 | V9 motorcycle | Custom arcade physics — throttle, brake, speed-scaled steering, lean, drift, nitro, ramp jumps, airborne handling, crash reset |
| §6 | Touch controls | Virtual joystick **and** D-pad, switchable; throttle/brake/boost/drift/jump/fire/dismount/horn |
| §7 | Enter/exit vehicle | Mount/dismount with camera and controller handover |
| §8 | Camera system | Four modes — chase, action, FPV, tactical — with speed-sensitive framing |
| §10 | Mission framework | Data-driven steps with per-step Speed/Stealth/Smarts hints |
| §11 | Stealth detection | Vision cones, distance, silent mode, rising alert meter, escort-out on capture |
| §12 | Security cameras | Sweeping cones, EMP-disable, hackable terminals |
| §13 | Disguises | Five disguises, lockers, disguise-aware bot behaviour |
| §14 | Gadget set | EMP Tagger, Foam Launcher, Mini Recon Drone, Hologram Decoy, Remote V9 |
| §15 | Recon drone | Launch, fly, camera view, return |
| §16 | Child-safe action | Robots and drones only; capture = escorted out, never harm |
| §20 | Traffic & pedestrians | Route-following vehicles, wandering NPCs, dialogue, side quests |
| §23 | HUD/UX | Mission panel, speedometer, fuel/nitro, radar minimap, GPS routing, gadget bar |
| §24 | Child accessibility | Steering assist, waypoint guidance, in-game walkthrough, forgiving failure |
| §31 | Privacy-first | Zero network calls, zero data collection, no ads, fully offline |
| §32 | Audio | Fully procedural Web Audio engine — engine RPM, gadgets, music, speech |
| — | Extras beyond spec | Bike customiser, fuel stations, XP/ranks/credits, collectibles, stunt rings, parental play-timer |

---

## ⚠️ Stubs — present in name, not in behaviour

These are the ones that matter most, because the UI already implies they work.

### 1. CHAOS Alert (spec §17) — *severity: high*
`chaosAlertLevel` only ever takes the values **0 and 2**. Levels 1, 3, 4 and 5 are
declared in the spec and shown in the HUD but nothing produces them, and none of the
escalation content exists: no search drone, no interceptor drones, no roadblocks or
trackers, no elite pursuit robot. There is also no decay path — no "escape the pursuit
radius", no "change disguise to cool down", no safe areas.
**Needs:** a real `ChaosAlertManager` owning level, progress, escalation triggers, decay
rules, and the spawn/despawn of pursuit entities per level.

### 2. Racing (spec §19) — *severity: high*
`side_race_downtown` exists as **mission text only**. There is no checkpoint entity, no
ordering, no wrong-checkpoint detection, no timer, no lap tracking, no results screen.
**Needs:** `RaceManager`, `RaceCheckpoint`, `RaceParticipant` equivalents, plus the actual
checkpoint meshes placed in the world.

### 3. Motorcycle chase (spec §18) — *severity: medium*
Step 3 of the story mission is a proximity check against a drone flying a fixed sine path.
There is no adaptive target speed, no dynamic checkpoints, no shortcuts, no obstacle
spawning, no fail threshold with recovery.
**Needs:** a reusable chase controller driven by a path plus a distance band.

### 4. AI state machine (spec §11) — *severity: medium*
Bots have a single float `alertLevel`, not the five named states the spec asks for
(Unaware / Curious / Investigating / Alert / Searching). There is no investigate
behaviour, no search behaviour, no sound-event perception, and no navmesh — patrols are
straight-line lerps between fixed points.
**Needs:** an explicit state machine, a sound-event bus, and simple navigation (a waypoint
graph is enough; a full navmesh is overkill here).

### 5. Save system (spec §21) — *severity: high*
Only **stats, settings and bike customisation** persist. Player position, current mission,
mission step, disguise, gadget unlocks, collectibles picked up and CHAOS state are all
**lost on reload**. There is no `SaveDataVersion` and no migration path — spec §21
explicitly requires both.
**Needs:** one versioned save object, one `SaveManager` with `migrate(v)`, and a
checkpoint/autosave hook.

### 6. Quality settings (spec §26) — *severity: medium*
One boolean `highQualityGraphics`. The spec wants LOW / MEDIUM / HIGH presets governing
shadows, resolution scale, traffic and pedestrian counts, LOD distances and particle
budgets, with auto-detection on first launch. Auto-detect matters a lot on Android.

### 7. Building interiors (spec §3) — *severity: medium*
The museum and station are solid boxes with gates. The spec's vertical slice calls for one
enterable interior and one stealth infiltration area inside it.

### 8. Debug menu (spec §33) — *severity: low*
Does not exist. Teleport, reset bike, refill gadgets, clear alert, unlock disguise, jump to
mission stage, FPS/memory readout — all of it would make every later task faster to test.

---

## ❌ Not started

| Spec | Gap |
| --- | --- |
| §27–§30 | **The entire Android path.** No Capacitor/wrapper, no `AndroidManifest`, no package id, no icons, no adaptive icon, no splash, no landscape lock, no signing config, no APK, no AAB. Nothing has ever run on a phone. |
| §6, §38.6 | **Gamepad support.** No Gamepad API polling at all. `EngineInputState` is ready for it; nothing feeds it. |
| §25 | **Mobile performance work.** No object pooling, no LOD groups, no instancing, no draw-distance culling, no frustum/occlusion strategy. Single 979 KB bundle, no code splitting. Never profiled on a phone. |
| §13 | **Data-driven restricted zones.** `AllowedDisguises[]` doesn't exist — disguise checks are hardcoded string comparisons inside the bot update. |
| §22 | **Service separation.** All managers live inside one `GameEngine` class rather than as separate services. |
| §35 | **Tests.** One smoke test now exists (`npm run smoke`). No unit tests on physics, missions or save migration. |

## 🐞 Known bugs

- **HUD overlap:** the agent rank / XP panel renders underneath the CHASE CAM and RESET
  buttons at the top-left, clipping "AGENT V-09". Visible immediately on load at 1280×720.
- **Deprecated Three.js APIs:** `THREE.Clock` (use `THREE.Timer`) and `PCFSoftShadowMap`
  both log deprecation warnings on boot.
- **AudioContext autoplay:** audio only starts after the first user gesture; on some
  Android browsers the first sounds are silently swallowed. Needs an explicit
  "tap to start" gate.

---

## Suggested build order

Ordered so that each phase makes the next one easier to verify.

**Phase A — foundations (do first, unblocks everything)**
1. Versioned `SaveManager` with full state capture + migration.
2. Debug menu (dev builds only).
3. Split `gameEngine.ts` into subsystems; extract tunables to a config module.
4. Fix the three known bugs.

**Phase B — get it on the phone (the milestone that actually matters)**
5. Capacitor wrapper, package id `com.velocitynine.agentv9`, landscape lock, icons, splash.
6. Gamepad API support.
7. Quality presets LOW/MED/HIGH with device auto-detect.
8. First real device test; profile and fix the worst frame-time offenders.
9. Signed debug APK on the target phone.

**Phase C — finish the stubbed systems**
10. `ChaosAlertManager` with all six levels and decay.
11. Race framework + the downtown checkpoint sprint made real.
12. Chase controller; rebuild story step 3 on top of it.
13. AI state machine with investigate/search and sound events.
14. Museum interior + stealth infiltration area.

**Phase D — polish and ship**
15. Object pooling, LOD, instancing, draw-distance culling.
16. Code splitting; get the initial chunk under 500 KB.
17. Unit tests on physics, mission advancement and save migration.
18. Signed AAB.

## Definition of done for the first Android build

Spec §38, restated as a checklist to tick off:

- [ ] Launches on a physical Android phone
- [ ] Walk around the city district
- [ ] Mount V9
- [ ] Bike feels fun to ride on a touchscreen
- [ ] Touch controls work
- [ ] Bluetooth controller works
- [ ] Enter one building interior
- [ ] Security camera detects the player
- [ ] One disguise works
- [ ] EMP disables electronics
- [ ] Recon drone works
- [ ] A real race works
- [ ] A real chase works
- [ ] The Midnight Prototype can be completed end to end
- [ ] At least two of Speed / Stealth / Smarts genuinely work
- [x] Progress saves and reloads <!-- A1: versioned SaveManager + migration -->
- [ ] Runs acceptably on a mid-range phone
- [ ] APK installs
- [x] Signed AAB can be produced <!-- D4: `npm run android:aab`; keystore is local, not committed -->
- [x] Tablet-class panels auto-pick LOW and never open an 8M-pixel buffer <!-- B4 2026-08-31 -->

