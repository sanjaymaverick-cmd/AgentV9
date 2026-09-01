# Agent V9 — UI/UX test report

Generated **2026-09-01T10:55:15.877Z** by `scripts/ui-ux-agent.mjs`.

Verdict: **playable, polish left** — 0 high, 1 medium, 1 low.

## What the new layout is doing

- Four corners: identity (speed + meters) top-left, events under the brief, menu+radar top-right, gadgets lifted off the sticks.
- Overflow Menu holds Map / Missions / Garage / Guide / Settings / camera / reset / stick-vs-dpad.
- Touch: move stick left; LOOK stacked above Horn-Drift-Mount and Fire-Jump-Boost on the right.
- Start screen is quiet (no emoji, no tablet-debug copy). FPS chip sits top-center, off the stick.

## Layout by viewport

| Viewport | CSS | Overlaps | Small targets | Stick | Look | Menu |
| --- | --- | ---: | ---: | --- | --- | --- |
| phone-portrait | 390×844 | 0 | 0 | yes | yes | yes |
| tablet-portrait | 800×1280 | 0 | 0 | yes | yes | yes |

## Feature walk

| Control | Result | Note |
| --- | --- | --- |
| `hud-menu-btn` | ok | phone-portrait present |
| `silent-mode-toggle-btn` | ok | phone-portrait present |
| `gadget-btn-emp` | ok | phone-portrait present |
| `gadget-btn-foam` | ok | phone-portrait present |
| `gadget-btn-drone` | ok | phone-portrait present |
| `gadget-btn-hologram` | ok | phone-portrait present |
| `gadget-btn-remote_v9` | ok | phone-portrait present |
| `virtual-joystick-base` | ok | phone-portrait present |
| `look-joystick-base` | ok | phone-portrait present |
| `touch-horn-btn` | ok | phone-portrait present |
| `touch-drift-btn` | ok | phone-portrait present |
| `touch-interact-btn` | ok | phone-portrait present |
| `touch-gadget-btn` | ok | phone-portrait present |
| `touch-jump-btn` | ok | phone-portrait present |
| `touch-boost-btn` | ok | phone-portrait present |
| `radar-heading-btn` | ok | phone-portrait present |
| `radar-zoom-in-btn` | ok | phone-portrait present |
| `radar-zoom-out-btn` | ok | phone-portrait present |

## Findings and suggestions

| Sev | Area | Issue | Suggestion |
| --- | --- | --- | --- |
| med | features/tablet-portrait | feature walk timeout | Clicks run on the WebGL thread; presence was still recorded from the layout pass. |
| low | source | src/components/DebugMenu.tsx still uses neon/pink/violet chrome | Restyle the modal to hud tokens. |

## Suggested next polish (even if the agent is green)

1. DEV-only debug menu still speaks the old neon language — restyle if it stays in screenshots.
2. Confirm on the physical tablet: thumbs vs LOOK / gadget-cycle / BOOST.
3. Radar HDG + range overlays sit on the disc; if they cover blips, shrink the labels.

Screenshots: `uiux-*.png` in the screenshots folder.
