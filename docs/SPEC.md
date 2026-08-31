# Agent V9: Velocity City — Master Build Brief

> **Stack note (2026-08-31).** This brief was originally written for Unity 6 + C# + Android
> Studio. The project was instead built as a **TypeScript / Three.js / React web game**,
> packaged for Android via a WebView wrapper. That decision was deliberate: it produces a
> playable build on a phone in days rather than months, needs no Unity Editor work, and the
> game is already ~9,000 lines along that path and running.
>
> **Every gameplay, safety, UX and performance requirement below still stands.** Where the
> brief names a Unity class (`MotorcycleController.cs`, `ChaosAlertManager.cs`, a
> ScriptableObject), read it as "a module with that responsibility". The engine changed;
> the game did not.

---

## The premise

A child-safe open-world motorcycle + spy + stealth + gadget action-adventure for ages
roughly 8–12. Primary target age: **9**. It should feel exciting and sophisticated, not
babyish.

**The central rule: every major mission can be solved through SPEED, STEALTH, or SMARTS.**

## 1. Target platform

Android phones and tablets, ARM64, landscape, 4 GB RAM and up. Touchscreen and Bluetooth
controller support. 60 FPS on modern mid-range hardware with graceful fallback to 30.

## 2. Project structure

Production-quality, modular. No giant god-objects. Prefer interfaces, components,
configuration data and event-driven communication over hard-coded dependencies.

## 3. Initial vertical slice

Do **not** build the complete open world first. Build one polished playable slice:

one open city district · one controllable player · third-person movement · camera controls ·
sprinting · jumping · interaction system · one motorcycle · enter/exit · motorcycle physics
(acceleration, braking, steering, leaning, drifting, jumps) · speedometer · basic traffic ·
pedestrian NPCs · one building interior · one stealth infiltration area · guards or security
robots · security cameras · detection system · hiding · one disguise · one EMP gadget · one
recon drone · one motorcycle chase · one motorcycle race · one complete story mission with
working Speed, Stealth and Smarts solutions · checkpoint/save system · mission completion UI ·
pause/settings menu · Android touch controls · controller support.

## 4. Player controller

Walk, run, sprint, jump, rotate toward movement, smooth acceleration/deceleration, slope
handling, gravity, ground detection, interaction raycast, contextual interaction button.
Stable and mobile-friendly — avoid physics instability while walking.

State machine: Idle · Walking · Running · Jumping · Riding · Interacting · Hiding · UsingGadget.

## 5. Motorcycle system

The core mechanic. Throttle, braking, reverse, steering, leaning, traction, suspension,
wheel rotation and contact, configurable top speed, acceleration curve, braking strength,
speed-dependent steering sensitivity, airborne behaviour, crash detection, quick reset.

**Prioritise arcade realism over simulation.** The bike must feel responsive, fast,
forgiving, easy for a child to control, and satisfying to master. Expose the handling
values as configuration, not magic numbers.

## 6. Mobile controls

Left: virtual steering joystick. Right: throttle and brake/reverse. Optional buttons for
boost, drift, gadget, mount/dismount. Support button steering, joystick steering and
optional tilt steering; make it configurable. Support Bluetooth controllers.

## 7. Enter / exit vehicle

Clean, interface-driven ("IVehicle") so future vehicles don't require rewriting the player
controller. Prompt when near, animate the mount, hand off control and camera, validate a
safe exit position on dismount.

## 8. Camera system

Separate rigs: **player** (third-person orbit, obstacle handling, configurable sensitivity),
**motorcycle** (speed-sensitive FOV, smooth follow, acceleration lag, shake at speed),
**stealth** (closer framing, better indoor visibility), **mission** (short cinematic beats —
no long non-interactive cutscenes).

## 9. Open-world architecture

Build one district now, but architect for many: Downtown, Old City, Harbour, Technology
District, Mountain Roads, Beach, Industrial, Amusement Island, Residential, Underground.
Prepare for streamed/additive loading, distance-based activation, object pooling, LOD
groups and occlusion culling. Never load a gigantic world into memory at once.

## 10. Mission system

Data-driven. `MissionDefinition` · `MissionObjective` · `MissionStage` · `MissionReward`.

Objective types: GoToLocation · ReachCheckpoint · Investigate · ScanObject · FollowTarget ·
ChaseTarget · EscapeArea · EnterBuilding · AvoidDetection · DisableDevice · HackTerminal ·
CollectObject · Race · UseDisguise · ControlDrone.

Each mission unlocks a SPEED path, a STEALTH path and a SMARTS path.
**Completing any one valid path advances the mission. Never require all three.**

## 11. Stealth system

Simplified and child-friendly. NPC awareness states: **Unaware · Curious · Investigating ·
Alert · Searching**. Perception from vision cone, distance, line of sight, player
visibility and sound events. No realistic killing.

## 12. Security cameras

Rotating, with a configurable viewing cone, detection timer, suspicious state, alarm
trigger, EMP-disable and hackable state. Show camera coverage subtly. Don't punish
stealth excessively.

## 13. Disguise system

Delivery Worker · Mechanic · Scientist · Race Crew · Maintenance Worker. Each restricted
zone declares `AllowedDisguises[]`. AI checks the player's disguise rather than simply
attacking. High-security NPCs can spot incorrect behaviour.

## 14. Gadget framework

Extendable — an `IGadget` interface and a `GadgetBase`. Each gadget declares cooldown,
icon, usage range, charge, sound, VFX and target rules.

Initial: **EMP Tagger** (disables cameras, robots, electronic locks) and **Recon Drone**
(remote camera, scouting, target marking). Later: foam launcher, hologram projector,
magnet glove, smoke bubble, decoy bot, grappling gadget.

## 15. Drone system

A small controllable spy drone: launch, return, fly, hover, ascend, descend, scan, mark
targets, camera view. Simplified physics, limited range, automatic return at zero battery.

## 16. Child-safe action

**No realistic firearms. No blood, gore, executions, realistic human killing, torture,
drugs, sexual content or gambling.** Enemies are primarily robots, drones and automated
security. Human antagonists are distracted, avoided, tagged, trapped or escaped from.
Failing stealth must create gameplay, not disturbing scenes.

## 17. CHAOS Alert system

An escalation/chase system with six levels:

| Level | Response |
| --- | --- |
| 0 | Normal |
| 1 | Search drone |
| 2 | Security cameras enhanced |
| 3 | Interceptor drones |
| 4 | Roadblocks and trackers |
| 5 | Elite pursuit robot |

Alert rises through suspicious actions. It falls through hiding, escaping the pursuit
radius, changing disguise, entering safe areas, disabling a tracker, or taking underground
routes.

## 18. Motorcycle chase system

Reusable: target path, adaptive target speed, dynamic checkpoints, shortcuts, scripted
events, obstacle spawning, pursuit distance, failure threshold. Avoid unfair
rubber-banding; let players recover from small mistakes.

## 19. Racing system

Reusable framework for checkpoint races, time trials and stunt challenges. Track
checkpoint order, race time, lap time, wrong-checkpoint detection and the finish result.

## 20. NPC and traffic system

Lightweight and mobile-friendly. Vehicles follow path networks, stop at intersections,
avoid simple obstacles, and despawn outside player range. Pedestrians wander, react to the
motorcycle, and use pooled spawning. No expensive AI outside player proximity.

## 21. Save system

Local. Save player location, completed missions, current mission, unlocked gadgets, V9
upgrades, collectibles, settings and agent rank. Use a versioned serialisable structure
(`SaveDataVersion = 1`) with migrations prepared for future versions.
**Lightweight settings only may live in simple key/value storage — never the whole save.**

## 22. Manager architecture

Avoid one giant GameManager. Separate services: GameStateManager · MissionManager ·
SaveManager · AudioManager · SceneLoader · InputManager · UIManager · ChaosAlertManager.
Avoid excessive global singletons.

## 23. UI / UX

Design for phones and tablets. **On foot:** mission objective, gadget, interaction button,
movement controls. **Riding:** steering, throttle, brake, boost, speed, navigation
waypoint. Keep the screen clean. Allow HUD scale adjustment.

## 24. Accessibility for children

Steering assistance · auto-acceleration option · reduced difficulty · mission hints ·
waypoint guidance · optional narrated mission instructions · adjustable camera sensitivity.
**Avoid punishing failure. Checkpoint frequently.**

## 25. Android performance

Critical. Mobile-tier rendering, baked lighting where practical, GPU instancing, static
batching, LOD groups, occlusion culling, object pooling, compressed textures, texture
atlases, minimal overdraw, simplified shaders, optimised particles. Avoid hundreds of
independent per-frame update loops — centralise. Profile, and keep memory acceptable.

## 26. Quality settings

**LOW** — reduced shadows, lower resolution scale, less traffic and fewer pedestrians,
shorter LOD distances, fewer particles.
**MEDIUM** — balanced defaults.
**HIGH** — higher resolution, better shadows, greater draw distance, more traffic and
pedestrians.
Auto-detect a recommended preset on first launch.

## 27–30. Android build and Play preparation

ARM64, landscape left + right. Prefer the modern graphics path with a stable fallback.
Request **only** necessary permissions — no contacts, call history, SMS or precise
location. The prototype must function fully offline. Prepare for an Android App Bundle:
package name, version code, version name, application icon, adaptive icon, splash screen
and signing configuration. Placeholder application ID: `com.velocitynine.agentv9`, easy to
change before release.

## 31. Privacy-first child design

No unrestricted chat. No location collection. No behavioural advertising. No unnecessary
personal data. **The prototype collects no personal data and integrates no advertising SDKs.**

## 32. Audio

An AudioManager with categories: Music · SFX · Dialogue · Motorcycle · Environment.
Motorcycle audio responds to RPM, acceleration, speed and airborne state. Pool audio sources.

## 33. Development mode

A debug menu in development builds only, disabled automatically in release: teleport to
mission · reset motorcycle · refill gadgets · clear CHAOS alert · unlock disguise · mission
stage selector · FPS display · memory display · quality level switch.

## 34. First playable mission — THE MIDNIGHT PROTOTYPE

The player receives a mission from V9 Academy. Ride V9 from headquarters to the Technology
Museum. Investigate the loading dock. A suspicious drone escapes. Chase it on the
motorcycle. The drone leads to an abandoned monorail station. There, three valid options
open up:

**SPEED** — find a motorcycle-accessible service tunnel, race through it using jumps and
shortcuts, reach the prototype first.

**STEALTH** — dismount, find a maintenance disguise, avoid guards and cameras, enter
through maintenance access, retrieve the prototype.

**SMARTS** — launch the Recon Drone, locate the electrical system, EMP the cameras, hack
the maintenance doors, guide a utility robot into opening another entrance.

All three converge into the **FINAL CHASE**: CHAOS uses a giant cargo drone to escape with
the prototype. The player rides V9 beneath it and disables three relay modules. The cargo
drone lands safely. Mission complete.

## 35. Code quality rules

Every important class must have a clear purpose, avoid unnecessary dependencies, use
understandable serialised configuration, avoid magic numbers, and carry comments only where
the logic needs them.

**Do not generate fake placeholder code pretending functionality exists.** If a subsystem
cannot yet be implemented, mark it clearly with `TODO`. Do not silently stub major systems.

## 36. Delivery order

Project & platform config → input → third-person player → camera → motorcycle → enter/exit →
test city → NPC/navigation → mission framework → stealth → gadgets → drone → race/chase →
full Midnight Prototype → save system → touch UI → optimisation → device build testing.

## 37. Expected output from the coding agent

Don't merely explain how the game could be built — build it. For every development step
report: files created · files modified · complete code · configuration required · scene/world
changes · packages installed · how to test the feature · known limitations · next step.

When modifying existing code: **inspect the existing project first, don't overwrite working
systems unnecessarily, build incrementally, and keep the project compiling after every
major milestone.**

## 38. Definition of done for the first build

1. Launches on a physical Android device · 2. Player can walk around a small city area ·
3. Player can mount V9 · 4. The motorcycle feels fun to ride · 5. Touchscreen controls work ·
6. Controller works · 7. Player can enter one building · 8. A security camera can detect the
player · 9. One disguise works · 10. EMP disables electronics · 11. Recon drone works ·
12. A motorcycle race works · 13. A motorcycle chase works · 14. The Midnight Prototype can
be completed · 15. At least two different approaches actually work · 16. Progress saves and
loads · 17. Runs acceptably on a mid-range Android device · 18. APK installs · 19. A signed
AAB can be produced.

> **The objective is not maximum content.** The objective is proving that
> *motorcycle + open world + stealth + spy gadgets + multiple solutions*
> is genuinely fun on Android.
