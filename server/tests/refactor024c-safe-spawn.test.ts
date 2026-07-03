// DROP8_REFACTOR_024C_OPEN_ARENA_RESPAWN
import { describe,expect,it } from 'vitest';
import { chooseOpenArenaSpawn,openArenaSpawnScore } from '../src/rooms/openArenaRespawn.js';
describe('Refactor 024C safe spawn',()=>{
 it('prefers a distant position without direct line of sight',()=>{
  const threats=[{x:0,y:0,alive:true}];
  const recent:Array<{x:number;y:number;at:number}>=[];
  const los=(from:any,to:any)=>to.x<500;
  const near=openArenaSpawnScore({x:100,y:0},threats,recent,0,los);
  const far=openArenaSpawnScore({x:800,y:0},threats,recent,0,los);
  expect(far).toBeGreaterThan(near);
  expect(chooseOpenArenaSpawn([{x:100,y:0},{x:800,y:0}],threats,recent,0,()=>true,los)).toEqual({x:800,y:0});
 });
});
