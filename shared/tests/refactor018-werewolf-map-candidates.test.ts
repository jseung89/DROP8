// DROP8_REFACTOR_018_WEREWOLF_SEASON
import { describe, expect, it } from 'vitest';
import { SILVER_ARMORY_CANDIDATES, WEREWOLF_ALTAR_CANDIDATES, WEREWOLF_MIN_ALTAR_ARMORY_DISTANCE, chooseWerewolfSeasonPoints, getMapConfig, seasonPointStructurallyValid, spaceAt, terrainAt, type MapId } from '../src/index.js';

function validity(mapId:MapId){
  const map=getMapConfig(mapId);
  return (point:{x:number;y:number})=>{
    const space=spaceAt(point.x,point.y,map.buildingVisibilityZones,map.rooms,0);
    const terrain=terrainAt(point.x,point.y,{buildings:map.buildings,rooms:map.rooms,rivers:map.rivers,shallowWaterZones:map.shallowWaterZones,crossings:map.landCrossings,shoreExits:map.shoreExits});
    return seasonPointStructurallyValid(map,point,terrain,space.outdoors);
  };
}

describe('Refactor 018 map candidates',()=>{
  for(const mapId of ['small','large','dock8'] as const){
    it(`keeps every ${mapId} altar and armory candidate on safe accessible land`,()=>{
      const valid=validity(mapId);
      expect(WEREWOLF_ALTAR_CANDIDATES[mapId]).toHaveLength(6);
      expect(SILVER_ARMORY_CANDIDATES[mapId]).toHaveLength(6);
      expect(WEREWOLF_ALTAR_CANDIDATES[mapId].every(valid)).toBe(true);
      expect(SILVER_ARMORY_CANDIDATES[mapId].every(valid)).toBe(true);
      const pair=chooseWerewolfSeasonPoints(mapId,()=>0,(point)=>valid(point));
      expect(pair).toBeDefined();
      expect(Math.hypot(pair!.altar.x-pair!.armory.x,pair!.altar.y-pair!.armory.y)).toBeGreaterThanOrEqual(WEREWOLF_MIN_ALTAR_ARMORY_DISTANCE[mapId]);
    });
  }
});
