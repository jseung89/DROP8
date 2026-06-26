// DROP8_REFACTOR_013G_DOCK8_RECOVERY
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import app from '../src/app.config.js';
import type { Drop8State } from '../src/rooms/schema.js';

describe('Refactor 013G Dock 8 recovery', () => {
  let server:ColyseusTestServer<typeof app>;
  beforeAll(async()=>{server=await boot(app);});
  afterAll(async()=>{await server.shutdown();});
  beforeEach(async()=>{await server.cleanup();});

  it('spawns 216 loot items with more than half indoors', async()=>{
    const room=await server.createRoom<Drop8State>('drop8',{fillAi:false,mapId:'dock8'});
    const internal=room as unknown as {spawnLoot:()=>void};
    internal.spawnLoot();
    const loot=[...room.state.loot.values()];
    const indoor=loot.filter((item)=>item.roomIndex>0);
    expect(loot).toHaveLength(216);
    expect(indoor).toHaveLength(124);
    expect(indoor.length/loot.length).toBeGreaterThanOrEqual(.52);
    const buildings=new Set(indoor.map((item)=>item.buildingId));
    for(let index=1;index<=20;index++)expect(buildings.has(`dock8-building-${index}`)).toBe(true);
  });

  it('selects eight motorcycles with balanced river-bank coverage', async()=>{
    const room=await server.createRoom<Drop8State>('drop8',{fillAi:false,mapId:'dock8'});
    const internal=room as unknown as {spawnMotorcycles:()=>void};
    internal.spawnMotorcycles();
    const motorcycles=[...room.state.motorcycles.values()];
    const west=motorcycles.filter((item)=>item.id.includes('-west-'));
    const east=motorcycles.filter((item)=>item.id.includes('-east-'));
    const central=motorcycles.filter((item)=>item.id.includes('-central-'));
    expect(motorcycles).toHaveLength(8);
    expect(west.length).toBeGreaterThanOrEqual(3);
    expect(west.length).toBeLessThanOrEqual(4);
    expect(east.length).toBeGreaterThanOrEqual(3);
    expect(east.length).toBeLessThanOrEqual(4);
    expect(central.length).toBeGreaterThanOrEqual(1);
    expect(motorcycles.filter((item)=>item.id.includes('-repair-')).length).toBeLessThanOrEqual(2);
  });
});
