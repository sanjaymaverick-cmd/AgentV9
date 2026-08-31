import { describe, expect, it } from 'vitest';
import { QUALITY_PRESETS } from './quality';

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
