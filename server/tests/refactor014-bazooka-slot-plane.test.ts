// DROP8_REFACTOR_014_PLANE_VISIBILITY_BAZOOKA_SLOT_SWAP
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BAZOOKA_BALANCE, MAP_CONFIGS, MOTORCYCLE_BALANCE, MOTORCYCLE_DESTRUCTION_BALANCE, WEAPONS } from '@drop8/shared';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { MotorcycleState, PlayerState, RocketState } from '../src/rooms/schema.js';

describe('Refactor 014 plane visibility, bazooka, and slot authority',()=>{
  it('applies a server-authoritative direct rocket hit without changing motorcycle base performance',()=>{
    expect(MOTORCYCLE_BALANCE.maxSpeedMultiplier).toBe(1.85);
    expect(MOTORCYCLE_BALANCE.maxCollisionDamage).toBe(45);
    expect(MOTORCYCLE_DESTRUCTION_BALANCE.maxHp).toBe(180);
    const room=new Drop8Room() as any;room.state.mapId='small';room.state.worldSize=MAP_CONFIGS.small.width;
    const attacker=new PlayerState();attacker.id='attacker';attacker.phase='landed';attacker.x=1800;attacker.y=2000;attacker.buildingId='';room.state.players.set(attacker.id,attacker);
    const bike=new MotorcycleState();bike.id='bike';bike.x=2100;bike.y=2000;bike.hp=180;bike.maxHp=180;bike.buildingId='';room.state.motorcycles.set(bike.id,bike);
    const rocket=new RocketState();rocket.id='rocket-test';rocket.ownerId=attacker.id;rocket.x=2000;rocket.y=2000;rocket.prevX=rocket.x;rocket.prevY=rocket.y;rocket.vx=WEAPONS.bazooka.projectileSpeed;rocket.vy=0;rocket.life=2;rocket.radius=BAZOOKA_BALANCE.projectileRadius;room.state.rockets.set(rocket.id,rocket);
    room.updateRockets(.25);
    expect(room.state.rockets.has(rocket.id)).toBe(false);
    expect(bike.destroyed).toBe(false);expect(bike.exploding).toBe(false);
    expect(bike.hp).toBe(10);
    const explosion=[...room.state.explosions.values()][0]!;
    expect(explosion.weaponType).toBe('bazooka');expect(explosion.attackerId).toBe(attacker.id);
    expect(explosion.vehicleDamage).toBe(BAZOOKA_BALANCE.directVehicleDamage);expect(explosion.structureDamage).toBe(BAZOOKA_BALANCE.structureDamage);
  });

  it('swaps full or empty weapon slots without moving magazine or reserve-ammo ownership',()=>{
    const room=new Drop8Room() as any;
    const player=new PlayerState();player.id='slot-player';player.phase='landed';player.alive=true;player.primary='bazooka';player.secondary='rifle';player.equipped='bazooka';player.bazookaMagazine=1;player.rifleMagazine=7;player.rocketAmmo=3;player.standardAmmo=51;room.state.players.set(player.id,player);
    const sent:any[]=[];const client={sessionId:player.id,send:(type:string,payload:any)=>sent.push({type,payload})};
    room.swapWeaponSlots(client,{from:1,to:2});
    expect(player.primary).toBe('rifle');expect(player.secondary).toBe('bazooka');expect(player.equipped).toBe('bazooka');
    expect(player.bazookaMagazine).toBe(1);expect(player.rifleMagazine).toBe(7);expect(player.rocketAmmo).toBe(3);expect(player.standardAmmo).toBe(51);
    player.primary='';room.swapWeaponSlots(client,{from:1,to:2});
    expect(player.primary).toBe('bazooka');expect(player.secondary).toBe('');expect(player.bazookaMagazine).toBe(1);expect(sent.some((item)=>item.type==='slotSwapResult')).toBe(true);
  });

  it('drops and re-picks a bazooka without duplicating its magazine or rocket reserve',()=>{
    const room=new Drop8Room() as any;room.state.mapId='small';room.state.worldSize=MAP_CONFIGS.small.width;
    const player=new PlayerState();player.id='drop-pickup-player';player.phase='landed';player.alive=true;player.x=1900;player.y=2000;player.primary='bazooka';player.equipped='bazooka';player.bazookaMagazine=1;player.rocketAmmo=3;player.buildingId='';player.roomIndex=0;room.state.players.set(player.id,player);
    const client={sessionId:player.id,send:()=>undefined};
    room.dropWeapon(client,{slot:1});
    const dropped=[...room.state.loot.values()].find((loot:any)=>loot.kind==='bazooka') as any;
    expect(player.primary).toBe('');expect(player.bazookaMagazine).toBe(0);expect(player.rocketAmmo).toBe(3);
    expect(dropped?.weaponMagazine).toBe(1);expect(dropped?.grantsAmmo).toBe(false);
    const result=room.applyLoot(player,'bazooka',dropped);
    expect(result.success).toBe(true);expect(player.primary).toBe('bazooka');expect(player.bazookaMagazine).toBe(1);expect(player.rocketAmmo).toBe(3);
  });

  it('preserves exact bazooka magazine and rocket reserve in death drops',()=>{
    const room=new Drop8Room() as any;room.state.mapId='small';room.state.worldSize=MAP_CONFIGS.small.width;
    const player=new PlayerState();player.id='drop-player';player.phase='dead';player.x=1900;player.y=2000;player.primary='bazooka';player.bazookaMagazine=1;player.rocketAmmo=4;player.buildingId='';player.roomIndex=0;
    room.dropInventory(player);
    const drops=[...room.state.loot.values()];
    const weapon=drops.find((loot:any)=>loot.kind==='bazooka'),ammo=drops.find((loot:any)=>loot.kind==='rocket_ammo');
    expect(weapon?.weaponMagazine).toBe(1);expect(weapon?.grantsAmmo).toBe(false);expect(ammo?.ammoCount).toBe(4);
  });

  it('keeps every roof and the window overlay closed while the viewer is not landed',()=>{
    const scenePath=fileURLToPath(new URL('../../client/src/GameScene.ts',import.meta.url));
    const mainPath=fileURLToPath(new URL('../../client/src/main.ts',import.meta.url));
    const scene=readFileSync(scenePath,'utf8'),main=readFileSync(mainPath,'utf8');
    expect(scene).toContain("if(viewer?.phase!=='landed')return{buildingId:'',roomIndex:0,outdoors:true}");
    expect(scene).toContain("for(const roof of this.buildingRoofs.values())roof.setAlpha(1)");
    expect(scene).toContain("viewer?.alive&&viewer?.phase==='landed'");
    expect(scene).toContain('DROP8_REFACTOR_013H1_LARGE_NESTED_ROOM_WINDOW_DOCK8_TERRAIN_LOOT');
    expect(main).toContain("net.send('swapWeaponSlots',{from,to:slotNumber})");
    expect(main).toContain("net.send('dropWeapon',{slot:slotNumber})");
  });
});
