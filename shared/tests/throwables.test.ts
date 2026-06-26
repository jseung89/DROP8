import { describe, expect, it } from 'vitest';
import {
  FIRE_TIMING,
  SMOKE_TIMING,
  THROWABLE_CONFIGS,
  THROWABLE_MAX_CHARGE_MS,
  THROWABLE_MAX_DISTANCE,
  THROWABLE_MIN_DISTANCE,
  THROWABLE_SMOKE_NEAR_VISIBILITY,
  createThrowableMotion,
  fireFieldContains,
  fragPlayerDamage,
  fragVehicleDamage,
  predictThrowableTrajectory,
  smokeRadiusAt,
  smokeVisibilityBetween,
  stepThrowableMotion,
  throwableChargeRatio,
  throwableDistanceForCharge,
  type BuildingVisibilityZone,
  type MapConfig,
  type ThrowableMotion,
} from '../src/index.js';

const emptyMap = (): Pick<MapConfig,'bulletObstacles'|'buildingVisibilityZones'|'width'|'height'> => ({
  width: 1000,
  height: 1000,
  bulletObstacles: [],
  buildingVisibilityZones: [],
});

const windowZone = (open = true): BuildingVisibilityZone => ({
  id: 'building-test',
  regionId: 'residential',
  buildingIndex: 0,
  interior: { x: 200, y: 100, w: 200, h: 200 },
  roof: { x: 190, y: 90, w: 220, h: 220 },
  doors: [{ id:'door-test', buildingId:'building-test', x:200, y:250, width:20, height:80, insideRevealDistance:200, outsideRevealDistance:200, open }],
  windows: [{ id:'window-test', buildingId:'building-test', side:'west', offset:.5, x:200, y:160, width:20, height:80, vaultable:true, allowsVision:true, allowsBullets:true, insideRevealDistance:200, outsideRevealDistance:200 }],
});

describe('Refactor 012 throwable shared rules', () => {
  it('clamps charge and maps it deterministically to the configured throw distance', () => {
    expect(throwableChargeRatio(-10)).toBe(0);
    expect(throwableChargeRatio(THROWABLE_MAX_CHARGE_MS / 2)).toBeCloseTo(.5, 6);
    expect(throwableChargeRatio(THROWABLE_MAX_CHARGE_MS * 2)).toBe(1);
    expect(throwableDistanceForCharge(0)).toBe(THROWABLE_MIN_DISTANCE);
    expect(throwableDistanceForCharge(THROWABLE_MAX_CHARGE_MS)).toBe(THROWABLE_MAX_DISTANCE);
  });

  it('produces the same deterministic trajectory for the same starting state', () => {
    const start = createThrowableMotion(100, 100, 1, 0, 425);
    const first = predictThrowableTrajectory(start, emptyMap(), THROWABLE_CONFIGS.fragGrenade);
    const second = predictThrowableTrajectory(start, emptyMap(), THROWABLE_CONFIGS.fragGrenade);
    expect(first).toEqual(second);
    expect(first.landing.x).toBeGreaterThan(THROWABLE_MIN_DISTANCE + 80);
    expect(first.landing.z).toBeGreaterThanOrEqual(0);
  });

  it('bounces on a solid wall', () => {
    const map = emptyMap();
    map.bulletObstacles = [{ x: 200, y: 0, w: 20, h: 400 }];
    const motion:ThrowableMotion = { x:190, y:100, z:70, vx:300, vy:0, vz:0, bounces:0, phase:'flying' };
    const result = stepThrowableMotion(motion, .05, map, THROWABLE_CONFIGS.fragGrenade);
    expect(result.collision).toBe('wall');
    expect(result.vx).toBeLessThan(0);
    expect(result.bounces).toBe(1);
  });

  it('passes through a window aperture at the correct height and strikes the frame outside it', () => {
    const zone = windowZone();
    const map:Pick<MapConfig,'bulletObstacles'|'buildingVisibilityZones'|'width'|'height'> = {
      width:1000,height:1000,buildingVisibilityZones:[zone],
      bulletObstacles:[{x:200,y:100,w:20,h:60},{x:200,y:240,w:20,h:60}],
    };
    const through:ThrowableMotion={x:190,y:200,z:70,vx:300,vy:0,vz:0,bounces:0,phase:'flying'};
    const low:ThrowableMotion={...through,z:10};
    expect(stepThrowableMotion(through,.05,map,THROWABLE_CONFIGS.smokeGrenade).collision).toBe('none');
    expect(stepThrowableMotion(low,.05,map,THROWABLE_CONFIGS.smokeGrenade).collision).toBe('window-frame');
  });

  it('treats an explicitly closed door as a collision and an open door as a portal', () => {
    const base = { width:1000,height:1000,bulletObstacles:[] };
    const motion:ThrowableMotion={x:190,y:290,z:60,vx:300,vy:0,vz:0,bounces:0,phase:'flying'};
    const closed=stepThrowableMotion(motion,.05,{...base,buildingVisibilityZones:[windowZone(false)]},THROWABLE_CONFIGS.fragGrenade);
    const open=stepThrowableMotion(motion,.05,{...base,buildingVisibilityZones:[windowZone(true)]},THROWABLE_CONFIGS.fragGrenade);
    expect(closed.collision).toBe('wall');
    expect(open.collision).toBe('none');
  });

  it('uses exact fragment damage bands for players and motorcycles', () => {
    expect([fragPlayerDamage(0),fragPlayerDamage(35),fragPlayerDamage(35.01),fragPlayerDamage(80.01),fragPlayerDamage(130.01),fragPlayerDamage(180.01)]).toEqual([100,100,75,45,20,0]);
    expect([fragVehicleDamage(0),fragVehicleDamage(50),fragVehicleDamage(50.01),fragVehicleDamage(100.01),fragVehicleDamage(150.01),fragVehicleDamage(180.01)]).toEqual([120,120,80,45,20,0]);
  });

  it('grows, holds and fades smoke on the configured timeline', () => {
    const radius=120;
    expect(smokeRadiusAt(0,0,radius)).toBe(0);
    expect(smokeRadiusAt(SMOKE_TIMING.growMs/2,0,radius)).toBeCloseTo(60);
    expect(smokeRadiusAt(SMOKE_TIMING.growMs+SMOKE_TIMING.holdMs-1,0,radius)).toBe(radius);
    expect(smokeRadiusAt(SMOKE_TIMING.growMs+SMOKE_TIMING.holdMs+SMOKE_TIMING.fadeMs,0,radius)).toBe(0);
  });

  it('hides opposite sides of smoke but allows only near silhouettes inside the same cloud', () => {
    const field={id:'s',x:100,y:100,radius:100,buildingId:''};
    expect(smokeVisibilityBetween({x:100,y:100},{x:240,y:100},[field],0)).toBe('hidden');
    expect(smokeVisibilityBetween({x:70,y:100},{x:70+THROWABLE_SMOKE_NEAR_VISIBILITY-1,y:100},[field],0)).toBe('near');
    expect(smokeVisibilityBetween({x:40,y:100},{x:160,y:100},[field],0)).toBe('hidden');
    expect(smokeVisibilityBetween({x:0,y:0,buildingId:'room-a'},{x:10,y:0,buildingId:'room-a'},[field],0)).toBe('clear');
  });

  it('uses seconds for synchronized smoke expiry while keeping render animation in milliseconds', () => {
    const field={id:'timed-smoke',x:100,y:100,radius:100,buildingId:'',expiresAt:100};
    expect(smokeVisibilityBetween({x:100,y:100},{x:240,y:100},[field],99)).toBe('hidden');
    expect(smokeVisibilityBetween({x:100,y:100},{x:240,y:100},[field],100)).toBe('clear');
    expect(smokeVisibilityBetween({x:100,y:100},{x:240,y:100},[field],101)).toBe('clear');
    expect(smokeRadiusAt(SMOKE_TIMING.growMs/2,0,120)).toBeCloseTo(60);
  });

  it('allows fire through an open doorway but not between sealed indoor spaces', () => {
    const zone=windowZone();
    const outside={x:180,y:290,buildingId:''};
    const inside={x:230,y:290,buildingId:'building-test'};
    expect(fireFieldContains({...outside,radius:115},inside,[zone])).toBe(true);
    expect(fireFieldContains({x:250,y:200,radius:115,buildingId:'building-test'},{x:260,y:210,buildingId:'another-room'},[zone])).toBe(false);
    expect(FIRE_TIMING.tickMs).toBe(250);
    expect(FIRE_TIMING.playerTickDamage).toBe(3);
  });
});
