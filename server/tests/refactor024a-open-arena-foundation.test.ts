// DROP8_REFACTOR_024A_OPEN_ARENA_FOUNDATION
import { describe,expect,it } from 'vitest';
import { OPEN_ARENA_LIMITS,normalizeGameMode,normalizeOpenArenaConfig } from '@drop8/shared';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const roomSource=readFileSync(resolve(process.cwd(),'src/rooms/Drop8Room.ts'),'utf8');

describe('Refactor 024A Open Arena foundation',()=>{
  it('normalizes mode and validates separate human/AI capacity',()=>{
    expect(normalizeGameMode('openArena')).toBe('openArena');
    expect(normalizeGameMode('unknown')).toBe('battleRoyale');
    expect(normalizeOpenArenaConfig(8,7)).toMatchObject({maxHumans:8,configuredAiCount:7,maxTotalCombatants:16});
    expect(()=>normalizeOpenArenaConfig(8,12)).toThrow(/16/);
    expect(OPEN_ARENA_LIMITS.maxTotalCombatants).toBe(16);
  });
  it('keeps Battle Royale and Open Arena server paths separate',()=>{
    expect(roomSource).toContain("this.gameMode==='openArena'");
    expect(roomSource).toContain('private beginOpenArena()');
    expect(roomSource).toContain("if(this.gameMode==='battleRoyale')this.updateZone(dt)");
    expect(roomSource).toContain("if(this.gameMode==='battleRoyale')this.finishCheck()");
    expect(roomSource).toContain("this.state.phase='ACTIVE'");
    expect(roomSource).toContain("this.state.zoneState='DISABLED'");
  });
});
