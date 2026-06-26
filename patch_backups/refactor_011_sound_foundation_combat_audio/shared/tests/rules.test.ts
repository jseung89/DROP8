import { describe, expect, it } from 'vitest';
import { AMMO_DISPLAY_NAMES, BUSHES, BUILDINGS, DECORATIONS, LARGE_INTERIOR_WALLS, MAP_CONFIGS, MOTORCYCLE_BALANCE, MOTORCYCLE_LAUNCH_SPEED, MOTORCYCLE_MAX_SPEED, OBSTACLES, PLAYER_SPEED, PROJECTILE_CONFIGS, REGION_THEMES, REGIONS, createRoomCode, distance, motorcycleCollisionDamage, motorcycleDirectionRetention, motorcycleSpeedMultiplier, motorcycleSpreadMultiplier, motorcycleSpreadRadians, normalizeAimVector, normalizeAmmoType, normalizeMovementInput, pointInDirectionalScope, sanitizeText, segmentCircleIntersectionT, WEAPONS, circleHitsRect } from '../src/index.js';

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
    const indoor={x:zone.interior.x+zone.interior.w/2,y:zone.interior.y+zone.interior.h/2,buildingId:zone.id};
    const outsideCandidates=[
      {x:zone.roof.x-400,y:zone.roof.y-400,buildingId:''},
      {x:zone.roof.x+zone.roof.w+400,y:zone.roof.y-400,buildingId:''},
      {x:zone.roof.x-400,y:zone.roof.y+zone.roof.h+400,buildingId:''},
      {x:zone.roof.x+zone.roof.w+400,y:zone.roof.y+zone.roof.h+400,buildingId:''},
    ];
    expect(outsideCandidates.some((candidate)=>!buildingSpacesVisible(indoor,candidate))).toBe(true);
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
    expect(sniper).toBeGreaterThan(.08);
  });

  it('applies no low-speed impact damage and caps high-speed damage below instant kill', () => {
    expect(motorcycleCollisionDamage(MOTORCYCLE_MAX_SPEED*.2)).toBe(0);
    expect(motorcycleCollisionDamage(MOTORCYCLE_MAX_SPEED)).toBe(MOTORCYCLE_BALANCE.maxCollisionDamage);
    expect(motorcycleCollisionDamage(MOTORCYCLE_MAX_SPEED)).toBeLessThan(100);
    expect(motorcycleCollisionDamage(MOTORCYCLE_MAX_SPEED,MOTORCYCLE_MAX_SPEED,true)).toBeLessThan(motorcycleCollisionDamage(MOTORCYCLE_MAX_SPEED));
  });
});


describe('Refactor 008 combat and vehicle balance rules', () => {
  it('normalizes finite aim vectors and rejects unusable input', () => {
    expect(normalizeAimVector(3,4)).toEqual({x:.6,y:.8});
    expect(normalizeAimVector(0,0)).toBeNull();
    expect(normalizeAimVector(Number.NaN,1)).toBeNull();
    expect(normalizeAimVector(Number.POSITIVE_INFINITY,1)).toBeNull();
  });

  it('uses a human-speed launch and reaches 1.85x speed after 2.4 seconds', () => {
    expect(MOTORCYCLE_LAUNCH_SPEED).toBe(Math.round(PLAYER_SPEED*1.05));
    expect(MOTORCYCLE_MAX_SPEED).toBe(Math.round(PLAYER_SPEED*1.85));
    expect(motorcycleSpeedMultiplier(0)).toBeCloseTo(1.05,6);
    expect(motorcycleSpeedMultiplier(350)).toBeCloseTo(1.15,6);
    expect(motorcycleSpeedMultiplier(1300)).toBeCloseTo(1.5,6);
    expect(motorcycleSpeedMultiplier(2400)).toBeCloseTo(1.85,6);
    expect(motorcycleSpeedMultiplier(9999)).toBeCloseTo(1.85,6);
  });

  it('loses progressively more speed during sharp direction changes', () => {
    expect(motorcycleDirectionRetention(0)).toBe(1);
    expect(motorcycleDirectionRetention(Math.PI/6)).toBeGreaterThan(.85);
    expect(motorcycleDirectionRetention(Math.PI/2)).toBeLessThan(.8);
    expect(motorcycleDirectionRetention(Math.PI)).toBeLessThanOrEqual(.55);
  });

  it('accepts only targets in the forward sniper corridor and range', () => {
    expect(pointInDirectionalScope(0,0,1,0,500,0,900)).toBe(true);
    expect(pointInDirectionalScope(0,0,1,0,-100,0,900)).toBe(false);
    expect(pointInDirectionalScope(0,0,1,0,500,400,900)).toBe(false);
    expect(pointInDirectionalScope(0,0,1,0,1000,0,900)).toBe(false);
  });

  it('steps vehicle shooting spread from stable to heavily inaccurate', () => {
    expect(motorcycleSpreadMultiplier(0)).toBe(1);
    expect(motorcycleSpreadMultiplier(.4)).toBeCloseTo(1.35,6);
    expect(motorcycleSpreadMultiplier(.6)).toBeCloseTo(1.8,6);
    expect(motorcycleSpreadMultiplier(.8)).toBeCloseTo(2.5,6);
    expect(motorcycleSpreadMultiplier(1)).toBeCloseTo(3.3,6);
  });
});

import { BULLET_OBSTACLES, VISIBILITY_OBSTACLES, WINDOW_INTERACTION_DISTANCE, buildingSpacesInteractable, createBuildingVisibilityZones, findWindowVaultCandidate, projectileWallsForBuilding, segmentRectIntersectionT, windowVaultPoints } from '../src/index.js';

describe('Refactor 009 window transit rules', () => {
  it('creates deterministic windows for every building without overlapping its door center', () => {
    const rebuilt=createBuildingVisibilityZones(BUILDINGS,'small');
    expect(rebuilt.map((zone)=>zone.windows)).toEqual(BUILDING_VISIBILITY_ZONES.map((zone)=>zone.windows));
    for(const [index,zone] of BUILDING_VISIBILITY_ZONES.entries()){
      const building=BUILDINGS[index]!;
      expect(zone.windows.length).toBeGreaterThanOrEqual(1);
      const door=zone.doors[0]!;
      const doorCenter={x:door.x+door.width/2,y:door.y+door.height/2};
      for(const window of zone.windows){
        const center={x:window.x+window.width/2,y:window.y+window.height/2};
        expect(distance(center.x,center.y,doorCenter.x,doorCenter.y)).toBeGreaterThan(45);
        expect(window.buildingId).toBe(zone.id);
        expect(window.width===36||window.height===36).toBe(true);
      }
      expect(building.w*building.h>=90000?zone.windows.length<=3:zone.windows.length<=2).toBe(true);
    }
  });

  it('keeps window openings solid for movement but open for bullets and visibility', () => {
    const zone=BUILDING_VISIBILITY_ZONES[0]!;
    const building=BUILDINGS[zone.buildingIndex]!;
    const window=zone.windows[0]!;
    const points=windowVaultPoints(window);
    const movementBlocked=COLLISION_OBSTACLES.some((rect)=>segmentRectIntersectionT(points.outside.x,points.outside.y,points.inside.x,points.inside.y,rect)!==null);
    const bulletBlocked=BULLET_OBSTACLES.some((rect)=>segmentRectIntersectionT(points.outside.x,points.outside.y,points.inside.x,points.inside.y,rect)!==null);
    const visionBlocked=VISIBILITY_OBSTACLES.some((rect)=>segmentRectIntersectionT(points.outside.x,points.outside.y,points.inside.x,points.inside.y,rect)!==null);
    expect(movementBlocked).toBe(true);
    expect(bulletBlocked).toBe(false);
    expect(visionBlocked).toBe(false);
    expect(projectileWallsForBuilding(building,zone.windows).length).toBeGreaterThan(4);
  });

  it('allows sight through a window but never cross-window item interaction', () => {
    const zone=BUILDING_VISIBILITY_ZONES[0]!;
    const window=zone.windows[0]!;
    const points=windowVaultPoints(window);
    const inside={...points.inside,buildingId:zone.id};
    const outside={...points.outside,buildingId:''};
    expect(buildingSpacesVisible(inside,outside)).toBe(true);
    expect(buildingSpacesInteractable(inside,outside)).toBe(false);
    const candidate=findWindowVaultCandidate(outside.x,outside.y,'',BUILDING_VISIBILITY_ZONES,WINDOW_INTERACTION_DISTANCE);
    expect(candidate?.window.id).toBe(window.id);
    expect(candidate?.targetBuildingId).toBe(zone.id);
  });
});


import { ANGLE_AWARE_PORTAL_BALANCE, DOOR_PROXIMITY_BALANCE, MOTORCYCLE_DESTRUCTION_BALANCE, PORTAL_SELECTION_BALANCE, WINDOW_PORTAL_SCOPE_DEPTH, WINDOW_PORTAL_VIEW_DEPTH, WINDOW_PROXIMITY_BALANCE, angleAwarePortalTarget, crossSpaceOpening, doorPortalOpening, explosionExposureMultiplier, motorcycleExplosionDamage, motorcyclePlayerCollisionDamage, motorcycleProjectileDamage, motorcycleWallCollisionDamage, portalAngularVisibility, portalOpeningGeometry, portalPolygon, portalTarget, portalViewGeometry, radialExplosionDamage, segmentClearOfRects, selectActivePortal, selectActiveWindow, targetVisibilitySamples, visibilitySampleResult, windowOpeningCenter, windowPortalPolygon, windowPortalTarget } from '../src/index.js';

describe('Refactor 010 window combat and vehicle destruction rules', () => {
  it('limits window sight to a local expanding portal instead of an endless strip', () => {
    const zone=BUILDING_VISIBILITY_ZONES.find((item)=>item.windows.length>0)!;
    const window=zone.windows[0]!;
    const points=windowVaultPoints(window);
    const dx=points.inside.x-points.outside.x,dy=points.inside.y-points.outside.y,length=Math.hypot(dx,dy)||1;
    const nx=dx/length,ny=dy/length;
    const viewer={...points.inside,buildingId:zone.id};
    const nearOutside={x:points.outside.x-nx*100,y:points.outside.y-ny*100,buildingId:''};
    const farOutside={x:points.outside.x-nx*(WINDOW_PORTAL_VIEW_DEPTH+70),y:points.outside.y-ny*(WINDOW_PORTAL_VIEW_DEPTH+70),buildingId:''};
    expect(crossSpaceOpening(viewer,nearOutside,false,BUILDING_VISIBILITY_ZONES)?.kind).toBe('window');
    expect(crossSpaceOpening(viewer,farOutside,false,BUILDING_VISIBILITY_ZONES)).toBeNull();
    expect(crossSpaceOpening(viewer,farOutside,true,BUILDING_VISIBILITY_ZONES)?.kind).toBe('window');
    expect(segmentClearOfRects(viewer.x,viewer.y,nearOutside.x,nearOutside.y,VISIBILITY_OBSTACLES)).toBe(true);
  });

  it('builds a widening trapezoid and rejects targets outside its lateral edge', () => {
    const zone=BUILDING_VISIBILITY_ZONES.find((item)=>item.windows.length>0)!;
    const window=zone.windows[0]!;
    const polygon=windowPortalPolygon(window,'inside',false);
    expect(polygon).toHaveLength(4);
    const nearWidth=distance(polygon[0]!.x,polygon[0]!.y,polygon[1]!.x,polygon[1]!.y);
    const farWidth=distance(polygon[2]!.x,polygon[2]!.y,polygon[3]!.x,polygon[3]!.y);
    expect(farWidth).toBeGreaterThan(nearWidth);
    const centerX=window.x+window.width/2,centerY=window.y+window.height/2;
    const inside=windowPortalTarget(window,centerX,centerY,zone.id,false);
    expect(inside.maxDepth).toBe(WINDOW_PROXIMITY_BALANCE.outsideToInsideNormalDepth);
    const scoped=windowPortalTarget(window,centerX,centerY,zone.id,true);
    expect(scoped.maxDepth).toBe(WINDOW_PROXIMITY_BALANCE.outsideToInsideScopeDepth);
    const outside=windowPortalTarget(window,centerX,centerY,'',false);
    expect(outside.maxDepth).toBe(WINDOW_PORTAL_VIEW_DEPTH);
    const outsideScoped=windowPortalTarget(window,centerX,centerY,'',true);
    expect(outsideScoped.maxDepth).toBe(WINDOW_PORTAL_SCOPE_DEPTH);
    const offAxis=window.side==='north'||window.side==='south'
      ? windowPortalTarget(window,centerX+500,centerY+80,zone.id,false)
      : windowPortalTarget(window,centerX+80,centerY+500,zone.id,false);
    expect(offAxis.visible).toBe(false);
  });

  it('activates only an aimed nearby window and drops it outside the proximity limit', () => {
    const zone=BUILDING_VISIBILITY_ZONES.find((item)=>item.windows.length>0)!;
    const window=zone.windows[0]!;
    const points=windowVaultPoints(window);
    const center=windowOpeningCenter(window);
    const aimInside={x:center.x-points.inside.x,y:center.y-points.inside.y};
    const selectedInside=selectActiveWindow({...points.inside,buildingId:zone.id},aimInside.x,aimInside.y,'',false,BUILDING_VISIBILITY_ZONES);
    expect(selectedInside?.windowId).toBe(window.id);
    const awayLength=Math.hypot(points.inside.x-center.x,points.inside.y-center.y)||1;
    const farInside={
      x:center.x+(points.inside.x-center.x)/awayLength*(WINDOW_PROXIMITY_BALANCE.insideNormalActivationDistance+20),
      y:center.y+(points.inside.y-center.y)/awayLength*(WINDOW_PROXIMITY_BALANCE.insideNormalActivationDistance+20),
      buildingId:zone.id,
    };
    expect(selectActiveWindow(farInside,center.x-farInside.x,center.y-farInside.y,'',false,BUILDING_VISIBILITY_ZONES)).toBeNull();
    const aimOutside={x:center.x-points.outside.x,y:center.y-points.outside.y};
    expect(selectActiveWindow({...points.outside,buildingId:''},aimOutside.x,aimOutside.y,'',false,BUILDING_VISIBILITY_ZONES)?.windowId).toBe(window.id);
  });

  it('selects one nearby aimed door or window as a unified portal', () => {
    const zone=BUILDING_VISIBILITY_ZONES[0]!;
    const door=doorPortalOpening(zone,zone.doors[0]!);
    const center=windowOpeningCenter(door);
    const outward=door.side==='north'?{x:0,y:-1}:door.side==='south'?{x:0,y:1}:door.side==='west'?{x:-1,y:0}:{x:1,y:0};
    const inside={x:center.x-outward.x*70,y:center.y-outward.y*70,buildingId:zone.id};
    const outside={x:center.x+outward.x*70,y:center.y+outward.y*70,buildingId:''};
    const selectedInside=selectActivePortal(inside,center.x-inside.x,center.y-inside.y,'',false,BUILDING_VISIBILITY_ZONES);
    expect(selectedInside).toMatchObject({openingId:door.id,kind:'door',buildingId:zone.id});
    const selectedOutside=selectActivePortal(outside,center.x-outside.x,center.y-outside.y,'',false,BUILDING_VISIBILITY_ZONES);
    expect(selectedOutside).toMatchObject({openingId:door.id,kind:'door'});
    expect(PORTAL_SELECTION_BALANCE.maxActivePortals).toBe(1);
  });

  it('requires door proximity and limits door sight to a local portal volume', () => {
    const zone=BUILDING_VISIBILITY_ZONES[0]!;
    const door=doorPortalOpening(zone,zone.doors[0]!);
    const center=windowOpeningCenter(door);
    const outward=door.side==='north'?{x:0,y:-1}:door.side==='south'?{x:0,y:1}:door.side==='west'?{x:-1,y:0}:{x:1,y:0};
    const nearInside={x:center.x-outward.x*80,y:center.y-outward.y*80,buildingId:zone.id};
    const farInside={x:center.x-outward.x*(DOOR_PROXIMITY_BALANCE.insideNormalActivationDistance+25),y:center.y-outward.y*(DOOR_PROXIMITY_BALANCE.insideNormalActivationDistance+25),buildingId:zone.id};
    expect(selectActivePortal(nearInside,center.x-nearInside.x,center.y-nearInside.y,'',false,BUILDING_VISIBILITY_ZONES)?.openingId).toBe(door.id);
    expect(selectActivePortal(farInside,center.x-farInside.x,center.y-farInside.y,'',false,BUILDING_VISIBILITY_ZONES)).toBeNull();
    const polygon=portalPolygon(door,'door','outside',false);
    expect(polygon).toHaveLength(4);
    const nearWidth=distance(polygon[0]!.x,polygon[0]!.y,polygon[1]!.x,polygon[1]!.y);
    const farWidth=distance(polygon[2]!.x,polygon[2]!.y,polygon[3]!.x,polygon[3]!.y);
    expect(farWidth).toBeGreaterThan(nearWidth);
    const nearTarget={x:center.x+outward.x*120,y:center.y+outward.y*120,buildingId:''};
    const farTarget={x:center.x+outward.x*(DOOR_PROXIMITY_BALANCE.insideToOutsideNormalDepth+30),y:center.y+outward.y*(DOOR_PROXIMITY_BALANCE.insideToOutsideNormalDepth+30),buildingId:''};
    expect(portalTarget(door,'door',nearTarget.x,nearTarget.y,'',false).visible).toBe(true);
    expect(portalTarget(door,'door',farTarget.x,farTarget.y,'',false).visible).toBe(false);
    expect(crossSpaceOpening(nearInside,nearTarget,false,BUILDING_VISIBILITY_ZONES,door.id)?.kind).toBe('door');
    expect(crossSpaceOpening(nearInside,farTarget,false,BUILDING_VISIBILITY_ZONES,door.id)).toBeNull();
  });

  it('blocks every cross-space portal when no nearby portal is selected', () => {
    const zone=BUILDING_VISIBILITY_ZONES[0]!;
    const door=doorPortalOpening(zone,zone.doors[0]!);
    const center=windowOpeningCenter(door);
    const outward=door.side==='north'?{x:0,y:-1}:door.side==='south'?{x:0,y:1}:door.side==='west'?{x:-1,y:0}:{x:1,y:0};
    const inside={x:center.x-outward.x*70,y:center.y-outward.y*70,buildingId:zone.id};
    const outside={x:center.x+outward.x*70,y:center.y+outward.y*70,buildingId:''};
    expect(crossSpaceOpening(inside,outside,false,BUILDING_VISIBILITY_ZONES,'')).toBeNull();
  });

  it('samples the target center and both sides for partial window exposure', () => {
    const samples=targetVisibilitySamples(0,0,100,0,20);
    expect(samples).toHaveLength(3);
    expect(samples[0]).toMatchObject({x:100,y:0,kind:'center'});
    expect(samples[1]!.y).not.toBe(samples[2]!.y);
    const centerBlock={x:40,y:-4,w:20,h:8};
    const result=visibilitySampleResult(0,0,100,0,[centerBlock],20);
    expect(result.centerVisible).toBe(false);
    expect(result.characterVisible).toBe(true);
    expect(result.visibleCount).toBe(2);
    expect(result.nameplateVisible).toBe(true);
  });

  it('applies weapon-specific motorcycle projectile damage and shotgun cap inputs', () => {
    expect(motorcycleProjectileDamage('pistol',20)).toBe(18);
    expect(motorcycleProjectileDamage('smg',20)).toBe(13);
    expect(motorcycleProjectileDamage('rifle',20)).toBe(16);
    expect(motorcycleProjectileDamage('shotgun',20)).toBe(9);
    expect(motorcycleProjectileDamage('sniper',20)).toBe(25);
    expect(MOTORCYCLE_DESTRUCTION_BALANCE.shotgunShotDamageCap).toBe(30);
  });

  it('damages motorcycles only on meaningful wall or player impacts', () => {
    expect(motorcycleWallCollisionDamage(MOTORCYCLE_MAX_SPEED*.3)).toBe(0);
    expect(motorcycleWallCollisionDamage(MOTORCYCLE_MAX_SPEED)).toBe(36);
    expect(motorcycleWallCollisionDamage(MOTORCYCLE_MAX_SPEED,MOTORCYCLE_MAX_SPEED,false)).toBeLessThan(20);
    expect(motorcyclePlayerCollisionDamage(MOTORCYCLE_MAX_SPEED*.3)).toBe(0);
    expect(motorcyclePlayerCollisionDamage(MOTORCYCLE_MAX_SPEED)).toBe(14);
  });

  it('makes the motorcycle blast near-lethal at the center and falls off by distance', () => {
    const balance=MOTORCYCLE_DESTRUCTION_BALANCE;
    expect(motorcycleExplosionDamage(0)).toBe(90);
    expect(motorcycleExplosionDamage(50)).toBe(85);
    expect(motorcycleExplosionDamage(90)).toBe(68);
    expect(motorcycleExplosionDamage(125)).toBe(38);
    expect(motorcycleExplosionDamage(balance.explosionRadius)).toBe(12);
    expect(motorcycleExplosionDamage(balance.explosionRadius+1)).toBe(0);
    expect(radialExplosionDamage(0,balance.explosionRadius,balance.maxExplosionDamage,balance.minExplosionDamage)).toBe(balance.maxExplosionDamage);
  });

  it('blocks explosions with solid walls and reduces pressure through windows', () => {
    const direct=explosionExposureMultiplier({x:0,y:0,buildingId:''},{x:30,y:0,buildingId:''},[],BUILDING_VISIBILITY_ZONES,10);
    expect(direct).toBe(1);
    const blocked=explosionExposureMultiplier({x:0,y:0,buildingId:''},{x:100,y:0,buildingId:''},[{x:40,y:-100,w:20,h:200}],BUILDING_VISIBILITY_ZONES,10);
    expect(blocked).toBe(0);
    const zone=BUILDING_VISIBILITY_ZONES.find((item)=>item.windows.length>0)!;
    const points=windowVaultPoints(zone.windows[0]!);
    const throughWindow=explosionExposureMultiplier({...points.outside,buildingId:''},{...points.inside,buildingId:zone.id},VISIBILITY_OBSTACLES,BUILDING_VISIBILITY_ZONES,10);
    expect(throughWindow).toBe(MOTORCYCLE_DESTRUCTION_BALANCE.windowExplosionMultiplier);
  });
});

describe('Refactor 010D angle-aware portal visibility rules', () => {
  function doorFixture(){
    const zone=BUILDING_VISIBILITY_ZONES[0]!;
    const door=doorPortalOpening(zone,zone.doors[0]!);
    const geometry=portalOpeningGeometry(door,'outside');
    const observerAt=(lateral:number,behind=80)=>({
      x:geometry.center.x-geometry.normal.x*behind+geometry.tangent.x*lateral,
      y:geometry.center.y-geometry.normal.y*behind+geometry.tangent.y*lateral,
      buildingId:zone.id,
    });
    return{zone,door,geometry,observerAt};
  }

  it('changes the portal frustum continuously from left through center to right', () => {
    const {door,geometry,observerAt}=doorFixture();
    const farShift=(lateral:number)=>{
      const observer=observerAt(lateral);
      const aim={x:geometry.center.x-observer.x,y:geometry.center.y-observer.y};
      const view=portalViewGeometry(door,'door',observer,'outside',false,aim.x,aim.y,true);
      const farMid={x:(view.polygon[2]!.x+view.polygon[3]!.x)/2,y:(view.polygon[2]!.y+view.polygon[3]!.y)/2};
      return{view,shift:(farMid.x-geometry.center.x)*geometry.tangent.x+(farMid.y-geometry.center.y)*geometry.tangent.y};
    };
    const left=farShift(-40),center=farShift(0),right=farShift(40);
    expect(left.view.normalizedLateralOffset).toBeLessThan(0);
    expect(right.view.normalizedLateralOffset).toBeGreaterThan(0);
    expect(Math.abs(center.shift)).toBeLessThan(1);
    expect(left.shift*right.shift).toBeLessThan(0);
    expect(Math.abs(left.shift)).toBeCloseTo(Math.abs(right.shift),5);
    const smallLeft=farShift(-10).shift,smallRight=farShift(10).shift;
    expect(smallLeft).toBeGreaterThan(center.shift);
    expect(smallRight).toBeLessThan(center.shift);
  });

  it('smoothly attenuates front, side, peripheral, and out-of-view aim', () => {
    const front=portalAngularVisibility(0),edgeFront=portalAngularVisibility(20),side=portalAngularVisibility(30),sideEdge=portalAngularVisibility(40),peripheral=portalAngularVisibility(50),outside=portalAngularVisibility(61);
    expect(front).toMatchObject({viewMode:'front',depthFactor:1,revealStrength:1});
    expect(edgeFront.depthFactor).toBe(1);
    expect(side.viewMode).toBe('side');
    expect(side.depthFactor).toBeLessThan(front.depthFactor);
    expect(side.depthFactor).toBeGreaterThan(sideEdge.depthFactor);
    expect(peripheral.viewMode).toBe('peripheral');
    expect(peripheral.depthFactor).toBeLessThan(sideEdge.depthFactor);
    expect(outside).toMatchObject({viewMode:'none',depthFactor:0,revealStrength:0});
  });

  it('caps the near-door and near-window render angles', () => {
    const {door,geometry}=doorFixture();
    const doorObserver={x:geometry.center.x-geometry.normal.x*5,y:geometry.center.y-geometry.normal.y*5};
    const doorAim={x:geometry.center.x-doorObserver.x,y:geometry.center.y-doorObserver.y};
    const doorView=portalViewGeometry(door,'door',doorObserver,'outside',false,doorAim.x,doorAim.y,true);
    expect(doorView.totalViewAngleDeg).toBeLessThanOrEqual(ANGLE_AWARE_PORTAL_BALANCE.doorMaximumViewAngleDeg+.0001);
    expect(Math.hypot(doorView.renderObserver.x-geometry.center.x,doorView.renderObserver.y-geometry.center.y)).toBeGreaterThanOrEqual(ANGLE_AWARE_PORTAL_BALANCE.doorMinimumRenderDistance-.001);

    const zone=BUILDING_VISIBILITY_ZONES.find((item)=>item.windows.length>0)!;
    const window=zone.windows[0]!;
    const points=windowVaultPoints(window);
    const windowGeometry=portalOpeningGeometry(window,'outside');
    const windowObserver={x:windowGeometry.center.x-windowGeometry.normal.x*5,y:windowGeometry.center.y-windowGeometry.normal.y*5};
    const windowAim={x:windowGeometry.center.x-windowObserver.x,y:windowGeometry.center.y-windowObserver.y};
    const windowView=portalViewGeometry(window,'window',windowObserver,'outside',false,windowAim.x,windowAim.y,true);
    expect(windowView.totalViewAngleDeg).toBeLessThanOrEqual(ANGLE_AWARE_PORTAL_BALANCE.windowMaximumViewAngleDeg+.0001);
    expect(points.inside).toBeDefined();
  });

  it('uses aim attenuation for actual cross-space visibility without changing bullet geometry', () => {
    const {zone,door,geometry,observerAt}=doorFixture();
    const observer=observerAt(0);
    const target={x:geometry.center.x+geometry.normal.x*55,y:geometry.center.y+geometry.normal.y*55,buildingId:''};
    const rotate=(degrees:number)=>{
      const base=Math.atan2(geometry.center.y-observer.y,geometry.center.x-observer.x)+degrees*Math.PI/180;
      return{x:Math.cos(base),y:Math.sin(base)};
    };
    const frontAim=rotate(0),sideAim=rotate(30),peripheralAim=rotate(50),outsideAim=rotate(61);
    expect(crossSpaceOpening(observer,target,false,BUILDING_VISIBILITY_ZONES,door.id,frontAim)?.viewMode).toBe('front');
    expect(crossSpaceOpening(observer,target,false,BUILDING_VISIBILITY_ZONES,door.id,sideAim)?.viewMode).toBe('side');
    expect(crossSpaceOpening(observer,target,false,BUILDING_VISIBILITY_ZONES,door.id,peripheralAim)?.viewMode).toBe('peripheral');
    expect(crossSpaceOpening(observer,target,false,BUILDING_VISIBILITY_ZONES,door.id,outsideAim)).toBeNull();
    expect(angleAwarePortalTarget(door,'door',observer,target.x,target.y,'',false,frontAim.x,frontAim.y).visible).toBe(true);
    expect(portalTarget(door,'door',target.x,target.y,'',false).visible).toBe(true);
    expect(zone.id).toBe(observer.buildingId);
  });

  it('retains the current portal for peripheral fade but lets a newly aimed portal win', () => {
    const {door,geometry,observerAt}=doorFixture();
    const observer=observerAt(0);
    const base=Math.atan2(geometry.center.y-observer.y,geometry.center.x-observer.x);
    const peripheral={x:Math.cos(base+50*Math.PI/180),y:Math.sin(base+50*Math.PI/180)};
    const retained=selectActivePortal(observer,peripheral.x,peripheral.y,door.id,false,BUILDING_VISIBILITY_ZONES);
    expect(retained?.openingId).toBe(door.id);
    expect(retained!.angleDifferenceDeg).toBeGreaterThan(PORTAL_SELECTION_BALANCE.retainedSelectionAngleDeg);
    expect(retained!.angleDifferenceDeg).toBeLessThan(PORTAL_SELECTION_BALANCE.peripheralReleaseAngleDeg);
  });
});

