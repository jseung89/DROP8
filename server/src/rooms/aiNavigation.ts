// DROP8_REFACTOR_023_AI_SAFE_ZONE_SWEEP_LIVE_SPECTATOR_DIALOGUE
// DROP8_REFACTOR_022_AI_NAVIGATION_TACTICAL_RECOVERY
export type AiGoalKind='none'|'hazard'|'swim-exit'|'zone'|'heal'|'combat'|'search'|'sound'|'objective'|'loot'|'patrol'|'escape';
export type AiProgressSample={x:number;y:number;goalDistance:number;at:number};

export const AI_NAVIGATION_RECOVERY={
  progressSampleSeconds:.25,
  minimumActualMove:.7,
  minimumGoalGain:.22,
  healthyGoalGain:1.35,
  oscillationStallSeconds:1.15,
  failedGoalCooldownSeconds:2.2,
  failedShoreExitCooldownSeconds:2.8,
  swimExitLockSeconds:2.4,
  blockedCombatRepathSeconds:.38,
  blockedCombatGiveUpSeconds:1.35,
  waterProbeStep:34,
  voluntarySwimPenalty:620,
} as const;

const GOAL_PRIORITY:Record<AiGoalKind,number>={none:0,patrol:10,loot:25,sound:35,objective:45,search:55,combat:70,heal:78,escape:82,zone:90,'swim-exit':95,hazard:100};
export function aiGoalPriority(kind:AiGoalKind){return GOAL_PRIORITY[kind];}

export function canReplaceAiGoal(currentKind:AiGoalKind,currentKey:string,lockedUntil:number,nextKind:AiGoalKind,nextKey:string,now:number,force=false){
  if(force||currentKind==='none'||currentKey===nextKey||now>=lockedUntil)return true;
  return aiGoalPriority(nextKind)>aiGoalPriority(currentKind);
}

export function nextAiStallSeconds(current:number,dt:number,actualMove:number,waypointGain:number,goalGain:number){
  const makingProgress=Math.max(waypointGain,goalGain)>=AI_NAVIGATION_RECOVERY.minimumGoalGain;
  const physicallyMoving=actualMove>=AI_NAVIGATION_RECOVERY.minimumActualMove;
  if(makingProgress)return Math.max(0,current-dt*3.2);
  if(physicallyMoving)return current+dt*.78;
  return current+dt;
}

export function pushAiProgressSample(samples:readonly AiProgressSample[],sample:AiProgressSample,max=8){
  const next=[...samples,sample];
  return next.length>max?next.slice(next.length-max):next;
}

function pointDistance(a:AiProgressSample,b:AiProgressSample){return Math.hypot(a.x-b.x,a.y-b.y);}
export function detectAiOscillation(samples:readonly AiProgressSample[]){
  if(samples.length<6)return false;
  const recent=samples.slice(-6),travel=recent.slice(1).reduce((sum,item,index)=>sum+pointDistance(recent[index]!,item),0),displacement=pointDistance(recent[0]!,recent.at(-1)!);
  const alternating=pointDistance(recent[0]!,recent[2]!)<34&&pointDistance(recent[1]!,recent[3]!)<34&&pointDistance(recent[2]!,recent[4]!)<34&&pointDistance(recent[3]!,recent[5]!)<34&&pointDistance(recent[0]!,recent[1]!)>24;
  const goalImprovement=recent[0]!.goalDistance-recent.at(-1)!.goalDistance;
  return alternating||(travel>145&&displacement<52&&goalImprovement<28);
}


export const AI_SAFE_ZONE_SWEEP={
  targetLifetimeSeconds:8,
  arrivalDistance:92,
  routeCorridorDistance:170,
  routeDetourDistance:260,
  urgentRouteCorridorDistance:260,
  urgentRouteDetourDistance:430,
} as const;

export type AiSweepZone={active:boolean;centerX:number;centerY:number;radius:number;signature:string};
export type AiSweepTarget={x:number;y:number;sector:number;clockwise:-1|1;generation:number;key:string};
export type AiSweepDetourMetrics={corridorDistance:number;extraDistance:number};
export type AiDialogueAudience='player'|'spectator'|'none';

function stableHash(value:string){
  let hash=2166136261;
  for(const char of value){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}

function clampNumber(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}

export function createAiSafeZoneSweepTarget(input:{aiId:string;x:number;y:number;worldSize:number;generation:number;zone:AiSweepZone}):AiSweepTarget{
  const hash=stableHash(input.aiId),sector=((hash>>>5)%5)-2,clockwise:1|-1=((hash>>>11)&1)===0?1:-1;
  const margin=28,generation=Math.max(1,Math.floor(input.generation));
  let x:number,y:number;
  if(input.zone.active){
    const cx=input.zone.centerX,cy=input.zone.centerY,radius=Math.max(220,input.zone.radius),fromCenter=Math.atan2(input.y-cy,input.x-cx),centerDistance=Math.hypot(input.x-cx,input.y-cy);
    if(centerDistance>radius*.42){
      const towardCenter=Math.atan2(cy-input.y,cx-input.x),laneAngle=towardCenter+sector*.105+clockwise*.055;
      const step=clampNumber(Math.max(480,centerDistance*.68),480,Math.min(940,radius*.72));
      const lateral=sector*42;
      x=input.x+Math.cos(laneAngle)*step-Math.sin(laneAngle)*lateral;
      y=input.y+Math.sin(laneAngle)*step+Math.cos(laneAngle)*lateral;
    }else{
      const ring=radius*(.27+((hash>>>16)%18)/100),arc=.72+(generation%4)*.12;
      const angle=fromCenter+clockwise*arc+sector*.08;
      x=cx+Math.cos(angle)*ring;
      y=cy+Math.sin(angle)*ring;
    }
    const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy),limit=Math.max(180,radius*.72);
    if(d>limit){x=cx+dx/d*limit;y=cy+dy/d*limit;}
  }else{
    const angle=((hash%360)/180)*Math.PI+clockwise*(generation-1)*.38+sector*.09;
    const step=680+((hash>>>18)%220);
    x=input.x+Math.cos(angle)*step;
    y=input.y+Math.sin(angle)*step;
  }
  x=clampNumber(x,margin,input.worldSize-margin);y=clampNumber(y,margin,input.worldSize-margin);
  return{x,y,sector,clockwise,generation,key:`safe-sweep:${input.zone.signature}:${sector}:${generation}`};
}

export function aiSweepDetourMetrics(start:{x:number;y:number},goal:{x:number;y:number},item:{x:number;y:number}):AiSweepDetourMetrics{
  const vx=goal.x-start.x,vy=goal.y-start.y,lengthSq=vx*vx+vy*vy;
  const t=lengthSq>0?clampNumber(((item.x-start.x)*vx+(item.y-start.y)*vy)/lengthSq,0,1):0;
  const px=start.x+vx*t,py=start.y+vy*t;
  const corridorDistance=Math.hypot(item.x-px,item.y-py);
  const direct=Math.hypot(vx,vy),via=Math.hypot(item.x-start.x,item.y-start.y)+Math.hypot(goal.x-item.x,goal.y-item.y);
  return{corridorDistance,extraDistance:Math.max(0,via-direct)};
}

export function shouldTakeAiSweepLoot(metrics:AiSweepDetourMetrics,urgent=false){
  const corridor=urgent?AI_SAFE_ZONE_SWEEP.urgentRouteCorridorDistance:AI_SAFE_ZONE_SWEEP.routeCorridorDistance;
  const detour=urgent?AI_SAFE_ZONE_SWEEP.urgentRouteDetourDistance:AI_SAFE_ZONE_SWEEP.routeDetourDistance;
  return metrics.corridorDistance<=corridor&&metrics.extraDistance<=detour;
}

export function aiDialogueAudience(listener:{alive:boolean;phase:string}|undefined,distanceToSpeaker:number,radius:number):AiDialogueAudience{
  if(!listener)return'none';
  if(listener.alive)return distanceToSpeaker<=radius?'player':'none';
  return listener.phase==='dead'?'spectator':'none';
}
