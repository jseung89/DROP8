// DROP8_REFACTOR_024C_OPEN_ARENA_RESPAWN
import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source=readFileSync(resolve(process.cwd(),'src/rooms/Drop8Room.ts'),'utf8');
describe('Refactor 024C AI slot respawn',()=>{
 it('maintains fixed slots instead of creating replacement IDs',()=>{
  expect(source).toContain('private openArenaAiSlots=new Map<string,OpenArenaAiSlot>()');
  expect(source).toContain("slot.state='respawnWait'");
  expect(source).toContain("slot.state='alive'");
  expect(source).toContain('const player=this.state.players.get(slot.playerId)');
 });
});
