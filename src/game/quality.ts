import { QualityLevel } from '../types/game';

/**
 * Graphics quality presets (spec §26). LOW / MEDIUM / HIGH govern the levers that
 * actually move frame time on a phone: renderer pixel ratio, shadows + shadow map
 * resolution, draw distance / fog, particle budgets, and how many traffic cars /
 * sidewalk pedestrians stay visible. The world spawns HIGH's pool; applyQuality
 * hides the surplus.
 *
 * Pixel ratio is further clamped by `resolvePixelRatio` so a 1600×2560 tablet
 * at DPR 2 cannot open an 8-million-pixel drawing buffer on HIGH.
 */
export interface QualityPreset {
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: number;
  drawDistance: number; // camera.far, metres
  fogDensity: number; // THREE.FogExp2 density
  trafficCount: number;
  pedestrianCount: number;
  maxDriftParticles: number;
  maxRefuelParticles: number;
  /** CHAOS L3 interceptor drones kept visible (ChaosAlertManager trims the rest). */
  chaosInterceptorCount: number;
  /** CHAOS L4 roadblocks kept visible. */
  chaosRoadblockCount: number;
  /** Street SpotLights. Off on LOW — 12 dynamic lights wreck mid-range tablet GPUs. */
  streetLights: boolean;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: {
    pixelRatioCap: 1,
    shadows: false,
    shadowMapSize: 512,
    drawDistance: 320,
    fogDensity: 0.009,
    trafficCount: 2,
    pedestrianCount: 2,
    maxDriftParticles: 20,
    maxRefuelParticles: 12,
    chaosInterceptorCount: 1,
    chaosRoadblockCount: 2,
    streetLights: false,
  },
  medium: {
    pixelRatioCap: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    drawDistance: 500,
    fogDensity: 0.006,
    trafficCount: 4,
    pedestrianCount: 4,
    maxDriftParticles: 40,
    maxRefuelParticles: 25,
    chaosInterceptorCount: 2,
    chaosRoadblockCount: 3,
    streetLights: true,
  },
  high: {
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    drawDistance: 800,
    fogDensity: 0.005,
    trafficCount: 8,
    pedestrianCount: 8,
    maxDriftParticles: 80,
    maxRefuelParticles: 40,
    chaosInterceptorCount: 3,
    chaosRoadblockCount: 3,
    streetLights: true,
  },
};

/** Max drawing-buffer pixels (cssW × cssH × pixelRatio) per preset. */
export const PIXEL_BUDGET: Record<QualityLevel, number> = {
  low: 2.2e6,
  medium: 3.5e6,
  high: 5.0e6,
};

/** ~1920×1080 is 2.07e6; a 1600×2560 tablet in landscape is 4.1e6. */
export function isLargeDisplay(cssPixels: number): boolean {
  return cssPixels >= 2.5e6;
}

/**
 * Pixel ratio that respects the preset cap AND a drawing-buffer budget.
 * A 2560×1600 tablet on HIGH would otherwise fill 5120×3200 — a slideshow
 * on mid-range Mali / Adreno GPUs.
 */
export function resolvePixelRatio(
  level: QualityLevel,
  cssW: number,
  cssH: number,
  dpr: number,
): number {
  const cap = QUALITY_PRESETS[level].pixelRatioCap;
  const css = Math.max(1, cssW) * Math.max(1, cssH);
  const maxPr = Math.sqrt(PIXEL_BUDGET[level] / css);
  return Math.min(dpr || 1, cap, Math.max(0.7, maxPr));
}

/** MSAA is free on a 720p phone and ruinous on a 1600×2560 tablet. */
export function shouldAntialias(level: QualityLevel, cssPixels: number): boolean {
  return level === 'high' && !isLargeDisplay(cssPixels);
}

export interface QualitySignals {
  dpr?: number;
  cores?: number;
  mem?: number;
  cssPixels?: number;
}

/**
 * Recommend a preset on first launch from device signals. Deliberately conservative:
 * a wrong guess toward LOW is a smooth game, toward HIGH is a slideshow.
 * Tablet-class panels (1600×2560 and similar) never auto-pick HIGH.
 */
export function autoDetectQuality(signals: QualitySignals = {}): QualityLevel {
  const dpr =
    signals.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const cores =
    signals.cores ??
    (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4);
  const mem =
    signals.mem ??
    (typeof navigator !== 'undefined'
      ? (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4
      : 4);
  const cssPixels =
    signals.cssPixels ??
    (typeof window !== 'undefined'
      ? (window.innerWidth || 1280) * (window.innerHeight || 720)
      : 1280 * 720);

  let score = 0;
  if (cores >= 8) score += 2;
  else if (cores >= 6) score += 1;
  if (mem >= 8) score += 2;
  else if (mem >= 4) score += 1;
  if (dpr <= 1.5) score += 1;
  if (dpr >= 2.5) score -= 1;
  if (isLargeDisplay(cssPixels)) score -= 2;

  if (isLargeDisplay(cssPixels)) {
    return score >= 3 ? 'medium' : 'low';
  }
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

/**
 * SwiftShader / llvmpipe / similar software GL fail to compile Three's shadow
 * MeshDepthMaterial (VALIDATE_STATUS false) and then poison later programs with
 * error 1282. Skip shadow maps on those renderers.
 */
export function isSoftwareWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debug
    ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? '')
    : String(gl.getParameter(gl.RENDERER) ?? '');
  const s = renderer.toLowerCase();
  return s.includes('swiftshader') || s.includes('llvmpipe') || s.includes('software');
}
