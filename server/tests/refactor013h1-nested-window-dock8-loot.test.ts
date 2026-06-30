// DROP8_REFACTOR_013H1_LARGE_NESTED_ROOM_WINDOW_DOCK8_TERRAIN_LOOT
import { describe, expect, it } from 'vitest';
import {
  MAP_CONFIGS,
  PLAYER_BODY_RADIUS,
  circleHitsRect,
  createSeededRandom,
  findPortalVaultCandidate,
  portalBuildingIdForSide,
  spaceAt,
  terrainAt,
} from '@drop8/shared';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { PlayerState } from '../src/rooms/schema.js';

function maxNearAxisGroup(items:readonly {x:number;y:number}[],axis:'x'|'y',tolerance=6){
  const values=items.map((item)=>item[axis]).sort((a,b)=>a-b);
  let best=0;
  for(let start=0;start<values.length;start++){
    let end=start;
    while(end+1<values.length&&values[end+1]!-values[start]!<=tolerance)end++;
    best=Math.max(best,end-start+1);
  }
  return best;
}

function hasAlignedFourPointProgression(items:readonly {x:number;y:number}[],axis:'x'|'y',secondaryTolerance=6,spacingTolerance=4){
  const primary=axis,secondary=axis==='x'?'y':'x';
  const bySecondary=[...items].sort((a,b)=>a[secondary]-b[secondary]);
  for(let start=0;start<bySecondary.length;start++){
    let end=start;
    while(end+1<bySecondary.length&&bySecondary[end+1]![secondary]-bySecondary[start]![secondary]<=secondaryTolerance)end++;
    if(end-start+1<4)continue;
    const group=bySecondary.slice(start,end+1).sort((a,b)=>a[primary]-b[primary]);
    for(let first=0;first<group.length-3;first++)for(let second=first+1;second<group.length-2;second++){
      const step=group[second]![primary]-group[first]![primary];
      if(step<20)continue;
      let count=2,expected=group[second]![primary]+step;
      for(let index=second+1;index<group.length&&count<4;index++){
        const value=group[index]![primary];
        if(Math.abs(value-expected)<=spacingTolerance){count++;expected+=step;}
        else if(value>expected+spacingTolerance)break;
      }
      if(count>=4)return true;
    }
  }
  return false;
}

describe('Refactor 013H1 nested-room windows and Dock 8 loot authority',()=>{
  it('resolves every large-map vaultable window from both physical sides for 20 rounds',()=>{
    const map=MAP_CONFIGS.large;
    const windows=map.portals.filter((portal)=>portal.kind==='window'&&portal.vaultable);
    const nested=windows.filter((portal)=>portalBuildingIdForSide(portal,'A')!==''&&portalBuildingIdForSide(portal,'A')!==portalBuildingIdForSide(portal,'B'));
    expect(windows.length).toBeGreaterThan(0);
    expect(nested.length).toBeGreaterThan(0);
    for(let round=0;round<20;round++){
      const room=new Drop8Room() as any;
      room.state.mapId='large';room.state.mapSizeMode='large';room.state.worldSize=map.width;
      for(const portal of windows)for(const side of ['A','B'] as const){
        const start=side==='A'?portal.approachA:portal.approachB;
        const roomIndex=side==='A'?portal.sideARoomIndex:portal.sideBRoomIndex;
        const buildingId=portalBuildingIdForSide(portal,side);
        const sourceSpace=spaceAt(start.x,start.y,map.buildingVisibilityZones,map.rooms,0);
        expect(sourceSpace.buildingId,`${portal.id} ${side} source building`).toBe(buildingId);
        expect(sourceSpace.roomIndex,`${portal.id} ${side} source room`).toBe(roomIndex);
        const candidate=findPortalVaultCandidate(start.x,start.y,buildingId,roomIndex,[portal],72);
        expect(candidate,`${portal.id} ${side} candidate`).toBeDefined();
        if(!candidate)throw new Error(`Missing vault candidate: ${portal.id} ${side}`);
        const destination=room.resolveVaultDestination(candidate,'fixture-player');
        expect(destination,`${portal.id} ${side} destination`).toBeDefined();
        if(!destination)throw new Error(`Missing vault destination: ${portal.id} ${side}`);
        const targetSpace=spaceAt(destination.x,destination.y,map.buildingVisibilityZones,map.rooms,0);
        expect(targetSpace.buildingId,`${portal.id} ${side} target building`).toBe(candidate.targetBuildingId);
        expect(targetSpace.roomIndex,`${portal.id} ${side} target room`).toBe(candidate.targetRoomIndex);
        expect(map.collisionObstacles.some((rect)=>circleHitsRect(destination.x,destination.y,PLAYER_BODY_RADIUS+2,rect))).toBe(false);
      }
    }
  });

  it('completes 20 alternating server-authoritative vaults through one nested large-map window',()=>{
    const map=MAP_CONFIGS.large;
    const portal=map.portals.find((candidate)=>candidate.id==='large-building-16-window-1');
    expect(portal).toBeDefined();
    if(!portal)throw new Error('Nested large-map fixture window is missing.');
    const room=new Drop8Room() as any;
    room.state.mapId='large';room.state.mapSizeMode='large';room.state.worldSize=map.width;
    const player=new PlayerState();
    player.id='nested-window-player';player.alive=true;player.phase='landed';player.isDriving=false;player.isSwimming=false;player.angle=0;
    player.x=portal.approachA.x;player.y=portal.approachA.y;player.buildingId=portalBuildingIdForSide(portal,'A');player.roomIndex=portal.sideARoomIndex;player.insideBuilding=Boolean(player.buildingId);
    room.state.players.set(player.id,player);
    for(let round=0;round<20;round++){
      const candidate=findPortalVaultCandidate(player.x,player.y,player.buildingId,player.roomIndex,[portal],80);
      expect(candidate,`round ${round+1} candidate`).toBeDefined();
      if(!candidate)throw new Error(`Missing nested vault candidate at round ${round+1}`);
      expect(room.beginWindowVault(player,candidate),`round ${round+1} start`).toBe(true);
      room.clock.elapsedTime+=500;
      room.updateVaults();
      expect(player.isVaulting,`round ${round+1} finished`).toBe(false);
      const actual=spaceAt(player.x,player.y,map.buildingVisibilityZones,map.rooms,0);
      expect(player.buildingId,`round ${round+1} building`).toBe(actual.buildingId);
      expect(player.roomIndex,`round ${round+1} room`).toBe(actual.roomIndex);
      expect(map.collisionObstacles.some((rect)=>circleHitsRect(player.x,player.y,PLAYER_BODY_RADIUS+2,rect))).toBe(false);
      room.clock.elapsedTime+=500;
    }
    expect(player.buildingTransitionSeq).toBe(20);
  });

  it('spawns 280 naturally scattered Dock 8 loot items without changing other map budgets',()=>{
    expect(MAP_CONFIGS.small.lootBudget).toBe(85);
    expect(MAP_CONFIGS.large.lootBudget).toBe(142);
    expect(MAP_CONFIGS.dock8.lootBudget).toBe(280);
    const map=MAP_CONFIGS.dock8;
    let maxX=0,maxY=0;
    for(let seed=1;seed<=500;seed++){
      const room=new Drop8Room() as any;
      room.state.mapId='dock8';room.state.mapSizeMode='dock8';room.state.worldSize=map.width;
      room.lootRandom=createSeededRandom(seed);
      room.spawnLoot();
      const loot=[...room.state.loot.values()] as Array<{x:number;y:number;buildingId:string;roomIndex:number;kind:string}>;
      expect(loot).toHaveLength(280);
      expect(loot.filter((item)=>Boolean(item.buildingId)).length/loot.length).toBeGreaterThanOrEqual(.52);
      const occupiedBuildings=new Set(loot.filter((item)=>item.buildingId).map((item)=>item.buildingId));
      expect(map.buildingVisibilityZones.every((zone)=>occupiedBuildings.has(zone.id))).toBe(true);
      for(const item of loot){
        expect(map.collisionObstacles.some((rect)=>circleHitsRect(item.x,item.y,20,rect))).toBe(false);
        const kind=terrainAt(item.x,item.y,{buildings:map.buildings,rooms:map.rooms,rivers:map.rivers,shallowWaterZones:map.shallowWaterZones,crossings:map.landCrossings,shoreExits:map.shoreExits});
        expect(kind).not.toBe('deep-water');
      }
      maxX=Math.max(maxX,maxNearAxisGroup(loot,'x'));
      maxY=Math.max(maxY,maxNearAxisGroup(loot,'y'));
      expect(hasAlignedFourPointProgression(loot,'x')).toBe(false);
      expect(hasAlignedFourPointProgression(loot,'y')).toBe(false);
    }
    expect(maxX).toBeLessThanOrEqual(56);
    expect(maxY).toBeLessThanOrEqual(56);
  });
});
