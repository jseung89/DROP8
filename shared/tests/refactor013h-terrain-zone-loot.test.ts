// DROP8_REFACTOR_013H_FIXED_V3_VISIBILITY_ROOF_RIVER_ZONE_SNIPER_AI
// DROP8_REFACTOR_013H_VISIBILITY_ROOF_RIVER_ZONE_SNIPER
import { describe, expect, it } from 'vitest';
import {
  MAP_CONFIGS,
  adjustedLootTableForMap,
  createInitialZone,
  createNextZone,
  createSeededRandom,
  terrainAt,
  waterSignedDepthAt,
} from '../src/index.js';

function terrainForDock8(x:number,y:number){
  const map=MAP_CONFIGS.dock8;
  return terrainAt(x,y,{
    buildings:map.buildings,
    rooms:map.rooms,
    rivers:map.rivers,
    shallowWaterZones:map.shallowWaterZones,
    crossings:map.landCrossings,
    shoreExits:map.shoreExits,
  });
}

describe('Refactor 013H terrain, opening zone and long-range balance',()=>{
  it('treats building rooms as land overrides and crossings as non-swimming terrain',()=>{
    const map=MAP_CONFIGS.dock8;
    for(const room of map.rooms){
      for(let y=room.rect.y+8;y<=room.rect.y+room.rect.h-8;y+=32)for(let x=room.rect.x+8;x<=room.rect.x+room.rect.w-8;x+=32){
        expect(terrainForDock8(x,y),`${room.id} ${Math.round(x)},${Math.round(y)}`).toBe('building');
      }
    }
    for(const building of map.buildings){
      for(let y=building.y+20;y<=building.y+building.h-20;y+=48)for(let x=building.x+20;x<=building.x+building.w-20;x+=48){
        expect(terrainForDock8(x,y),`building ${Math.round(x)},${Math.round(y)}`).toBe('building');
      }
    }
    for(const crossing of map.landCrossings){
      const x=crossing.rect.x+crossing.rect.w/2,y=crossing.rect.y+crossing.rect.h/2;
      expect(terrainForDock8(x,y),crossing.id).toBe(crossing.kind==='ford'?'ford':'bridge');
    }
  });

  it('keeps the visible river continuous outside explicit land overrides',()=>{
    const map=MAP_CONFIGS.dock8;
    let checked=0;
    for(let y=120;y<map.height;y+=96){
      for(let x=2500;x<4700;x+=72){
        const depth=waterSignedDepthAt(x,y,map.rivers,map.landCrossings);
        if(depth<120)continue;
        const kind=terrainForDock8(x,y);
        if(kind==='building'||kind==='bridge'||kind==='ford'||kind==='shore')continue;
        expect(kind,`river sample ${Math.round(x)},${Math.round(y)}`).toBe('deep-water');
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(250);
    expect(terrainForDock8(120,120)).toBe('land');
  });

  it('distributes first circles across every map and keeps all generated follow-up circles contained',()=>{
    for(const map of Object.values(MAP_CONFIGS)){
      const counts=Array.from({length:9},()=>0);
      let west=0,east=0,north=0,south=0;
      const crossings=map.id==='dock8'?map.landCrossings.filter((crossing)=>crossing.allowsPlayer).map((crossing)=>({x:crossing.rect.x+crossing.rect.w/2,y:crossing.rect.y+crossing.rect.h/2})):[];
      for(let seed=1;seed<=1000;seed++){
        const random=createSeededRandom(seed);
        const zone=createInitialZone(random,map.initialZoneRadius,map.width,28,crossings);
        expect(zone.x,`${map.id} x`).toBeGreaterThanOrEqual(0);
        expect(zone.x,`${map.id} x`).toBeLessThanOrEqual(map.width);
        expect(zone.y,`${map.id} y`).toBeGreaterThanOrEqual(0);
        expect(zone.y,`${map.id} y`).toBeLessThanOrEqual(map.height);
        const sx=Math.min(2,Math.floor(zone.x/(map.width/3)));
        const sy=Math.min(2,Math.floor(zone.y/(map.height/3)));
        counts[sy*3+sx]++;
        if(zone.x<map.width/2)west++;else east++;
        if(zone.y<map.height/2)north++;else south++;
        if(crossings.length)expect(crossings.some((point)=>Math.hypot(zone.x-point.x,zone.y-point.y)<=zone.radius),`${map.id} crossing seed ${seed}`).toBe(true);
        const next=createNextZone(random,zone.x,zone.y,zone.radius,zone.radius*.72,0,28,map.width);
        expect(Math.hypot(next.x-zone.x,next.y-zone.y)+next.radius,`${map.id} containment seed ${seed}`).toBeLessThanOrEqual(zone.radius-28+1e-6);
      }
      expect(counts[4],`${map.id} center`).toBeLessThanOrEqual(250);
      for(const side of [west,east,north,south]){
        expect(side,`${map.id} side`).toBeGreaterThanOrEqual(350);
        expect(side,`${map.id} side`).toBeLessThanOrEqual(650);
      }
    }
  });

  it('keeps small-map weights stable while raising large-map sniper and Dock 8 ammo odds',()=>{
    const weapons=[
      {kind:'pistol' as const,weight:26},{kind:'smg' as const,weight:24},{kind:'rifle' as const,weight:20},
      {kind:'shotgun' as const,weight:20},{kind:'sniper' as const,weight:10},
    ];
    const ammo=[
      {kind:'pistol_ammo' as const,weight:28},{kind:'standard_ammo' as const,weight:48},{kind:'shotgun_ammo' as const,weight:24},
    ];
    const probability=(table:readonly {kind:string;weight:number}[],kind:string)=>{
      const total=table.reduce((sum,item)=>sum+item.weight,0);
      return table.find((item)=>item.kind===kind)!.weight/total;
    };
    const baseSniper=probability(weapons,'sniper');
    const largeSniper=probability(adjustedLootTableForMap('large',weapons),'sniper');
    const dockSniper=probability(adjustedLootTableForMap('dock8',weapons),'sniper');
    const baseStandard=probability(ammo,'standard_ammo');
    const dockStandard=probability(adjustedLootTableForMap('dock8',ammo),'standard_ammo');
    expect(adjustedLootTableForMap('small',weapons)).toEqual(weapons);
    expect(largeSniper/baseSniper).toBeGreaterThanOrEqual(1.10);
    expect(largeSniper/baseSniper).toBeLessThanOrEqual(1.15);
    expect(dockSniper/baseSniper).toBeGreaterThanOrEqual(1.30);
    expect(dockSniper/baseSniper).toBeLessThanOrEqual(1.40);
    expect(dockStandard/baseStandard).toBeGreaterThanOrEqual(1.15);
    expect(dockStandard/baseStandard).toBeLessThanOrEqual(1.20);
  });
});
