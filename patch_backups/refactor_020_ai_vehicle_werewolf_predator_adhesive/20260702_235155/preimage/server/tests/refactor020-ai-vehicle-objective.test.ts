// DROP8_REFACTOR_020_AI_VEHICLE_OBJECTIVE_RIVALRY
import { describe,expect,it,vi } from 'vitest';
import { MAP_CONFIGS, SUPPLY_DROP_BALANCE, WEREWOLF_BALANCE } from '@drop8/shared';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { MotorcycleState, PlayerState, SupplyDropState } from '../src/rooms/schema.js';

function makeRoom(clock:{value:number}){
  const room=new Drop8Room() as any;
  room.now=()=>clock.value;
  room.setMatchmaking=vi.fn().mockResolvedValue(undefined);
  room.registrySyncQueue=Promise.resolve();
  room.state.phase='ACTIVE';
  room.state.mapId='small';
  room.state.mapSizeMode='small';
  room.state.worldSize=MAP_CONFIGS.small.width;
  room.state.aliveCount=8;
  return room;
}

function ai(id:string,x:number,y:number){
  const p=new PlayerState();
  p.id=id;p.name=id;p.ai=true;p.alive=true;p.phase='landed';p.x=x;p.y=y;p.hp=100;
  return p;
}

function bike(id:string,x:number,y:number){
  const value=new MotorcycleState();
  value.id=id;value.x=x;value.y=y;value.lastSafeX=x;value.lastSafeY=y;value.hp=180;value.maxHp=180;
  return value;
}

function supply(id:string,x:number,y:number){
  const value=new SupplyDropState();
  value.id=id;value.x=x;value.y=y;value.landed=true;value.specialWeapon='bazooka';
  return value;
}

describe('Refactor 020 AI vehicle, objective and rivalry',()=>{
  it('allows two AI to race for the same empty motorcycle',()=>{
    const clock={value:10},room=makeRoom(clock),first=ai('ai-first',800,900),second=ai('ai-second',840,900),vehicle=bike('race-bike',980,900),drop=supply('supply-race',1900,900);
    room.state.players.set(first.id,first);room.state.players.set(second.id,second);room.state.motorcycles.set(vehicle.id,vehicle);room.state.supplyDrops.set(drop.id,drop);
    for(const p of [first,second]){
      const intent=room.newAiIntent(p);
      room.aiIntent.set(p.id,intent);
      room.aiWorldObjectives.set(p.id,{kind:'supply',id:drop.id,x:drop.x,y:drop.y,expiresAt:40});
      intent.state='SEEK_SUPPLY';intent.routeGoalX=drop.x;intent.routeGoalY=drop.y;
      expect(room.maybeStartAiVehiclePlan(p,intent)).toBe(true);
    }
    expect(room.aiVehiclePlans.get(first.id)?.vehicleId).toBe(vehicle.id);
    expect(room.aiVehiclePlans.get(second.id)?.vehicleId).toBe(vehicle.id);
    expect(vehicle.driverId).toBe('');
  });

  it('mounts the first arriving AI and produces server-authoritative driving input',()=>{
    const clock={value:10},room=makeRoom(clock),p=ai('ai-driver',180,200),vehicle=bike('drive-bike',200,200),drop=supply('supply-drive',1000,200);
    room.state.players.set(p.id,p);room.state.motorcycles.set(vehicle.id,vehicle);room.state.supplyDrops.set(drop.id,drop);
    const intent=room.newAiIntent(p);room.aiIntent.set(p.id,intent);
    room.aiWorldObjectives.set(p.id,{kind:'supply',id:drop.id,x:drop.x,y:drop.y,expiresAt:40});
    intent.state='SEEK_SUPPLY';intent.routeGoalX=drop.x;intent.routeGoalY=drop.y;
    expect(room.maybeStartAiVehiclePlan(p,intent)).toBe(true);
    expect(room.updateAiVehiclePlan(p,intent,.05)).toBe(true);
    expect(p.isDriving).toBe(true);expect(vehicle.driverId).toBe(p.id);
    clock.value+=.05;
    expect(room.updateAiVehiclePlan(p,intent,.05)).toBe(true);
    const input=room.inputs.get(p.id);
    expect(input).toBeDefined();
    expect(input.x).toBeGreaterThan(.5);
    expect(Math.abs(input.y)).toBeLessThan(.5);
  });

  it('dismounts near a supply, opens it and keeps the previous motorcycle for return',()=>{
    const clock={value:10},room=makeRoom(clock),p=ai('ai-supply',200,200),vehicle=bike('supply-bike',200,200),drop=supply('supply-open',330,200);
    room.state.players.set(p.id,p);room.state.motorcycles.set(vehicle.id,vehicle);room.state.supplyDrops.set(drop.id,drop);
    expect(room.mountMotorcycle(p,vehicle)).toBe(true);
    const intent=room.newAiIntent(p);room.aiIntent.set(p.id,intent);
    room.aiWorldObjectives.set(p.id,{kind:'supply',id:drop.id,x:drop.x,y:drop.y,expiresAt:40});
    room.aiVehiclePlans.set(p.id,{vehicleId:vehicle.id,preferredVehicleId:vehicle.id,phase:'drive',objectiveKind:'supply',objectiveId:drop.id,targetX:drop.x,targetY:drop.y,startedAt:10,expiresAt:40,avoidSign:1,stuckFor:0,reverseUntil:0,lastX:vehicle.x,lastY:vehicle.y});
    expect(room.updateAiVehiclePlan(p,intent,.05)).toBe(false);
    expect(p.isDriving).toBe(false);
    expect(room.aiVehiclePlans.get(p.id)?.phase).toBe('walk');
    p.x=drop.x-SUPPLY_DROP_BALANCE.interactionDistance/2;p.y=drop.y;
    room.handleAiWorldObjectiveAtPosition(p,intent);
    expect(drop.opened).toBe(true);
    expect(room.state.loot.size).toBeGreaterThan(0);
    expect(room.aiVehiclePlans.get(p.id)?.preferredVehicleId).toBe(vehicle.id);
  });

  it('lets an AI complete the altar ritual and automatically transform',()=>{
    const clock={value:20},room=makeRoom(clock),p=ai('ai-wolf',1600,1600);
    room.state.players.set(p.id,p);
    const intent=room.newAiIntent(p);room.aiIntent.set(p.id,intent);
    const season=room.state.werewolfSeason;season.enabled=true;season.altarPhase='active';season.altarX=p.x;season.altarY=p.y;
    room.aiWorldObjectives.set(p.id,{kind:'altar',id:'altar-0',x:p.x,y:p.y,expiresAt:50});
    expect(room.handleAiWorldObjectiveAtPosition(p,intent)).toBe(true);
    expect(p.werewolf.ritualizing).toBe(true);
    clock.value+=WEREWOLF_BALANCE.ritualSeconds+.01;
    room.updateWerewolfSeason(.01);
    expect(p.werewolf.hasCurse).toBe(true);
    room.updateAi(.05);
    expect(p.werewolf.transformPreparing).toBe(true);
    clock.value+=WEREWOLF_BALANCE.transformPrepareSeconds+.01;
    room.updateWerewolfSeason(.01);
    expect(p.werewolf.transformed).toBe(true);
    expect(season.werewolfPlayerId).toBe(p.id);
    expect(p.isDriving).toBe(false);
  });
});
