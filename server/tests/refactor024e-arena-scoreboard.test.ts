// DROP8_REFACTOR_024E_OPEN_ARENA_SCOREBOARD_UX
import { describe,expect,it } from 'vitest';import { readFileSync } from 'node:fs';import { resolve } from 'node:path';
const source=readFileSync(resolve(process.cwd(),'src/rooms/Drop8Room.ts'),'utf8');
describe('Refactor 024E scoreboard',()=>{it('tracks deaths, streaks and AI/human eliminations without Schema fields',()=>{expect(source).toContain('private arenaKillStreak=new Map');expect(source).toContain('private openArenaScoreboardPayload');expect(source).toContain("this.broadcast('arenaScoreboard'");expect(source).not.toContain('@type() arenaKillStreak');});});
