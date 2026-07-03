// DROP8_REFACTOR_024A_OPEN_ARENA_FOUNDATION
export type GameMode='battleRoyale'|'openArena';
export type OpenArenaLifecycle='active'|'emptyGrace'|'disposed';

export const OPEN_ARENA_LIMITS={
  minHumans:1,
  maxHumans:8,
  minAi:0,
  maxAi:12,
  defaultHumans:8,
  defaultAi:7,
  maxTotalCombatants:16,
} as const;

export interface OpenArenaConfig{
  maxHumans:number;
  configuredAiCount:number;
  maxTotalCombatants:number;
}

function finiteInteger(value:unknown,fallback:number){
  const parsed=typeof value==='number'?value:Number(value);
  return Number.isFinite(parsed)?Math.trunc(parsed):fallback;
}

export function normalizeGameMode(value:unknown):GameMode{
  return value==='openArena'?'openArena':'battleRoyale';
}

export function normalizeOpenArenaConfig(maxHumansValue:unknown,aiCountValue:unknown):OpenArenaConfig{
  const maxHumans=Math.max(OPEN_ARENA_LIMITS.minHumans,Math.min(OPEN_ARENA_LIMITS.maxHumans,finiteInteger(maxHumansValue,OPEN_ARENA_LIMITS.defaultHumans)));
  const configuredAiCount=Math.max(OPEN_ARENA_LIMITS.minAi,Math.min(OPEN_ARENA_LIMITS.maxAi,finiteInteger(aiCountValue,OPEN_ARENA_LIMITS.defaultAi)));
  if(maxHumans+configuredAiCount>OPEN_ARENA_LIMITS.maxTotalCombatants){
    throw new Error(`인간과 AI를 합친 최대 전투 인원은 ${OPEN_ARENA_LIMITS.maxTotalCombatants}명입니다.`);
  }
  return{maxHumans,configuredAiCount,maxTotalCombatants:OPEN_ARENA_LIMITS.maxTotalCombatants};
}
