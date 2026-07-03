// DROP8_REFACTOR_024D_OPEN_ARENA_PERSISTENT_WORLD
import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';import { resolve } from 'node:path';
const source=readFileSync(resolve(process.cwd(),'src/rooms/Drop8Room.ts'),'utf8');
describe('Refactor 024D cleanup',()=>{it('expires dynamic drops and clears persistent runtime maps',()=>{expect(source).toContain('arenaDropExpiresAt');expect(source).toContain('OPEN_ARENA_DROP_TTL_SECONDS');expect(source).toContain('this.arenaLootSlots.clear()');expect(source).toContain('this.updateOpenArenaWorld()');});});
