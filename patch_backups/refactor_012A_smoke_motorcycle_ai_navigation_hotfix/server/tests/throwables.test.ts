import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import app from '../src/app.config.js';
import { FireFieldState, ThrownObjectState, type Drop8State } from '../src/rooms/schema.js';

describe('Refactor 012 throwable server authority', () => {
  let server: ColyseusTestServer<typeof app>;

  beforeAll(async () => { server = await boot(app); });
  afterAll(async () => { await server.shutdown(); });
  beforeEach(async () => { await server.cleanup(); });

  async function landedPlayer(){
    const room=await server.createRoom<Drop8State>('drop8',{fillAi:false});
    const client=await server.connectTo(room,{nickname:'Thrower'});
    client.onMessage('audioEvent',()=>undefined);client.onMessage('notice',()=>undefined);
    room.state.phase='ACTIVE';room.state.serverTime=0;
    const player=room.state.players.get(client.sessionId)!;
    player.phase='landed';player.alive=true;player.x=1300;player.y=1800;player.buildingId='';player.angle=0;player.primary='rifle';player.equipped='rifle';player.previousEquipped='rifle';
    return{room,client,player};
  }

  it('rejects a throw when the authoritative inventory is empty', async () => {
    const {room,client,player}=await landedPlayer();
    client.send('switch',{slot:4});client.send('throwPrepare');client.send('throw',{aimX:1,aimY:0});
    await new Promise((resolve)=>setTimeout(resolve,100));
    expect(player.throwableCount).toBe(0);
    expect(room.state.thrownObjects.size).toBe(0);
  });

  it('spawns one server-owned projectile, consumes one item and restores the previous weapon at zero', async () => {
    const {room,client,player}=await landedPlayer();
    player.throwableType='fragGrenade';player.throwableCount=1;
    client.send('switch',{slot:4});await new Promise((resolve)=>setTimeout(resolve,35));
    client.send('throwPrepare');await new Promise((resolve)=>setTimeout(resolve,90));
    client.send('throw',{aimX:1,aimY:0});await new Promise((resolve)=>setTimeout(resolve,100));
    expect(room.state.thrownObjects.size).toBe(1);
    const object=[...room.state.thrownObjects.values()][0]!;
    expect(object.ownerId).toBe(player.id);
    expect(object.kind).toBe('fragGrenade');
    expect(player.throwableCount).toBe(0);
    expect(player.throwableType).toBe('');
    expect(player.equipped).toBe('rifle');
  });

  it('converts resting smoke and incendiary projectiles into synchronized fields', async () => {
    const {room,player}=await landedPlayer();
    const smoke=new ThrownObjectState();smoke.id='smoke-test';smoke.ownerId=player.id;smoke.kind='smokeGrenade';smoke.x=2050;smoke.y=2050;smoke.phase='resting';smoke.detonateAt=.001;
    const fire=new ThrownObjectState();fire.id='fire-test';fire.ownerId=player.id;fire.kind='incendiaryGrenade';fire.x=2250;fire.y=2050;fire.phase='resting';
    room.state.thrownObjects.set(smoke.id,smoke);room.state.thrownObjects.set(fire.id,fire);
    await new Promise((resolve)=>setTimeout(resolve,110));
    expect(room.state.smokeFields.size).toBe(1);
    expect(room.state.fireFields.size).toBe(1);
    expect(room.state.thrownObjects.has(smoke.id)).toBe(false);
    expect(room.state.thrownObjects.has(fire.id)).toBe(false);
  });

  it('does not stack periodic fire damage from overlapping fields', async () => {
    const {room,player}=await landedPlayer();
    player.hp=100;player.armor=0;
    for(const id of ['fire-a','fire-b']){
      const field=new FireFieldState();field.id=id;field.ownerId='enemy';field.x=player.x;field.y=player.y;field.radius=115;field.expiresAt=9999;field.buildingId='';room.state.fireFields.set(id,field);
    }
    await new Promise((resolve)=>setTimeout(resolve,310));
    expect(player.hp).toBeGreaterThanOrEqual(94);
    expect(player.hp).toBeLessThanOrEqual(97);
  });
});
