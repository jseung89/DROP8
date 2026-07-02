// DROP8_REFACTOR_016_SOLO_AI_ITEM_INTERFACE_FIST
import { describe,expect,it } from 'vitest';
import { AI_PROFILES,AI_PROFILE_ORDER,AMMO_PRESENTATION,FIST_BALANCE,HEAL_SELECTION_BALANCE,SOLO_MODE_BALANCE,WEAPONS,aiProfileForIndex,deterministicAiAimOffset } from '../src/index.js';

describe('Refactor 016 shared solo, AI, item and fist rules',()=>{
  it('defines eight distinct deterministic AI profiles',()=>{expect(AI_PROFILE_ORDER).toHaveLength(8);expect(new Set(AI_PROFILE_ORDER).size).toBe(8);expect(Array.from({length:8},(_,i)=>aiProfileForIndex(i))).toEqual(AI_PROFILE_ORDER);expect(Math.min(...Object.values(AI_PROFILES).map((p)=>p.speedMultiplier))).toBeGreaterThanOrEqual(.85);expect(Math.max(...Object.values(AI_PROFILES).map((p)=>p.speedMultiplier))).toBeLessThanOrEqual(1.05);});
  it('gives profiles different deterministic accuracy and driving penalties',()=>{const low=Math.abs(deterministicAiAimOffset('rusher',7,700,true,true));const elite=Math.abs(deterministicAiAimOffset('sniper',7,700,false,false));expect(low).toBeGreaterThan(elite);expect(deterministicAiAimOffset('balanced',11,300)).toBe(deterministicAiAimOffset('balanced',11,300));});
  it('keeps solo at one human and the existing total player count',()=>{expect(SOLO_MODE_BALANCE).toEqual({humanPlayers:1,totalPlayers:8});});
  it('distinguishes every ammunition type with label glyph color and css class',()=>{expect(Object.keys(AMMO_PRESENTATION).sort()).toEqual(['fuel_ammo','pistol_ammo','rocket_ammo','shotgun_ammo','standard_ammo']);for(const value of Object.values(AMMO_PRESENTATION)){expect(value.label.length).toBeGreaterThan(0);expect(value.glyph.length).toBeGreaterThan(0);expect(value.cssClass).toMatch(/^ammo-/);}});
  it('makes fists a five-hit weapon without changing vehicle stats',()=>{expect(FIST_BALANCE.damage).toBe(20);expect(WEAPONS.fists.damage).toBe(FIST_BALANCE.damage);expect(WEAPONS.fists.range).toBe(73);expect(Math.ceil(100/FIST_BALANCE.damage)).toBe(5);});
  it('publishes explicit bandage and medkit timings',()=>{expect(HEAL_SELECTION_BALANCE.bandage).toEqual({healAmount:25,useSeconds:2});expect(HEAL_SELECTION_BALANCE.medkit).toEqual({healAmount:60,useSeconds:4});});
});
