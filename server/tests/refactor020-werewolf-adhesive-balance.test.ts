// DROP8_REFACTOR_020_WEREWOLF_PREDATOR_ADHESIVE_BALANCE
import { describe, expect, it, vi } from 'vitest';
import { ADHESIVE_PLAYER_BALANCE, ADHESIVE_SPRAYER_BALANCE, WEREWOLF_BALANCE, adhesivePlayerSpeedMultiplier } from '@drop8/shared';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { MotorcycleState, PlayerState } from '../src/rooms/schema.js';

function makeRoom(clock:{value:number}){const room=new Drop8Room() as any;room.now=()=>clock.value;room.setMatchmaking=vi.fn().mockResolvedValue(undefined);room.registrySyncQueue=Promise.resolve();room.state.phase='ACTIVE';room.state.aliveCount=4;room.state.werewolfSeason.enabled=true;return room;}
function addPlayer(room:any,id:string,x:number,y:number){const p=new PlayerState();p.id=id;p.name=id;p.alive=true;p.phase='landed';p.x=x;p.y=y;room.state.players.set(id,p);room.tacticalInventory(id);return p;}

describe('Refactor 020 werewolf predator and adhesive control',()=>{
  it('applies aura damage on an interval and dismounts a sustained nearby rider',()=>{
    const clock={value:1},room=makeRoom(clock),wolf=addPlayer(room,'wolf',1000,1000),driver=addPlayer(room,'driver',1040,1000),bike=new MotorcycleState();
    wolf.werewolf.transformed=true;wolf.werewolf.transformEndsAt=99;room.state.werewolfSeason.werewolfPlayerId=wolf.id;
    bike.id='bike';bike.x=1040;bike.y=1000;bike.driverId=driver.id;driver.isDriving=true;driver.vehicleId=bike.id;room.state.motorcycles.set(bike.id,bike);
    room.firstObstacleHitT=()=>null;
    room.updateWerewolfAura();expect(bike.hp).toBe(bike.maxHp-WEREWOLF_BALANCE.auraVehicleDamage);expect(driver.isDriving).toBe(true);
    clock.value=1.4;room.updateWerewolfAura();clock.value=1.81;room.updateWerewolfAura();
    expect(driver.isDriving).toBe(false);expect(driver.vehicleId).toBe('');
  });

  it('stacks player adhesive to stage three and leaves a recovery tail',()=>{
    const clock={value:0},room=makeRoom(clock),sprayer=addPlayer(room,'sprayer',500,500),target=addPlayer(room,'target',680,500);
    sprayer.primary='adhesive_sprayer';sprayer.equipped='adhesive_sprayer';sprayer.angle=0;room.tacticalInventory(sprayer.id).adhesiveSprayerMagazine=30;
    for(let i=0;i<12;i++){clock.value=i*.1;room.firePlayer(sprayer);}
    expect(target.werewolf.adhesiveSlowStage).toBe(3);
    expect(target.werewolf.adhesiveSlowUntil).toBeGreaterThan(clock.value+4);
    const active=adhesivePlayerSpeedMultiplier(target.werewolf.adhesiveSlowStage,clock.value,target.werewolf.adhesiveSlowUntil,target.werewolf.adhesiveRecoveryUntil);
    expect(active).toBe(ADHESIVE_PLAYER_BALANCE.stage3SpeedMultiplier);
    clock.value=target.werewolf.adhesiveSlowUntil+1;
    const recovering=adhesivePlayerSpeedMultiplier(target.werewolf.adhesiveSlowStage,clock.value,target.werewolf.adhesiveSlowUntil,target.werewolf.adhesiveRecoveryUntil);
    expect(recovering).toBeGreaterThan(active);expect(recovering).toBeLessThan(1);
  });

  it('uses the stronger motorcycle adhesive profile without changing weapon range',()=>{
    expect(ADHESIVE_SPRAYER_BALANCE.motorcycle.speedMultiplier).toBe(.45);
    expect(ADHESIVE_SPRAYER_BALANCE.motorcycle.durationSeconds).toBe(5);
    expect(ADHESIVE_SPRAYER_BALANCE.range).toBe(315);
  });
});
