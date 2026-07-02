// DROP8_REFACTOR_018_WEREWOLF_SEASON
import { describe, expect, it, vi } from 'vitest';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { PlayerState } from '../src/rooms/schema.js';

function makeRoom(clock:{value:number}){const room=new Drop8Room() as any;room.now=()=>clock.value;room.setMatchmaking=vi.fn().mockResolvedValue(undefined);room.registrySyncQueue=Promise.resolve();room.state.phase='ACTIVE';room.state.aliveCount=4;return room;}
function addPlayer(room:any,id:string,x:number,y:number){const p=new PlayerState();p.id=id;p.name=id;p.alive=true;p.phase='landed';p.x=x;p.y=y;p.angle=0;room.state.players.set(id,p);room.tacticalInventory(id);return p;}

import { SILVER_CROSSBOW_BALANCE, WEAPONS } from '@drop8/shared';

describe('Refactor 018 silver crossbow',()=>{
  it('uses a four-round magazine and preserves the dedicated reserve',()=>{
    const clock={value:1},room=makeRoom(clock),p=addPlayer(room,'hunter',500,500),t=room.tacticalInventory(p.id);
    p.primary='silver_crossbow';p.equipped='silver_crossbow';t.silverCrossbowMagazine=4;t.silverBoltAmmo=6;
    expect(room.getWeaponMagazine(p,'silver_crossbow')).toBe(4);
    expect(room.getAmmo(p,'silver_bolt')).toBe(6);
    expect(WEAPONS.silver_crossbow.reloadSeconds).toBe(SILVER_CROSSBOW_BALANCE.reloadSeconds);
  });
  it('applies twenty damage per silver pellet while cancelling sprint',()=>{
    const clock={value:1},room=makeRoom(clock),hunter=addPlayer(room,'hunter',500,500),wolf=addPlayer(room,'wolf',550,500);
    wolf.werewolf.transformed=true;wolf.werewolf.sprinting=true;wolf.werewolf.transformEndsAt=99;
    wolf.werewolf.sprinting=false;wolf.werewolf.silverSlowUntil=clock.value+2.5;room.damage(wolf,55,hunter.id,'은화살',0,undefined,'silver');
    expect(wolf.hp).toBe(80);expect(wolf.werewolf.silverSlowUntil).toBeGreaterThan(clock.value);
    room.damage(wolf,55,hunter.id,'은화살',0,undefined,'silver');
    expect(wolf.hp).toBe(60);expect(wolf.alive).toBe(true);
  });
});
