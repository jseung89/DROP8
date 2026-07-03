// DROP8_REFACTOR_022_AI_NAVIGATION_TACTICAL_RECOVERY
import { describe,expect,it } from 'vitest';
import { AI_NAVIGATION_RECOVERY,canReplaceAiGoal,detectAiOscillation,nextAiStallSeconds,pushAiProgressSample,type AiProgressSample } from '../src/rooms/aiNavigation.js';

describe('Refactor 022 AI navigation recovery helpers',()=>{
  it('counts sideways movement without goal gain as a stall',()=>{
    const next=nextAiStallSeconds(0,.25,5,.03,.05);
    expect(next).toBeGreaterThan(0);
    expect(nextAiStallSeconds(next,.25,5,2.5,2.5)).toBeLessThan(next);
  });

  it('detects A-B-A-B route oscillation',()=>{
    let samples:AiProgressSample[]=[];
    const points=[[100,100],[150,100],[102,102],[149,101],[101,100],[151,99]];
    points.forEach(([x,y],index)=>{samples=pushAiProgressSample(samples,{x:x!,y:y!,goalDistance:500-index,at:index*.25});});
    expect(detectAiOscillation(samples)).toBe(true);
  });

  it('does not flag healthy forward progress',()=>{
    const samples=Array.from({length:6},(_,index)=>({x:100+index*42,y:100,goalDistance:500-index*42,at:index*.25}));
    expect(detectAiOscillation(samples)).toBe(false);
  });

  it('keeps a locked goal unless a higher-priority emergency replaces it',()=>{
    expect(canReplaceAiGoal('loot','loot-a',10,'patrol','patrol',5)).toBe(false);
    expect(canReplaceAiGoal('loot','loot-a',10,'combat','enemy-a',5)).toBe(true);
    expect(canReplaceAiGoal('combat','enemy-a',10,'combat','enemy-b',5)).toBe(false);
    expect(canReplaceAiGoal('combat','enemy-a',10,'combat','enemy-a',5)).toBe(true);
    expect(AI_NAVIGATION_RECOVERY.voluntarySwimPenalty).toBeGreaterThan(500);
  });
});
