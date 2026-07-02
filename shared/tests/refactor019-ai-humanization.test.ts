// DROP8_REFACTOR_019_AI_HUMANIZATION
import { describe,expect,it } from 'vitest';
import { AI_DIALOGUE_LINES, aiAimErrorPixels, aiBurstSpec, aiReactionDelaySeconds, aiVisionDistance, aiVisionFovRadians, turnAngleToward } from '../src/index.js';
describe('Refactor 019 AI humanization rules',()=>{
  it('limits calm vision and rear acquisition',()=>{expect(aiVisionDistance('calm',false)).toBeCloseTo(617.5,5);expect(aiVisionFovRadians('calm')).toBeCloseTo(100*Math.PI/180,5);expect(turnAngleToward(0,Math.PI,.2)).toBeCloseTo(.2,5);});
  it('adds reaction and movement aim penalties',()=>{expect(aiReactionDelaySeconds(600,Math.PI*.8,false,.5,.5)).toBeGreaterThan(.7);expect(aiAimErrorPixels(700,1,.5,'sniper')).toBeGreaterThan(aiAimErrorPixels(120,0,.5,'pistol'));});
  it('defines weapon bursts and dialogue ids',()=>{expect(aiBurstSpec('rifle').min).toBe(3);expect(aiBurstSpec('smg').max).toBe(10);expect(AI_DIALOGUE_LINES.lost_bush).toContain('수풀');});
});
