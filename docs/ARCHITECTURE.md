# Architecture

## The one-sentence version

`App.tsx` owns persisted state and React UI; `GameEngine` owns the Three.js scene and the
game loop; they talk through one `GameState` snapshot pushed ~30 times a second.

## Layers

```
┌───────────────────────────────────────────────────────────────┐
│ React (src/components/)                                       │
│   HUD · MiniMap · TouchControls · modals                      │
│   Reads GameState. Writes only through engine public methods. │
└──────────────▲──────────────────────────────┬─────────────────┘
               │ onStateChange(GameState)     │ engine.input / engine.fireGadget() …
┌──────────────┴──────────────────────────────▼─────────────────┐
│ GameEngine (src/game/gameEngine.ts)                           │
│   requestAnimationFrame loop → update(dt) → subsystems        │
└──────────────┬────────────────────────────────────────────────┘
               │ builds once at startup
┌──────────────▼────────────────────────────────────────────────┐
│ world.ts  → WorldObjects (colliders, bots, cameras, POIs …)   │
│ models.ts → procedural THREE.Group factories                  │
│ audio.ts  → SoundEngine singleton (Web Audio synthesis)       │
│ missionEngine.ts → mission data                               │
└───────────────────────────────────────────────────────────────┘
```

## Key contracts

### `GameState` (`gameEngine.ts`)

A flat, serialisable snapshot of everything the UI needs: riding flags, speed, fuel,
nitro, stealth visibility and noise, CHAOS alert, active mission, player stats, radar
entities, GPS route, notifications. The engine mutates its own copy each frame and calls
`notifyState()` on a throttle (~33 ms) so React re-renders at a fixed cheap rate rather
than every frame.

**Rule:** the UI never reaches into Three.js objects. If the HUD needs something new, add
a field to `GameState`.

### `EngineInputState` (`gameEngine.ts`)

The single input surface. Keyboard handlers, `TouchControls`, and any future gamepad
support all write to the same struct; the physics code only ever reads it.

- Digital channels are `boolean` (button held).
- Analog channels (`analogSteer`, `analogThrottle`) are `-1..+1` floats.
- `EngineButtonInput` is the boolean-only key union — use it for anything button-driven,
  so you can't accidentally assign a boolean to an analog channel.

### `WorldObjects` (`world.ts`)

`buildVelocityCity(scene)` returns one struct holding every gameplay-relevant handle:
colliders, stunt ramps, terminals, disguise lockers, collectibles, security bots, security
cameras, stunt rings, fuel stations, traffic vehicles, NPCs, POIs, and the two mission
gates. The engine holds it and iterates it — there is no scene graph search at runtime.

### Missions (`missionEngine.ts`)

Missions are plain data objects, deliberately shaped like Unity ScriptableObjects: a
`Mission` has ordered `MissionStep`s, each with a `targetPosition` and an `approachHint`
carrying the **Speed / Stealth / Smarts** phrasing for that step. The engine's
`updateMissionLogic()` checks proximity and world flags to advance steps.

## The design rules to keep

1. **Everything is procedural.** No external models, textures or audio files. `models.ts`
   builds meshes from primitives; `audio.ts` synthesises every sound from oscillators.
   This is why the game is one ~1 MB offline bundle. Preserve it.
2. **No network calls, ever.** The audience is children. The game must stay fully offline
   with zero data collection.
3. **Non-lethal only.** Enemies are robots, drones and cameras. Failing stealth escorts
   the player out; it never kills anyone.
4. **One update loop.** New per-frame behaviour goes into a private `updateX(dt)` method
   called from `update()`, not into its own `requestAnimationFrame` or `setInterval`.
5. **Config over magic numbers.** Handling values, detection ranges and timers should be
   named constants near the top of their subsystem, headed toward a tunables module.

## Known structural debt

- `gameEngine.ts` is ~2,300 lines and does physics, AI, missions, GPS and camera work in
  one class. It should be split into subsystems that share the `GameState` and `WorldObjects`
  handles — see `ROADMAP.md`.
- Save data is three separate `localStorage` keys with no version field or migration path.
- The production bundle is a single ~979 KB chunk with no code splitting.
