import { describe, expect, it } from 'vitest';
import { AMMO_DISPLAY_NAMES, BUSHES, BUILDINGS, DECORATIONS, LARGE_INTERIOR_WALLS, MAP_CONFIGS, MOTORCYCLE_MAX_SPEED, OBSTACLES, PROJECTILE_CONFIGS, REGION_THEMES, REGIONS, createRoomCode, distance, motorcycleCollisionDamage, motorcycleSpreadRadians, normalizeAmmoType, normalizeMovementInput, sanitizeText, segmentCircleIntersectionT, WEAPONS, circleHitsRect } from '../src/index.js';

describe('shared rules', () => {
  it('creates a readable six-character room code', () => {
    expect(createRoomCode(() => 0)).toBe('AAAAAA');
  });

  it('removes angle brackets and control characters from chat', () => {
    expect(sanitizeText('<script> hi </script>\u0000', 20)).not.toMatch(/[<>\u0000]/);
  });

  it('contains fists and five firearms including a sniper rifle', () => {
    expect(Object.keys(WEAPONS)).toEqual(['fists', 'pistol', 'smg', 'rifle', 'shotgun', 'sniper']);
  });


  it('normalizes diagonal motorcycle movement without changing a cardinal direction', () => {
    expect(normalizeMovementInput(0,-1)).toEqual({x:0,y:-1});
    const diagonal=normalizeMovementInput(1,-1);
    expect(Math.hypot(diagonal.x,diagonal.y)).toBeCloseTo(1,6);
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2,6);
    expect(diagonal.y).toBeCloseTo(-Math.SQRT1_2,6);
  });
  it('uses exactly three pickup ammo types and maps sniper to standard ammo', () => {
    expect(Object.keys(AMMO_DISPLAY_NAMES).sort()).toEqual(['pistol_ammo','shotgun_ammo','standard_ammo']);
    expect(WEAPONS.pistol.ammoType).toBe('pistol_ammo');
    expect(WEAPONS.shotgun.ammoType).toBe('shotgun_ammo');
    expect(WEAPONS.smg.ammoType).toBe('standard_ammo');
    expect(WEAPONS.rifle.ammoType).toBe('standard_ammo');
    expect(WEAPONS.sniper.ammoType).toBe('standard_ammo');
    expect(normalizeAmmoType('sniper_ammo')).toBe('standard_ammo');
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
    expect((warehouse.get('shotgun') ?? 0) + (warehouse.get('shotgun_ammo') ?? 0)).toBeGreaterThan(warehouse.get('rifle') ?? 0);
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

import { COLLISION_OBSTACLES, PROP_OBSTACLES, WORLD_PROPS, WORLD_SIZE, createNextZone, createPlaneRoute } from '../src/index.js';

describe('Refactor 005 world and route rules', () => {
  it('turns visible field props into collision geometry while leaving decorative markers passable', () => {
    expect(PROP_OBSTACLES.length).toBeGreaterThan(15);
    expect(COLLISION_OBSTACLES.length).toBeGreaterThan(OBSTACLES.length);
    expect(WORLD_PROPS.find((prop) => prop.kind === 'fence')?.collision).toBe('thin');
    expect(WORLD_PROPS.find((prop) => prop.kind === 'crate')?.collision).toBe('solid');
    expect(WORLD_PROPS.find((prop) => prop.kind === 'helipad')?.collision).toBe('none');
  });

  it('creates long randomized plane routes that cross the map', () => {
    const first = createPlaneRoute(createSeededRandom(101));
    const second = createPlaneRoute(createSeededRandom(202));
    expect(Math.hypot(first.endX - first.startX, first.endY - first.startY)).toBeGreaterThan(WORLD_SIZE);
    expect([first.startX, first.startY, first.endX, first.endY].some((value) => value < 0 || value > WORLD_SIZE)).toBe(true);
    expect(`${first.startX.toFixed(1)},${first.startY.toFixed(1)},${first.endX.toFixed(1)},${first.endY.toFixed(1)}`)
      .not.toBe(`${second.startX.toFixed(1)},${second.startY.toFixed(1)},${second.endX.toFixed(1)},${second.endY.toFixed(1)}`);
  });

  it('keeps every randomized next zone fully inside the current zone', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const current = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, radius: 1800 };
      const next = createNextZone(createSeededRandom(seed), current.x, current.y, current.radius, 1100, 3);
      expect(distance(current.x, current.y, next.x, next.y) + next.radius).toBeLessThanOrEqual(current.radius - 27.9);
      expect(next.x - next.radius).toBeGreaterThanOrEqual(0);
      expect(next.y - next.radius).toBeGreaterThanOrEqual(0);
      expect(next.x + next.radius).toBeLessThanOrEqual(WORLD_SIZE);
      expect(next.y + next.radius).toBeLessThanOrEqual(WORLD_SIZE);
    }
  });
});

import { BUILDING_VISIBILITY_ZONES, buildingIdAt, buildingSpacesVisible } from '../src/index.js';

describe('Refactor 005B building visibility rules', () => {
  it('assigns stable building ids to interior coordinates', () => {
    expect(BUILDING_VISIBILITY_ZONES).toHaveLength(BUILDINGS.length);
    const zone = BUILDING_VISIBILITY_ZONES[0]!;
    expect(buildingIdAt(zone.interior.x + zone.interior.w / 2, zone.interior.y + zone.interior.h / 2)).toBe(zone.id);
    expect(buildingIdAt(100, 100)).toBe('');
  });

  it('shows the same space and only connects indoor/outdoor players near the same door', () => {
    const zone = BUILDING_VISIBILITY_ZONES[0]!;
    const door = zone.doors[0]!;
    const center = { x: door.x + door.width / 2, y: door.y + door.height / 2 };
    expect(buildingSpacesVisible({ ...center, buildingId: zone.id }, { x: center.x + 20, y: center.y + 20, buildingId: '' })).toBe(true);
    expect(buildingSpacesVisible({ x: zone.interior.x + 30, y: zone.interior.y + 30, buildingId: zone.id }, { x: center.x + 300, y: center.y + 300, buildingId: '' })).toBe(false);
    expect(buildingSpacesVisible({ ...center, buildingId: zone.id }, { ...center, buildingId: BUILDING_VISIBILITY_ZONES[1]!.id })).toBe(false);
  });
});


describe('Refactor 006 map and projectile rules', () => {
  it('defines distinct small and large map configs', () => {
    expect(MAP_CONFIGS.small.width).toBeLessThan(MAP_CONFIGS.large.width);
    expect(MAP_CONFIGS.small.buildings.length).toBeLessThan(MAP_CONFIGS.large.buildings.length);
    expect(MAP_CONFIGS.large.initialZoneRadius).toBeGreaterThan(MAP_CONFIGS.small.initialZoneRadius);
    expect(LARGE_INTERIOR_WALLS.length).toBeGreaterThanOrEqual(8);
  });

  it('gives the sniper a much faster but non-penetrating projectile', () => {
    expect(PROJECTILE_CONFIGS.sniper.projectileSpeed).toBeGreaterThan(PROJECTILE_CONFIGS.rifle.projectileSpeed * 1.8);
    expect(PROJECTILE_CONFIGS.sniper.ammoType).toBe('standard_ammo');
    expect(PROJECTILE_CONFIGS.sniper.canPenetratePlayers).toBe(false);
    expect(PROJECTILE_CONFIGS.sniper.canPenetrateProps).toBe(false);
  });

  it('finds the first intersection of a fast bullet segment and a circular hitbox', () => {
    const t=segmentCircleIntersectionT(0,0,1000,0,500,0,24);
    expect(t).not.toBeNull();
    expect(t!).toBeCloseTo(.476,2);
    expect(segmentCircleIntersectionT(0,100,1000,100,500,0,24)).toBeNull();
  });
});


describe('Refactor 007 motorcycle and scope rules', () => {
  it('adds motorcycles to both map sizes', () => {
    expect(MAP_CONFIGS.small.motorcycleSpawns.length).toBeGreaterThanOrEqual(2);
    expect(MAP_CONFIGS.large.motorcycleSpawns.length).toBeGreaterThan(MAP_CONFIGS.small.motorcycleSpawns.length);
  });

  it('increases weapon spread with motorcycle speed and turning', () => {
    const stopped=motorcycleSpreadRadians('rifle',WEAPONS.rifle.spread,0,0);
    const moving=motorcycleSpreadRadians('rifle',WEAPONS.rifle.spread,1,1);
    const sniper=motorcycleSpreadRadians('sniper',WEAPONS.sniper.spread,1,1);
    expect(stopped).toBeCloseTo(WEAPONS.rifle.spread,6);
    expect(moving).toBeGreaterThan(stopped*3);
    expect(sniper).toBeGreaterThan(.12);
  });

  it('applies no low-speed impact damage and caps high-speed damage below instant kill', () => {
    expect(motorcycleCollisionDamage(MOTORCYCLE_MAX_SPEED*.2)).toBe(0);
    expect(motorcycleCollisionDamage(MOTORCYCLE_MAX_SPEED)).toBeGreaterThanOrEqual(55);
    expect(motorcycleCollisionDamage(MOTORCYCLE_MAX_SPEED)).toBeLessThan(100);
    expect(motorcycleCollisionDamage(MOTORCYCLE_MAX_SPEED,MOTORCYCLE_MAX_SPEED,true)).toBeLessThan(motorcycleCollisionDamage(MOTORCYCLE_MAX_SPEED));
  });
});
