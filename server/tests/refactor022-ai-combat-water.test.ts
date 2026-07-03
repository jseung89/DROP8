// DROP8_REFACTOR_022_AI_NAVIGATION_TACTICAL_RECOVERY
import { describe,expect,it } from 'vitest';
import { MAP_CONFIGS } from '@drop8/shared';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { PlayerState } from '../src/rooms/schema.js';

function makeAi(id:string,x:number,y:number){const p=new PlayerState();p.id=id;p.name=id;p.ai=true;p.alive=true;p.phase='landed';p.x=x;p.y=y;p.hp=100;p.primary='rifle';p.equipped='rifle';p.rifleMagazine=20;return p;}

describe('Refactor 022 AI water and tactical recovery',()=>{
  it('prioritizes a locked shore exit while swimming',()=>{
    const room=new Drop8Room() as any;room.state.mapId='dock8';room.state.mapSizeMode='dock8';room.state.worldSize=MAP_CONFIGS.dock8.width;room.state.phase='ACTIVE';room.now=()=>10;
    const river=MAP_CONFIGS.dock8.rivers[0]!,p=makeAi('swimmer',river.points[3]!.x,river.points[3]!.y);p.isSwimming=true;room.state.players.set(p.id,p);
    const intent=room.newAiIntent(p);room.aiIntent.set(p.id,intent);room.planAi(p,intent);
    expect(intent.state).toBe('SWIM_ESCAPE');expect(intent.goalKind).toBe('swim-exit');expect(intent.swimExitId).not.toBe('');expect(intent.targetId).toBe('');expect(intent.route.length).toBeGreaterThan(0);
    const firstExit=intent.swimExitId;room.planAi(p,intent);expect(intent.swimExitId).toBe(firstExit);
  });

  it('routes opposite river banks through a crossing instead of a direct water cut',()=>{
    const room=new Drop8Room() as any;room.state.mapId='dock8';room.state.mapSizeMode='dock8';room.state.worldSize=MAP_CONFIGS.dock8.width;room.state.phase='ACTIVE';room.now=()=>10;
    const p=makeAi('crosser',1800,3300),intent=room.newAiIntent(p);const target={x:5500,y:3300};const route=room.buildAiRoute(p,target.x,target.y,intent);
    expect(route.length).toBeGreaterThan(1);
    expect(route.some((point:any)=>point.x>2900&&point.x<4450&&point.y>1100&&point.y<6100)).toBe(true);
  });

  it('does not let swimming AI enter combat hold',()=>{
    const room=new Drop8Room() as any;room.state.mapId='dock8';room.state.mapSizeMode='dock8';room.state.worldSize=MAP_CONFIGS.dock8.width;room.state.phase='ACTIVE';room.now=()=>10;
    const river=MAP_CONFIGS.dock8.rivers[0]!,p=makeAi('swimmer-combat',river.points[4]!.x,river.points[4]!.y),enemy=makeAi('enemy',p.x+180,p.y);p.isSwimming=true;enemy.ai=false;room.state.players.set(p.id,p);room.state.players.set(enemy.id,enemy);
    const intent=room.newAiIntent(p);room.aiIntent.set(p.id,intent);room.planAi(p,intent);
    expect(intent.mode).toBe('move');expect(intent.state).toBe('SWIM_ESCAPE');expect(intent.targetId).toBe('');
  });
});
