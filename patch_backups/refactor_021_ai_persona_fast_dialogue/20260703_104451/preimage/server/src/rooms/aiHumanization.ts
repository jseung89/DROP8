// DROP8_REFACTOR_019_AI_HUMANIZATION
import { AI_HUMANIZATION, aiAimErrorPixels, aiBurstSpec, aiReactionDelaySeconds, aiSoundErrorRadius, type AiAwarenessState, type AiDialogueLineId, type Difficulty } from '@drop8/shared';

export type AiPersonality='aggressive'|'cautious'|'support'|'scavenger'|'driver';
export type AiSoundKind='gun'|'footstep'|'running'|'vehicle'|'explosion'|'flame'|'adhesive'|'voice';
export type AiKnowledgeSource='none'|'visual'|'sound'|'voice'|'damage';
export interface AiPersonalityProfile{personality:AiPersonality;reaction:number;accuracy:number;focus:number;aggression:number;riskAvoidance:number;coverPreference:number;cooperation:number;vehicleSkill:number;lootPreference:number;talkativeness:number;turnRate:number;}
export interface AiHumanMemory{
  targetId:string;source:AiKnowledgeSource;confidence:number;targetVisible:boolean;nextVisionCheckAt:number;targetAcquiredAt:number;reactionReadyAt:number;
  lastSeenX:number;lastSeenY:number;lastSeenAt:number;lastSeenVx:number;lastSeenVy:number;previousSeenX:number;previousSeenY:number;previousSeenAt:number;searchUntil:number;
  heardX:number;heardY:number;heardAt:number;heardKind:AiSoundKind;heardEventId:string;
  aimOffsetX:number;aimOffsetY:number;aimRefreshAt:number;burstRemaining:number;burstCooldownUntil:number;lastWeapon:string;
  buildingId:string;roomIndex:number;buildingEnteredAt:number;roomEnteredAt:number;visitedRooms:Set<string>;exitRequestedAt:number;
  lastDialogueAt:number;lastCasualDialogueAt:number;lastLineId:string;lastLineAt:number;unstuckStage:number;lastThreatAt:number;
}

function hashText(value:string){let hash=2166136261>>>0;for(const char of value){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)>>>0;}return hash>>>0;}
export function deterministicUnit(key:string,salt=0){let x=(hashText(key)^Math.imul(salt+1,2654435761))>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967295;}
export function createAiProfile(id:string,difficulty:Difficulty):AiPersonalityProfile{
  const types:AiPersonality[]=['aggressive','cautious','support','scavenger','driver'];const personality=types[Math.floor(deterministicUnit(id,1)*types.length)]!;
  const difficultySkill=difficulty==='hard'?.72:difficulty==='easy'?.38:.55;const jitter=(salt:number)=>(deterministicUnit(id,salt)-.5)*.28;
  const profile:AiPersonalityProfile={personality,reaction:Math.max(.18,Math.min(.9,difficultySkill+jitter(2))),accuracy:Math.max(.18,Math.min(.9,difficultySkill+jitter(3))),focus:1+jitter(4)*.35,aggression:.5+jitter(5),riskAvoidance:.5+jitter(6),coverPreference:.5+jitter(7),cooperation:.5+jitter(8),vehicleSkill:.5+jitter(9),lootPreference:.5+jitter(10),talkativeness:.5+jitter(11),turnRate:2.4+difficultySkill*1.8+jitter(12)};
  if(personality==='aggressive'){profile.aggression+=.25;profile.riskAvoidance-=.18;profile.reaction+=.08;}
  if(personality==='cautious'){profile.coverPreference+=.25;profile.riskAvoidance+=.24;profile.aggression-=.16;}
  if(personality==='support'){profile.cooperation+=.3;profile.talkativeness+=.18;}
  if(personality==='scavenger'){profile.lootPreference+=.3;profile.aggression-=.1;}
  if(personality==='driver'){profile.vehicleSkill+=.32;profile.aggression+=.05;}
  for(const key of ['reaction','accuracy','aggression','riskAvoidance','coverPreference','cooperation','vehicleSkill','lootPreference','talkativeness'] as const)profile[key]=Math.max(.08,Math.min(.95,profile[key]));
  return profile;
}
export function createAiMemory(x:number,y:number,buildingId='',roomIndex=0,now=0):AiHumanMemory{return{targetId:'',source:'none',confidence:0,targetVisible:false,nextVisionCheckAt:0,targetAcquiredAt:0,reactionReadyAt:0,lastSeenX:x,lastSeenY:y,lastSeenAt:0,lastSeenVx:0,lastSeenVy:0,previousSeenX:x,previousSeenY:y,previousSeenAt:0,searchUntil:0,heardX:x,heardY:y,heardAt:0,heardKind:'footstep',heardEventId:'',aimOffsetX:0,aimOffsetY:0,aimRefreshAt:0,burstRemaining:0,burstCooldownUntil:0,lastWeapon:'',buildingId,roomIndex,buildingEnteredAt:now,roomEnteredAt:now,visitedRooms:new Set(buildingId?[`${buildingId}:${roomIndex}`]:[]),exitRequestedAt:0,lastDialogueAt:-99,lastCasualDialogueAt:-99,lastLineId:'',lastLineAt:-99,unstuckStage:0,lastThreatAt:-99};}
export function refreshAiAim(memory:AiHumanMemory,profile:AiPersonalityProfile,key:string,now:number,distance:number,movementRatio:number,weaponId:string){if(now<memory.aimRefreshAt&&memory.lastWeapon===weaponId)return;const radius=aiAimErrorPixels(distance,movementRatio,profile.accuracy,weaponId);const angle=deterministicUnit(key,Math.floor(now*4)+17)*Math.PI*2;const magnitude=radius*(.35+deterministicUnit(key,Math.floor(now*5)+29)*.65);memory.aimOffsetX=Math.cos(angle)*magnitude;memory.aimOffsetY=Math.sin(angle)*magnitude;memory.aimRefreshAt=now+.3+deterministicUnit(key,Math.floor(now*3)+41)*.3;memory.lastWeapon=weaponId;}
export function prepareAiReaction(memory:AiHumanMemory,profile:AiPersonalityProfile,key:string,now:number,distance:number,sideAngle:number,reacquire:boolean){memory.targetAcquiredAt=now;memory.reactionReadyAt=now+aiReactionDelaySeconds(distance,sideAngle,reacquire,profile.reaction,deterministicUnit(key,Math.floor(now*10)+53));memory.burstRemaining=0;memory.burstCooldownUntil=Math.max(memory.burstCooldownUntil,memory.reactionReadyAt);}
export function prepareAiBurst(memory:AiHumanMemory,key:string,weaponId:string,now:number){const spec=aiBurstSpec(weaponId);if(memory.burstRemaining<=0&&now>=memory.burstCooldownUntil){memory.burstRemaining=spec.min+Math.floor(deterministicUnit(key,Math.floor(now*7)+67)*(spec.max-spec.min+1));}return spec;}
export function finishAiBurstShot(memory:AiHumanMemory,key:string,weaponId:string,now:number){const spec=aiBurstSpec(weaponId);memory.burstRemaining=Math.max(0,memory.burstRemaining-1);if(memory.burstRemaining===0)memory.burstCooldownUntil=now+spec.pauseMin+deterministicUnit(key,Math.floor(now*11)+79)*(spec.pauseMax-spec.pauseMin);}
export function estimateSoundPoint(listenerId:string,eventId:string,x:number,y:number,distance:number){const error=aiSoundErrorRadius(distance);const angle=deterministicUnit(listenerId+eventId,83)*Math.PI*2;const magnitude=error*(.35+deterministicUnit(listenerId+eventId,89)*.65);return{x:x+Math.cos(angle)*magnitude,y:y+Math.sin(angle)*magnitude};}
export function pickDialogue(category:string,key:string,salt:number):AiDialogueLineId{const table:Record<string,AiDialogueLineId[]>={contact:['contact_enemy','contact_front','contact_entrance','contact_window'],uncertain:['uncertain_bush','uncertain_sound','uncertain_steps'],lost:['lost_target','lost_last_seen','lost_bush','lost_building'],reload:['reload_now','reload_empty'],retreat:['retreat_hurt','retreat_back'],heal:['heal_need'],exit:['exit_clear','exit_outside'],stuck:['stuck_blocked'],vehicle:['vehicle_heard'],danger:['danger_bazooka','danger_flame','danger_sniper'],response:['response_checking','response_other_side']};const candidates=table[category]??table.uncertain!;return candidates[Math.floor(deterministicUnit(key,salt)*candidates.length)]!;}
export function awarenessForState(state:string,hasMemory:boolean):AiAwarenessState{return['ENGAGE','DEFEND','RETREAT','BAZOOKA_SAFE_DISTANCE'].includes(state)?'combat':hasMemory||['INVESTIGATE','SEARCH_LAST_SEEN','REPOSITION','TAKE_COVER','RELOAD'].includes(state)?'alert':'calm';}
export { AI_HUMANIZATION };
