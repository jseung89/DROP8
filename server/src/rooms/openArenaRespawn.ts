// DROP8_REFACTOR_024C_OPEN_ARENA_RESPAWN
export type ArenaPoint={x:number;y:number};
export type ArenaThreat=ArenaPoint&{alive:boolean};
export type RecentArenaSpawn=ArenaPoint&{at:number};

export interface OpenArenaAiSlot{
  slotId:string;
  playerId:string;
  personaName:string;
  state:'alive'|'respawnWait';
  respawnAt:number;
  generation:number;
}

export function openArenaSpawnScore(
  point:ArenaPoint,
  threats:ArenaThreat[],
  recent:RecentArenaSpawn[],
  now:number,
  hasLineOfSight:(from:ArenaPoint,to:ArenaPoint)=>boolean,
){
  let nearest=Number.POSITIVE_INFINITY;
  let visibleThreats=0;
  for(const threat of threats){
    if(!threat.alive)continue;
    const d=Math.hypot(point.x-threat.x,point.y-threat.y);
    nearest=Math.min(nearest,d);
    if(d<900&&hasLineOfSight(threat,point))visibleThreats++;
  }
  const nearestScore=!Number.isFinite(nearest)?55:Math.min(55,nearest/12);
  const recentPenalty=recent.reduce((sum,item)=>sum+(now-item.at<8&&Math.hypot(point.x-item.x,point.y-item.y)<220?28:0),0);
  return nearestScore-visibleThreats*34-recentPenalty;
}

export function chooseOpenArenaSpawn(
  candidates:ArenaPoint[],
  threats:ArenaThreat[],
  recent:RecentArenaSpawn[],
  now:number,
  valid:(point:ArenaPoint)=>boolean,
  hasLineOfSight:(from:ArenaPoint,to:ArenaPoint)=>boolean,
):ArenaPoint|undefined{
  let best:ArenaPoint|undefined;
  let bestScore=-Infinity;
  for(const candidate of candidates){
    if(!valid(candidate))continue;
    const score=openArenaSpawnScore(candidate,threats,recent,now,hasLineOfSight);
    if(score>bestScore){best=candidate;bestScore=score;}
  }
  return best;
}
