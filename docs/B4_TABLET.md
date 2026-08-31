# B4 — Android tablet profile

Target device: **1600×2560 Android tablet, DPR 2**, game locked to landscape
(**2560×1600 CSS**). Profiled 2026-08-31. No physical tablet was attached to
the build machine, so GPU frame time still has to be confirmed on-device
(Parental → **Show FPS overlay**, ride downtown). Absolute FPS from the
headless SwiftShader run is discarded.

## What the numbers showed

| Signal | Tablet LOW (this is the auto-detect) |
| --- | --- |
| Auto-detect | **LOW** — even an 8-core / 8 GB tablet never auto-picks HIGH |
| Pixel ratio | `resolvePixelRatio` caps HIGH at ~1.10 and LOW at ~0.73 so the drawing buffer stays inside 2.2M / 5.0M pixels. Uncapped HIGH would have been **5120×3200**. |
| MSAA | **off** on any panel ≥ 2.5M CSS pixels |
| Street SpotLights | **off** on LOW (12 dynamic lights) |
| Draw calls | **~1190** downtown |
| Triangles | **~43k** (fine — the game is draw-call bound, not triangle-bound) |
| Meshes | **1554** (almost all visible from downtown) |
| Shadows / AA | off on LOW |

Draw calls are the remaining GPU risk if LOW still misses 30 FPS on the tablet.
Instancing / merging static city (D1 leftover) is the follow-up — not guessed
before the on-device overlay is read.

## How to read FPS on the tablet

1. Install the debug APK (`npm run cap:sync` then Android Studio / `gradlew assembleDebug`).
2. Open **Parental & Gameplay Settings** (shield) → **Show FPS overlay**.
3. Ride through downtown traffic for 30 seconds.
4. Need: **min FPS ≥ 30**. If it dips, drop to Low if you raised it, then we
   merge static city meshes.

The overlay also shows `pr`, drawing-buffer size, draw calls and triangle count.
