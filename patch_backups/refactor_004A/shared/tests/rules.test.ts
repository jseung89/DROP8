import { describe, expect, it } from 'vitest';
import { createRoomCode, sanitizeText, WEAPONS } from '../src/index.js';

describe('shared rules', () => {
  it('creates a readable six-character room code', () => {
    expect(createRoomCode(() => 0)).toBe('AAAAAA');
  });

  it('removes angle brackets and control characters from chat', () => {
    expect(sanitizeText('<script> hi </script>\u0000', 20)).not.toMatch(/[<>\u0000]/);
  });

  it('contains fists and four firearms without a sniper rifle', () => {
    expect(Object.keys(WEAPONS)).toEqual(['fists', 'pistol', 'smg', 'rifle', 'shotgun']);
  });
});
