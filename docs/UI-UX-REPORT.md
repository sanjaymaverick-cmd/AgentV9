# Agent V9 — UI/UX test report

Generated **2026-09-01T10:33:24.657Z** by `scripts/ui-ux-agent.mjs`.

Verdict: **playable, polish left** — 0 high, 2 medium, 4 low.

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
| `tap-to-start` | FAIL | still visible |
| `hud-menu-btn` | FAIL | page.evaluate: Target page, context or browser has been closed |

## Findings and suggestions

| Sev | Area | Issue | Suggestion |
| --- | --- | --- | --- |
| med | features/tablet-portrait | feature walk timeout | Clicks run on the WebGL thread; presence was still recorded from the layout pass. |
| med | features | Click #hud-menu-btn timed out | WebGL main thread blocked the click; retry on a real GPU. |
| low | source | src/components/DebugMenu.tsx still uses neon/pink/violet chrome | Restyle the modal to hud tokens. |
| low | source | src/components/ParentalModal.tsx still uses neon/pink/violet chrome | Restyle the modal to hud tokens. |
| low | source | src/components/WalkthroughModal.tsx still contains emoji | Replace with lucide icons or plain copy. |
| low | source | src/components/WalkthroughModal.tsx still uses neon/pink/violet chrome | Restyle the modal to hud tokens. |

## Suggested next polish (even if the agent is green)

1. Restyle Map / Missions / Garage / Guide / Settings onto `.hud-panel` tokens so they match the HUD (they still speak a louder cyan-border language).
2. Collapse radar zoom into a single cycle control — two 44px buttons under a 132px radar still add height.
3. Gadget row is six 44px buttons. On a 390px phone it is the remaining squeeze; a cycle-gadget chip next to Fire would free the gutter.
4. Walkthrough and in-world notifications still mix emoji and purple copy — strip those in a follow-up.
5. Confirm on the physical tablet: thumbs vs LOOK/BOOST with the new 17rem gadget lift.

Screenshots: `uiux-*.png` in the screenshots folder.
