// DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE
import { describe,expect,it } from 'vitest';
import { OPEN_ARENA_RITUAL_ACTIVE_SECONDS,OPEN_ARENA_RITUAL_COMPLETION_SECONDS,OPEN_ARENA_RITUAL_COOLDOWN_SECONDS,OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS,OPEN_ARENA_RITUAL_SUPPLY_CLEARANCE,OPEN_ARENA_RITUAL_WARNING_SECONDS } from '../src/rooms/openArenaWorld.js';

describe('Refactor 028 Open Arena recurring werewolf ritual constants',()=>{
  it('keeps the ritual cadence bounded and separate from supply drops',()=>{
    expect(OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS).toBe(90);
    expect(OPEN_ARENA_RITUAL_WARNING_SECONDS).toBe(15);
    expect(OPEN_ARENA_RITUAL_ACTIVE_SECONDS).toBe(45);
    expect(OPEN_ARENA_RITUAL_COOLDOWN_SECONDS).toBe(120);
    expect(OPEN_ARENA_RITUAL_COMPLETION_SECONDS).toBe(5);
    expect(OPEN_ARENA_RITUAL_SUPPLY_CLEARANCE).toBeGreaterThanOrEqual(500);
  });
});
