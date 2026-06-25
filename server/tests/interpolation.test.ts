import { describe, expect, it } from 'vitest';
import { pushPositionSnapshot, samplePosition, zoneDirection } from '../../client/src/interpolation.js';

describe('Refactor 005 interpolation helpers', () => {
  it('keeps hidden player snapshots flowing and samples the current interpolated location', () => {
    const buffer: Array<{ x:number; y:number; angle:number; receivedAt:number }> = [];
    pushPositionSnapshot(buffer, { x: 10, y: 20, angle: 0, receivedAt: 100 });
    pushPositionSnapshot(buffer, { x: 110, y: 20, angle: Math.PI / 2, receivedAt: 200 });
    const sampled = samplePosition(buffer, 150)!;
    expect(sampled.x).toBeCloseTo(60);
    expect(sampled.y).toBeCloseTo(20);
    expect(sampled.angle).toBeCloseTo(Math.PI / 4);
  });

  it('caps interpolation history and labels zone movement directions', () => {
    const buffer: Array<{ x:number; y:number; angle:number; receivedAt:number }> = [];
    for (let i = 0; i < 20; i += 1) pushPositionSnapshot(buffer, { x: i, y: 0, angle: 0, receivedAt: i }, 8);
    expect(buffer).toHaveLength(8);
    expect(zoneDirection(100, -100)).toBe('북동');
  });
});
