# Roadmap — what's done, what's left

Last refreshed **2026-09-01** against `main` (HUD four-corner pass).
The 70% audit below that date is historical; **do not treat the stub list as current.**

## Verdict

The spec §3 vertical slice is **playable end to end in software**: city, bike, gadgets,
disguises, stealth, CHAOS 0–5, downtown race, story chase, museum + cargo interiors,
Capacitor Android wrapper, quality presets, signed AAB. What is still open is
**on-device proof** (tablet 30 FPS, APK sideload, story E2E on hardware) and
**GPU draw-call work** if LOW misses 30 FPS downtown.

---

## ✅ Done and working

| Spec | System | Notes |
| --- | --- | --- |
| §3, §9 | Open city district | Roads, junctions, colliders, landmarks, POIs |
| §3 | Interiors | Hollow museum (cameras, staff door, laser) + cargo station (gate, vent, rail slot, EMP breaker) |
| §4 | Third-person agent | Walk/run, gravity, crouch, camera-relative move |
| §5 | V9 motorcycle | Arcade physics, nitro, drift, ramps, **forgiving crash** (speed cut + gyro, no fail) |
| §6 | Touch controls | Joystick **and** D-pad |
| §6, §38.6 | Gamepad | Xbox map; touch HUD hides while a pad is connected |
| §7 | Enter/exit vehicle | Mount/dismount; **dismount searches left/right/behind so the agent does not spawn inside a wall** |
| §8 | Camera | Chase / action / FPV / tactical; look-around while still; **chase arm occludes against building AABBs** |
| §10 | Mission framework | Speed / Stealth / Smarts per step |
| §11 | Stealth + AI | Five-state GuardAI, sound bus, escort-out |
| §12 | Security cameras | Sweep + detect timer + alarm; EMP disable |
| §13 | Disguises | Five disguises, lockers, `allowedDisguises[]` on zones |
| §14 | Gadgets | EMP, foam (traps + solid blobs), hologram (10s), remote V9, recon drone |
| §15 | Recon drone | Fly, camera, **battery, ~55 m leash, auto-return, recharge on rack** |
| §16 | Child-safe action | Robots/drones only; capture = escort |
| §17 | CHAOS | Levels 0–5, search drone / interceptors / roadblocks / elite, decay routes |
| §18 | Chase | Reusable controller; story step 3 rides it |
| §19 | Racing | Downtown checkpoint sprint, timer, best time in save |
| §20 | Traffic & peds | Quality-scaled pool (LOW 2 / MED 4 / HIGH 8) |
| §21 | Save | Versioned `SaveManager` + migrate; full mission/pos/disguise/CHAOS |
| §23 | HUD | Four-corner overlay: identity, events, Menu+132px radar, lifted gadgets; overflow Menu; 44px targets |
| §24 | Accessibility | Steering assist, waypoints, walkthrough, forgiving failure |
| §26 | Quality | LOW / MED / HIGH + auto-detect; **tablets never auto HIGH**; drawing-buffer budget |
| §27–§30 | Android wrapper | Capacitor `com.velocitynine.agentv9`, landscape, no INTERNET, icons/splash |
| §31 | Privacy | Zero network, no ads, offline |
| §32 | Audio | Procedural Web Audio; tap-to-start unlock |
| §33 | Debug menu | DEV-only; backtick. Production FPS chip: Parental → Show FPS overlay |
| — | Extras | Bike customiser, fuel, XP/ranks, collectibles, stunt rings, parental timer, Jax drone-tagger |

---

## ⚠️ Still open (not stubs — unfinished proof or polish)

### B4 — on-device 30 FPS *(needs the physical tablet)*
Software landed: pixel-ratio cap, no MSAA on large panels, street SpotLights off on LOW,
hot-path Vector3/Box3 reuse, Parental FPS overlay, `window.__agentV9` probe.

Headless profile (discard FPS): **~1190 draw calls**, ~43k triangles downtown on LOW.
The game is **draw-call bound**. **Done when** the overlay holds min FPS ≥ 30 riding
downtown on the 1600×2560 tablet.

### D1 — instancing / merge static city *(spec §25)*
Road dashes, zebra stripes and yellow medians are **one draw each** (merged at boot).
Building boxes are single-material (was 6 draws). Bike wheels dropped 8 tread-torus
meshes. Remaining: tree/light InstancedMesh if tablet FPS is still under 30.

### D2 — code splitting
Initial `gameEngine` chunk ~729 KB (~196 KB gzip). Target < 500 KB raw.

### First Android install
Debug APK **builds**. Sideload + story E2E + Bluetooth pad on the tablet have not been
ticked from this repo's hardware.

---

## Historical audit (2026-08-31 morning) — superseded

The original stub list (CHAOS stuck at 0/2, race as text, no save, no Android, no interiors)
was true at that audit and is **no longer true**. Kept here so old handoff paste does not
get re-litigated: those items shipped the same day as C1–C5, B1–B3, D3 (partial), D4.

Suggested build order from that audit (A → B → C → D) completed through C and D3/D4.
Remaining order:

1. Sideload debug APK on the tablet; Parental → Show FPS overlay; ride downtown.
2. If min FPS < 30 → D1 merge/instance static city.
3. Play The Midnight Prototype Speed / Stealth / Smarts on device.
4. D2 split only if store size / parse time hurts.

## Definition of done for the first Android build

Spec §38:

- [ ] Launches on a physical Android device
- [ ] Walk around the city district
- [ ] Mount V9
- [ ] Bike feels fun to ride on a touchscreen
- [ ] Touch controls work
- [ ] Bluetooth controller works
- [x] Enter one building interior <!-- museum + cargo station, software -->
- [x] Security camera detects the player <!-- GuardAI cameras -->
- [x] One disguise works
- [x] EMP disables electronics
- [x] Recon drone works <!-- + battery/leash -->
- [x] A real race works <!-- downtown sprint -->
- [x] A real chase works <!-- chase controller -->
- [ ] The Midnight Prototype can be completed end to end *on device*
- [x] At least two of Speed / Stealth / Smarts genuinely work
- [x] Progress saves and reloads
- [ ] Runs acceptably on the target tablet (B4 overlay ≥ 30 FPS)
- [ ] APK installs
- [x] Signed AAB can be produced
- [x] Tablet-class panels auto-pick LOW and never open an 8M-pixel buffer
- [x] Chase camera does not clip through building volumes
- [x] Dismount never drops the agent inside a collider
