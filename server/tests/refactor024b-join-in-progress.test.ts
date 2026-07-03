// DROP8_REFACTOR_024B_OPEN_ARENA_LIFECYCLE_HOST_MIGRATION
import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const room=readFileSync(resolve(process.cwd(),'src/rooms/Drop8Room.ts'),'utf8');
const client=readFileSync(resolve(process.cwd(),'../client/src/main.ts'),'utf8');
describe('Refactor 024B join in progress',()=>{
 it('spawns only the joining human without restarting the world',()=>{
  expect(room).toContain('this.resetOpenArenaCombatant(p');
  expect(room).not.toContain("this.beginOpenArena();this.system(`${p.name}님이 진행 중");
  expect(client).toContain("arena?room.lifecycle!=='active'&&room.phase!=='LOBBY'");
 });
});
