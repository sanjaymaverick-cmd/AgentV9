import { describe, expect, it } from 'vitest';
import {
  QUALITY_PRESETS,
  autoDetectQuality,
  isLargeDisplay,
  resolvePixelRatio,
  shouldAntialias,
} from './quality';

describe('QUALITY_PRESETS agent budgets', () => {
  it('steps traffic and pedestrians up from LOW to MEDIUM to HIGH', () => {
    expect(QUALITY_PRESETS.low.trafficCount).toBeLessThan(QUALITY_PRESETS.medium.trafficCount);
    expect(QUALITY_PRESETS.medium.trafficCount).toBeLessThan(QUALITY_PRESETS.high.trafficCount);
    expect(QUALITY_PRESETS.low.pedestrianCount).toBeLessThan(QUALITY_PRESETS.medium.pedestrianCount);
    expect(QUALITY_PRESETS.medium.pedestrianCount).toBeLessThan(QUALITY_PRESETS.high.pedestrianCount);
  });

  it('keeps HIGH as the spawn ceiling the world builds toward', () => {
    expect(QUALITY_PRESETS.high.trafficCount).toBe(8);
    expect(QUALITY_PRESETS.high.pedestrianCount).toBe(8);
    expect(QUALITY_PRESETS.medium.trafficCount).toBe(4);
    expect(QUALITY_PRESETS.low.trafficCount).toBe(2);
  });
});

describe('tablet display budget (1600×2560 @ 2× DPR)', () => {
  const tabletCss = 2560 * 1600; // landscape lock

  it('treats a 1600×2560 panel as a large display', () => {
    expect(isLargeDisplay(tabletCss)).toBe(true);
    expect(isLargeDisplay(1920 * 1080)).toBe(false);
  });

  it('never auto-picks HIGH on a tablet, even with 8 cores / 8 GB', () => {
    expect(
      autoDetectQuality({ dpr: 2, cores: 8, mem: 8, cssPixels: tabletCss }),
    ).not.toBe('high');
  });

  it('picks LOW on a mid-range tablet', () => {
    expect(
      autoDetectQuality({ dpr: 2, cores: 4, mem: 4, cssPixels: tabletCss }),
    ).toBe('low');
  });

  it('caps HIGH pixel ratio so the drawing buffer stays under 5M pixels', () => {
    const pr = resolvePixelRatio('high', 2560, 1600, 2);
    expect(2560 * pr * 1600 * pr).toBeLessThanOrEqual(5.0e6 + 1);
    expect(pr).toBeLessThan(2);
  });

  it('caps LOW pixel ratio under 2.2M pixels on the tablet', () => {
    const pr = resolvePixelRatio('low', 2560, 1600, 2);
    expect(2560 * pr * 1600 * pr).toBeLessThanOrEqual(2.2e6 + 1);
  });

  it('disables MSAA on tablet-class panels', () => {
    expect(shouldAntialias('high', tabletCss)).toBe(false);
    expect(shouldAntialias('high', 1280 * 720)).toBe(true);
    expect(shouldAntialias('low', 1280 * 720)).toBe(false);
  });

  it('still allows HIGH on a 720p phone with beefy hardware', () => {
    expect(
      autoDetectQuality({ dpr: 2, cores: 8, mem: 8, cssPixels: 1280 * 720 }),
    ).toBe('high');
  });
});
