// DROP8_REFACTOR_024B_OPEN_ARENA_LIFECYCLE_HOST_MIGRATION
import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source=readFileSync(resolve(process.cwd(),'src/rooms/Drop8Room.ts'),'utf8');
describe('Refactor 024B lifecycle and host migration',()=>{
 it('uses explicit Open Arena lifecycle and manual dispose',()=>{
  expect(source).toContain("this.autoDispose=false");
  expect(source).toContain("private openArenaLifecycle:OpenArenaLifecycle='active'");
  expect(source).toContain('private enterOpenArenaEmptyGrace()');
  expect(source).toContain("void this.disconnect()");
  expect(source).toContain("private:!this.state.publicRoom||arenaHidden");
 });
 it('allows active Open Arena join-in-progress while rejecting Battle Royale active joins',()=>{
  expect(source).toContain("this.gameMode==='openArena'&&this.state.phase==='ACTIVE'");
  expect(source).toContain("else if(this.state.phase!=='LOBBY')throw new Error");
 });
});
