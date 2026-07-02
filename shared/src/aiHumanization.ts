// DROP8_REFACTOR_019_AI_HUMANIZATION
export type AiAwarenessState='calm'|'alert'|'combat';
export type AiDialogueCategory='contact'|'uncertain'|'lost'|'reload'|'retreat'|'heal'|'exit'|'stuck'|'vehicle'|'danger'|'response';
export type AiDialogueLineId=
  |'contact_enemy'|'contact_front'|'contact_entrance'|'contact_window'|'uncertain_bush'|'uncertain_sound'|'uncertain_steps'
  |'lost_target'|'lost_last_seen'|'lost_bush'|'lost_building'|'reload_now'|'reload_empty'|'retreat_hurt'|'retreat_back'
  |'heal_need'|'exit_clear'|'exit_outside'|'stuck_blocked'|'vehicle_heard'|'danger_bazooka'|'danger_flame'|'danger_sniper'
  |'response_checking'|'response_other_side';

export const AI_DIALOGUE_LINES:Record<AiDialogueLineId,string>={
  contact_enemy:'적 발견!',contact_front:'정면에 한 명!',contact_entrance:'건물 입구 쪽이야!',contact_window:'창문에 있다!',
  uncertain_bush:'수풀 쪽에 움직임이 있어.',uncertain_sound:'총소리 방향 확인해.',uncertain_steps:'발소리 들었어.',
  lost_target:'놓쳤어.',lost_last_seen:'마지막으로 저쪽에서 봤어.',lost_bush:'수풀로 들어갔다.',lost_building:'건물 안으로 숨었어.',
  reload_now:'재장전!',reload_empty:'탄창 빈다!',retreat_hurt:'나 많이 맞았어.',retreat_back:'잠깐 빠질게.',heal_need:'회복할 시간이 필요해.',
  exit_clear:'여긴 다 봤어.',exit_outside:'밖으로 나가자.',stuck_blocked:'길이 막혔어, 돌아가.',vehicle_heard:'오토바이 소리야.',
  danger_bazooka:'바주카다, 흩어져!',danger_flame:'화염방사기다, 거리 벌려!',danger_sniper:'저격수야, 엄폐해!',
  response_checking:'확인해볼게.',response_other_side:'반대편을 확인할게.',
};

export const AI_HUMANIZATION={
  baseVisionDistance:950,
  visionDistance:{calm:.65,alert:.80,combat:.95},
  visionFovDegrees:{calm:100,alert:140,combat:170},
  indoorVisionMultiplier:.68,
  hiddenBushDistance:150,
  targetMemorySeconds:4.5,
  searchSeconds:[3.2,5.0] as const,
  visualRefreshSeconds:.10,
  hearingMemorySeconds:4.5,
  dialogueRadius:620,
  tacticalDialogueCooldown:[3,5] as const,
  casualDialogueCooldown:[10,20] as const,
  repeatedLineCooldown:30,
  globalDialogueCooldown:1.6,
  roomIdleSeconds:3,
  buildingDwellSeconds:[10,15] as const,
  unstuckStageSeconds:[.9,1.8,3] as const,
} as const;

export function wrapAngle(value:number){return Math.atan2(Math.sin(value),Math.cos(value));}
export function angleDistance(a:number,b:number){return Math.abs(wrapAngle(a-b));}
export function turnAngleToward(current:number,target:number,maxStep:number){return current+Math.max(-maxStep,Math.min(maxStep,wrapAngle(target-current)));}
export function aiVisionDistance(state:AiAwarenessState,indoors:boolean,focus=1){const base=AI_HUMANIZATION.baseVisionDistance*AI_HUMANIZATION.visionDistance[state]*Math.max(.85,Math.min(1.12,focus));return base*(indoors?AI_HUMANIZATION.indoorVisionMultiplier:1);}
export function aiVisionFovRadians(state:AiAwarenessState,focus=1){return AI_HUMANIZATION.visionFovDegrees[state]*Math.PI/180*Math.max(.9,Math.min(1.08,focus));}
export function aiReactionDelaySeconds(distance:number,sideAngle:number,reacquire:boolean,reactionSkill:number,randomUnit=.5){let base=distance<220?.34:distance<520?.52:.68;if(sideAngle>Math.PI*.72)base+=.48;else if(sideAngle>Math.PI*.38)base+=.24;if(reacquire)base-=.12;base*=1.18-Math.max(0,Math.min(1,reactionSkill))*.35;return Math.max(.22,base+(randomUnit-.5)*.18);}
export function aiAimErrorPixels(distance:number,movementRatio:number,accuracy:number,weaponId:string){const distanceBase=distance<220?11:distance<560?25:47;const movement=1+Math.max(0,Math.min(1,movementRatio))*1.05;const weapon=weaponId==='sniper'||weaponId==='bazooka'||weaponId==='silver_crossbow'?1.25:weaponId==='smg'?.92:1;return distanceBase*movement*weapon*(1.45-Math.max(0,Math.min(1,accuracy))*.75);}
export function aiBurstSpec(weaponId:string){
  if(weaponId==='rifle')return{min:3,max:6,pauseMin:.25,pauseMax:.5};
  if(weaponId==='smg')return{min:5,max:10,pauseMin:.22,pauseMax:.42};
  if(weaponId==='pistol')return{min:2,max:4,pauseMin:.28,pauseMax:.52};
  if(weaponId==='shotgun')return{min:1,max:1,pauseMin:.32,pauseMax:.58};
  if(weaponId==='sniper')return{min:1,max:1,pauseMin:.8,pauseMax:1.25};
  if(weaponId==='bazooka')return{min:1,max:1,pauseMin:.85,pauseMax:1.2};
  if(weaponId==='silver_crossbow')return{min:1,max:2,pauseMin:.42,pauseMax:.7};
  return{min:3,max:6,pauseMin:.25,pauseMax:.5};
}
export function aiSoundErrorRadius(distance:number){return distance<280?75:distance<650?140:235;}
export function decayAiConfidence(confidence:number,elapsedSeconds:number,source:'visual'|'sound'|'voice'){const rate=source==='visual'?18:source==='sound'?24:30;return Math.max(0,confidence-elapsedSeconds*rate);}
