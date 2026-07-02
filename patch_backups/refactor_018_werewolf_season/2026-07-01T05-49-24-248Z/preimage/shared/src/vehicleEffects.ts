// DROP8_REFACTOR_017_ADHESIVE_STRIP_LOBBY_BAZOOKA_WATER
export type VehicleSlowKind='adhesive'|'strip_trap';

export interface VehicleSlowProfile{
  speedMultiplier:number;
  accelerationMultiplier:number;
  steeringMultiplier:number;
  durationSeconds:number;
}

export interface VehicleSlowEffect extends VehicleSlowProfile{
  kind:VehicleSlowKind;
  sourceId:string;
  startedAt:number;
  expiresAt:number;
  maxExpiresAt:number;
}

export interface VehicleSlowAggregate{
  kind:''|VehicleSlowKind|'mixed';
  speedMultiplier:number;
  accelerationMultiplier:number;
  steeringMultiplier:number;
  expiresAt:number;
}

export const ADHESIVE_SPRAYER_BALANCE={
  range:315,
  halfAngleRadians:21*Math.PI/180,
  tickSeconds:.10,
  exposureThresholdSeconds:.35,
  exposureBreakSeconds:.20,
  magazine:80,
  chargePerTick:1,
  chargePickupAmount:40,
  maxChargeReserve:160,
  visualDurationSeconds:.18,
  muzzleOffset:34,
  motorcycle:{speedMultiplier:.55,accelerationMultiplier:.40,steeringMultiplier:.75,durationSeconds:4,maxDurationSeconds:6},
  otherVehicle:{speedMultiplier:.75,accelerationMultiplier:.65,steeringMultiplier:.90,durationSeconds:3,maxDurationSeconds:4.5},
} as const;

export const STRIP_TRAP_VEHICLE_PROFILE={
  motorcycle:{speedMultiplier:.38,accelerationMultiplier:.28,steeringMultiplier:.60,durationSeconds:5.5},
  otherVehicle:{speedMultiplier:.60,accelerationMultiplier:.45,steeringMultiplier:.80,durationSeconds:4},
} as const;

export const VEHICLE_MIN_SPEED_MULTIPLIER=.30;

export function coneContains(
  sourceX:number,sourceY:number,angle:number,range:number,halfAngleRadians:number,
  targetX:number,targetY:number,targetRadius=0,
){
  const dx=targetX-sourceX,dy=targetY-sourceY,distance=Math.hypot(dx,dy);
  if(distance>range+targetRadius)return false;
  if(distance<=targetRadius+1)return true;
  const targetAngle=Math.atan2(dy,dx);
  const delta=Math.abs(Math.atan2(Math.sin(targetAngle-angle),Math.cos(targetAngle-angle)));
  return delta<=halfAngleRadians+Math.asin(Math.min(1,targetRadius/Math.max(1,distance)));
}

export function aggregateVehicleSlowEffects(effects:readonly VehicleSlowEffect[],now:number):VehicleSlowAggregate{
  const active=effects.filter((effect)=>Number.isFinite(effect.expiresAt)&&effect.expiresAt>now);
  if(!active.length)return{kind:'',speedMultiplier:1,accelerationMultiplier:1,steeringMultiplier:1,expiresAt:0};
  const kinds=new Set(active.map((effect)=>effect.kind));
  return{
    kind:kinds.size>1?'mixed':active[0]!.kind,
    speedMultiplier:Math.max(VEHICLE_MIN_SPEED_MULTIPLIER,Math.min(...active.map((effect)=>effect.speedMultiplier))),
    accelerationMultiplier:Math.min(...active.map((effect)=>effect.accelerationMultiplier)),
    steeringMultiplier:Math.min(...active.map((effect)=>effect.steeringMultiplier)),
    expiresAt:Math.max(...active.map((effect)=>effect.expiresAt)),
  };
}
