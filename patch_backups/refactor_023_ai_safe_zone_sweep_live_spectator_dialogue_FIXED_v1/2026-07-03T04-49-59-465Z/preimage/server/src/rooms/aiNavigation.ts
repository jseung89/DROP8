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
