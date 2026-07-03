// DROP8_REFACTOR_024C_OPEN_ARENA_RESPAWN
import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source=readFileSync(resolve(process.cwd(),'src/rooms/Drop8Room.ts'),'utf8');
describe('Refactor 024C human respawn',()=>{
 it('schedules, restores and protects Open Arena players',()=>{
  expect(source).toContain('private scheduleOpenArenaRespawn');
  expect(source).toContain('private updateOpenArenaRespawns');
  expect(source).toContain("p.secondary='pistol'");
  expect(source).toContain('this.spawnProtectionUntil.set');
  expect(source).toContain("this.gameMode==='openArena'&&this.now()<(this.spawnProtectionUntil.get(p.id)??0)");
 });
});
