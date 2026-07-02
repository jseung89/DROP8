// DROP8_REFACTOR_016_SOLO_AI_ITEM_INTERFACE_FIST
import { describe,expect,it } from 'vitest';
import { AI_PROFILE_ORDER,FIST_BALANCE,MAP_CONFIGS,SOLO_MODE_BALANCE } from '@drop8/shared';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { PlayerState } from '../src/rooms/schema.js';

function room(){const value=new Drop8Room() as any;value.state.mapId='small';value.state.mapSizeMode='small';value.state.worldSize=MAP_CONFIGS.small.width;return value;}
function player(id:string){const p=new PlayerState();p.id=id;p.phase='landed';p.alive=true;p.x=2700;p.y=2000;return p;}

describe('Refactor 016 server authority',()=>{
  it('fills solo mode to eight with diverse stable profiles',()=>{const value=room();value.state.soloMode=true;const human=player('human');human.ai=false;value.state.players.set(human.id,human);value.fillAi();const bots=[...value.state.players.values()].filter((p:any)=>p.ai);expect(value.state.players.size).toBe(SOLO_MODE_BALANCE.totalPlayers);expect(new Set(bots.map((p:any)=>p.aiProfile)).size).toBeGreaterThanOrEqual(3);expect(bots.map((p:any)=>p.aiProfile)).toEqual(AI_PROFILE_ORDER.slice(0,7));});
  it('uses selected heal only and never falls back to the other item',()=>{const value=room();const p=player('heal');p.hp=40;p.bandages=2;p.medkits=0;p.selectedHealKind='medkit';value.state.players.set(p.id,p);expect(value.beginHeal(p,p.selectedHealKind)).toBe(false);expect(p.bandages).toBe(2);p.selectedHealKind='bandage';expect(value.beginHeal(p,p.selectedHealKind)).toBe(true);expect(p.healingKind).toBe('bandage');});
  it('applies improved fist damage, range and knockback',()=>{const value=room();const a=player('a'),b=player('b');a.equipped='fists';a.angle=0;b.x=a.x+FIST_BALANCE.range-2;value.state.players.set(a.id,a);value.state.players.set(b.id,b);value.meleePlayer(a);expect(b.hp).toBe(100-FIST_BALANCE.damage);expect(value.knockback.get(b.id)).toBeDefined();});
  it('does not punch through a solid wall',()=>{const value=room();const rect=MAP_CONFIGS.small.bulletObstacles[0]!;const a=player('wall-a'),b=player('wall-b');a.equipped='fists';a.x=rect.x-20;a.y=rect.y+rect.h/2;b.x=rect.x+rect.w+20;b.y=a.y;a.angle=0;value.state.players.set(a.id,a);value.state.players.set(b.id,b);value.meleePlayer(a);expect(b.hp).toBe(100);});
  it('keeps AI movement profile within player-safe multipliers',()=>{for(const id of AI_PROFILE_ORDER){const p=player(id);p.ai=true;p.aiProfile=id;const profile=valueProfile(p);expect(profile.speedMultiplier).toBeGreaterThanOrEqual(.85);expect(profile.speedMultiplier).toBeLessThanOrEqual(1.05);}});
});
function valueProfile(p:PlayerState){const value=room();return value.aiProfile(p);}
