// DROP8_REFACTOR_024E_OPEN_ARENA_SCOREBOARD_UX
import { describe,expect,it } from 'vitest';import { readFileSync } from 'node:fs';import { resolve } from 'node:path';
const html=readFileSync(resolve(process.cwd(),'../client/index.html'),'utf8');const main=readFileSync(resolve(process.cwd(),'../client/src/main.ts'),'utf8');
describe('Refactor 024E UX',()=>{it('shows population, ranking and preserves the mode-specific HUD',()=>{expect(html).toContain('arenaScoreboardPanel');expect(main).toContain('renderArenaScoreboard');expect(main).toContain("arena?'상시 개방 전장':'배틀로얄'");});});
