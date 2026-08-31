import { describe, expect, it } from 'vitest';
import { lerpAngle, wrapAngle } from './cameraRig';

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
