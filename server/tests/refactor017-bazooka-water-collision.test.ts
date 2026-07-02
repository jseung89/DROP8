// DROP8_REFACTOR_017_ADHESIVE_STRIP_LOBBY_BAZOOKA_WATER
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BAZOOKA_BALANCE, MAP_CONFIGS, WEAPONS } from '@drop8/shared';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { RocketState } from '../src/rooms/schema.js';

describe('Refactor 017 bazooka water collision',()=>{
  it('lets a rocket continue through Dock 8 deep water',()=>{
    const room=new Drop8Room() as any;room.state.mapId='dock8';room.state.mapSizeMode='dock8';room.state.worldSize=MAP_CONFIGS.dock8.width;
    const rocket=new RocketState();rocket.id='water-rocket';rocket.ownerId='owner';rocket.x=3500;rocket.y=3000;rocket.prevX=rocket.x;rocket.prevY=rocket.y;rocket.vx=WEAPONS.bazooka.projectileSpeed;rocket.vy=0;rocket.life=2;rocket.traveled=0;rocket.radius=BAZOOKA_BALANCE.projectileRadius;room.state.rockets.set(rocket.id,rocket);
    expect(room.terrainKindAt(rocket.x,rocket.y)).toBe('deep-water');room.updateRockets(.05);
    expect(room.state.rockets.has(rocket.id)).toBe(true);expect(room.state.explosions.size).toBe(0);expect(rocket.x).toBeGreaterThan(3500);
  });

  it('keeps water out of the terrain-hit condition while retaining bounds and range explosions',()=>{
    const source=readFileSync(fileURLToPath(new URL('../src/rooms/Drop8Room.ts',import.meta.url)),'utf8');
    expect(source).toContain('const terrainHit=nx<0||ny<0||nx>this.worldSize||ny>this.worldSize;');
    expect(source).not.toContain("terrainKindAt(nx,ny)==='deep-water'");
    expect(WEAPONS.bazooka.projectileSpeed).toBe(900);expect(BAZOOKA_BALANCE.directVehicleDamage).toBe(170);expect(BAZOOKA_BALANCE.maxSplashVehicleDamage).toBe(128);expect(BAZOOKA_BALANCE.minSplashVehicleDamage).toBe(14);expect(BAZOOKA_BALANCE.structureDamage).toBe(120);
  });
});
