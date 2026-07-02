// DROP8_REFACTOR_017_ADHESIVE_STRIP_LOBBY_BAZOOKA_WATER
import { describe, expect, it } from 'vitest';
import { STRIP_TRAP_BALANCE, circleHitsStripTrap, stripTrapsOverlap } from '../src/index.js';

const trap={x:100,y:100,angle:0,length:STRIP_TRAP_BALANCE.length,width:STRIP_TRAP_BALANCE.width};
describe('Refactor 017 strip trap geometry',()=>{
  it('triggers a motorcycle-sized circle crossing the low strip',()=>{
    expect(circleHitsStripTrap(100,122,18,trap,STRIP_TRAP_BALANCE.motorcycleTriggerPadding)).toBe(true);
    expect(circleHitsStripTrap(100,170,18,trap,STRIP_TRAP_BALANCE.motorcycleTriggerPadding)).toBe(false);
  });
  it('rejects overlapping traps but allows separated placements',()=>{
    expect(stripTrapsOverlap(trap,{...trap,x:125},STRIP_TRAP_BALANCE.overlapPadding)).toBe(true);
    expect(stripTrapsOverlap(trap,{...trap,x:280},STRIP_TRAP_BALANCE.overlapPadding)).toBe(false);
  });
});
