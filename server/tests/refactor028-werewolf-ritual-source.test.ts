// DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE
import { describe,expect,it } from 'vitest';import { readFileSync } from 'node:fs';import { resolve } from 'node:path';
const project=resolve(process.cwd(),'..');
const room=readFileSync(resolve(project,'server/src/rooms/Drop8Room.ts'),'utf8');
const world=readFileSync(resolve(project,'server/src/rooms/openArenaWorld.ts'),'utf8');
const scene=readFileSync(resolve(project,'client/src/GameScene.ts'),'utf8');
const notes=readFileSync(resolve(project,'docs/PATCH_NOTES.md'),'utf8');
describe('Refactor 028 recurring werewolf ritual source contract',()=>{
  it('is chained after 025A and 027 without adding 029',()=>{
    expect(room).toContain('DROP8_REFACTOR_025_OPEN_ARENA_KILL_LIMIT_MATCH_CYCLE');
    expect(room).toContain('DROP8_REFACTOR_027_OPEN_ARENA_RECURRING_SUPPLY_DROPS');
    expect(room).toContain('DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE');
    expect(room).not.toContain('DROP8_REFACTOR_029_ADHESIVE_FIRE_RATE_SUPPRESSION');
  });
  it('uses Open Arena-only ritual timers while preserving Battle Royale werewolf season initialization',()=>{
    expect(world).toContain('OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS=90');
    expect(world).toContain('OPEN_ARENA_RITUAL_ACTIVE_SECONDS=45');
    expect(room).toContain('private openArenaNextRitualWarningAt=0');
    expect(room).toContain('private startOpenArenaRitualWarning(now=this.now())');
    expect(room).toContain('this.openArenaNextRitualWarningAt=this.now()+OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS');
    expect(room).toContain('private initializeWerewolfSeason(firstDelaySeconds=WEREWOLF_BALANCE.altarWakeSeconds)');
  });
  it('keeps AI from completing Open Arena rituals and guards supply-drop proximity',()=>{
    expect(room).toContain("if(this.gameMode==='openArena'||!p.ai");
    expect(room).toContain('this.openArenaRitualPositionClear(point)');
    expect(room).toContain('OPEN_ARENA_RITUAL_SUPPLY_CLEARANCE');
    expect(room).toContain("if(this.gameMode!=='openArena'&&season.altarPhase==='active'");
  });
  it('renders the existing altar marker and documents the scope',()=>{
    expect(scene).toContain('DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE');
    expect(scene).toContain("E 유지  늑대의 제단 의식");
    expect(notes).toContain('Refactor 028 — Recurring Werewolf Ritual Cycle');
    expect(notes).toContain('Refactor 027 보급상자 기능은 변경하지 않는다');
  });
});
