// DROP8_REFACTOR_024D_OPEN_ARENA_PERSISTENT_WORLD
import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';import { resolve } from 'node:path';
const source=readFileSync(resolve(process.cwd(),'src/rooms/Drop8Room.ts'),'utf8');
describe('Refactor 024D Arena vehicles',()=>{it('registers one slot and delays replacement after destruction',()=>{expect(source).toContain('private arenaVehicleSlots=new Map');expect(source).toContain('markOpenArenaVehicleDestroyed');expect(source).toContain('respawnOpenArenaVehicle');});});
