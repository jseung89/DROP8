// DROP8_REFACTOR_023_AI_SAFE_ZONE_SWEEP_LIVE_SPECTATOR_DIALOGUE
import { describe,expect,it } from 'vitest';
import { MAP_CONFIGS } from '@drop8/shared';
import { AI_SAFE_ZONE_SWEEP,aiSweepDetourMetrics,createAiSafeZoneSweepTarget,shouldTakeAiSweepLoot } from '../src/rooms/aiNavigation.js';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { PlayerState } from '../src/rooms/schema.js';

function makeAi(id:string,x:number,y:number){const p=new PlayerState();p.id=id;p.name=`AI-${id}`;p.ai=true;p.alive=true;p.phase='landed';p.x=x;p.y=y;p.hp=100;p.primary='rifle';p.equipped='rifle';p.rifleMagazine=20;return p;}
function setupRoom(){const room=new Drop8Room() as any;room.state.mapId='dock8';room.state.mapSizeMode='dock8';room.state.worldSize=MAP_CONFIGS.dock8.width;room.state.phase='ACTIVE';room.state.zoneActive=true;room.state.zoneStage=2;room.state.zoneState='WAITING';room.state.zoneX=3600;room.state.zoneY=3600;room.state.zoneRadius=1800;room.state.nextZoneX=3900;room.state.nextZoneY=3500;room.state.nextZoneRadius=1250;return room;}

describe('Refactor 023 AI safe-zone sweep',()=>{
  it('creates a stable long-lived target that advances toward the safe area',()=>{
    const zone={active:true,centerX:4000,centerY:4000,radius:1800,signature:'2:WAITING:50:50:15'};
    const a=createAiSafeZoneSweepTarget({aiId:'faker',x:900,y:1100,worldSize:7200,generation:1,zone});
    const b=createAiSafeZoneSweepTarget({aiId:'faker',x:900,y:1100,worldSize:7200,generation:1,zone});
    expect(b).toEqual(a);
    const toward=(a.x-900)*(4000-900)+(a.y-1100)*(4000-1100);
    expect(toward).toBeGreaterThan(0);
    expect(a.key).toContain('safe-sweep:2:WAITING');
  });

  it('spreads different AIs across different sweep lanes',()=>{
    const zone={active:true,centerX:3600,centerY:3600,radius:1700,signature:'zone'};
    const targets=['faker','keria','rockstar','bigsaeng'].map((aiId)=>createAiSafeZoneSweepTarget({aiId,x:1800,y:1800,worldSize:7200,generation:1,zone}));
    expect(new Set(targets.map((target)=>`${Math.round(target.x)}:${Math.round(target.y)}`)).size).toBeGreaterThan(1);
    expect(new Set(targets.map((target)=>target.sector)).size).toBeGreaterThan(1);
  });

  it('accepts useful loot near the route and rejects a large sideways detour',()=>{
    const near=aiSweepDetourMetrics({x:0,y:0},{x:1000,y:0},{x:420,y:90});
    const far=aiSweepDetourMetrics({x:0,y:0},{x:1000,y:0},{x:430,y:520});
    expect(shouldTakeAiSweepLoot(near)).toBe(true);
    expect(shouldTakeAiSweepLoot(far)).toBe(false);
    expect(shouldTakeAiSweepLoot({corridorDistance:220,extraDistance:350},true)).toBe(true);
    expect(AI_SAFE_ZONE_SWEEP.targetLifetimeSeconds).toBeGreaterThanOrEqual(6);
  });

  it('keeps the same destination across repeated AI thinking and regenerates after a zone change',()=>{
    const room=setupRoom();let now=30;room.now=()=>now;
    const p=makeAi('stable-sweeper',1500,1500),intent=room.newAiIntent(p);room.state.players.set(p.id,p);
    const first=room.ensureAiSafeSweepTarget(p,intent);room.applyAiSafeSweep(p,intent);
    const firstRouteGoal={x:intent.routeGoalX,y:intent.routeGoalY,key:intent.sweepKey};
    now+=.22;const second=room.ensureAiSafeSweepTarget(p,intent);room.applyAiSafeSweep(p,intent);
    expect(second).toEqual(first);expect(intent.sweepKey).toBe(firstRouteGoal.key);expect(intent.routeGoalX).toBe(firstRouteGoal.x);expect(intent.routeGoalY).toBe(firstRouteGoal.y);expect(intent.state).toBe('SAFE_SWEEP');
    room.state.zoneStage=3;room.state.nextZoneX=4700;room.state.nextZoneY=4200;now+=.22;
    const changed=room.ensureAiSafeSweepTarget(p,intent);
    expect(changed.key).not.toBe(first.key);
  });

  it('restores the saved sweep after a short item detour',()=>{
    const room=setupRoom();room.now=()=>30;
    const p=makeAi('loot-resume',1700,1600),intent=room.newAiIntent(p);room.state.players.set(p.id,p);
    room.ensureAiSafeSweepTarget(p,intent);room.applyAiSafeSweep(p,intent);
    const goal={x:intent.sweepTargetX,y:intent.sweepTargetY,key:intent.sweepKey};
    intent.itemDetourActive=true;intent.goalKind='loot';intent.goalKey='loot-test';intent.route=[];
    expect(room.resumeAiSafeSweep(p,intent)).toBe(true);
    expect(intent.state).toBe('SAFE_SWEEP');expect(intent.goalKey).toBe(goal.key);expect(intent.routeGoalX).toBe(goal.x);expect(intent.routeGoalY).toBe(goal.y);
  });
});
