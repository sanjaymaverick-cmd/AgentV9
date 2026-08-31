import { QualityLevel } from '../types/game';

/**
 * Graphics quality presets (spec §26). LOW / MEDIUM / HIGH govern the levers that
 * actually move frame time on a phone: renderer pixel ratio, shadows + shadow map
 * resolution, draw distance / fog, and particle budgets.
 *
 * `trafficCount` / `pedestrianCount` are declared for completeness but the vertical
 * slice only spawns 4 of each — surplus agents are just hidden. TODO: honour these for
 * real once the city has more autonomous agents.
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
  },
  high: {
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    drawDistance: 800,
    fogDensity: 0.005,
    trafficCount: 4,
    pedestrianCount: 4,
    maxDriftParticles: 80,
    maxRefuelParticles: 40,
    chaosInterceptorCount: 3,
    chaosRoadblockCount: 3,
  },
};

/**
 * Recommend a preset on first launch from device signals. Deliberately conservative:
 * a wrong guess toward LOW is a smooth game, toward HIGH is a slideshow.
 */
export function autoDetectQuality(): QualityLevel {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const mem =
    typeof navigator !== 'undefined'
      ? (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4
      : 4;

  let score = 0;
  if (cores >= 8) score += 2;
  else if (cores >= 6) score += 1;
  if (mem >= 8) score += 2;
  else if (mem >= 4) score += 1;
  if (dpr <= 2) score += 1; // very high-DPI panels cost more to fill

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
