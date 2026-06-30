// DROP8_REFACTOR_013H1_LARGE_ROOM_WINDOW_DOCK8_TERRAIN_LOOT
import { describe, expect, it } from 'vitest';
import { MAP_CONFIGS, findPortalVaultCandidate, portalBuildingIdForSide, roomAt, spaceAt, terrainAt, waterSignedDepthAt } from '../src/index.js';
import { DOCK8_LOOT_ANCHORS, DOCK8_RIVERS } from '../src/maps/dock8.js';
import type { RoomZone } from '../src/maps/types.js';

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

describe('Refactor 013H1 large-room and Dock 8 hotfix invariants',()=>{
  it('selects the smallest matching room instead of the first overlapping parent room',()=>{
    const rooms:RoomZone[]=[
      {id:'parent',buildingId:'b',index:1,rect:{x:0,y:0,w:400,h:400},kind:'main'},
      {id:'child',buildingId:'b',index:2,rect:{x:100,y:100,w:120,h:120},kind:'office'},
    ];
    expect(roomAt(150,150,rooms,'b')?.id).toBe('child');
    expect(spaceAt(150,150,[{id:'b',interior:{x:0,y:0,w:400,h:400},doors:[],windows:[]}],rooms).roomIndex).toBe(2);
  });

  it('maps nested large-map building windows to the physical room on each side',()=>{
    const map=MAP_CONFIGS.large;
    const windows=map.portals.filter((portal)=>portal.kind==='window'&&portal.vaultable);
    const nested=windows.filter((portal)=>portalBuildingIdForSide(portal,'A')&&portalBuildingIdForSide(portal,'A')!==portalBuildingIdForSide(portal,'B'));
    expect(windows.length).toBeGreaterThan(0);
    expect(nested.length).toBeGreaterThan(0);
    for(const portal of windows){
      const aBuildingId=portalBuildingIdForSide(portal,'A');
      const bBuildingId=portalBuildingIdForSide(portal,'B');
      const actualA=spaceAt(portal.approachA.x,portal.approachA.y,map.buildingVisibilityZones,map.rooms,0);
      const actualB=spaceAt(portal.approachB.x,portal.approachB.y,map.buildingVisibilityZones,map.rooms,0);
      expect(actualA.buildingId,`${portal.id} A building`).toBe(aBuildingId);
      expect(actualA.roomIndex,`${portal.id} A room`).toBe(portal.sideARoomIndex);
      expect(actualB.buildingId,`${portal.id} B building`).toBe(bBuildingId);
      expect(actualB.roomIndex,`${portal.id} B room`).toBe(portal.sideBRoomIndex);
      const fromA=findPortalVaultCandidate(portal.approachA.x,portal.approachA.y,aBuildingId,portal.sideARoomIndex,[portal],72);
      const fromB=findPortalVaultCandidate(portal.approachB.x,portal.approachB.y,bBuildingId,portal.sideBRoomIndex,[portal],72);
      expect(fromA,`${portal.id} A`).toBeDefined();
      expect(fromB,`${portal.id} B`).toBeDefined();
      expect(fromA?.targetBuildingId).toBe(bBuildingId);
      expect(fromA?.targetRoomIndex).toBe(portal.sideBRoomIndex);
      expect(fromB?.targetBuildingId).toBe(aBuildingId);
      expect(fromB?.targetRoomIndex).toBe(portal.sideARoomIndex);
    }
  });

  it('keeps Dock 8 river bends deep-water so the renderer must use joined strokes',()=>{
    const map=MAP_CONFIGS.dock8;
    let checked=0;
    for(const river of DOCK8_RIVERS)for(let index=1;index<river.points.length-1;index++){
      const point=river.points[index]!;
      const depth=waterSignedDepthAt(point.x,point.y,map.rivers,map.landCrossings);
      if(depth<80)continue;
      const kind=terrainAt(point.x,point.y,{buildings:map.buildings,rooms:map.rooms,rivers:map.rivers,shallowWaterZones:map.shallowWaterZones,crossings:map.landCrossings,shoreExits:map.shoreExits});
      if(kind==='building'||kind==='bridge'||kind==='ford'||kind==='shore')continue;
      expect(kind,`river bend ${index}`).toBe('deep-water');
      checked++;
    }
    expect(checked).toBeGreaterThan(2);
  });

  it('raises only Dock 8 loot budget and removes grid-like anchor alignment',()=>{
    expect(MAP_CONFIGS.small.lootBudget).toBe(85);
    expect(MAP_CONFIGS.large.lootBudget).toBe(142);
    expect(MAP_CONFIGS.dock8.lootBudget).toBe(280);
    expect(DOCK8_LOOT_ANCHORS.length).toBeGreaterThanOrEqual(360);
    const active=DOCK8_LOOT_ANCHORS.slice(0,MAP_CONFIGS.dock8.lootBudget);
    const indoor=active.filter((anchor)=>Boolean(anchor.buildingId));
    expect(active).toHaveLength(280);
    expect(indoor.length/active.length).toBeGreaterThanOrEqual(.52);
    expect(maxNearAxisGroup(active,'x')).toBeLessThanOrEqual(Math.floor(active.length*.2));
    expect(maxNearAxisGroup(active,'y')).toBeLessThanOrEqual(Math.floor(active.length*.2));
    expect(hasAlignedFourPointProgression(active,'x')).toBe(false);
    expect(hasAlignedFourPointProgression(active,'y')).toBe(false);
  });
});
