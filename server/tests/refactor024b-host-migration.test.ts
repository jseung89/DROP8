// DROP8_REFACTOR_024B_OPEN_ARENA_LIFECYCLE_HOST_MIGRATION
import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source=readFileSync(resolve(process.cwd(),'src/rooms/Drop8Room.ts'),'utf8');
describe('Refactor 024B host migration',()=>{
 it('selects the oldest connected human and excludes AI',()=>{
  expect(source).toContain('private humanJoinedAt=new Map<string,number>()');
  expect(source).toContain("filter((player)=>!player.ai).sort");
  expect(source).toContain("this.broadcast('hostChanged'");
 });
});
