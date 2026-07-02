// DROP8_REFACTOR_018_WEREWOLF_SEASON
import { describe, expect, it } from 'vitest';
import { MOTORCYCLE_MAX_SPEED, SILVER_CROSSBOW_BALANCE, WEREWOLF_BALANCE, WEAPONS, werewolfDamage, werewolfSpeed } from '../src/index.js';

describe('Refactor 018 werewolf season rules',()=>{
  it('derives werewolf pursuit speed without changing motorcycle balance',()=>{
    expect(MOTORCYCLE_MAX_SPEED).toBe(481);
    expect(werewolfSpeed(MOTORCYCLE_MAX_SPEED,false,false,false)).toBeCloseTo(529.1,5);
    expect(werewolfSpeed(MOTORCYCLE_MAX_SPEED,true,false,false)).toBeCloseTo(673.4,5);
    expect(werewolfSpeed(MOTORCYCLE_MAX_SPEED,true,true,false)).toBe(WEREWOLF_BALANCE.indoorSpeedCap);
    expect(werewolfSpeed(MOTORCYCLE_MAX_SPEED,true,false,true)).toBeCloseTo(370.37,4);
  });
  it('keeps the three-claw, bazooka survival and silver shotgun pellet rules',()=>{
    expect(WEREWOLF_BALANCE.clawDamage*3).toBeGreaterThanOrEqual(100);
    expect(werewolfDamage(112,'explosion')).toBeCloseTo(44.8,5);
    expect(werewolfDamage(18,'bullet')).toBeCloseTo(4.5,5);
    expect(werewolfDamage(45,'other')).toBeCloseTo(9,5);
    expect(werewolfDamage(999,'silver')).toBe(20);
  });
  it('defines an independent crossbow and limited silver ammunition',()=>{
    expect(WEAPONS.silver_crossbow.magazine).toBe(4);
    expect(WEAPONS.silver_crossbow.reloadSeconds).toBe(1.35);
    expect(WEAPONS.silver_crossbow.projectileSpeed).toBe(SILVER_CROSSBOW_BALANCE.projectileSpeed);
    expect(WEAPONS.silver_crossbow.pellets).toBe(5);
    expect(WEAPONS.silver_crossbow.fireInterval).toBe(.42);
    expect(WEREWOLF_BALANCE.initialSilverBolts).toBe(6);
    expect(WEREWOLF_BALANCE.maxWorldSilverBolts).toBe(12);
  });
});
