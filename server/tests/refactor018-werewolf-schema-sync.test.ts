// DROP8_REFACTOR_018_WEREWOLF_SEASON
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Drop8State, PlayerState, WerewolfPlayerState, WerewolfSeasonState } from '../src/rooms/schema.js';

describe('Refactor 018 Schema synchronization',()=>{
  it('uses one nested field on PlayerState and Drop8State to stay within the Colyseus limit',()=>{
    const source=readFileSync(fileURLToPath(new URL('../src/rooms/schema.ts',import.meta.url)),'utf8');
    const count=(name:string,next:string)=>((source.split(`export class ${name}`)[1]?.split(next?`export class ${next}`:String.raw`\0`)[0]??'').match(/@type\(/g)??[]).length;
    expect(count('PlayerState','TacticalInventoryState')).toBe(64);
    expect(count('Drop8State','')).toBeLessThanOrEqual(64);
    expect(new PlayerState().werewolf).toBeInstanceOf(WerewolfPlayerState);
    expect(new Drop8State().werewolfSeason).toBeInstanceOf(WerewolfSeasonState);
  });
  it('keeps all volatile season state inside the nested objects',()=>{
    const state=new Drop8State(),player=new PlayerState();
    player.werewolf.hasCurse=true;state.werewolfSeason.curseOwnerId='p1';
    expect(player.toJSON().werewolf.hasCurse).toBe(true);
    expect(state.toJSON().werewolfSeason.curseOwnerId).toBe('p1');
  });
});
