// DROP8_REFACTOR_018_WEREWOLF_SEASON
import { describe, expect, it, vi } from 'vitest';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { MotorcycleState, PlayerState } from '../src/rooms/schema.js';

function makeRoom(clock:{value:number}){const room=new Drop8Room() as any;room.now=()=>clock.value;room.setMatchmaking=vi.fn().mockResolvedValue(undefined);room.registrySyncQueue=Promise.resolve();room.state.phase='ACTIVE';room.state.aliveCount=4;return room;}
function addPlayer(room:any,id:string,x:number,y:number){const p=new PlayerState();p.id=id;p.name=id;p.alive=true;p.phase='landed';p.x=x;p.y=y;p.angle=0;room.state.players.set(id,p);room.tacticalInventory(id);return p;}

import { WEREWOLF_BALANCE } from '@drop8/shared';

describe('Refactor 018 werewolf combat and motorcycle hunt',()=>{
  it('kills a normal target in three authoritative claw hits',()=>{
    const clock={value:1},room=makeRoom(clock),wolf=addPlayer(room,'wolf',1800,1800),target=addPlayer(room,'target',1860,1800);
    wolf.werewolf.transformed=true;wolf.werewolf.transformEndsAt=99;wolf.angle=0;
    for(const t of [1,1.7,2.4]){clock.value=t;room.werewolfClaw(wolf);}
    expect(target.alive).toBe(false);expect(target.hp).toBe(0);expect(WEREWOLF_BALANCE.clawDamage).toBe(34);
  });
  it('marks a motorcycle first and force-dismounts on the second hit',()=>{
    const clock={value:1},room=makeRoom(clock),wolf=addPlayer(room,'wolf',2000,2000),driver=addPlayer(room,'driver',2060,2000),bike=new MotorcycleState();
    wolf.werewolf.transformed=true;wolf.werewolf.transformEndsAt=99;wolf.angle=0;
    bike.id='bike';bike.x=2060;bike.y=2000;bike.driverId=driver.id;driver.isDriving=true;driver.vehicleId=bike.id;room.state.motorcycles.set(bike.id,bike);
    room.werewolfClaw(wolf);expect(bike.huntMarkedBy).toBe(wolf.id);expect(driver.isDriving).toBe(true);
    clock.value=1.7;room.werewolfClaw(wolf);
    expect(driver.isDriving).toBe(false);expect(driver.vehicleId).toBe('');expect(driver.werewolf.huntDismountImmuneUntil).toBeGreaterThan(clock.value);
  });
});
