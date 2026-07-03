// DROP8_REFACTOR_025_OPEN_ARENA_KILL_LIMIT_MATCH_CYCLE
import { describe,expect,it } from 'vitest';import { readFileSync } from 'node:fs';import { resolve } from 'node:path';
const source=readFileSync(resolve(process.cwd(),'src/rooms/Drop8Room.ts'),'utf8');
describe('Refactor 025 round cycle source contract',()=>{
  it('keeps the room alive while freezing combat and resetting the arena round',()=>{
    expect(source).toContain("private openArenaRoundState:OpenArenaRoundState='active'");
    expect(source).toContain("this.broadcast('arenaRoundResult'");
    expect(source).toContain("this.broadcast('arenaRoundStarted'");
    expect(source).toContain('private resetOpenArenaRound()');
    expect(source).toContain("this.gameMode==='openArena'&&this.openArenaRoundState!=='active'");
    expect(source).toContain("if(this.gameMode==='battleRoyale')this.finishCheck()");
  });
  it('counts human kills against AI but excludes AI from finish and ranking helpers',()=>{
    expect(source).toContain('const targetMap=victim.ai?this.arenaAiKills:this.arenaHumanKills');
    expect(source).toContain('sortOpenArenaHumanRows(rows)');
    expect(source).toContain('shouldFinishOpenArenaRound');
  });
});
