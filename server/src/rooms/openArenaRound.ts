// DROP8_REFACTOR_025_OPEN_ARENA_KILL_LIMIT_MATCH_CYCLE
export type OpenArenaRoundState='active'|'result'|'resetting';
export const OPEN_ARENA_ROUND_RESULT_SECONDS=5;
export const OPEN_ARENA_ROUND_COUNTDOWN_SECONDS=3;
export const OPEN_ARENA_ROUND_TOTAL_SECONDS=OPEN_ARENA_ROUND_RESULT_SECONDS+OPEN_ARENA_ROUND_COUNTDOWN_SECONDS;

export type ArenaScoreRow={id:string;name:string;ai:boolean;kills:number;deaths:number;kd:number;streak:number;bestStreak:number;humanKills:number;aiKills:number;damageDone:number;alive:boolean;reachedAt:number};
export function sortOpenArenaHumanRows(rows:ArenaScoreRow[]){
  return rows.filter((row)=>!row.ai).sort((a,b)=>b.kills-a.kills||b.humanKills-a.humanKills||a.deaths-b.deaths||b.damageDone-a.damageDone||a.reachedAt-b.reachedAt||a.name.localeCompare(b.name,'ko'));
}
export function shouldFinishOpenArenaRound(killLimit:number,row:Pick<ArenaScoreRow,'ai'|'kills'>){return !row.ai&&killLimit>0&&row.kills>=killLimit;}
