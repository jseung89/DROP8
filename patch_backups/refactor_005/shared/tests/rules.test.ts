import { describe, expect, it } from 'vitest';
import { BUSHES, BUILDINGS, DECORATIONS, OBSTACLES, REGION_THEMES, REGIONS, createRoomCode, distance, sanitizeText, WEAPONS, circleHitsRect } from '../src/index.js';

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

import { REGION_LOOT_TABLES, createSeededRandom, weightedLootChoice } from '../src/index.js';

describe('regional loot tables', () => {
  const sample = (region: keyof typeof REGION_LOOT_TABLES, seed: number, count = 1200) => {
    const random = createSeededRandom(seed);
    const result = new Map<string, number>();
    for (let index = 0; index < count; index += 1) {
      const kind = weightedLootChoice(REGION_LOOT_TABLES[region], random);
      result.set(kind, (result.get(kind) ?? 0) + 1);
    }
    return result;
  };

  it('makes hospital recovery items more common than firearms', () => {
    const counts = sample('hospital', 11);
    const heals = (counts.get('bandage') ?? 0) + (counts.get('medkit') ?? 0);
    const guns = ['pistol', 'smg', 'rifle', 'shotgun'].reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
    expect(heals).toBeGreaterThan(guns);
  });

  it('gives military and warehouse their intended specialties', () => {
    const military = sample('military', 22);
    const warehouse = sample('warehouse', 33);
    expect((military.get('rifle') ?? 0) + (military.get('vest') ?? 0)).toBeGreaterThan(military.get('pistol') ?? 0);
    expect((warehouse.get('shotgun') ?? 0) + (warehouse.get('shells') ?? 0)).toBeGreaterThan(warehouse.get('rifle') ?? 0);
  });

  it('makes forest camp favor healing and melee tools', () => {
    const counts = sample('forestCamp', 44);
    const forestTools = ['bandage', 'knife', 'bat'].reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
    expect(forestTools).toBeGreaterThan(counts.get('rifle') ?? 0);
  });
});


describe('Refactor 004B world identity', () => {
  it('defines a distinct visual theme and decorations for every named region', () => {
    expect(Object.keys(REGION_THEMES).sort()).toEqual(REGIONS.map((region) => region.id).sort());
    for (const region of REGIONS) {
      expect(REGION_THEMES[region.id].trait.length).toBeGreaterThan(8);
      expect(DECORATIONS.some((decoration) => decoration.regionId === region.id)).toBe(true);
    }
    expect(DECORATIONS.some((decoration) => decoration.regionId === 'hospital' && decoration.kind === 'medicalCross')).toBe(true);
    expect(DECORATIONS.some((decoration) => decoration.regionId === 'forestCamp' && decoration.kind === 'tent')).toBe(true);
    expect(DECORATIONS.some((decoration) => decoration.regionId === 'military' && decoration.kind === 'sandbag')).toBe(true);
  });

  it('places most bushes in forest camp without blocking walls or building doors', () => {
    const forest = BUSHES.filter((bush) => bush.regionId === 'forestCamp');
    expect(BUSHES.length).toBeGreaterThanOrEqual(40);
    expect(forest.length).toBeGreaterThan(BUSHES.length / 2);
    for (const bush of BUSHES) {
      expect(OBSTACLES.some((rect) => circleHitsRect(bush.x, bush.y, bush.radius + 8, rect))).toBe(false);
      for (const building of BUILDINGS) {
        const door = building.doorSide === 'north' || building.doorSide === 'south'
          ? { x: building.x + building.w * building.doorOffset, y: building.doorSide === 'north' ? building.y : building.y + building.h }
          : { x: building.doorSide === 'west' ? building.x : building.x + building.w, y: building.y + building.h * building.doorOffset };
        expect(distance(bush.x, bush.y, door.x, door.y)).toBeGreaterThan(bush.radius + 75);
      }
    }
  });
});


describe('Refactor 004C collision clearance', () => {
  it('keeps every building doorway comfortably wider than a player diameter', () => {
    for (const building of BUILDINGS) expect(building.doorWidth).toBeGreaterThanOrEqual(92);
  });
});
