import { describe, expect, it } from 'vitest';
import { lerpAngle, shouldChaseFollow, wrapAngle } from './cameraRig';

describe('camera look heading', () => {
  it('does not wrap the long way when lerping across ±π', () => {
    const from = 3.0;
    const to = -3.0;
    const stepped = lerpAngle(from, to, 0.25);
    expect(Math.abs(wrapAngle(stepped - from))).toBeLessThan(1);
  });

  it('leaves heading unchanged when the recenter blend is 0 (standing still)', () => {
    const look = 1.2;
    expect(lerpAngle(look, 0, 0)).toBe(1.2);
  });
});

describe('shouldChaseFollow', () => {
  const moving = { bikeSpeed: 12, minSpeed: 4, lookHold: 0, looking: false };

  it('never follows on foot', () => {
    expect(shouldChaseFollow({ ...moving, riding: false })).toBe(false);
  });

  it('does not follow while look is held', () => {
    expect(shouldChaseFollow({ ...moving, riding: true, looking: true })).toBe(false);
  });

  it('does not follow during the look-hold window', () => {
    expect(shouldChaseFollow({ ...moving, riding: true, lookHold: 0.4 })).toBe(false);
  });

  it('follows a moving bike after look is released', () => {
    expect(shouldChaseFollow({ ...moving, riding: true })).toBe(true);
  });

  it('does not follow a parked bike', () => {
    expect(shouldChaseFollow({ ...moving, riding: true, bikeSpeed: 0 })).toBe(false);
  });
});
