// DROP8_REFACTOR_024D_OPEN_ARENA_PERSISTENT_WORLD
import { describe,expect,it } from 'vitest';
import { arenaLootRespawnSeconds,OPEN_ARENA_DROP_TTL_SECONDS } from '../src/rooms/openArenaWorld.js';
describe('Refactor 024D Arena loot',()=>{it('uses bounded category timers and drop TTL',()=>{expect(arenaLootRespawnSeconds('ammo')).toBe(20);expect(arenaLootRespawnSeconds('weapon')).toBe(40);expect(OPEN_ARENA_DROP_TTL_SECONDS).toBe(60);});});
