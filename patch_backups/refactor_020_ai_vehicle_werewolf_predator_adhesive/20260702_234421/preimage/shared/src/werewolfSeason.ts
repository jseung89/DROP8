// DROP8_REFACTOR_018_WEREWOLF_SEASON
import type { MapConfig, MapId, Rect } from './index.js';

export type WerewolfAltarPhase='dormant'|'active'|'claimed'|'recharging'|'disabled';
export type WerewolfEndReason='expired'|'death'|'disconnect'|'round_end';
export type WerewolfPointPurpose='altar'|'armory';
export type SeasonPoint={x:number;y:number};

export const WEREWOLF_BALANCE={
  altarWakeSeconds:15,ritualSeconds:3,ritualRadius:86,ritualMoveTolerance:10,
  curseUseSeconds:30,curseMinimumTransferSeconds:10,transformPrepareSeconds:1.2,transformDurationSeconds:30,
  baseSpeedMultiplier:1.10,sprintSpeedMultiplier:1.40,indoorSpeedCap:410,sprintSeconds:4,sprintRechargeSeconds:5,sprintRechargeDelaySeconds:.6,sprintSteeringMultiplier:.80,
  clawDamage:34,clawCooldownSeconds:.65,clawRange:92,clawHalfAngleRadians:50*Math.PI/180,
  bulletDamageMultiplier:.25,explosionDamageMultiplier:.40,otherDamageMultiplier:.20,explosionKnockbackMultiplier:.50,
  huntVehicleDamage:8,huntMarkSeconds:2.5,huntDismountImmunitySeconds:2,huntDriverLockSeconds:.6,huntAttackRecoverySeconds:.4,
  silverBoltDamage:20,silverBoltHumanDamage:14,silverSlowSeconds:2.5,silverSlowMultiplier:.55,
  rechargeSeconds:10,initialSilverBolts:6,rechargeSilverBolts:3,maxWorldSilverBolts:12,
  altarEdgeMargin:260,pointObstacleClearance:72,pointSpawnClearance:260,pointMotorcycleClearance:220,pointBushClearance:90,
} as const;

export const SILVER_CROSSBOW_BALANCE={magazine:4,reloadSeconds:1.35,fireInterval:.42,projectileSpeed:2100,range:1050,moveMultiplier:.96,maxReserve:10} as const;

export const WEREWOLF_ALTAR_CANDIDATES:Record<MapId,readonly SeasonPoint[]>={
  small:[{x:2688,y:384},{x:672,y:1248},{x:2016,y:1440},{x:576,y:2304},{x:3264,y:2304},{x:2688,y:3456}],
  large:[{x:1920,y:896},{x:4224,y:1152},{x:2304,y:2944},{x:3968,y:3968},{x:1152,y:3584},{x:3968,y:5120}],
  dock8:[{x:2592,y:720},{x:6624,y:2736},{x:2736,y:2016},{x:2304,y:3600},{x:5472,y:4608},{x:4320,y:5472}],
};

export const SILVER_ARMORY_CANDIDATES:Record<MapId,readonly SeasonPoint[]>={
  small:[{x:2688,y:1152},{x:3360,y:1248},{x:1440,y:2112},{x:2112,y:2400},{x:864,y:3552},{x:1920,y:3744}],
  large:[{x:3328,y:1792},{x:2048,y:4096},{x:2432,y:1920},{x:4096,y:2560},{x:1536,y:5120},{x:5504,y:1792}],
  dock8:[{x:6624,y:3888},{x:2592,y:4752},{x:720,y:3888},{x:4752,y:6624},{x:1584,y:2736},{x:1296,y:6048}],
};

export const WEREWOLF_MIN_ALTAR_ARMORY_DISTANCE:Record<MapId,number>={small:900,large:1400,dock8:1600};

function circleRectDistance(x:number,y:number,rect:Rect){const nx=Math.max(rect.x,Math.min(rect.x+rect.w,x)),ny=Math.max(rect.y,Math.min(rect.y+rect.h,y));return Math.hypot(x-nx,y-ny);}

export function seasonPointStructurallyValid(map:MapConfig,point:SeasonPoint,terrainKind:string,outdoors:boolean){
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
  const m=WEREWOLF_BALANCE.altarEdgeMargin;
  if(point.x<m||point.y<m||point.x>map.width-m||point.y>map.height-m)return false;
  if(!outdoors||terrainKind!=='land')return false;
  if(map.collisionObstacles.some((rect)=>circleRectDistance(point.x,point.y,rect)<WEREWOLF_BALANCE.pointObstacleClearance))return false;
  if(map.bushes.some((b)=>Math.hypot(point.x-b.x,point.y-b.y)<b.radius+WEREWOLF_BALANCE.pointBushClearance))return false;
  if(map.motorcycleSpawns.some((s)=>Math.hypot(point.x-s.x,point.y-s.y)<WEREWOLF_BALANCE.pointMotorcycleClearance))return false;
  if(map.emergencySpawnPoints.some((s)=>Math.hypot(point.x-s.x,point.y-s.y)<WEREWOLF_BALANCE.pointSpawnClearance))return false;
  return true;
}

export function chooseWerewolfSeasonPoints(mapId:MapId,random:()=>number,valid:(p:SeasonPoint,purpose:WerewolfPointPurpose)=>boolean){
  const altars=WEREWOLF_ALTAR_CANDIDATES[mapId].filter((p)=>valid(p,'altar'));
  if(!altars.length)return undefined;
  const altar=altars[Math.floor(random()*altars.length)]!;
  const armories=SILVER_ARMORY_CANDIDATES[mapId].filter((p)=>valid(p,'armory')&&Math.hypot(p.x-altar.x,p.y-altar.y)>=WEREWOLF_MIN_ALTAR_ARMORY_DISTANCE[mapId]);
  if(!armories.length)return undefined;
  const armory=armories[Math.floor(random()*armories.length)]!;
  return{altar,armory};
}

export function werewolfSpeed(baseMotorcycleSpeed:number,sprinting:boolean,indoors:boolean,silverSlowed:boolean){
  const raw=baseMotorcycleSpeed*(sprinting?WEREWOLF_BALANCE.sprintSpeedMultiplier:WEREWOLF_BALANCE.baseSpeedMultiplier)*(silverSlowed?WEREWOLF_BALANCE.silverSlowMultiplier:1);
  return indoors?Math.min(WEREWOLF_BALANCE.indoorSpeedCap,raw):raw;
}

export function werewolfDamage(amount:number,kind:'bullet'|'explosion'|'silver'|'other'){
  if(kind==='silver')return WEREWOLF_BALANCE.silverBoltDamage;
  if(kind==='bullet')return amount*WEREWOLF_BALANCE.bulletDamageMultiplier;
  if(kind==='explosion')return amount*WEREWOLF_BALANCE.explosionDamageMultiplier;
  return amount*WEREWOLF_BALANCE.otherDamageMultiplier;
}
