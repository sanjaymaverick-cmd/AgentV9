# Agent V9: Velocity City — project notes for Claude Code

A child-safe 3D open-world motorcycle-spy game for a nine-year-old.
TypeScript · React 19 · Three.js · Vite 6 · Tailwind 4 · Web Audio.

## Read first

- `docs/CLAUDE_CODE_PROMPT.md` — the working brief and ordered task list
- `docs/ROADMAP.md` — what works, what's a stub, build order
- `docs/ARCHITECTURE.md` — module boundaries and the rules that keep them
- `docs/SPEC.md` — the original design brief (source of truth for *what the game is*)

## Commands

```bash
npm run dev        # dev server on :3000
npm run typecheck  # must pass before any task is done
npm run smoke      # builds + boots in headless Chromium, fails on runtime errors
npm run build      # production build

npm run cap:sync   # build web + push into the committed android/ project
npm run cap:assets # regenerate launcher icons + splash from assets/*.svg
npm run android    # cap:sync, then open Android Studio (needs local Android SDK)
```

## Hard constraints

1. **Zero network calls.** No analytics, ads, accounts, remote assets or CDN fonts. Ever.
2. **Non-lethal.** Robots, drones and cameras only. Caught = escorted out, never harmed.
3. **Everything procedural.** No external model/texture/audio files — meshes come from
   `models.ts`, sounds are synthesised in `audio.ts`. Keeps the game one ~1 MB offline bundle.
4. **Forgiving.** Target age 9. Checkpoint often; never punish failure hard.
5. **No fake progress.** Mark unfinished work with an explicit `TODO`. Never ship a stub
   that looks complete — several already exist and they're the codebase's main problem.
6. **The stack is settled.** The spec names Unity classes; build modules with those
   responsibilities instead. Do not propose porting to Unity.

## Conventions

- UI never touches Three.js objects — it reads `GameState` and calls engine methods.
- All input goes through `EngineInputState`; use `EngineButtonInput` for boolean channels.
- New per-frame work becomes a private `updateX(dt)` called from `update()` — never its own
  `requestAnimationFrame` or `setInterval`.
- Named constants over magic numbers.
- Conventional commits: `feat(chase): adaptive pursuit speed`.
