// DROP8_REFACTOR_013G_DOCK8_RECOVERY
import { describe, expect, it } from 'vitest';
import {
  MAP_CONFIGS,
  SWIM_SPEED,
  findPortalVaultCandidate,
  getMapConfig,
  isDeepWaterAt,
  normalizeMapId,
  spaceAt,
  traceSpaceVisibility,
} from '../src/index.js';

describe('Refactor 013 map and spatial foundation', () => {
  it('keeps the legacy maps and adds the 7168 square Dock 8 map', () => {
    expect(getMapConfig('small').width).toBe(4096);
    expect(getMapConfig('large').width).toBe(6144);
    expect(getMapConfig('dock8').width).toBe(7168);
    expect(getMapConfig('dock8').height).toBe(7168);
    expect(normalizeMapId('small')).toBe('small');
    expect(normalizeMapId('large')).toBe('large');
    expect(normalizeMapId('dock8')).toBe('dock8');
    expect(normalizeMapId('unknown')).toBe('small');
  });

  it('defines three bridges, two fords, 22 shore exits and the expanded Dock 8 mobility pool', () => {
    const map=MAP_CONFIGS.dock8;
    expect(map.landCrossings.filter((crossing)=>crossing.kind!=='ford')).toHaveLength(3);
    expect(map.landCrossings.filter((crossing)=>crossing.kind==='ford')).toHaveLength(2);
    expect(map.shoreExits).toHaveLength(22);
    expect(map.motorcycleSpawns).toHaveLength(12);
    expect(map.motorcycleBudget).toBe(8);
    expect(map.lootSpawns.length).toBeGreaterThanOrEqual(380);
    expect(map.lootSpawns.length).toBeLessThanOrEqual(380);
    expect(map.lootBudget).toBe(280);
    expect(SWIM_SPEED).toBe(165);
  });

  it('keeps rooms inside their owning buildings and portal room references valid', () => {
    for(const map of Object.values(MAP_CONFIGS)){
      const roomIndices=new Set(map.rooms.map((room)=>room.index));
      for(const room of map.rooms){
        const building=map.buildingVisibilityZones.find((zone)=>zone.id===room.buildingId);
        expect(building).toBeDefined();
        expect(room.rect.x).toBeGreaterThanOrEqual(building!.interior.x);
        expect(room.rect.y).toBeGreaterThanOrEqual(building!.interior.y);
        expect(room.rect.x+room.rect.w).toBeLessThanOrEqual(building!.interior.x+building!.interior.w);
        expect(room.rect.y+room.rect.h).toBeLessThanOrEqual(building!.interior.y+building!.interior.h);
      }
      for(const portal of map.portals){
        expect(portal.sideARoomIndex===0||roomIndices.has(portal.sideARoomIndex)).toBe(true);
        expect(portal.sideBRoomIndex===0||roomIndices.has(portal.sideBRoomIndex)).toBe(true);
      }
    }
  });

  it('assigns every explicit loot anchor to its real building and room and avoids deep water', () => {
    for(const map of Object.values(MAP_CONFIGS)){
      for(const loot of map.lootSpawns){
        expect(isDeepWaterAt(loot.x,loot.y,map.rivers,map.landCrossings)).toBe(false);
        const space=spaceAt(loot.x,loot.y,map.buildingVisibilityZones,map.rooms);
        if(loot.buildingId)expect(space.buildingId).toBe(loot.buildingId);
        if(loot.roomIndex)expect(space.roomIndex).toBe(loot.roomIndex);
      }
    }
  });

  it('adds guaranteed central-building anchors to both legacy maps', () => {
    const small=MAP_CONFIGS.small.lootSpawns.filter((spawn)=>spawn.id?.startsWith('small-central-'));
    const large=MAP_CONFIGS.large.lootSpawns.filter((spawn)=>spawn.id?.startsWith('large-central-'));
    expect(small).toHaveLength(9);
    expect(large).toHaveLength(16);
    expect(small.every((spawn)=>Boolean(spawn.buildingId)&&Number(spawn.roomIndex)>0)).toBe(true);
    expect(large.every((spawn)=>Boolean(spawn.buildingId)&&Number(spawn.roomIndex)>0)).toBe(true);
  });


  it('keeps more than half of active Dock 8 loot indoors and rewards every enterable building', () => {
    const map=MAP_CONFIGS.dock8;
    const active=map.lootSpawns.slice(0,map.lootBudget);
    const indoor=active.filter((spawn)=>Boolean(spawn.buildingId));
    expect(indoor.length/active.length).toBeGreaterThanOrEqual(.52);
    for(const building of map.buildingVisibilityZones){
      const count=indoor.filter((spawn)=>spawn.buildingId===building.id).length;
      expect(count,building.id).toBeGreaterThanOrEqual(2);
    }
    expect(indoor.filter((spawn)=>spawn.buildingId==='dock8-building-9')).toHaveLength(51);
  });

  it('spreads Dock 8 motorcycle candidates across both river banks and central approaches', () => {
    const spawns=MAP_CONFIGS.dock8.motorcycleSpawns;
    expect(spawns.filter((spawn)=>spawn.id.includes('-west-'))).toHaveLength(6);
    expect(spawns.filter((spawn)=>spawn.id.includes('-east-'))).toHaveLength(6);
    expect(spawns.filter((spawn)=>spawn.id.includes('-central-')).length).toBeGreaterThanOrEqual(2);
    for(let left=0;left<spawns.length;left++)for(let right=left+1;right<spawns.length;right++){
      expect(Math.hypot(spawns[left]!.x-spawns[right]!.x,spawns[left]!.y-spawns[right]!.y)).toBeGreaterThan(350);
    }
  });
  it('traces visibility and vault traversal through an internal Dock 8 window', () => {
    const map=MAP_CONFIGS.dock8;
    const portal=map.portals.find((candidate)=>candidate.id==='dock8-logistics-main-window');
    expect(portal).toBeDefined();
    const viewer={...portal!.approachA,roomIndex:portal!.sideARoomIndex};
    const target={...portal!.approachB,roomIndex:portal!.sideBRoomIndex};
    const trace=traceSpaceVisibility(viewer,target,map.portals,map.visibilityObstacles);
    expect(trace.visible).toBe(true);
    expect(trace.crossedPortalIds).toContain(portal!.id);
    const vault=findPortalVaultCandidate(viewer.x,viewer.y,portal!.buildingId,viewer.roomIndex,map.portals,100);
    expect(vault?.portal.id).toBe(portal!.id);
    expect(vault?.targetRoomIndex).toBe(target.roomIndex);
  });
});
