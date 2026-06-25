import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') id=''; @type('string') name=''; @type('number') x=2048; @type('number') y=2048; @type('number') angle=0;
  @type('number') hp=100; @type('number') armor=0; @type('number') altitude=0; @type('number') kills=0; @type('number') damageDone=0; @type('number') attackSeq=0;
  @type('number') hitSeq=0; @type('number') lastHitAngle=0; @type('number') lastHitDamage=0;
  @type('boolean') alive=true; @type('boolean') ready=false; @type('boolean') ai=false; @type('boolean') host=false; @type('boolean') muted=false;
  @type('string') phase='lobby'; @type('string') primary=''; @type('string') secondary=''; @type('string') melee='fists'; @type('string') equipped='fists';
  @type('number') magazine=0; @type('number') smallAmmo=0; @type('number') rifleAmmo=0; @type('number') shells=0; @type('number') bandages=0; @type('number') medkits=0;
}
export class BulletState extends Schema { @type('string') id=''; @type('string') owner=''; @type('number') x=0; @type('number') y=0; @type('number') vx=0; @type('number') vy=0; @type('number') life=0; @type('number') damage=0; }
export class LootState extends Schema { @type('string') id=''; @type('string') kind=''; @type('number') x=0; @type('number') y=0; }
export class Drop8State extends Schema {
  @type('string') phase='LOBBY'; @type('string') roomCode=''; @type('string') hostId=''; @type('boolean') fillAi=true; @type('string') difficulty='normal'; @type('string') zoneSpeed='normal';
  @type({map:PlayerState}) players=new MapSchema<PlayerState>(); @type({map:BulletState}) bullets=new MapSchema<BulletState>(); @type({map:LootState}) loot=new MapSchema<LootState>();
  @type('number') zoneX=2048; @type('number') zoneY=2048; @type('number') zoneRadius=1950; @type('number') nextZoneRadius=1950; @type('number') zoneTimer=30; @type('number') zoneStage=0;
  @type('number') planeX=0; @type('number') planeY=0; @type('number') planeEndX=4096; @type('number') planeEndY=4096; @type('number') planeProgress=0;
  @type('number') aliveCount=0; @type('string') winner=''; @type(['string']) placements=new ArraySchema<string>();
}
