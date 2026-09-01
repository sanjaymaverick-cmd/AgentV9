# Agent V9 — HUD / overlay design

Child-safe spy motorcycle. Overlay chrome only (the 3D city is a separate system).
Cyan is the single accent. No emoji in chrome. Tap targets 44px. Safe-area padding.

## Four corners

| Corner | Owns | Must not |
| --- | --- | --- |
| Top-left | Identity (rank, speed, energy, nitro) + collapsible brief + radio | Eat the radar column |
| Top-center | GPS / live events only | Sit on identity or radar on phones — below identity under 700px |
| Top-right | One **Menu** stacked above a 132px radar | Five icon buttons in a column |
| Bottom | Gadgets (+ silent). Lifted 13rem when touch is on | Sit on the sticks |

## Overflow menu

Map, Missions, Garage, Guide, Settings, Cycle camera, Reset bike, Stick vs D-pad.

## Touch

- **Left:** move stick or D-pad
- **Right:** LOOK stacked *above* Horn / Drift / Mount, then Fire / Jump / Boost
- Camera, reset, and stick-vs-dpad live in Menu — not a second top bar
- Duplicate Mount / Talk / Refuel HUD prompts hide while touch is on

## Tokens

`--color-hud-*` in `src/index.css`. One accent (`#7dd3e8`). Warn / danger / ok only on meters and BOOST.

## Viewports we design for

- Phone 390×844 and 844×390
- Tablet portrait 800×1280 (1600×2560 @ 2×)
- Tablet landscape 1280×800
- Desktop 1440×900
