// DROP8_REFACTOR_025_OPEN_ARENA_KILL_LIMIT_MATCH_CYCLE
import { describe,expect,it } from 'vitest';
import { normalizeOpenArenaConfig,normalizeOpenArenaKillLimit } from '@drop8/shared';
import { shouldFinishOpenArenaRound,sortOpenArenaHumanRows,type ArenaScoreRow } from '../src/rooms/openArenaRound.js';

const row=(overrides:Partial<ArenaScoreRow>):ArenaScoreRow=>({id:'p',name:'인간',ai:false,kills:0,deaths:0,kd:0,streak:0,bestStreak:0,humanKills:0,aiKills:0,damageDone:0,alive:true,reachedAt:0,...overrides});

describe('Refactor 025 Open Arena kill limit',()=>{
  it('accepts only 10/20/30/unlimited and defaults to 20',()=>{
    expect(normalizeOpenArenaKillLimit(10)).toBe(10);
    expect(normalizeOpenArenaKillLimit('20')).toBe(20);
    expect(normalizeOpenArenaKillLimit(30)).toBe(30);
    expect(normalizeOpenArenaKillLimit(0)).toBe(0);
    expect(normalizeOpenArenaKillLimit(15)).toBe(20);
    expect(normalizeOpenArenaConfig(8,7,30)).toMatchObject({maxHumans:8,configuredAiCount:7,killLimit:30});
  });
  it('lets only humans finish a limited round and never finishes unlimited',()=>{
    expect(shouldFinishOpenArenaRound(10,row({kills:10}))).toBe(true);
    expect(shouldFinishOpenArenaRound(10,row({ai:true,kills:99}))).toBe(false);
    expect(shouldFinishOpenArenaRound(0,row({kills:999}))).toBe(false);
  });
  it('removes AI and applies the approved human tie breakers',()=>{
    const sorted=sortOpenArenaHumanRows([
      row({id:'ai',name:'AI',ai:true,kills:99}),
      row({id:'b',name:'B',kills:10,humanKills:2,deaths:2,damageDone:500,reachedAt:2}),
      row({id:'a',name:'A',kills:10,humanKills:3,deaths:8,damageDone:100,reachedAt:3}),
      row({id:'c',name:'C',kills:10,humanKills:2,deaths:2,damageDone:600,reachedAt:4}),
    ]);
    expect(sorted.map((item)=>item.id)).toEqual(['a','c','b']);
  });
});
