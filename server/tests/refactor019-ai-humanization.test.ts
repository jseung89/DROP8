// DROP8_REFACTOR_019_AI_HUMANIZATION
import { describe,expect,it,vi } from 'vitest';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { PlayerState } from '../src/rooms/schema.js';
function room(){const r=new Drop8Room() as any;r.now=()=>10;r.setMatchmaking=vi.fn().mockResolvedValue(undefined);r.registrySyncQueue=Promise.resolve();r.state.phase='ACTIVE';return r;}
function player(id:string,x:number,y:number,angle=0){const p=new PlayerState();p.id=id;p.name=id;p.ai=id.startsWith('ai');p.alive=true;p.phase='landed';p.x=x;p.y=y;p.angle=angle;return p;}
describe('Refactor 019 server perception',()=>{
  it('does not acquire a target behind a calm AI',()=>{const r=room(),ai=player('ai-a',1000,1000,0),target=player('human',800,1000);r.state.players.set(ai.id,ai);r.state.players.set(target.id,target);const intent=r.newAiIntent(ai);expect(r.aiCanVisuallyAcquire(ai,target,intent)).toBe(false);});
  it('stops long-range hidden-bush acquisition',()=>{const r=room(),ai=player('ai-a',1000,1000,0),target=player('human',1300,1000);target.inBush=true;target.bushRevealed=false;r.state.players.set(ai.id,ai);r.state.players.set(target.id,target);const intent=r.newAiIntent(ai);expect(r.aiCanVisuallyAcquire(ai,target,intent)).toBe(false);});
  it('stores an estimated sound instead of exact coordinates',()=>{const r=room(),ai=player('ai-a',1000,1000,0);r.state.players.set(ai.id,ai);r.addAiNoise(1400,1000,'human','gun',900,.7);const heard=r.findRecentNoise(ai);expect(heard).toBeDefined();expect(Math.hypot(heard.x-1400,heard.y-1000)).toBeGreaterThan(1);});
});
