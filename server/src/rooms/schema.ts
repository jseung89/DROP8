// DROP8_REFACTOR_018_WEREWOLF_SEASON
// DROP8_REFACTOR_017_ADHESIVE_STRIP_LOBBY_BAZOOKA_WATER
// DROP8_REFACTOR_015A_SUPPLY_DROP_FLAMETHROWER
// DROP8_REFACTOR_014_PLANE_VISIBILITY_BAZOOKA_SLOT_SWAP
// DROP8_REFACTOR_013H_FIXED_V3_VISIBILITY_ROOF_RIVER_ZONE_SNIPER_AI
// DROP8_REFACTOR_013H_VISIBILITY_ROOF_RIVER_ZONE_SNIPER
import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
// DROP8_REFACTOR_013_INTERIOR_RIVER_DOCK8


export class WerewolfPlayerState extends Schema {
  @type('boolean') hasCurse=false;
  @type('number') curseExpiresAt=0;
  @type('boolean') ritualizing=false;
  @type('number') ritualStartedAt=0;
  @type('number') ritualCompletesAt=0;
  @type('number') ritualOriginX=0;
  @type('number') ritualOriginY=0;
  @type('boolean') transformPreparing=false;
  @type('number') transformReadyAt=0;
  @type('boolean') transformed=false;
  @type('number') transformEndsAt=0;
  @type('number') sprintGauge=1;
  @type('boolean') sprinting=false;
  @type('number') sprintRechargeAt=0;
  @type('number') silverSlowUntil=0;
  @type('number') actionLockedUntil=0;
  @type('number') attackRecoveryUntil=0;
  @type('number') huntDismountImmuneUntil=0;
}

export class WerewolfSeasonState extends Schema {
  @type('boolean') enabled=false;
  @type('string') altarPhase='disabled';
  @type('number') altarX=0;
  @type('number') altarY=0;
  @type('number') altarActivatesAt=0;
  @type('number') altarReactivateAt=0;
  @type('number') armoryX=0;
  @type('number') armoryY=0;
  @type('boolean') armoryActive=false;
  @type('boolean') armoryOpened=false;
  @type('string') armoryOpenedBy='';
  @type('string') curseOwnerId='';
  @type('string') werewolfPlayerId='';
  @type('boolean') curseDropActive=false;
  @type('number') curseDropX=0;
  @type('number') curseDropY=0;
  @type('number') curseDropRemaining=0;
  @type('number') cycle=0;
  @type('boolean') initialNoticeSent=false;
  @type('boolean') disabledForEndgame=false;
}

export class PlayerState extends Schema {
  @type('string') id='';
  @type('string') name='';
  @type('number') x=2048;
  @type('number') y=2048;
  @type('number') angle=0;

  @type('number') hp=100;
  @type('number') armor=0;
  @type('number') altitude=0;
  @type('number') kills=0;
  @type('number') damageDone=0;
  @type('number') attackSeq=0;
  @type('number') hitSeq=0;
  @type('number') lastHitAngle=0;
  @type('number') lastHitDamage=0;

  @type('boolean') alive=true;
  @type('boolean') ready=false;
  @type('boolean') ai=false;
  @type('boolean') host=false;
  @type('boolean') muted=false;
  @type('boolean') inBush=false;
  @type('boolean') bushRevealed=false;
  @type('boolean') reloading=false;
  @type('boolean') insideBuilding=false;
  @type('boolean') isSniperScoped=false;
  @type('boolean') isDriving=false;
  @type('boolean') isVaulting=false;
  @type('boolean') isSwimming=false;

  @type('string') phase='lobby';
  @type('string') primary='';
  @type('string') secondary='';
  @type('string') melee='fists';
  @type('string') equipped='fists';
  @type('string') aiState='LOBBY';
  @type('string') buildingId='';
  @type('uint16') roomIndex=0;
  @type('string') vehicleId='';
  @type('string') vaultWindowId='';
  @type('string') throwableType='';
  @type('number') throwableCount=0;
  @type('boolean') isPreparingThrow=false;
  @type('number') throwCharge=0;
  @type('string') previousEquipped='fists';

  @type('number') magazine=0;
  @type('number') pistolMagazine=0;
  @type('number') smgMagazine=0;
  @type('number') rifleMagazine=0;
  @type('number') shotgunMagazine=0;
  @type('number') sniperMagazine=0;
  @type('number') bazookaMagazine=0;
  @type('number') flamethrowerMagazine=0;
  @type('number') pistolAmmo=0;
  @type('number') standardAmmo=0;
  @type('number') shotgunAmmo=0;
  @type('number') rocketAmmo=0;
  @type('number') fuelAmmo=0;
  @type('number') bandages=0;
  @type('number') medkits=0;

  @type('string') healingKind='';
  @type('number') healingProgress=0;
  @type('string') reloadWeapon='';
  @type('number') reloadProgress=0;
  @type('number') buildingTransitionSeq=0;
  @type('number') vaultProgress=0;
  @type(WerewolfPlayerState) werewolf=new WerewolfPlayerState();
}

export class TacticalInventoryState extends Schema {
  @type('string') id='';
  @type('number') adhesiveSprayerMagazine=0;
  @type('number') adhesiveCharge=0;
  @type('number') stripTrapCount=0;
  @type('number') silverCrossbowMagazine=0;
  @type('number') silverBoltAmmo=0;
}

export class BulletState extends Schema {
  @type('string') id='';
  @type('string') owner='';
  @type('number') x=0;
  @type('number') y=0;
  @type('number') vx=0;
  @type('number') vy=0;
  @type('number') prevX=0;
  @type('number') prevY=0;
  @type('number') life=0;
  @type('number') traveled=0;
  @type('number') damage=0;
  @type('number') radius=2.4;
  @type('string') weaponId='';
  @type('string') buildingId='';
  @type('string') vehicleId='';
  @type('string') vaultWindowId='';
  @type('number') shotSeq=0;
}

export class RocketState extends Schema {
  @type('string') id='';
  @type('string') ownerId='';
  @type('number') x=0;
  @type('number') y=0;
  @type('number') prevX=0;
  @type('number') prevY=0;
  @type('number') vx=0;
  @type('number') vy=0;
  @type('number') life=0;
  @type('number') traveled=0;
  @type('number') radius=7;
  @type('string') buildingId='';
}

export class ThrownObjectState extends Schema {
  @type('string') id='';
  @type('string') ownerId='';
  @type('string') kind='';
  @type('number') x=0;
  @type('number') y=0;
  @type('number') z=0;
  @type('number') vx=0;
  @type('number') vy=0;
  @type('number') vz=0;
  @type('number') bounces=0;
  @type('string') phase='flying';
  @type('number') spawnedAt=0;
  @type('number') detonateAt=0;
  @type('string') buildingId='';
}

export class SmokeFieldState extends Schema {
  @type('string') id='';
  @type('string') ownerId='';
  @type('number') x=0;
  @type('number') y=0;
  @type('number') radius=0;
  @type('number') maxRadius=0;
  @type('number') startedAt=0;
  @type('number') expiresAt=0;
  @type('string') buildingId='';
}

export class FireFieldState extends Schema {
  @type('string') id='';
  @type('string') ownerId='';
  @type('number') x=0;
  @type('number') y=0;
  @type('number') radius=115;
  @type('number') startedAt=0;
  @type('number') expiresAt=0;
  @type('number') nextTickAt=0;
  @type('string') buildingId='';
}


export class FlameJetState extends Schema {
  @type('string') id='';
  @type('string') ownerId='';
  @type('number') x=0;
  @type('number') y=0;
  @type('number') angle=0;
  @type('number') range=320;
  @type('number') halfAngle=0;
  @type('number') startedAt=0;
  @type('number') expiresAt=0;
  @type('string') buildingId='';
}

export class AdhesiveJetState extends Schema {
  @type('string') id='';
  @type('string') ownerId='';
  @type('number') x=0;
  @type('number') y=0;
  @type('number') angle=0;
  @type('number') range=315;
  @type('number') halfAngle=0;
  @type('number') startedAt=0;
  @type('number') expiresAt=0;
  @type('string') buildingId='';
}

export class StripTrapState extends Schema {
  @type('string') id='';
  @type('string') ownerId='';
  @type('number') x=0;
  @type('number') y=0;
  @type('number') angle=0;
  @type('number') length=100;
  @type('number') width=14;
  @type('number') hp=30;
  @type('number') maxHp=30;
  @type('number') placedAt=0;
  @type('number') activatesAt=0;
  @type('number') expiresAt=0;
  @type('boolean') active=false;
  @type('string') buildingId='';
}

export class SupplyDropState extends Schema {
  @type('string') id='';
  @type('number') x=0;
  @type('number') y=0;
  @type('number') altitude=0;
  @type('number') spawnedAt=0;
  @type('number') landedAt=0;
  @type('boolean') landed=false;
  @type('boolean') opened=false;
  @type('number') openedAt=0;
  @type('string') openedBy='';
  @type('string') specialWeapon='';
  @type('string') mapId='';
  @type('number') zoneStage=0;
}

export class ExplosionState extends Schema {
  @type('string') id='';
  @type('number') x=0;
  @type('number') y=0;
  @type('number') radius=0;
  @type('number') startedAt=0;
  @type('number') duration=0;
  @type('string') sourceId='';
  @type('string') ownerId='';
  @type('string') kind='motorcycle';
  @type('string') attackerId='';
  @type('string') weaponType='';
  @type('number') vehicleDamage=0;
  @type('number') structureDamage=0;
  @type('string') buildingId='';
}

export class MotorcycleState extends Schema {
  @type('string') id='';
  @type('number') x=0;
  @type('number') y=0;
  @type('number') rotation=0;
  @type('number') speed=0;
  @type('number') velocityX=0;
  @type('number') velocityY=0;
  @type('number') angularVelocity=0;
  @type('string') driverId='';
  @type('number') lastSafeX=0;
  @type('number') lastSafeY=0;
  @type('number') stuckTimeMs=0;
  @type('number') hp=180;
  @type('number') maxHp=180;
  @type('boolean') critical=false;
  @type('boolean') exploding=false;
  @type('boolean') destroyed=false;
  @type('number') explosionAt=0;
  @type('number') destroyedAt=0;
  @type('number') lastDamagedAt=0;
  @type('string') lastDamagedBy='';
  @type('string') buildingId='';
  @type('string') slowKind='';
  @type('number') slowSpeedMultiplier=1;
  @type('number') slowAccelerationMultiplier=1;
  @type('number') slowSteeringMultiplier=1;
  @type('number') slowUntil=0;
  @type('string') huntMarkedBy='';
  @type('number') huntMarkUntil=0;
}

export class LootState extends Schema {
  @type('string') id='';
  @type('string') kind='';
  @type('number') x=0;
  @type('number') y=0;
  @type('string') buildingId='';
  @type('uint16') roomIndex=0;
  @type('string') vehicleId='';
  @type('string') vaultWindowId='';
  @type('number') weaponMagazine=-1;
  @type('number') stackCount=1;
  @type('number') ammoCount=-1;
  @type('boolean') grantsAmmo=true;
  @type('string') pickupLockedForPlayerId='';
  @type('number') pickupLockedUntil=0;
}

export class Drop8State extends Schema {
  @type('string') phase='LOBBY';
  @type('string') roomCode='';
  @type('string') hostId='';
  @type('boolean') fillAi=true;
  @type('boolean') publicRoom=true;
  @type('string') difficulty='normal';
  @type('string') zoneSpeed='normal';
  @type('string') mapId='small';
  @type('string') mapSizeMode='small';
  @type('number') mapRevision=0;
  @type('number') worldSize=4096;

  @type({map:PlayerState}) players=new MapSchema<PlayerState>();
  @type({map:TacticalInventoryState}) tacticalInventories=new MapSchema<TacticalInventoryState>();
  @type({map:BulletState}) bullets=new MapSchema<BulletState>();
  @type({map:RocketState}) rockets=new MapSchema<RocketState>();
  @type({map:LootState}) loot=new MapSchema<LootState>();
  @type({map:MotorcycleState}) motorcycles=new MapSchema<MotorcycleState>();
  @type({map:ExplosionState}) explosions=new MapSchema<ExplosionState>();
  @type({map:ThrownObjectState}) thrownObjects=new MapSchema<ThrownObjectState>();
  @type({map:SmokeFieldState}) smokeFields=new MapSchema<SmokeFieldState>();
  @type({map:FireFieldState}) fireFields=new MapSchema<FireFieldState>();
  @type({map:FlameJetState}) flameJets=new MapSchema<FlameJetState>();
  @type({map:AdhesiveJetState}) adhesiveJets=new MapSchema<AdhesiveJetState>();
  @type({map:StripTrapState}) stripTraps=new MapSchema<StripTrapState>();
  @type({map:SupplyDropState}) supplyDrops=new MapSchema<SupplyDropState>();
  @type(WerewolfSeasonState) werewolfSeason=new WerewolfSeasonState();

  @type('number') zoneX=2048;
  @type('number') zoneY=2048;
  @type('number') zoneRadius=1950;
  @type('number') zoneStartX=2048;
  @type('number') zoneStartY=2048;
  @type('number') zoneStartRadius=1950;
  @type('number') nextZoneX=2048;
  @type('number') nextZoneY=2048;
  @type('number') nextZoneRadius=1950;
  @type('number') zoneTimer=30;
  @type('number') zoneStage=0;
  @type('number') zoneProgress=0;
  @type('boolean') zoneActive=false;
  @type('string') zoneState='FREE';
  @type('boolean') supplySpawned=false;
  @type('string') supplyDropId='';

  @type('number') planeStartX=0;
  @type('number') planeStartY=0;
  @type('number') planeX=0;
  @type('number') planeY=0;
  @type('number') planeEndX=4096;
  @type('number') planeEndY=4096;
  @type('number') planeAngle=0;
  @type('number') planeProgress=0;

  @type('number') serverTime=0;
  @type('number') serverTickAvg=0;
  @type('number') serverTickP95=0;
  @type('number') serverTickMax=0;
  @type('number') serverAiMs=0;
  @type('number') serverCollisionMs=0;
  @type('number') serverZoneMs=0;
  @type('number') serverVehicleMs=0;
  @type('number') recoveryCount=0;
  @type('number') vehicleRecoveryCount=0;
  @type('number') activeBulletLimit=400;

  @type('number') aliveCount=0;
  @type('string') winner='';
  @type(['string']) placements=new ArraySchema<string>();
}
