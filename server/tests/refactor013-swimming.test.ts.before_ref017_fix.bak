import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { MAP_CONFIGS, SWIM_SPEED } from '@drop8/shared';
import app from '../src/app.config.js';
import type { Drop8State } from '../src/rooms/schema.js';

describe('Refactor 013 swimming server authority', () => {
  let server:ColyseusTestServer<typeof app>;
  beforeAll(async()=>{server=await boot(app);});
  afterAll(async()=>{await server.shutdown();});
  beforeEach(async()=>{await server.cleanup();});

  async function dock8Player(){
    const room=await server.createRoom<Drop8State>('drop8',{fillAi:false,mapId:'dock8'});
    const client=await server.connectTo(room,{nickname:'Swimmer'});
    for(const type of ['audioEvent','notice','chat','pickupResult'])client.onMessage(type,()=>undefined);
    room.state.phase='ACTIVE';
    const player=room.state.players.get(client.sessionId)!;
    player.phase='landed';player.alive=true;player.x=3300;player.y=420;player.equipped='rifle';player.primary='rifle';player.rifleMagazine=30;
    return{room,client,player};
  }

  it('creates Dock 8 rooms with the requested map identity', async()=>{
    const {room}=await dock8Player();
    expect(room.state.mapId).toBe('dock8');
    expect(MAP_CONFIGS.dock8.width).toBe(7168);
    expect(SWIM_SPEED).toBe(165);
  });

  it('blocks shooting and ammunition consumption while swimming', async()=>{
    const {client,player}=await dock8Player();
    player.isSwimming=true;
    const before=player.rifleMagazine;
    client.send('fire',{x:1,y:0});
    await new Promise((resolve)=>setTimeout(resolve,90));
    expect(player.rifleMagazine).toBe(before);
  });

  it('blocks reload, healing and throwable preparation while swimming', async()=>{
    const {client,player}=await dock8Player();
    player.isSwimming=true;player.rifleMagazine=1;player.standardAmmo=50;player.hp=60;player.bandages=1;player.throwableType='fragGrenade';player.throwableCount=1;
    client.send('reload');client.send('heal',{kind:'bandage'});client.send('switch',{slot:4});client.send('throwPrepare');
    await new Promise((resolve)=>setTimeout(resolve,100));
    expect(player.reloading).toBe(false);
    expect(player.healingKind).toBe('');
    expect(player.isPreparingThrow).toBe(false);
    expect(player.bandages).toBe(1);
    expect(player.throwableCount).toBe(1);
  });

  it('keeps the equipped weapon while swimming', async()=>{
    const {player}=await dock8Player();
    player.isSwimming=true;
    expect(player.equipped).toBe('rifle');
    expect(player.primary).toBe('rifle');
  });
});
