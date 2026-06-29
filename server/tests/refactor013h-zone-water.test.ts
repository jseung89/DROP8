// DROP8_REFACTOR_013H_FIXED_V3_VISIBILITY_ROOF_RIVER_ZONE_SNIPER_AI
// DROP8_REFACTOR_013H_VISIBILITY_ROOF_RIVER_ZONE_SNIPER
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { MAP_CONFIGS, terrainAt } from '@drop8/shared';
import app from '../src/app.config.js';
import type { Drop8State, PlayerState } from '../src/rooms/schema.js';

describe('Refactor 013H delayed zone and continuous swimming authority',()=>{
  let server:ColyseusTestServer<typeof app>;
  beforeAll(async()=>{server=await boot(app);});
  afterAll(async()=>{await server.shutdown();});
  beforeEach(async()=>{await server.cleanup();});

  async function createDock8Room(){
    const room=await server.createRoom<Drop8State>('drop8',{fillAi:false,mapId:'dock8'});
    const client=await server.connectTo(room,{nickname:'TerrainTester'});
    for(const type of ['audioEvent','notice','chat','pickupResult'])client.onMessage(type,()=>undefined);
    room.state.phase='ACTIVE';
    const player=room.state.players.get(client.sessionId)!;
    player.phase='landed';player.alive=true;
    return{room,client,player};
  }

  it('starts without a circle, announces it, then activates it without real-time waiting',async()=>{
    const {room,player}=await createDock8Room();
    const internal=room as unknown as {updateZone:(dt:number)=>void};
    player.x=1000;player.y=1000;
    room.state.zoneActive=false;room.state.zoneState='FREE';room.state.zoneTimer=.01;
    internal.updateZone(.02);
    expect(room.state.zoneActive).toBe(false);
    expect(room.state.zoneState).toBe('ANNOUNCING');
    expect(room.state.zoneTimer).toBeGreaterThan(0);
    room.state.zoneTimer=.01;
    internal.updateZone(.02);
    expect(room.state.zoneActive).toBe(true);
    expect(room.state.zoneState).toBe('WAITING');
    expect(room.state.zoneRadius).toBe(MAP_CONFIGS.dock8.initialZoneRadius);
  });

  it('uses map-specific free-loot durations',async()=>{
    expect(MAP_CONFIGS.small.zoneFreeSeconds).toBe(50);
    expect(MAP_CONFIGS.large.zoneFreeSeconds).toBe(65);
    expect(MAP_CONFIGS.dock8.zoneFreeSeconds).toBe(85);
  });

  it('enters anywhere in continuous deep water and exits inside a building or on land',async()=>{
    const {room,player}=await createDock8Room();
    const map=MAP_CONFIGS.dock8;
    const internal=room as unknown as {updateSwimmingState:(player:PlayerState)=>void};
    let deep:{x:number;y:number}|undefined;
    for(let y=180;y<map.height&&!deep;y+=80)for(let x=2500;x<4700;x+=64){
      const kind=terrainAt(x,y,{buildings:map.buildings,rooms:map.rooms,rivers:map.rivers,shallowWaterZones:map.shallowWaterZones,crossings:map.landCrossings,shoreExits:map.shoreExits});
      if(kind==='deep-water'){deep={x,y};break;}
    }
    expect(deep).toBeDefined();
    player.x=deep!.x;player.y=deep!.y;player.isSwimming=false;
    internal.updateSwimmingState(player);
    expect(player.isSwimming).toBe(true);

    const building=map.buildingVisibilityZones.find((zone)=>zone.id==='dock8-building-9')!;
    player.x=building.interior.x+40;player.y=building.interior.y+40;
    internal.updateSwimmingState(player);
    expect(player.isSwimming).toBe(false);

    player.x=120;player.y=120;
    internal.updateSwimmingState(player);
    expect(player.isSwimming).toBe(false);
  });

  it('keeps bridges and fords non-swimming',async()=>{
    const {room,player}=await createDock8Room();
    const internal=room as unknown as {updateSwimmingState:(player:PlayerState)=>void};
    for(const crossing of MAP_CONFIGS.dock8.landCrossings){
      player.x=crossing.rect.x+crossing.rect.w/2;
      player.y=crossing.rect.y+crossing.rect.h/2;
      player.isSwimming=false;
      internal.updateSwimmingState(player);
      expect(player.isSwimming,crossing.id).toBe(false);
    }
  });
});
