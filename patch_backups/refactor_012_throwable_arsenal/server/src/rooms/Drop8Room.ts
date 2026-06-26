import { Client, CloseCode, Room } from '@colyseus/core';
import { BulletState, Drop8State, ExplosionState, LootState, MotorcycleState, PlayerState } from './schema.js';
import {
  BUSH_FIRE_REVEAL_SECONDS,
  BUSH_HIDE_DISTANCE,
  BUSH_HIT_REVEAL_SECONDS,
  CHAT_RADIUS,
  FALL_START_ALTITUDE,
  GUN_LOOT_MIN_DISTANCE,
  LOOT_DOOR_CLEARANCE,
  LOOT_MIN_DISTANCE,
  LOOT_WALL_CLEARANCE,
  MAX_PLAYERS,
  MELEE_WEAPONS,
  MOTORCYCLE_BALANCE,
  MOTORCYCLE_DESTRUCTION_BALANCE,
  MOTORCYCLE_COLLISION_COOLDOWN,
  MOTORCYCLE_DIRECT_ACCELERATION,
  MOTORCYCLE_DIRECT_DECELERATION,
  MOTORCYCLE_LAUNCH_SPEED,
  MOTORCYCLE_MAX_SPEED,
  MOTORCYCLE_MAX_TURN_RATE,
  MOTORCYCLE_MOUNT_DISTANCE,
  MOTORCYCLE_RADIUS,
  MOTORCYCLE_ROTATION_RESPONSE,
  MOTORCYCLE_SCOPE_SPEED_RATIO,
  PATCH_RATE_MS,
  PLANE_DURATION,
  PLAYER_BODY_RADIUS,
  PLAYER_HIT_RADIUS,
  PLAYER_SEPARATION_RADIUS,
  PLAYER_SPEED,
  PROJECTILE_CONFIGS,
  REGION_LOOT_TABLES,
  SERVER_TICK_RATE,
  SNIPER_SCOPE_MOVE_MULTIPLIER,
  WEAPONS,
  WINDOW_INTERACTION_DISTANCE,
  WINDOW_VAULT_COOLDOWN_MS,
  WINDOW_VAULT_DURATION_MS,
  buildingIdAt,
  buildingSpacesInteractable,
  buildingZoneById,
  circleHitsRect,
  clamp,
  createNextZone,
  createPlaneRoute,
  createRoomCode,
  createSeededRandom,
  distance,
  explosionExposureMultiplier,
  findWindowVaultCandidate,
  getMapConfig,
  isFiniteNumber,
  motorcycleCollisionDamage,
  motorcycleExplosionDamage,
  motorcyclePlayerCollisionDamage,
  motorcycleProjectileDamage,
  motorcycleWallCollisionDamage,
  motorcycleDirectionRetention,
  motorcycleSpeedMultiplier,
  motorcycleSpreadRadians,
  normalizeAimVector,
  normalizeMovementInput,
  sanitizeText,
  segmentCircleIntersectionT,
  segmentRectIntersectionT,
  visibilitySampleResult,
  weightedLootChoice,
  type AmmoType,
  type Building,
  type Difficulty,
  type EquippedId,
  type LootKind,
  type MapConfig,
  type MapSizeMode,
  type MeleeId,
  type RegionId,
  type WeaponId,
  type ZoneSpeed,
} from '@drop8/shared';
import { removePublicRoom, upsertPublicRoom } from '../roomRegistry.js';

type Input = { x:number; y:number; aimX:number; aimY:number; angle:number; seq:number; aiming:boolean; accelerate:boolean; brake:boolean; turnLeft:boolean; turnRight:boolean };
type Point = { x:number; y:number };
type AiMode = 'move'|'retreat'|'hold';
type AiIntent = {
  tx:number;
  ty:number;
  targetId:string;
  lootId:string;
  mode:AiMode;
  state:string;
  avoidSign:number;
  stuckFor:number;
  lastX:number;
  lastY:number;
  route:Point[];
  lastSeenX:number;
  lastSeenY:number;
  lastSeenUntil:number;
  routeGoalX:number;
  routeGoalY:number;
  repathAt:number;
};
type HealKind = 'bandage'|'medkit';
type HealJob = { at:number; startedAt:number; duration:number; amount:number; kind:HealKind };
type ReloadJob = { at:number; startedAt:number; duration:number; weapon:WeaponId };
type Noise = { x:number; y:number; at:number; owner:string };
type LootReservation={aiId:string;expiresAt:number;lastDistance:number};
type SafePoint={x:number;y:number;mapId:string;buildingId:string;recordedAt:number};
type StuckState={lastX:number;lastY:number;movingSince:number;lastRecoveryAt:number};
type VehicleStuckState={lastX:number;lastY:number;stuckFor:number;lastRecoveryAt:number};
type VehicleMotionState={movementHeldMs:number;previousInputX:number;previousInputY:number;mountedAt:number;directionPenaltyUntil:number};
type VaultJob={startX:number;startY:number;targetX:number;targetY:number;startedAt:number;duration:number;windowId:string;targetBuildingId:string;transitioned:boolean};
type JoinOptions = {
  nickname?:unknown;
  password?:unknown;
  fillAi?:boolean;
  difficulty?:Difficulty;
  zoneSpeed?:ZoneSpeed;
  roomPassword?:unknown;
  publicRoom?:boolean;
  mapSizeMode?:MapSizeMode;
};

const AI_NAMES=['바람','돌멩이','야옹','쏜다','도망','파밍왕','생존봇'];

export class Drop8Room extends Room<{ state: Drop8State }> {
  maxClients=MAX_PLAYERS;
  state=new Drop8State();

  private inputs=new Map<string,Input>();
  private shotAt=new Map<string,number>();
  private reloadUntil=new Map<string,ReloadJob>();
  private healUntil=new Map<string,HealJob>();
  private aiThinkAt=new Map<string,number>();
  private aiIntent=new Map<string,AiIntent>();
  private aiSwitchAt=new Map<string,number>();
  private aiLandedAt=new Map<string,number>();
  private aiDefendUntil=new Map<string,number>();
  private lootReservations=new Map<string,LootReservation>();
  private bushRevealUntil=new Map<string,number>();
  private lastSafePositions=new Map<string,SafePoint>();
  private stuckStates=new Map<string,StuckState>();
  private knockback=new Map<string,{vx:number;vy:number}>();
  private chatAt=new Map<string,number>();
  private noises:Noise[]=[];
  private password='';
  private elapsed=0;
  private bulletSeq=0;
  private lootSeq=0;
  private planeStart={x:0,y:0};
  private planeEnd={x:4096,y:4096};
  private lootRandom:()=>number=Math.random;
  private zoneShrinkDuration=28;
  private tickSamples:number[]=[];
  private perfLastPublish=0;
  private registryLastSync=0;
  private createdAt=Date.now();
  private exitReasons=new Map<string,'left'|'kicked'>();
  private bulletRemoveQueue=new Set<string>();
  private vehicleCollisionAt=new Map<string,number>();
  private vehicleStuckStates=new Map<string,VehicleStuckState>();
  private vehicleMotionStates=new Map<string,VehicleMotionState>();
  private vaultJobs=new Map<string,VaultJob>();
  private vaultCooldownUntil=new Map<string,number>();
  private vehicleWallDamageAt=new Map<string,number>();
  private vehicleShotDamage=new Map<string,{damage:number;expiresAt:number}>();
  private vehicleAttackerAt=new Map<string,number>();
  private explosionSeq=0;
  private audioEventSeq=0;

  private get map():MapConfig{return getMapConfig(this.state.mapSizeMode as MapSizeMode);}
  private get worldSize(){return this.map.width;}

  async onCreate(options:JoinOptions) {
    let code=createRoomCode();
    for(let i=0;i<8 && await this.presence.get(`drop8:${code}`);i++)code=createRoomCode();
    await this.presence.setex(`drop8:${code}`,'1',60*60*8);
    this.roomId=code;
    this.state.roomCode=code;
    this.state.fillAi=options.fillAi!==false;
    this.state.publicRoom=options.publicRoom!==false;
    this.state.difficulty=options.difficulty??'normal';
    this.state.zoneSpeed=options.zoneSpeed??'normal';
    this.state.mapSizeMode=options.mapSizeMode==='large'?'large':'small';
    this.state.mapId=this.state.mapSizeMode;
    this.state.worldSize=this.map.width;
    this.password=sanitizeText(options.roomPassword,32);
    this.patchRate=PATCH_RATE_MS;
    this.setSimulationInterval((dt)=>this.tick(dt/1000),1000/SERVER_TICK_RATE);

    this.onMessage('ready',(c)=>this.ready(c));
    this.onMessage('settings',(c,m)=>this.settings(c,m));
    this.onMessage('start',(c)=>this.start(c));
    this.onMessage('input',(c,m)=>this.input(c,m));
    this.onMessage('jump',(c)=>this.jump(c));
    this.onMessage('vaultWindow',(c)=>this.vaultWindow(c));
    this.onMessage('fire',(c)=>this.fire(c));
    this.onMessage('melee',(c)=>this.melee(c));
    this.onMessage('reload',(c)=>this.reload(c));
    this.onMessage('interact',(c)=>this.interact(c));
    this.onMessage('pickup',(c)=>this.pickup(c));
    this.onMessage('switch',(c,m)=>this.switchWeapon(c,m));
    this.onMessage('heal',(c,m)=>this.heal(c,m));
    this.onMessage('chat',(c,m)=>this.chat(c,m));
    this.onMessage('kick',(c,m)=>this.kick(c,m));
    this.onMessage('ping',(c,m)=>c.send('pong',{t:Number(m?.t)||Date.now(),serverTime:Date.now()}));
    this.onMessage('rematch',(c)=>{
      if(this.state.phase==='FINISHED'&&this.state.players.get(c.sessionId)?.host)this.resetLobby();
    });
    this.syncRoomRegistry();
  }

  onAuth(_client:Client,options:JoinOptions){
    if(this.password&&sanitizeText(options.password,32)!==this.password)throw new Error('비밀번호가 맞지 않습니다.');
    return true;
  }

  onJoin(client:Client,options:JoinOptions){
    const p=new PlayerState();
    p.id=client.sessionId;
    p.name=sanitizeText(options.nickname,16)||`유저${this.clients.length}`;
    p.host=this.state.players.size===0;
    this.state.players.set(client.sessionId,p);
    if(p.host)this.state.hostId=p.id;
    this.system(`${p.name}님이 입장했습니다.`);
    this.syncRoomRegistry();
  }

  async onLeave(client:Client,code:CloseCode){
    const p=this.state.players.get(client.sessionId);
    if(!p)return;
    const reason=this.exitReasons.get(client.sessionId);
    this.exitReasons.delete(client.sessionId);
    if(!reason&&this.state.phase!=='LOBBY'&&code!==CloseCode.CONSENTED){
      try{await this.allowReconnection(client,15);return;}catch{/* reconnect timeout */}
    }
    this.removePlayer(client.sessionId,reason??'left');
  }

  private removePlayer(playerId:string,reason:'left'|'kicked'){
    const p=this.state.players.get(playerId);
    if(!p)return;
    const wasHost=p.host;
    this.detachPlayerFromVehicle(p);
    p.isSniperScoped=false;
    if(this.state.phase!=='LOBBY'&&p.alive){
      p.alive=false;
      p.phase='dead';
      this.dropInventory(p);
    }
    this.state.players.delete(playerId);
    this.inputs.delete(playerId);
    this.cancelHeal(p);
    this.cancelReload(p);
    this.lastSafePositions.delete(playerId);
    this.stuckStates.delete(playerId);
    this.vaultJobs.delete(playerId);
    this.vaultCooldownUntil.delete(playerId);
    this.aiIntent.delete(playerId);
    this.aiThinkAt.delete(playerId);
    this.aiSwitchAt.delete(playerId);
    this.aiLandedAt.delete(playerId);
    this.aiDefendUntil.delete(playerId);
    this.bushRevealUntil.delete(playerId);
    this.knockback.delete(playerId);
    this.chatAt.delete(playerId);
    this.system(reason==='kicked'?`${p.name}님이 방장에 의해 퇴장했습니다.`:`${p.name}님이 퇴장했습니다.`);
    if(wasHost){
      const next=[...this.state.players.values()].find((value)=>!value.ai);
      if(next){
        next.host=true;
        this.state.hostId=next.id;
        this.system(`${next.name}님이 새로운 방장이 되었습니다.`);
      }else this.state.hostId='';
    }
    this.finishCheck();
    this.syncRoomRegistry();
  }

  private kick(client:Client,message:any){
    const requester=this.state.players.get(client.sessionId);
    if(!requester?.host)return client.send('error','방장만 강퇴할 수 있습니다.');
    const targetId=sanitizeText(message?.targetPlayerId,80);
    if(!targetId||targetId===client.sessionId)return client.send('error','자기 자신은 강퇴할 수 없습니다.');
    const targetPlayer=this.state.players.get(targetId);
    if(!targetPlayer||targetPlayer.ai)return client.send('error','강퇴할 수 없는 대상입니다.');
    const targetClient=this.clients.find((candidate)=>candidate.sessionId===targetId);
    if(!targetClient)return client.send('error','대상이 이미 퇴장했습니다.');
    this.exitReasons.set(targetId,'kicked');
    targetClient.send('kicked',{message:'방장에 의해 방에서 나갔습니다.'});
    targetClient.leave(CloseCode.CONSENTED,'kicked');
  }

  onDispose(){removePublicRoom(this.roomId);void this.presence.del(`drop8:${this.roomId}`);}

  private system(text:string){const now=Date.now();this.broadcast('chat',{channel:'system',sender:'시스템',nickname:'시스템',text,time:now,sentAt:now});}
  private emitAudioEvent(type:string,data:Record<string,unknown>={},target?:Client){
    const payload={id:`audio-${++this.audioEventSeq}`,type,createdAt:Date.now(),...data};
    if(target)target.send('audioEvent',payload);else this.broadcast('audioEvent',payload);
  }
  private playerClient(playerId:string){return this.clients.find((client)=>client.sessionId===playerId);}

  private ready(c:Client){
    const p=this.state.players.get(c.sessionId);
    if(p&&this.state.phase==='LOBBY'){
      p.ready=!p.ready;
      this.system(`${p.name}님이 ${p.ready?'준비했습니다.':'준비를 취소했습니다.'}`);
    }
  }

  private settings(c:Client,m:any){
    const p=this.state.players.get(c.sessionId);
    if(!p?.host||this.state.phase!=='LOBBY')return;
    if(typeof m?.fillAi==='boolean')this.state.fillAi=m.fillAi;
    if(['easy','normal','hard'].includes(m?.difficulty))this.state.difficulty=m.difficulty;
    if(['slow','normal','fast'].includes(m?.zoneSpeed))this.state.zoneSpeed=m.zoneSpeed;
    if(m?.mapSizeMode==='small'||m?.mapSizeMode==='large'){
      this.state.mapSizeMode=m.mapSizeMode;
      this.state.mapId=m.mapSizeMode;
      this.state.worldSize=this.map.width;
      this.state.mapRevision++;
      for(const player of this.state.players.values())player.ready=false;
      this.system(`맵이 ${this.map.displayName}으로 변경되었습니다.`);
    }
    this.syncRoomRegistry();
  }

  private start(c:Client){
    const p=this.state.players.get(c.sessionId);
    if(!p?.host||this.state.phase!=='LOBBY')return;
    const humans=[...this.state.players.values()].filter((v)=>!v.ai);
    if(humans.some((v)=>!v.ready)){c.send('error','모든 실제 플레이어가 준비해야 합니다.');return;}
    if(this.state.fillAi)this.fillAi();
    this.beginMatch();
    this.syncRoomRegistry();
  }

  private fillAi(){
    let i=1;
    while(this.state.players.size<MAX_PLAYERS){
      const p=new PlayerState();
      p.id=`ai-${Date.now()}-${i}`;
      p.name=`AI-${AI_NAMES[(i-1)%AI_NAMES.length]}`;
      p.ai=true;
      p.ready=true;
      p.aiState='PLANE';
      this.state.players.set(p.id,p);
      i++;
    }
  }

  private beginMatch(){
    this.clearTransient();
    this.elapsed=0;
    this.lootRandom=createSeededRandom((Date.now()^Math.floor(Math.random()*0xffffffff))>>>0);
    this.state.phase='PLANE';
    this.state.winner='';
    this.state.placements.clear();
    this.state.worldSize=this.map.width;
    this.state.zoneX=this.worldSize/2;
    this.state.zoneY=this.worldSize/2;
    this.state.zoneRadius=this.map.initialZoneRadius;
    this.state.zoneStartX=this.state.zoneX;
    this.state.zoneStartY=this.state.zoneY;
    this.state.zoneStartRadius=this.state.zoneRadius;
    this.state.zoneTimer=30;
    this.state.zoneStage=0;
    this.state.zoneProgress=0;
    this.state.zoneState='WAITING';
    this.prepareNextZone();
    this.choosePlane();

    let aiIndex=0;
    for(const p of this.state.players.values()){
      p.hp=100;
      p.armor=0;
      p.alive=true;
      p.kills=0;
      p.damageDone=0;
      p.attackSeq=0;
      p.hitSeq=0;
      p.lastHitAngle=0;
      p.lastHitDamage=0;
      p.inBush=false;
      p.bushRevealed=false;
      p.buildingId='';
      p.insideBuilding=false;
      p.buildingTransitionSeq=0;
      p.isSniperScoped=false;
      p.isDriving=false;
      p.vehicleId='';
      p.isVaulting=false;
      p.vaultProgress=0;
      p.vaultWindowId='';
      p.reloading=false;
      p.reloadWeapon='';
      p.reloadProgress=0;
      p.phase='plane';
      p.altitude=FALL_START_ALTITUDE;
      p.primary='';
      p.secondary='';
      p.melee='fists';
      p.equipped='fists';
      p.aiState=p.ai?'PLANE':'';
      p.magazine=0;
      p.pistolMagazine=0;
      p.smgMagazine=0;
      p.rifleMagazine=0;
      p.shotgunMagazine=0;
      p.sniperMagazine=0;
      p.pistolAmmo=0;
      p.standardAmmo=0;
      p.shotgunAmmo=0;
      p.bandages=0;
      p.medkits=0;
      p.healingKind='';
      p.healingProgress=0;
      p.x=this.planeStart.x;
      p.y=this.planeStart.y;
      this.lastSafePositions.set(p.id,{x:p.x,y:p.y,mapId:this.map.id,buildingId:'',recordedAt:this.now()});
      this.stuckStates.set(p.id,{lastX:p.x,lastY:p.y,movingSince:0,lastRecoveryAt:-99});
      if(p.ai){
        this.aiThinkAt.set(p.id,3+aiIndex++*1.7);
        this.aiIntent.set(p.id,this.newAiIntent(p));
      }
    }
    this.state.aliveCount=this.state.players.size;
    this.spawnLoot();
    this.spawnMotorcycles();
    this.system('비행기가 출발했습니다. Space로 낙하하세요.');
  }

  private newAiIntent(p:PlayerState):AiIntent{
    return {
      tx:p.x,ty:p.y,targetId:'',lootId:'',mode:'move',state:'PATROL',
      avoidSign:Math.random()<.5?-1:1,stuckFor:0,lastX:p.x,lastY:p.y,
      route:[],lastSeenX:p.x,lastSeenY:p.y,lastSeenUntil:0,
      routeGoalX:p.x,routeGoalY:p.y,repathAt:0,
    };
  }

  private choosePlane(){
    const route=createPlaneRoute(this.lootRandom,this.worldSize,this.map.planeMargin);
    this.planeStart={x:route.startX,y:route.startY};
    this.planeEnd={x:route.endX,y:route.endY};
    this.state.planeStartX=route.startX;
    this.state.planeStartY=route.startY;
    this.state.planeX=route.startX;
    this.state.planeY=route.startY;
    this.state.planeEndX=route.endX;
    this.state.planeEndY=route.endY;
    this.state.planeAngle=route.angle;
    this.state.planeProgress=0;
  }

  private spawnLoot(){
    this.state.loot.clear();
    this.lootReservations.clear();
    for(const spawn of this.map.lootSpawns.slice(0,this.map.lootBudget)){
      const table=REGION_LOOT_TABLES[spawn.regionId as RegionId]??REGION_LOOT_TABLES.residential;
      const kind=weightedLootChoice(table,this.lootRandom);
      const pos=this.findSeparatedLootPosition(spawn.x,spawn.y,kind);
      if(!pos)continue;
      const l=new LootState();
      l.id=`loot-${++this.lootSeq}`;
      l.kind=kind;
      l.x=pos.x;
      l.y=pos.y;
      l.buildingId=buildingIdAt(l.x,l.y,0,this.map.buildingVisibilityZones);
      this.state.loot.set(l.id,l);
    }
  }

  private lootSpacing(kind:LootKind){return kind in WEAPONS&&kind!=='fists'?GUN_LOOT_MIN_DISTANCE:LOOT_MIN_DISTANCE;}

  private doorCenters():Point[]{
    return this.map.buildings.map((building)=>{
      if(building.doorSide==='north'||building.doorSide==='south')return{x:building.x+building.w*building.doorOffset,y:building.doorSide==='north'?building.y:building.y+building.h};
      return{x:building.doorSide==='west'?building.x:building.x+building.w,y:building.y+building.h*building.doorOffset};
    });
  }

  private isLootPositionValid(x:number,y:number,kind:LootKind,ignoreId=''){
    if(x<40||y<40||x>this.worldSize-40||y>this.worldSize-40)return false;
    if(this.map.collisionObstacles.some((rect)=>circleHitsRect(x,y,LOOT_WALL_CLEARANCE,rect)))return false;
    if(this.doorCenters().some((door)=>distance(x,y,door.x,door.y)<LOOT_DOOR_CLEARANCE))return false;
    const min=this.lootSpacing(kind);
    for(const loot of this.state.loot.values()){
      if(loot.id===ignoreId)continue;
      const otherMin=this.lootSpacing(loot.kind as LootKind);
      if(distance(x,y,loot.x,loot.y)<Math.max(min,otherMin))return false;
    }
    return true;
  }

  private findSeparatedLootPosition(baseX:number,baseY:number,kind:LootKind):Point|undefined{
    for(let i=0;i<18;i++){
      const ring=Math.floor(i/6);
      const radius=i===0?0:42+ring*52+this.lootRandom()*28;
      const angle=(i*2.399963+this.lootRandom()*.45)%(Math.PI*2);
      const x=clamp(baseX+Math.cos(angle)*radius,40,this.worldSize-40);
      const y=clamp(baseY+Math.sin(angle)*radius,40,this.worldSize-40);
      if(this.isLootPositionValid(x,y,kind))return{x,y};
    }
    const region=this.map.regions.find((r)=>baseX>=r.x&&baseX<=r.x+r.w&&baseY>=r.y&&baseY<=r.y+r.h);
    if(region){
      for(let i=0;i<18;i++){
        const x=region.x+55+this.lootRandom()*Math.max(1,region.w-110);
        const y=region.y+55+this.lootRandom()*Math.max(1,region.h-110);
        if(this.isLootPositionValid(x,y,kind))return{x,y};
      }
    }
    return undefined;
  }

  private clearTransient(){
    this.state.bullets.clear();
    this.state.loot.clear();
    this.inputs.clear();
    this.shotAt.clear();
    this.reloadUntil.clear();
    this.healUntil.clear();
    this.aiIntent.clear();
    this.aiSwitchAt.clear();
    this.aiLandedAt.clear();
    this.aiDefendUntil.clear();
    this.lootReservations.clear();
    this.bushRevealUntil.clear();
    this.lastSafePositions.clear();
    this.stuckStates.clear();
    this.bulletRemoveQueue.clear();
    this.state.motorcycles.clear();
    this.state.explosions.clear();
    this.vehicleCollisionAt.clear();
    this.vehicleStuckStates.clear();
    this.vehicleMotionStates.clear();
    this.vaultJobs.clear();
    this.vaultCooldownUntil.clear();
    this.vehicleWallDamageAt.clear();
    this.vehicleShotDamage.clear();
    this.vehicleAttackerAt.clear();
    this.knockback.clear();
    this.noises=[];
    this.tickSamples=[];
    this.perfLastPublish=0;
  }

  private input(c:Client,m:any){
    const p=this.state.players.get(c.sessionId);
    if(!p||p.ai||!p.alive)return;
    if(!isFiniteNumber(m?.x)||!isFiniteNumber(m?.y))return;
    const aim=normalizeAimVector(Number(m?.aimX),Number(m?.aimY));
    if(!aim)return;
    const input:Input={
      x:p.isVaulting?0:clamp(m.x,-1,1),y:p.isVaulting?0:clamp(m.y,-1,1),aimX:aim.x,aimY:aim.y,angle:Math.atan2(aim.y,aim.x),seq:Number(m.seq)||0,
      aiming:!p.isVaulting&&Boolean(m?.aiming),accelerate:false,brake:false,turnLeft:false,turnRight:false,
    };
    this.inputs.set(p.id,input);
    p.angle=input.angle;
    const motorcycle=p.vehicleId?this.state.motorcycles.get(p.vehicleId):undefined;
    const speedRatio=motorcycle?Math.hypot(motorcycle.velocityX,motorcycle.velocityY)/MOTORCYCLE_MAX_SPEED:0;
    const scopeAllowed=p.phase==='landed'&&p.equipped==='sniper'&&!p.reloading&&!p.healingKind&&(!p.isDriving||(Math.hypot(input.x,input.y)<.05&&speedRatio<=MOTORCYCLE_SCOPE_SPEED_RATIO));
    p.isSniperScoped=scopeAllowed&&input.aiming;
  }

  private jump(c:Client){const p=this.state.players.get(c.sessionId);if(p?.phase==='plane')this.doJump(p);}

  private vaultWindow(c:Client){
    const p=this.state.players.get(c.sessionId);
    if(!p||p.ai||!p.alive||p.phase!=='landed'||p.isDriving||p.isVaulting)return;
    const now=this.now();
    if(now<(this.vaultCooldownUntil.get(p.id)??0))return;
    const candidate=findWindowVaultCandidate(p.x,p.y,p.buildingId,this.map.buildingVisibilityZones,WINDOW_INTERACTION_DISTANCE);
    if(!candidate)return;
    if(!this.vaultLandingFree(candidate.target.x,candidate.target.y,p.id)){
      c.send('notice',{type:'warning',message:'창문 반대편이 막혀 있습니다.'});
      return;
    }
    this.cancelHeal(p);
    this.cancelReload(p);
    this.knockback.delete(p.id);
    p.isSniperScoped=false;
    const duration=WINDOW_VAULT_DURATION_MS/1000;
    this.vaultJobs.set(p.id,{startX:p.x,startY:p.y,targetX:candidate.target.x,targetY:candidate.target.y,startedAt:now,duration,windowId:candidate.window.id,targetBuildingId:candidate.targetBuildingId,transitioned:false});
    this.vaultCooldownUntil.set(p.id,now+duration+WINDOW_VAULT_COOLDOWN_MS/1000);
    p.isVaulting=true;
    p.vaultProgress=0;
    p.vaultWindowId=candidate.window.id;
    this.inputs.set(p.id,{x:0,y:0,aimX:Math.cos(p.angle),aimY:Math.sin(p.angle),angle:p.angle,seq:0,aiming:false,accelerate:false,brake:false,turnLeft:false,turnRight:false});
  }

  private vaultLandingFree(x:number,y:number,playerId:string){
    if(!this.isPositionFree(x,y,PLAYER_BODY_RADIUS+2))return false;
    for(const motorcycle of this.state.motorcycles.values())if(distance(x,y,motorcycle.x,motorcycle.y)<PLAYER_BODY_RADIUS+MOTORCYCLE_RADIUS+6)return false;
    for(const player of this.state.players.values())if(player.id!==playerId&&player.alive&&player.phase==='landed'&&distance(x,y,player.x,player.y)<PLAYER_SEPARATION_RADIUS*1.75)return false;
    return true;
  }

  private clearVault(p:PlayerState){
    this.vaultJobs.delete(p.id);
    p.isVaulting=false;
    p.vaultProgress=0;
    p.vaultWindowId='';
  }

  private updateVaults(){
    const now=this.now();
    for(const [playerId,job] of [...this.vaultJobs]){
      const p=this.state.players.get(playerId);
      if(!p?.alive||p.phase!=='landed'||p.isDriving){if(p)this.clearVault(p);else this.vaultJobs.delete(playerId);continue;}
      const progress=clamp((now-job.startedAt)/job.duration,0,1);
      p.isVaulting=true;
      p.vaultProgress=progress;
      p.x=job.startX+(job.targetX-job.startX)*progress;
      p.y=job.startY+(job.targetY-job.startY)*progress;
      if(progress>=.5&&!job.transitioned){
        job.transitioned=true;
        if(p.buildingId!==job.targetBuildingId){p.buildingId=job.targetBuildingId;p.insideBuilding=Boolean(job.targetBuildingId);p.buildingTransitionSeq++;}
      }
      if(progress<1)continue;
      if(this.vaultLandingFree(job.targetX,job.targetY,p.id)){p.x=job.targetX;p.y=job.targetY;}
      else if(this.vaultLandingFree(job.startX,job.startY,p.id)){p.x=job.startX;p.y=job.startY;p.buildingId=job.targetBuildingId?'':buildingIdAt(job.startX,job.startY,0,this.map.buildingVisibilityZones);p.insideBuilding=Boolean(p.buildingId);p.buildingTransitionSeq++;}
      else{
        const safe=this.findNearestFreePoint(job.targetX,job.targetY,180)??this.findNearestFreePoint(job.startX,job.startY,180);
        if(safe){p.x=safe.x;p.y=safe.y;p.buildingId=buildingIdAt(safe.x,safe.y,0,this.map.buildingVisibilityZones);p.insideBuilding=Boolean(p.buildingId);p.buildingTransitionSeq++;}
      }
      this.lastSafePositions.set(p.id,{x:p.x,y:p.y,mapId:this.map.id,buildingId:p.buildingId,recordedAt:now});
      this.clearVault(p);
    }
  }

  private doJump(p:PlayerState){
    p.phase='falling';
    p.aiState=p.ai?'FALLING':'';
    p.x=this.state.planeX;
    p.y=this.state.planeY;
    p.altitude=FALL_START_ALTITUDE;
    if(this.state.phase==='PLANE')this.state.phase='DROP';
  }

  private fire(c:Client){const p=this.state.players.get(c.sessionId);if(p)this.firePlayer(p);}

  private firePlayer(p:PlayerState){
    if(!p.alive||p.phase!=='landed'||p.isVaulting)return;
    if(this.healUntil.has(p.id)){this.cancelHeal(p);return;}
    if(this.reloadUntil.has(p.id))return;
    const id=p.equipped as WeaponId;
    const w=WEAPONS[id];
    if(!w||w.id==='fists')return;
    const magazine=this.getWeaponMagazine(p,id);
    if(magazine<=0){if(!this.beginReload(p,id))this.emitAudioEvent('weapon_dry_fire',{sourceId:p.id,variant:id},this.playerClient(p.id));return;}
    const now=this.now();
    if(now-(this.shotAt.get(p.id)??-99)<w.fireInterval)return;
    this.shotAt.set(p.id,now);
    p.attackSeq++;
    this.setWeaponMagazine(p,id,magazine-1);
    this.revealBushPlayer(p,id==='sniper'?2:BUSH_FIRE_REVEAL_SECONDS);
    this.noises.push({x:p.x,y:p.y,at:now,owner:p.id});
    this.emitAudioEvent('weapon_fire',{sourceId:p.id,x:p.x,y:p.y,buildingId:p.buildingId,variant:id,sequence:p.attackSeq});
    const config=PROJECTILE_CONFIGS[id as Exclude<WeaponId,'fists'>];
    if(!config)return;
    while(this.state.bullets.size>=this.state.activeBulletLimit){
      const oldest=this.state.bullets.keys().next().value as string|undefined;
      if(!oldest)break;
      this.state.bullets.delete(oldest);
    }
    const motorcycle=p.isDriving&&p.vehicleId?this.state.motorcycles.get(p.vehicleId):undefined;
    const speedRatio=motorcycle?clamp(Math.hypot(motorcycle.velocityX,motorcycle.velocityY)/MOTORCYCLE_MAX_SPEED,0,1):0;
    const motion=motorcycle?this.vehicleMotionStates.get(motorcycle.id):undefined;
    const turnRatio=motorcycle?Math.max(clamp(Math.abs(motorcycle.angularVelocity)/MOTORCYCLE_MAX_TURN_RATE,0,1),motion&&now<motion.directionPenaltyUntil?1:0):0;
    const spread=motorcycle?motorcycleSpreadRadians(id,w.spread,speedRatio,turnRatio):w.spread;
    if(motorcycle&&id==='sniper'&&speedRatio>MOTORCYCLE_SCOPE_SPEED_RATIO)p.isSniperScoped=false;
    for(let i=0;i<w.pellets;i++){
      const a=p.angle+(Math.random()*2-1)*spread;
      const muzzleOffset=PLAYER_HIT_RADIUS+10;
      const muzzleX=p.x+Math.cos(a)*muzzleOffset;
      const muzzleY=p.y+Math.sin(a)*muzzleOffset;
      const obstacleT=this.firstObstacleHitT(p.x,p.y,muzzleX,muzzleY,1);
      if(obstacleT!==null)continue;
      const b=new BulletState();
      b.id=`b-${++this.bulletSeq}`;
      b.owner=p.id;
      b.weaponId=id;
      b.x=muzzleX;
      b.y=muzzleY;
      b.prevX=muzzleX;
      b.prevY=muzzleY;
      b.vx=Math.cos(a)*config.projectileSpeed;
      b.vy=Math.sin(a)*config.projectileSpeed;
      b.life=config.lifetimeMs/1000;
      b.traveled=0;
      b.damage=config.damage;
      b.radius=config.radius;
      b.buildingId=p.buildingId;
      b.shotSeq=p.attackSeq;
      this.state.bullets.set(b.id,b);
    }
  }

  private melee(c:Client){const p=this.state.players.get(c.sessionId);if(p)this.meleePlayer(p);}

  private meleePlayer(p:PlayerState){
    if(!p.alive||p.phase!=='landed'||p.isVaulting)return;
    if(this.healUntil.has(p.id)){this.cancelHeal(p);return;}
    const melee=p.equipped==='fists'
      ?{name:'주먹',damage:WEAPONS.fists.damage,fireInterval:WEAPONS.fists.fireInterval,range:WEAPONS.fists.range,arc:1.1}
      :MELEE_WEAPONS[p.equipped as MeleeId];
    if(!melee)return;
    const now=this.now();
    if(now-(this.shotAt.get(p.id)??-99)<melee.fireInterval)return;
    this.shotAt.set(p.id,now);
    p.attackSeq++;
    this.revealBushPlayer(p,.7);
    let target:PlayerState|undefined;
    let best=melee.range;
    for(const other of this.state.players.values()){
      if(!other.alive||other.id===p.id||other.phase!=='landed')continue;
      const d=distance(p.x,p.y,other.x,other.y);
      if(d<best&&this.canSeeTarget(p,other)&&Math.abs(this.angleDiff(Math.atan2(other.y-p.y,other.x-p.x),p.angle))<melee.arc){target=other;best=d;}
    }
    if(target)this.damage(target,melee.damage,p.id,p.equipped==='fists'?'주먹':melee.name);
  }

  private reload(c:Client){
    const p=this.state.players.get(c.sessionId);
    if(!p)return;
    p.isSniperScoped=false;
    if(this.healUntil.has(p.id)){this.cancelHeal(p);return;}
    if(!this.beginReload(p)){
      const id=p.equipped as WeaponId,w=WEAPONS[id];
      if(w&&w.id!=='fists'&&this.getWeaponMagazine(p,id)<w.magazine&&this.getAmmo(p,w.ammoType)<=0)c.send('notice',{type:'warning',message:'재장전할 탄약이 없습니다.'});
    }
  }

  private beginReload(p:PlayerState,weaponId:WeaponId=p.equipped as WeaponId){
    p.isSniperScoped=false;
    if(!p.alive||p.phase!=='landed'||p.isVaulting||this.reloadUntil.has(p.id))return false;
    const w=WEAPONS[weaponId];
    if(!w||w.id==='fists'||p.equipped!==weaponId)return false;
    const magazine=this.getWeaponMagazine(p,weaponId);
    if(magazine>=w.magazine||this.getAmmo(p,w.ammoType)<=0)return false;
    const startedAt=this.now();
    this.reloadUntil.set(p.id,{at:startedAt+w.reloadSeconds,startedAt,duration:w.reloadSeconds,weapon:weaponId});
    p.reloading=true;
    p.reloadWeapon=weaponId;
    p.reloadProgress=0;
    if(p.ai)p.aiState='RELOAD';
    this.emitAudioEvent('reload_start',{sourceId:p.id,x:p.x,y:p.y,buildingId:p.buildingId,variant:weaponId});
    return true;
  }

  private cancelReload(p:PlayerState){
    this.reloadUntil.delete(p.id);
    p.reloading=false;
    p.reloadWeapon='';
    p.reloadProgress=0;
  }

  private interact(c:Client){
    const p=this.state.players.get(c.sessionId);
    if(!p||!p.alive||p.phase!=='landed'||p.isVaulting)return;
    if(p.isDriving){this.dismountMotorcycle(c,p);return;}
    let nearest:MotorcycleState|undefined;
    let best=MOTORCYCLE_MOUNT_DISTANCE;
    for(const motorcycle of this.state.motorcycles.values()){
      if(motorcycle.driverId||motorcycle.exploding||motorcycle.destroyed)continue;
      if(!buildingSpacesInteractable(p,motorcycle))continue;
      const d=distance(p.x,p.y,motorcycle.x,motorcycle.y);
      if(d<best){best=d;nearest=motorcycle;}
    }
    if(nearest){this.mountMotorcycle(p,nearest);return;}
    this.pickup(c);
  }

  private mountMotorcycle(p:PlayerState,motorcycle:MotorcycleState){
    if(motorcycle.driverId||motorcycle.exploding||motorcycle.destroyed||p.isDriving||p.isVaulting||!p.alive||p.phase!=='landed')return false;
    if(distance(p.x,p.y,motorcycle.x,motorcycle.y)>MOTORCYCLE_MOUNT_DISTANCE)return false;
    this.cancelHeal(p);this.cancelReload(p);p.isSniperScoped=false;
    p.isDriving=true;p.vehicleId=motorcycle.id;motorcycle.driverId=p.id;
    motorcycle.velocityX=0;motorcycle.velocityY=0;motorcycle.speed=0;motorcycle.angularVelocity=0;
    this.vehicleMotionStates.set(motorcycle.id,{movementHeldMs:0,previousInputX:0,previousInputY:0,mountedAt:this.now(),directionPenaltyUntil:-99});
    p.x=motorcycle.x;p.y=motorcycle.y;
    this.knockback.delete(p.id);
    return true;
  }

  private findDismountPoint(p:PlayerState,motorcycle:MotorcycleState){
    const right=motorcycle.rotation+Math.PI/2,left=motorcycle.rotation-Math.PI/2,back=motorcycle.rotation+Math.PI;
    const candidates=[right,left,back,motorcycle.rotation].map((angle)=>({x:motorcycle.x+Math.cos(angle)*(MOTORCYCLE_RADIUS+PLAYER_BODY_RADIUS+16),y:motorcycle.y+Math.sin(angle)*(MOTORCYCLE_RADIUS+PLAYER_BODY_RADIUS+16)}));
    let point=candidates.find((candidate)=>this.isDismountPositionFree(candidate.x,candidate.y,p.id,motorcycle.id));
    if(!point){
      const nearby=this.findNearestFreePoint(motorcycle.x,motorcycle.y,260,false);
      if(nearby&&this.isDismountPositionFree(nearby.x,nearby.y,p.id,motorcycle.id))point=nearby;
    }
    return point;
  }

  private dismountMotorcycle(c:Client|undefined,p:PlayerState){
    const motorcycle=p.vehicleId?this.state.motorcycles.get(p.vehicleId):undefined;
    if(!motorcycle){p.isDriving=false;p.vehicleId='';p.isSniperScoped=false;return true;}
    const point=this.findDismountPoint(p,motorcycle);
    if(!point){c?.send('notice',{type:'warning',message:'지금은 안전하게 내릴 공간이 없습니다.'});return false;}
    motorcycle.driverId='';motorcycle.velocityX*=.35;motorcycle.velocityY*=.35;motorcycle.speed=Math.hypot(motorcycle.velocityX,motorcycle.velocityY);motorcycle.angularVelocity=0;this.vehicleMotionStates.delete(motorcycle.id);
    p.isDriving=false;p.vehicleId='';p.isSniperScoped=false;p.x=point.x;p.y=point.y;p.buildingId=buildingIdAt(point.x,point.y,0,this.map.buildingVisibilityZones);p.insideBuilding=Boolean(p.buildingId);
    this.lastSafePositions.set(p.id,{x:p.x,y:p.y,mapId:this.map.id,buildingId:p.buildingId,recordedAt:this.now()});
    return true;
  }

  private forceDismountMotorcycle(p:PlayerState,motorcycle:MotorcycleState){
    const point=this.findDismountPoint(p,motorcycle)??this.map.emergencySpawnPoints.find((candidate)=>this.isDismountPositionFree(candidate.x,candidate.y,p.id,motorcycle.id));
    motorcycle.driverId='';motorcycle.velocityX=0;motorcycle.velocityY=0;motorcycle.speed=0;motorcycle.angularVelocity=0;this.vehicleMotionStates.delete(motorcycle.id);
    p.isDriving=false;p.vehicleId='';p.isSniperScoped=false;
    if(point){p.x=point.x;p.y=point.y;p.buildingId=buildingIdAt(point.x,point.y,0,this.map.buildingVisibilityZones);p.insideBuilding=Boolean(p.buildingId);this.lastSafePositions.set(p.id,{x:p.x,y:p.y,mapId:this.map.id,buildingId:p.buildingId,recordedAt:this.now()});}
  }

  private isDismountPositionFree(x:number,y:number,playerId:string,vehicleId:string){
    if(!this.isPositionFree(x,y)||buildingIdAt(x,y,0,this.map.buildingVisibilityZones))return false;
    for(const motorcycle of this.state.motorcycles.values())if(motorcycle.id!==vehicleId&&distance(x,y,motorcycle.x,motorcycle.y)<MOTORCYCLE_RADIUS+PLAYER_BODY_RADIUS+8)return false;
    for(const player of this.state.players.values())if(player.id!==playerId&&player.alive&&player.phase==='landed'&&distance(x,y,player.x,player.y)<PLAYER_SEPARATION_RADIUS*2)return false;
    return true;
  }

  private detachPlayerFromVehicle(p:PlayerState){
    if(p.vehicleId){const motorcycle=this.state.motorcycles.get(p.vehicleId);if(motorcycle?.driverId===p.id){motorcycle.driverId='';motorcycle.velocityX*=.35;motorcycle.velocityY*=.35;motorcycle.speed=Math.hypot(motorcycle.velocityX,motorcycle.velocityY);motorcycle.angularVelocity=0;this.vehicleMotionStates.delete(motorcycle.id);}}
    p.vehicleId='';p.isDriving=false;p.isSniperScoped=false;
  }

  private pickup(c:Client){
    const p=this.state.players.get(c.sessionId);
    if(!p||p.phase!=='landed'||!p.alive||p.isDriving||p.isVaulting)return;
    if(this.healUntil.has(p.id))this.cancelHeal(p);
    const now=this.now();
    let pick:LootState|undefined;
    let best=72;
    for(const l of this.state.loot.values()){
      if(l.pickupLockedForPlayerId===p.id&&now<l.pickupLockedUntil)continue;
      if(!buildingSpacesInteractable(p,l))continue;
      const d=distance(p.x,p.y,l.x,l.y);
      if(d<best){best=d;pick=l;}
    }
    if(!pick)return;
    const kind=pick.kind as LootKind;
    const equippedBefore=p.equipped;
    const result=this.applyLoot(p,kind,pick);
    if(!result.success)return;
    c.send('pickupResult',{kind,equipped:p.equipped,autoEquipped:p.equipped!==equippedBefore&&(kind in WEAPONS||kind in MELEE_WEAPONS),droppedKind:result.droppedKind??'',droppedMagazine:result.droppedMagazine??-1});
    this.state.loot.delete(pick.id);
    this.lootReservations.delete(pick.id);
  }

  private applyLoot(p:PlayerState,k:LootKind,source?:LootState):{success:boolean;droppedKind?:WeaponId;droppedMagazine?:number}{
    if(k in WEAPONS&&k!=='fists')return this.applyWeaponLoot(p,k as WeaponId,source);
    if(k in MELEE_WEAPONS){p.melee=k;this.setEquipped(p,k as MeleeId,true);return{success:true};}
    if(k==='pistol_ammo')p.pistolAmmo+=30;
    else if(k==='standard_ammo')p.standardAmmo+=24;
    else if(k==='shotgun_ammo')p.shotgunAmmo+=12;
    else if(k==='vest')p.armor=Math.max(p.armor,100);
    else if(k==='bandage')p.bandages=Math.min(5,p.bandages+1);
    else if(k==='medkit')p.medkits=Math.min(2,p.medkits+1);
    return{success:true};
  }

  private applyWeaponLoot(p:PlayerState,id:WeaponId,source?:LootState):{success:boolean;droppedKind?:WeaponId;droppedMagazine?:number}{
    const weapon=WEAPONS[id];
    if(!weapon||id==='fists')return{success:false};
    const alreadyOwned=p.primary===id||p.secondary===id;
    if(alreadyOwned){
      if(source&&source.weaponMagazine>=0)this.setWeaponMagazine(p,id,Math.max(this.getWeaponMagazine(p,id),source.weaponMagazine),false);
      this.grantWeaponPickupAmmo(p,weapon,source);
      this.setEquipped(p,id,true);
      return{success:true};
    }

    const preferred=weapon.slot==='secondary'?'secondary':'primary';
    const alternate=preferred==='primary'?'secondary':'primary';
    let slot:'primary'|'secondary';
    if(!p[preferred])slot=preferred;
    else if(!p[alternate])slot=alternate;
    else if(p.primary===p.equipped)slot='primary';
    else if(p.secondary===p.equipped)slot='secondary';
    else slot=preferred;

    const outgoing=p[slot] as WeaponId|'';
    let drop:LootState|undefined;
    let droppedMagazine=-1;
    if(outgoing){
      const point=this.findWeaponDropPosition(p,outgoing,source?.id??'');
      if(!point)return{success:false};
      droppedMagazine=this.getWeaponMagazine(p,outgoing);
      drop=new LootState();
      drop.id=`loot-${++this.lootSeq}`;
      drop.kind=outgoing;
      drop.x=point.x;
      drop.y=point.y;
      drop.buildingId=p.buildingId;
      drop.weaponMagazine=droppedMagazine;
      drop.grantsAmmo=false;
      drop.pickupLockedForPlayerId=p.id;
      drop.pickupLockedUntil=this.now()+.85;
    }

    this.cancelReload(p);
    p.isSniperScoped=false;
    p[slot]=id;
    const incomingMagazine=source&&source.weaponMagazine>=0?source.weaponMagazine:weapon.magazine;
    this.setWeaponMagazine(p,id,incomingMagazine,false);
    this.grantWeaponPickupAmmo(p,weapon,source);
    if(drop)this.state.loot.set(drop.id,drop);
    this.setEquipped(p,id,true);
    return{success:true,droppedKind:outgoing||undefined,droppedMagazine:outgoing?droppedMagazine:undefined};
  }

  private grantWeaponPickupAmmo(p:PlayerState,weapon:(typeof WEAPONS)[WeaponId],source?:LootState){
    if(source&&source.grantsAmmo===false)return;
    if(weapon.ammoType==='pistol_ammo')p.pistolAmmo+=weapon.magazine*2;
    if(weapon.ammoType==='standard_ammo')p.standardAmmo+=weapon.magazine*2;
    if(weapon.ammoType==='shotgun_ammo')p.shotgunAmmo+=weapon.magazine*2;
  }

  private findWeaponDropPosition(p:PlayerState,kind:WeaponId,ignoreId=''):Point|undefined{
    const valid=(x:number,y:number)=>{
      if(x<40||y<40||x>this.worldSize-40||y>this.worldSize-40)return false;
      if(buildingIdAt(x,y,0,this.map.buildingVisibilityZones)!==p.buildingId)return false;
      if(this.map.collisionObstacles.some((rect)=>circleHitsRect(x,y,LOOT_WALL_CLEARANCE,rect)))return false;
      if(this.doorCenters().some((door)=>distance(x,y,door.x,door.y)<LOOT_DOOR_CLEARANCE))return false;
      for(const loot of this.state.loot.values()){
        if(loot.id===ignoreId)continue;
        if(distance(x,y,loot.x,loot.y)<30)return false;
      }
      return true;
    };
    const baseAngle=p.angle+Math.PI;
    for(const radius of [34,46,60,78,104,136,176]){
      for(let index=0;index<12;index++){
        const step=Math.ceil(index/2)*(index%2===0?-1:1);
        const offset=index===0?0:step*Math.PI/12;
        const x=clamp(p.x+Math.cos(baseAngle+offset)*radius,40,this.worldSize-40);
        const y=clamp(p.y+Math.sin(baseAngle+offset)*radius,40,this.worldSize-40);
        if(valid(x,y))return{x,y};
      }
    }
    return undefined;
  }

  private switchWeapon(c:Client,m:any){
    const p=this.state.players.get(c.sessionId);
    if(!p||p.isVaulting)return;
    const slot=Number(m?.slot);
    const id=(slot===1?p.primary:slot===2?p.secondary:p.melee||'fists') as EquippedId;
    if(!id||(!(id in WEAPONS)&&!(id in MELEE_WEAPONS)))return;
    this.cancelHeal(p);
    p.isSniperScoped=false;
    this.setEquipped(p,id,true);
  }

  private setEquipped(p:PlayerState,id:EquippedId,force=false){
    if(p.equipped!==id)p.isSniperScoped=false;
    if(p.equipped===id){this.syncMagazine(p);return;}
    if(!force&&p.ai&&this.now()<(this.aiSwitchAt.get(p.id)??0))return;
    this.cancelReload(p);
    p.equipped=id;
    this.syncMagazine(p);
    if(p.ai)this.aiSwitchAt.set(p.id,this.now()+.8);
  }

  private heal(c:Client,m:any){
    const p=this.state.players.get(c.sessionId);
    if(!p)return;
    const requested=m?.kind==='medkit'?'medkit':m?.kind==='bandage'?'bandage':'auto';
    if(!this.beginHeal(p,requested))c.send('notice',{type:'warning',message:p.hp>=100?'이미 체력이 가득합니다.':'사용할 회복 아이템이 없습니다.'});
  }

  private beginHeal(p:PlayerState,requested:'auto'|HealKind='auto'){
    p.isSniperScoped=false;
    if(!p.alive||p.phase!=='landed'||p.isVaulting||p.hp>=100||this.healUntil.has(p.id))return false;
    const missing=100-p.hp;
    let kind:HealKind|''='';
    if(requested==='medkit'&&p.medkits>0)kind='medkit';
    else if(requested==='bandage'&&p.bandages>0)kind='bandage';
    else if(requested==='auto'){
      if(p.medkits>0&&(missing>25||p.bandages<=0))kind='medkit';
      else if(p.bandages>0)kind='bandage';
      else if(p.medkits>0)kind='medkit';
    }
    if(!kind)return false;
    const duration=kind==='medkit'?4:2;
    const amount=kind==='medkit'?60:25;
    const startedAt=this.now();
    this.cancelReload(p);
    this.healUntil.set(p.id,{at:startedAt+duration,startedAt,duration,amount,kind});
    p.healingKind=kind;
    p.healingProgress=0;
    if(p.ai)p.aiState='HEAL';
    this.emitAudioEvent('heal_start',{sourceId:p.id,x:p.x,y:p.y,buildingId:p.buildingId,variant:kind});
    return true;
  }

  private cancelHeal(p:PlayerState){
    if(!this.healUntil.delete(p.id)&&!p.healingKind)return;
    p.healingKind='';
    p.healingProgress=0;
  }

  private chat(c:Client,m:any){
    const p=this.state.players.get(c.sessionId);
    if(!p||p.muted)return;
    const text=sanitizeText(m?.text,80);
    if(!text)return;
    const now=Date.now();
    if(now-(this.chatAt.get(p.id)??0)<650)return;
    this.chatAt.set(p.id,now);
    const base={playerId:p.id,sender:p.name,nickname:p.name,text,time:now,sentAt:now};
    if(this.state.phase==='LOBBY'){
      this.broadcast('chat',{...base,channel:'lobby'});
      return;
    }
    if(!p.alive){
      for(const cl of this.clients){
        const q=this.state.players.get(cl.sessionId);
        if(q&&!q.alive)cl.send('chat',{...base,channel:'spectator'});
      }
      return;
    }
    for(const cl of this.clients){
      const q=this.state.players.get(cl.sessionId);
      if(q?.alive&&distance(p.x,p.y,q.x,q.y)<=CHAT_RADIUS)cl.send('chat',{...base,channel:'nearby'});
    }
  }

  private tick(dt:number){
    if(this.state.phase==='LOBBY'||this.state.phase==='FINISHED')return;
    const tickStarted=performance.now();
    this.elapsed+=dt;
    this.state.serverTime=this.now();
    this.updatePlane(dt);
    const vehicleStarted=performance.now();
    this.updateMotorcycles(dt);
    this.updateVaults();
    this.state.serverVehicleMs=performance.now()-vehicleStarted;
    const collisionStarted=performance.now();
    this.updatePlayers(dt);
    this.resolvePlayerOverlaps();
    this.updateBuildingStates();
    this.updateBushStates();
    this.updateReloads();
    this.updateHeals();
    this.updateBullets(dt);
    this.state.serverCollisionMs=performance.now()-collisionStarted;
    const zoneStarted=performance.now();
    this.updateZone(dt);
    this.state.serverZoneMs=performance.now()-zoneStarted;
    const aiStarted=performance.now();
    this.updateAi(dt);
    this.state.serverAiMs=performance.now()-aiStarted;
    this.updateBushStates();
    this.noises=this.noises.filter((n)=>this.now()-n.at<3);
    this.finishCheck();
    if(this.now()-this.registryLastSync>=2){this.registryLastSync=this.now();this.syncRoomRegistry();}
    this.recordTick(performance.now()-tickStarted);
  }

  private recordTick(duration:number){
    this.tickSamples.push(duration);
    if(this.tickSamples.length>300)this.tickSamples.shift();
    const now=this.now();
    if(now-this.perfLastPublish<.5)return;
    this.perfLastPublish=now;
    const sorted=[...this.tickSamples].sort((a,b)=>a-b);
    const total=sorted.reduce((sum,value)=>sum+value,0);
    this.state.serverTickAvg=sorted.length?total/sorted.length:0;
    this.state.serverTickP95=sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]??0:0;
    this.state.serverTickMax=sorted.at(-1)??0;
  }

  private updatePlane(_dt:number){
    if(!['PLANE','DROP'].includes(this.state.phase))return;
    this.state.planeProgress=clamp(this.elapsed/(PLANE_DURATION/this.map.planeSpeed),0,1);
    this.state.planeX=this.planeStart.x+(this.planeEnd.x-this.planeStart.x)*this.state.planeProgress;
    this.state.planeY=this.planeStart.y+(this.planeEnd.y-this.planeStart.y)*this.state.planeProgress;
    for(const p of this.state.players.values()){
      if(p.phase==='plane'){
        p.x=this.state.planeX;
        p.y=this.state.planeY;
        if(p.ai&&this.elapsed>=(this.aiThinkAt.get(p.id)??8))this.doJump(p);
        if(this.state.planeProgress>=1)this.doJump(p);
      }
    }
  }

  private spawnMotorcycles(){
    this.state.motorcycles.clear();
    this.vehicleCollisionAt.clear();
    this.vehicleStuckStates.clear();
    for(const spawn of this.map.motorcycleSpawns){
      const point=this.findNearestVehiclePoint(spawn.x,spawn.y,260);
      if(!point)continue;
      const motorcycle=new MotorcycleState();
      motorcycle.id=spawn.id;
      motorcycle.x=point.x;
      motorcycle.y=point.y;
      motorcycle.rotation=spawn.rotation;
      motorcycle.lastSafeX=point.x;
      motorcycle.lastSafeY=point.y;
      motorcycle.hp=MOTORCYCLE_DESTRUCTION_BALANCE.maxHp;
      motorcycle.maxHp=MOTORCYCLE_DESTRUCTION_BALANCE.maxHp;
      motorcycle.buildingId=buildingIdAt(point.x,point.y,0,this.map.buildingVisibilityZones);
      this.state.motorcycles.set(motorcycle.id,motorcycle);
      this.vehicleStuckStates.set(motorcycle.id,{lastX:point.x,lastY:point.y,stuckFor:0,lastRecoveryAt:-99});
    }
  }

  private isVehiclePositionFree(x:number,y:number,ignoreId=''){
    if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    if(x<MOTORCYCLE_RADIUS||y<MOTORCYCLE_RADIUS||x>this.worldSize-MOTORCYCLE_RADIUS||y>this.worldSize-MOTORCYCLE_RADIUS)return false;
    if(this.map.collisionObstacles.some((rect)=>circleHitsRect(x,y,MOTORCYCLE_RADIUS,rect)))return false;
    if(this.map.buildingVisibilityZones.some((zone)=>circleHitsRect(x,y,MOTORCYCLE_RADIUS+3,zone.roof)))return false;
    for(const other of this.state.motorcycles.values()){
      if(other.id===ignoreId)continue;
      if(distance(x,y,other.x,other.y)<MOTORCYCLE_RADIUS*2+8)return false;
    }
    return true;
  }

  private findNearestVehiclePoint(x:number,y:number,maxRadius=320):Point|undefined{
    if(this.isVehiclePositionFree(x,y))return{x,y};
    for(const radius of [40,72,104,144,192,256,maxRadius]){
      for(let index=0;index<16;index++){
        const angle=index/16*Math.PI*2;
        const candidate={x:clamp(x+Math.cos(angle)*radius,MOTORCYCLE_RADIUS,this.worldSize-MOTORCYCLE_RADIUS),y:clamp(y+Math.sin(angle)*radius,MOTORCYCLE_RADIUS,this.worldSize-MOTORCYCLE_RADIUS)};
        if(this.isVehiclePositionFree(candidate.x,candidate.y))return candidate;
      }
    }
    return this.map.emergencySpawnPoints.find((point)=>this.isVehiclePositionFree(point.x,point.y));
  }

  private playerClearOfMotorcycles(x:number,y:number,ignoreVehicleId=''){
    for(const motorcycle of this.state.motorcycles.values()){
      if(motorcycle.id===ignoreVehicleId)continue;
      if(distance(x,y,motorcycle.x,motorcycle.y)<PLAYER_BODY_RADIUS+MOTORCYCLE_RADIUS-3)return false;
    }
    return true;
  }

  private updateMotorcycles(dt:number){
    const now=this.now();
    const approach=(value:number,target:number,maxDelta:number)=>value<target?Math.min(target,value+maxDelta):Math.max(target,value-maxDelta);
    const removeIds:string[]=[];
    for(const motorcycle of this.state.motorcycles.values()){
      if(motorcycle.destroyed){
        if(now-motorcycle.destroyedAt>=MOTORCYCLE_DESTRUCTION_BALANCE.destroyedFadeMs/1000)removeIds.push(motorcycle.id);
        continue;
      }
      if(motorcycle.exploding){
        motorcycle.velocityX=approach(motorcycle.velocityX,0,MOTORCYCLE_DIRECT_DECELERATION*dt);
        motorcycle.velocityY=approach(motorcycle.velocityY,0,MOTORCYCLE_DIRECT_DECELERATION*dt);
        motorcycle.speed=Math.hypot(motorcycle.velocityX,motorcycle.velocityY);
        motorcycle.angularVelocity=0;
        if(now>=motorcycle.explosionAt)this.explodeMotorcycle(motorcycle);
        continue;
      }
      const driver=motorcycle.driverId?this.state.players.get(motorcycle.driverId):undefined;
      if(!driver?.alive||driver.phase!=='landed'||driver.vehicleId!==motorcycle.id){
        if(driver){driver.isDriving=false;driver.vehicleId='';driver.isSniperScoped=false;}
        motorcycle.driverId='';
        motorcycle.velocityX=approach(motorcycle.velocityX,0,MOTORCYCLE_DIRECT_DECELERATION*dt);
        motorcycle.velocityY=approach(motorcycle.velocityY,0,MOTORCYCLE_DIRECT_DECELERATION*dt);
        motorcycle.speed=Math.hypot(motorcycle.velocityX,motorcycle.velocityY);
        motorcycle.angularVelocity=0;
        motorcycle.buildingId=buildingIdAt(motorcycle.x,motorcycle.y,0,this.map.buildingVisibilityZones);
        this.vehicleMotionStates.delete(motorcycle.id);
        continue;
      }
      const input=this.inputs.get(driver.id)??{x:0,y:0,aimX:Math.cos(driver.angle),aimY:Math.sin(driver.angle),angle:driver.angle,seq:0,aiming:false,accelerate:false,brake:false,turnLeft:false,turnRight:false};
      driver.angle=input.angle;
      const beforeX=motorcycle.x,beforeY=motorcycle.y;
      const normalizedInput=normalizeMovementInput(input.x,input.y);
      const inputLength=Math.hypot(normalizedInput.x,normalizedInput.y);
      const moveX=normalizedInput.x;
      const moveY=normalizedInput.y;
      const motion=this.vehicleMotionStates.get(motorcycle.id)??{movementHeldMs:0,previousInputX:0,previousInputY:0,mountedAt:now,directionPenaltyUntil:-99};
      const requestedMove=inputLength>.001;

      if(requestedMove){
        const previousLength=Math.hypot(motion.previousInputX,motion.previousInputY);
        if(previousLength>.001){
          const previousAngle=Math.atan2(motion.previousInputY,motion.previousInputX);
          const nextAngle=Math.atan2(moveY,moveX);
          const change=Math.abs(this.angleDiff(nextAngle,previousAngle));
          const retained=motorcycleDirectionRetention(change);
          if(retained<1){
            motorcycle.velocityX*=retained;
            motorcycle.velocityY*=retained;
            motion.movementHeldMs*=retained<=.5?.2:retained<=.72?.48:.76;
            motion.directionPenaltyUntil=now+MOTORCYCLE_BALANCE.directionChangePenaltyMs/1000;
          }
        }
        motion.movementHeldMs=Math.min(MOTORCYCLE_BALANCE.timeToMaxSpeedMs,motion.movementHeldMs+dt*1000);
        motion.previousInputX=moveX;
        motion.previousInputY=moveY;
      }else{
        motion.movementHeldMs=0;
        motion.previousInputX=0;
        motion.previousInputY=0;
      }

      const targetSpeed=requestedMove?Math.max(MOTORCYCLE_LAUNCH_SPEED,PLAYER_SPEED*motorcycleSpeedMultiplier(motion.movementHeldMs)):0;
      const acceleration=requestedMove?MOTORCYCLE_DIRECT_ACCELERATION:MOTORCYCLE_DIRECT_DECELERATION;
      motorcycle.velocityX=approach(motorcycle.velocityX,moveX*targetSpeed,acceleration*dt);
      motorcycle.velocityY=approach(motorcycle.velocityY,moveY*targetSpeed,acceleration*dt);

      const impactVX=motorcycle.velocityX,impactVY=motorcycle.velocityY,impactSpeed=Math.hypot(impactVX,impactVY);
      let xBlocked=false,yBlocked=false;
      const nextX=motorcycle.x+motorcycle.velocityX*dt;
      if(this.isVehiclePositionFree(nextX,motorcycle.y,motorcycle.id))motorcycle.x=nextX;
      else{xBlocked=true;motorcycle.velocityX=0;motorcycle.velocityY*=.74;}
      const nextY=motorcycle.y+motorcycle.velocityY*dt;
      if(this.isVehiclePositionFree(motorcycle.x,nextY,motorcycle.id))motorcycle.y=nextY;
      else{yBlocked=true;motorcycle.velocityY=0;motorcycle.velocityX*=.74;}
      if(xBlocked||yBlocked){
        motion.movementHeldMs*=xBlocked&&yBlocked?.25:.58;
        motion.directionPenaltyUntil=now+MOTORCYCLE_BALANCE.directionChangePenaltyMs/1000;
        if(now-(this.vehicleWallDamageAt.get(motorcycle.id)??-99)>=MOTORCYCLE_DESTRUCTION_BALANCE.wallCollisionDamageCooldownMs/1000){
          const dominantX=Math.abs(impactVX)>=Math.abs(impactVY);
          const frontal=(xBlocked&&yBlocked)||(xBlocked&&dominantX)||(yBlocked&&!dominantX);
          const durabilityDamage=motorcycleWallCollisionDamage(impactSpeed,MOTORCYCLE_MAX_SPEED,frontal);
          if(durabilityDamage>0){this.vehicleWallDamageAt.set(motorcycle.id,now);this.damageMotorcycle(motorcycle,durabilityDamage,'','벽 충돌');}
        }
      }
      if(motorcycle.exploding)continue;

      const actualSpeed=Math.hypot(motorcycle.velocityX,motorcycle.velocityY);
      const previousRotation=motorcycle.rotation;
      if(actualSpeed>8){
        const targetRotation=Math.atan2(motorcycle.velocityY,motorcycle.velocityX);
        const rotationFactor=1-Math.exp(-MOTORCYCLE_ROTATION_RESPONSE*dt);
        motorcycle.rotation+=this.angleDiff(targetRotation,motorcycle.rotation)*rotationFactor;
      }
      motorcycle.angularVelocity=dt>0?this.angleDiff(motorcycle.rotation,previousRotation)/dt:0;
      motorcycle.speed=actualSpeed;
      motorcycle.buildingId=buildingIdAt(motorcycle.x,motorcycle.y,0,this.map.buildingVisibilityZones);
      if(this.isVehiclePositionFree(motorcycle.x,motorcycle.y,motorcycle.id)){
        motorcycle.lastSafeX=motorcycle.x;motorcycle.lastSafeY=motorcycle.y;
      }

      const stuck=this.vehicleStuckStates.get(motorcycle.id)??{lastX:motorcycle.x,lastY:motorcycle.y,stuckFor:0,lastRecoveryAt:-99};
      const progress=distance(beforeX,beforeY,motorcycle.x,motorcycle.y);
      stuck.stuckFor=requestedMove&&progress<.5?stuck.stuckFor+dt:Math.max(0,stuck.stuckFor-dt*2);
      if((!this.isVehiclePositionFree(motorcycle.x,motorcycle.y,motorcycle.id)||stuck.stuckFor>1.7)&&now-stuck.lastRecoveryAt>1.5){
        const point=this.isVehiclePositionFree(motorcycle.lastSafeX,motorcycle.lastSafeY,motorcycle.id)?{x:motorcycle.lastSafeX,y:motorcycle.lastSafeY}:this.findNearestVehiclePoint(motorcycle.x,motorcycle.y,360);
        if(point){motorcycle.x=point.x;motorcycle.y=point.y;motorcycle.velocityX=0;motorcycle.velocityY=0;motorcycle.speed=0;motorcycle.angularVelocity=0;motion.movementHeldMs=0;motion.previousInputX=0;motion.previousInputY=0;stuck.stuckFor=0;stuck.lastRecoveryAt=now;this.state.vehicleRecoveryCount++;const client=this.clients.find((candidate)=>candidate.sessionId===driver.id);client?.send('vehicleRecovery',{x:point.x,y:point.y});}
      }
      stuck.lastX=motorcycle.x;stuck.lastY=motorcycle.y;this.vehicleStuckStates.set(motorcycle.id,stuck);
      this.vehicleMotionStates.set(motorcycle.id,motion);
      driver.x=motorcycle.x;driver.y=motorcycle.y;
      const speedRatio=clamp(actualSpeed/MOTORCYCLE_MAX_SPEED,0,1);
      if(speedRatio>MOTORCYCLE_SCOPE_SPEED_RATIO||requestedMove)driver.isSniperScoped=false;
      this.applyMotorcycleCollisions(motorcycle,driver,now);
    }
    for(const id of removeIds){this.state.motorcycles.delete(id);this.vehicleStuckStates.delete(id);this.vehicleMotionStates.delete(id);this.vehicleWallDamageAt.delete(id);this.vehicleAttackerAt.delete(id);}
    for(const [key,time] of this.vehicleCollisionAt)if(now-time>3)this.vehicleCollisionAt.delete(key);
    for(const [key,record] of this.vehicleShotDamage)if(now>record.expiresAt)this.vehicleShotDamage.delete(key);
    for(const [id,explosion] of this.state.explosions)if(now-explosion.startedAt>explosion.duration)this.state.explosions.delete(id);
  }

  private applyMotorcycleCollisions(motorcycle:MotorcycleState,driver:PlayerState,now:number){
    const absoluteSpeed=Math.hypot(motorcycle.velocityX,motorcycle.velocityY);
    const motion=this.vehicleMotionStates.get(motorcycle.id);
    if(motion&&now-motion.mountedAt<MOTORCYCLE_BALANCE.mountCollisionGraceMs/1000)return;
    if(absoluteSpeed<MOTORCYCLE_MAX_SPEED*MOTORCYCLE_BALANCE.collisionDamageMinSpeedRatio)return;
    const forwardX=motorcycle.velocityX/absoluteSpeed,forwardY=motorcycle.velocityY/absoluteSpeed;
    const travelAngle=Math.atan2(forwardY,forwardX);
    for(const target of this.state.players.values()){
      if(!target.alive||target.phase!=='landed'||target.id===driver.id||target.isDriving)continue;
      const dx=target.x-motorcycle.x,dy=target.y-motorcycle.y,d=Math.hypot(dx,dy)||1;
      if(d>MOTORCYCLE_RADIUS+PLAYER_HIT_RADIUS+8)continue;
      if((dx/d)*forwardX+(dy/d)*forwardY<.18)continue;
      const key=`${motorcycle.id}:${target.id}`;
      if(now-(this.vehicleCollisionAt.get(key)??-99)<MOTORCYCLE_COLLISION_COOLDOWN)continue;
      const damage=motorcycleCollisionDamage(absoluteSpeed,MOTORCYCLE_MAX_SPEED,false);
      if(damage<=0)continue;
      this.vehicleCollisionAt.set(key,now);
      const ratio=clamp(absoluteSpeed/MOTORCYCLE_MAX_SPEED,0,1);
      this.damage(target,damage,driver.id,'오토바이',130+ratio*235,travelAngle);
      const vehicleDamage=motorcyclePlayerCollisionDamage(absoluteSpeed,MOTORCYCLE_MAX_SPEED);
      if(vehicleDamage>0)this.damageMotorcycle(motorcycle,vehicleDamage,driver.id,'플레이어 충돌');
      const retained=ratio>=.8?.38:ratio>=.6?.56:.8;
      motorcycle.velocityX*=retained;
      motorcycle.velocityY*=retained;
      motorcycle.speed=Math.hypot(motorcycle.velocityX,motorcycle.velocityY);
      if(motion){motion.movementHeldMs*=retained;motion.directionPenaltyUntil=now+MOTORCYCLE_BALANCE.directionChangePenaltyMs/1000;}
    }
  }

  private damageMotorcycle(motorcycle:MotorcycleState,amount:number,attackerId:string,reason:string){
    if(motorcycle.destroyed||motorcycle.exploding||amount<=0)return 0;
    const applied=Math.min(motorcycle.hp,Math.max(0,amount));
    if(applied<=0)return 0;
    const wasCritical=motorcycle.critical;
    motorcycle.hp=Math.max(0,motorcycle.hp-applied);
    motorcycle.lastDamagedAt=this.now();
    if(attackerId){motorcycle.lastDamagedBy=attackerId;this.vehicleAttackerAt.set(motorcycle.id,this.now());}
    motorcycle.critical=motorcycle.hp<=motorcycle.maxHp*MOTORCYCLE_DESTRUCTION_BALANCE.criticalHpRatio;
    this.emitAudioEvent(reason.includes('충돌')?'motorcycle_collision':'motorcycle_hit',{sourceId:motorcycle.id,x:motorcycle.x,y:motorcycle.y,buildingId:motorcycle.buildingId,variant:reason});
    if(motorcycle.critical&&!wasCritical)this.emitAudioEvent('motorcycle_critical',{sourceId:motorcycle.id,x:motorcycle.x,y:motorcycle.y,buildingId:motorcycle.buildingId});
    if(motorcycle.critical&&!wasCritical&&motorcycle.driverId){
      this.clients.find((client)=>client.sessionId===motorcycle.driverId)?.send('notice',{type:'warning',message:'오토바이가 심하게 손상되었습니다.'});
    }
    if(motorcycle.hp<=0)this.beginMotorcycleExplosion(motorcycle,reason);
    return applied;
  }

  private beginMotorcycleExplosion(motorcycle:MotorcycleState,_reason:string){
    if(motorcycle.destroyed||motorcycle.exploding)return;
    const now=this.now(),driverId=motorcycle.driverId;
    motorcycle.hp=0;
    motorcycle.critical=true;
    motorcycle.exploding=true;
    motorcycle.explosionAt=now+MOTORCYCLE_DESTRUCTION_BALANCE.explosionFuseMs/1000;
    motorcycle.velocityX=0;motorcycle.velocityY=0;motorcycle.speed=0;motorcycle.angularVelocity=0;
    if(driverId){
      const driver=this.state.players.get(driverId);
      if(driver)this.forceDismountMotorcycle(driver,motorcycle);
      this.clients.find((client)=>client.sessionId===driverId)?.send('notice',{type:'warning',message:'차량 파괴 · 폭발 위험',duration:2200});
    }
  }

  private explodeMotorcycle(motorcycle:MotorcycleState){
    if(motorcycle.destroyed||!motorcycle.exploding)return;
    const now=this.now();
    motorcycle.exploding=false;
    motorcycle.destroyed=true;
    motorcycle.destroyedAt=now;
    motorcycle.driverId='';
    motorcycle.velocityX=0;motorcycle.velocityY=0;motorcycle.speed=0;motorcycle.angularVelocity=0;
    const explosion=new ExplosionState();
    explosion.id=`explosion-${++this.explosionSeq}`;
    explosion.x=motorcycle.x;explosion.y=motorcycle.y;
    explosion.radius=MOTORCYCLE_DESTRUCTION_BALANCE.explosionRadius;
    explosion.startedAt=now;explosion.duration=.82;explosion.sourceId=motorcycle.id;
    this.state.explosions.set(explosion.id,explosion);
    const attackerAt=this.vehicleAttackerAt.get(motorcycle.id)??-Infinity;
    const attackerId=motorcycle.lastDamagedBy&&now-attackerAt<=MOTORCYCLE_DESTRUCTION_BALANCE.recentAttackerCreditMs/1000?motorcycle.lastDamagedBy:'';
    const source={x:motorcycle.x,y:motorcycle.y,buildingId:motorcycle.buildingId};
    for(const target of this.state.players.values()){
      if(!target.alive||target.phase!=='landed')continue;
      const d=distance(motorcycle.x,motorcycle.y,target.x,target.y);
      if(d>MOTORCYCLE_DESTRUCTION_BALANCE.explosionRadius)continue;
      const exposure=explosionExposureMultiplier(source,target,this.map.visibilityObstacles,this.map.buildingVisibilityZones,PLAYER_HIT_RADIUS);
      if(exposure<=0)continue;
      const damage=Math.round(motorcycleExplosionDamage(d)*exposure);
      if(damage<=0)continue;
      const ratio=clamp(1-d/MOTORCYCLE_DESTRUCTION_BALANCE.explosionRadius,0,1);
      const angle=d>1?Math.atan2(target.y-motorcycle.y,target.x-motorcycle.x):0;
      this.damage(target,damage,attackerId,'오토바이 폭발',MOTORCYCLE_DESTRUCTION_BALANCE.maxExplosionKnockback*ratio,angle);
    }
    for(const other of this.state.motorcycles.values()){
      if(other.id===motorcycle.id||other.destroyed)continue;
      const d=distance(motorcycle.x,motorcycle.y,other.x,other.y);
      if(d>MOTORCYCLE_DESTRUCTION_BALANCE.explosionRadius)continue;
      const exposure=explosionExposureMultiplier(source,other,this.map.visibilityObstacles,this.map.buildingVisibilityZones,MOTORCYCLE_RADIUS);
      if(exposure<=0)continue;
      const damage=Math.round(motorcycleExplosionDamage(d)*exposure);
      if(damage>0)this.damageMotorcycle(other,damage,attackerId,'폭발');
    }
  }

  private vehicleDamageForBullet(b:BulletState,motorcycle:MotorcycleState){
    const raw=motorcycleProjectileDamage(b.weaponId as WeaponId,b.damage);
    if(raw<=0)return 0;
    if(b.weaponId!=='shotgun')return raw;
    const key=`${motorcycle.id}:${b.owner}:${b.shotSeq}`;
    const now=this.now(),record=this.vehicleShotDamage.get(key)??{damage:0,expiresAt:now+.5};
    const allowed=Math.max(0,Math.min(raw,MOTORCYCLE_DESTRUCTION_BALANCE.shotgunShotDamageCap-record.damage));
    record.damage+=allowed;record.expiresAt=now+.5;this.vehicleShotDamage.set(key,record);
    return allowed;
  }

  private updatePlayers(dt:number){
    for(const p of this.state.players.values()){
      if(!p.alive)continue;
      const input=this.inputs.get(p.id)??{x:0,y:0,angle:p.angle,seq:0};
      if(!p.ai)p.angle=input.angle;
      if(p.phase==='falling'||p.phase==='parachute'){
        const parachute=p.altitude<300;
        p.phase=parachute?'parachute':'falling';
        if(p.ai)p.aiState=parachute?'PARACHUTE':'FALLING';
        const speed=parachute?145:260;
        const driftX=p.ai?Math.cos(p.angle)*.55:input.x;
        const driftY=p.ai?Math.sin(p.angle)*.55:input.y;
        this.tryMove(p,driftX*speed*dt,driftY*speed*dt);
        p.altitude=Math.max(0,p.altitude-(parachute?120:260)*dt);
        if(p.altitude<=0){
          this.resolveLanding(p);
          p.phase='landed';
          if(p.ai){p.aiState='EARLY_LOOT';this.aiLandedAt.set(p.id,this.now());}
          this.system(`${p.name} 착지`);
        }
        continue;
      }
      if(p.phase!=='landed')continue;
      if(p.isVaulting)continue;

      if(p.isDriving){
        const motorcycle=this.state.motorcycles.get(p.vehicleId);
        if(motorcycle?.driverId===p.id){p.x=motorcycle.x;p.y=motorcycle.y;continue;}
        p.isDriving=false;p.vehicleId='';p.isSniperScoped=false;
      }

      const kick=this.knockback.get(p.id);
      if(kick){
        this.tryMove(p,kick.vx*dt,kick.vy*dt);
        const damping=Math.pow(.035,dt);
        kick.vx*=damping;
        kick.vy*=damping;
        if(Math.hypot(kick.vx,kick.vy)<8)this.knockback.delete(p.id);
      }

      if(p.ai)continue;
      if(this.healUntil.has(p.id)&&Math.hypot(input.x,input.y)>.08)this.cancelHeal(p);
      if(this.healUntil.has(p.id))continue;
      const ranged=WEAPONS[(p.equipped||'fists') as WeaponId];
      const melee=MELEE_WEAPONS[p.equipped as MeleeId];
      const moveMultiplier=(ranged?.moveMultiplier??melee?.moveMultiplier??1)*(p.isSniperScoped?SNIPER_SCOPE_MOVE_MULTIPLIER:1);
      const wantsMove=Math.hypot(input.x,input.y)>.08;
      const moved=this.tryMove(p,input.x*PLAYER_SPEED*moveMultiplier*dt,input.y*PLAYER_SPEED*moveMultiplier*dt);
      this.trackStuck(p,wantsMove,moved);
    }
  }

  private tryMove(p:PlayerState,dx:number,dy:number){
    const beforeX=p.x;
    const beforeY=p.y;
    this.ensurePlayerFree(p);
    const free=(x:number,y:number)=>this.isPositionFree(x,y)&&this.playerClearOfMotorcycles(x,y,p.vehicleId);
    const total=Math.hypot(dx,dy);
    const steps=Math.max(1,Math.ceil(total/6));
    const sx=dx/steps;
    const sy=dy/steps;
    for(let i=0;i<steps;i++){
      const nx=clamp(p.x+sx,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
      const ny=clamp(p.y+sy,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
      if(free(nx,ny)){p.x=nx;p.y=ny;continue;}
      if(free(nx,p.y)){p.x=nx;continue;}
      if(free(p.x,ny)){p.y=ny;continue;}
      const length=Math.hypot(sx,sy)||1;
      const slideX=-sy/length*Math.min(6,length);
      const slideY=sx/length*Math.min(6,length);
      if(free(p.x+slideX,p.y+slideY)){p.x+=slideX;p.y+=slideY;continue;}
      if(free(p.x-slideX,p.y-slideY)){p.x-=slideX;p.y-=slideY;continue;}
      break;
    }
    this.ensurePlayerFree(p);
    if(this.isPositionFree(p.x,p.y,PLAYER_BODY_RADIUS+2)&&this.playerClearOfMotorcycles(p.x,p.y,p.vehicleId))this.lastSafePositions.set(p.id,{x:p.x,y:p.y,mapId:this.map.id,buildingId:p.buildingId,recordedAt:this.now()});
    return Math.hypot(p.x-beforeX,p.y-beforeY)>.05;
  }

  private isPositionFree(x:number,y:number,radius=PLAYER_BODY_RADIUS){
    if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    if(x<radius||y<radius||x>this.worldSize-radius||y>this.worldSize-radius)return false;
    return !this.map.collisionObstacles.some((rect)=>circleHitsRect(x,y,radius,rect));
  }

  private isLandingPositionValid(x:number,y:number){
    if(!this.isPositionFree(x,y,PLAYER_BODY_RADIUS+2))return false;
    if(buildingIdAt(x,y,0,this.map.buildingVisibilityZones))return false;
    for(const other of this.state.players.values()){
      if(!other.alive||other.phase==='plane'||other.phase==='falling'||other.phase==='parachute')continue;
      if(distance(x,y,other.x,other.y)<PLAYER_SEPARATION_RADIUS*1.5)return false;
    }
    return true;
  }

  private bushAt(x:number,y:number,padding=0){return this.map.bushes.find((bush)=>distance(x,y,bush.x,bush.y)<=Math.max(1,bush.radius-padding));}

  private nearestDoorOutsidePoint(x:number,y:number):Point|undefined{
    let best:Point|undefined;let bestDistance=Number.POSITIVE_INFINITY;
    for(const zone of this.map.buildingVisibilityZones){
      const roof=zone.roof;
      const near=x>=roof.x-160&&x<=roof.x+roof.w+160&&y>=roof.y-160&&y<=roof.y+roof.h+160;
      if(!near)continue;
      const cx=roof.x+roof.w/2,cy=roof.y+roof.h/2;
      for(const door of zone.doors){
        const dx=door.x+door.width/2,dy=door.y+door.height/2;
        const length=Math.hypot(dx-cx,dy-cy)||1;
        const candidate={x:dx+(dx-cx)/length*58,y:dy+(dy-cy)/length*58};
        const d=distance(x,y,candidate.x,candidate.y);
        if(d<bestDistance&&this.isLandingPositionValid(candidate.x,candidate.y)){best=candidate;bestDistance=d;}
      }
    }
    return best;
  }

  private resolveLanding(p:PlayerState){
    if(this.isLandingPositionValid(p.x,p.y)){
      p.buildingId='';p.insideBuilding=false;
      this.lastSafePositions.set(p.id,{x:p.x,y:p.y,mapId:this.map.id,buildingId:'',recordedAt:this.now()});
      return;
    }
    const point=this.nearestDoorOutsidePoint(p.x,p.y)??this.findNearestFreePoint(p.x,p.y,320,true)??this.map.emergencySpawnPoints.find((candidate)=>this.isLandingPositionValid(candidate.x,candidate.y));
    if(point){
      p.x=point.x;p.y=point.y;p.buildingId='';p.insideBuilding=false;
      this.lastSafePositions.set(p.id,{x:p.x,y:p.y,mapId:this.map.id,buildingId:'',recordedAt:this.now()});
      this.state.recoveryCount++;
      const client=this.clients.find((candidate)=>candidate.sessionId===p.id);
      client?.send('positionRecovery',{x:p.x,y:p.y,reason:'landing'});
    }
  }

  private recoverPlayer(p:PlayerState,reason:'collision'|'stuck'|'invalid'){
    const state=this.stuckStates.get(p.id)??{lastX:p.x,lastY:p.y,movingSince:0,lastRecoveryAt:-99};
    if(this.now()-state.lastRecoveryAt<1.5)return false;
    const previous=this.lastSafePositions.get(p.id);
    const point=this.findNearestFreePoint(p.x,p.y,320,false)
      ??(previous&&previous.mapId===this.map.id&&this.isPositionFree(previous.x,previous.y)?previous:undefined)
      ??this.map.emergencySpawnPoints.find((candidate)=>this.isPositionFree(candidate.x,candidate.y));
    if(!point)return false;
    p.x=point.x;p.y=point.y;
    state.lastX=p.x;state.lastY=p.y;state.movingSince=0;state.lastRecoveryAt=this.now();
    this.stuckStates.set(p.id,state);
    this.lastSafePositions.set(p.id,{x:p.x,y:p.y,mapId:this.map.id,buildingId:p.buildingId,recordedAt:this.now()});
    this.state.recoveryCount++;
    const client=this.clients.find((candidate)=>candidate.sessionId===p.id);
    client?.send('positionRecovery',{x:p.x,y:p.y,reason});
    const intent=this.aiIntent.get(p.id);if(intent){intent.route=[];intent.repathAt=0;intent.stuckFor=0;intent.lastX=p.x;intent.lastY=p.y;}
    return true;
  }

  private trackStuck(p:PlayerState,wantsMove:boolean,moved:boolean){
    const now=this.now();
    const state=this.stuckStates.get(p.id)??{lastX:p.x,lastY:p.y,movingSince:0,lastRecoveryAt:-99};
    if(!wantsMove||moved){state.lastX=p.x;state.lastY=p.y;state.movingSince=0;this.stuckStates.set(p.id,state);return;}
    if(!state.movingSince)state.movingSince=now;
    if(now-state.movingSince>=1&&this.map.collisionObstacles.some((rect)=>circleHitsRect(p.x,p.y,PLAYER_BODY_RADIUS+8,rect)))this.recoverPlayer(p,'stuck');
    this.stuckStates.set(p.id,state);
  }

  private resolvePlayerOverlaps(){
    const players=[...this.state.players.values()].filter((p)=>p.alive&&p.phase==='landed'&&!p.isDriving&&!p.isVaulting);
    for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
      const a=players[i]!,b=players[j]!;let dx=b.x-a.x,dy=b.y-a.y;let d=Math.hypot(dx,dy);
      if(d>=PLAYER_SEPARATION_RADIUS*2)continue;
      if(d<.001){let hash=0;for(const char of `${a.id}:${b.id}`)hash=(hash*31+char.charCodeAt(0))>>>0;const angle=(hash%360)*Math.PI/180;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
      const push=Math.min(5,(PLAYER_SEPARATION_RADIUS*2-d)/2),nx=dx/d,ny=dy/d;
      const ax=a.x-nx*push,ay=a.y-ny*push,bx=b.x+nx*push,by=b.y+ny*push;
      if(this.isPositionFree(ax,ay)){a.x=ax;a.y=ay;}
      if(this.isPositionFree(bx,by)){b.x=bx;b.y=by;}
    }
  }

  private firstObstacleHitT(x1:number,y1:number,x2:number,y2:number,padding=0){
    let closest:number|null=null;
    for(const rect of this.map.bulletObstacles){const t=segmentRectIntersectionT(x1,y1,x2,y2,rect,padding);if(t!==null&&(closest===null||t<closest))closest=t;}
    return closest;
  }

  private firstVisibilityObstacleHitT(x1:number,y1:number,x2:number,y2:number,padding=0){
    let closest:number|null=null;
    for(const rect of this.map.visibilityObstacles){const t=segmentRectIntersectionT(x1,y1,x2,y2,rect,padding);if(t!==null&&(closest===null||t<closest))closest=t;}
    return closest;
  }

  private revealBushPlayer(p:PlayerState,seconds:number){
    if(!p.alive||p.phase!=='landed')return;
    if(!p.inBush&&!this.bushAt(p.x,p.y,4))return;
    this.bushRevealUntil.set(p.id,Math.max(this.bushRevealUntil.get(p.id)??0,this.now()+seconds));
    p.inBush=true;
    p.bushRevealed=true;
  }

  private updateBushStates(){
    const now=this.now();
    for(const p of this.state.players.values()){
      if(!p.alive||p.phase!=='landed'){
        p.inBush=false;
        p.bushRevealed=false;
        this.bushRevealUntil.delete(p.id);
        continue;
      }
      p.inBush=Boolean(this.bushAt(p.x,p.y,4));
      if(!p.inBush){p.bushRevealed=false;this.bushRevealUntil.delete(p.id);continue;}
      const revealUntil=this.bushRevealUntil.get(p.id)??0;
      p.bushRevealed=now<revealUntil;
      if(now>=revealUntil)this.bushRevealUntil.delete(p.id);
    }
  }

  private ensurePlayerFree(p:PlayerState){
    if(this.isPositionFree(p.x,p.y)){
      if(this.isPositionFree(p.x,p.y,PLAYER_BODY_RADIUS+2))this.lastSafePositions.set(p.id,{x:p.x,y:p.y,mapId:this.map.id,buildingId:p.buildingId,recordedAt:this.now()});
      return true;
    }
    return this.recoverPlayer(p,'collision');
  }

  private ensureAiFree(p:PlayerState){return this.ensurePlayerFree(p);}

  private findNearestFreePoint(x:number,y:number,maxRadius=360,landing=false):Point|undefined{
    const valid=(px:number,py:number)=>landing?this.isLandingPositionValid(px,py):this.isPositionFree(px,py);
    if(valid(x,y))return{x,y};
    for(let radius=32;radius<=maxRadius;radius+=24){
      const samples=Math.max(16,Math.ceil(radius/8));
      for(let i=0;i<samples;i++){
        const angle=i/samples*Math.PI*2;
        const px=clamp(x+Math.cos(angle)*radius,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
        const py=clamp(y+Math.sin(angle)*radius,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
        if(valid(px,py))return{x:px,y:py};
      }
    }
    return undefined;
  }

  private updateReloads(){
    const now=this.now();
    for(const [id,job] of [...this.reloadUntil]){
      const p=this.state.players.get(id);
      if(!p?.alive||p.phase!=='landed'||p.equipped!==job.weapon){if(p)this.cancelReload(p);else this.reloadUntil.delete(id);continue;}
      p.reloading=true;
      p.reloadWeapon=job.weapon;
      p.reloadProgress=clamp((now-job.startedAt)/job.duration,0,1);
      if(now<job.at)continue;
      const w=WEAPONS[job.weapon]!;
      const current=this.getWeaponMagazine(p,job.weapon);
      const need=w.magazine-current;
      const reserve=this.getAmmo(p,w.ammoType);
      const load=Math.min(need,reserve);
      this.setWeaponMagazine(p,job.weapon,current+load,false);
      this.setAmmo(p,w.ammoType,reserve-load);
      this.syncMagazine(p);
      if(p.ai)p.aiState='COMBAT_READY';
      this.emitAudioEvent('reload_complete',{sourceId:p.id,x:p.x,y:p.y,buildingId:p.buildingId,variant:job.weapon});
      this.cancelReload(p);
    }
  }

  private updateHeals(){
    const now=this.now();
    for(const [id,h] of [...this.healUntil]){
      const p=this.state.players.get(id);
      if(!p?.alive){if(p)this.cancelHeal(p);else this.healUntil.delete(id);continue;}
      p.healingProgress=clamp((now-h.startedAt)/h.duration,0,1);
      if(now<h.at)continue;
      const available=h.kind==='medkit'?p.medkits:p.bandages;
      if(available>0){
        if(h.kind==='medkit')p.medkits--;
        else p.bandages--;
        p.hp=Math.min(100,p.hp+h.amount);
      }
      this.emitAudioEvent('heal_complete',{sourceId:p.id,x:p.x,y:p.y,buildingId:p.buildingId,variant:h.kind});
      this.cancelHeal(p);
      if(p.ai)p.aiState='PATROL';
    }
  }

  private updateBullets(dt:number){
    this.bulletRemoveQueue.clear();
    for(const [id,b] of this.state.bullets){
      if(this.bulletRemoveQueue.has(id))continue;
      const ox=b.x,oy=b.y;
      const nx=ox+b.vx*dt,ny=oy+b.vy*dt;
      b.prevX=ox;b.prevY=oy;
      const stepDistance=distance(ox,oy,nx,ny);
      b.life-=dt;
      b.traveled+=stepDistance;
      const weapon=WEAPONS[b.weaponId as WeaponId];
      const maxRange=weapon?.range??Math.max(1,stepDistance);
      let closestT=Number.POSITIVE_INFINITY;
      let hitPlayer:PlayerState|undefined;
      let hitMotorcycle:MotorcycleState|undefined;
      const obstacleT=this.firstObstacleHitT(ox,oy,nx,ny,b.radius);
      if(obstacleT!==null)closestT=obstacleT;
      for(const player of this.state.players.values()){
        if(!player.alive||player.id===b.owner||player.phase!=='landed')continue;
        const t=segmentCircleIntersectionT(ox,oy,nx,ny,player.x,player.y,PLAYER_HIT_RADIUS+b.radius);
        if(t!==null&&t<closestT){closestT=t;hitPlayer=player;hitMotorcycle=undefined;}
      }
      for(const motorcycle of this.state.motorcycles.values()){
        if(motorcycle.destroyed||motorcycle.driverId===b.owner)continue;
        const t=segmentCircleIntersectionT(ox,oy,nx,ny,motorcycle.x,motorcycle.y,MOTORCYCLE_RADIUS+b.radius);
        if(t!==null&&t<closestT){closestT=t;hitMotorcycle=motorcycle;hitPlayer=undefined;}
      }
      if(hitMotorcycle){
        b.x=ox+(nx-ox)*closestT;
        b.y=oy+(ny-oy)*closestT;
        const vehicleDamage=this.vehicleDamageForBullet(b,hitMotorcycle);
        if(vehicleDamage>0)this.damageMotorcycle(hitMotorcycle,vehicleDamage,b.owner,'총기');
        this.emitAudioEvent('impact_vehicle',{sourceId:b.owner,x:b.x,y:b.y,buildingId:hitMotorcycle.buildingId,variant:b.weaponId});
        if(vehicleDamage>0)this.emitAudioEvent('hit_confirm',{sourceId:b.owner,targetId:hitMotorcycle.id,variant:'vehicle'},this.playerClient(b.owner));
        this.bulletRemoveQueue.add(id);
        continue;
      }
      if(hitPlayer){
        b.x=ox+(nx-ox)*closestT;
        b.y=oy+(ny-oy)*closestT;
        this.damage(hitPlayer,b.damage,b.owner,'총기');
        this.emitAudioEvent('impact_player',{sourceId:b.owner,targetId:hitPlayer.id,x:b.x,y:b.y,buildingId:hitPlayer.buildingId,variant:b.weaponId});
        this.emitAudioEvent('hit_confirm',{sourceId:b.owner,targetId:hitPlayer.id,variant:b.weaponId},this.playerClient(b.owner));
        this.bulletRemoveQueue.add(id);
        continue;
      }
      if(obstacleT!==null){
        b.x=ox+(nx-ox)*obstacleT;
        b.y=oy+(ny-oy)*obstacleT;
        this.emitAudioEvent('impact_wall',{sourceId:b.owner,x:b.x,y:b.y,buildingId:b.buildingId,variant:b.weaponId});
        this.bulletRemoveQueue.add(id);
        continue;
      }
      b.x=nx;b.y=ny;
      if(b.life<=0||b.traveled>=maxRange||b.x<0||b.y<0||b.x>this.worldSize||b.y>this.worldSize)this.bulletRemoveQueue.add(id);
    }
    for(const id of this.bulletRemoveQueue)this.state.bullets.delete(id);
  }

  private prepareNextZone(){
    if(this.state.zoneStage>=6){
      this.state.nextZoneX=this.state.zoneX;
      this.state.nextZoneY=this.state.zoneY;
      this.state.nextZoneRadius=this.state.zoneRadius;
      this.state.zoneState='FINAL';
      this.state.zoneProgress=1;
      return;
    }
    const ratios=[.72,.68,.62,.55,.5,.45];
    const ratio=ratios[Math.min(this.state.zoneStage,ratios.length-1)]??.5;
    const nextRadius=Math.max(120,this.state.zoneRadius*ratio);
    const target=createNextZone(this.lootRandom,this.state.zoneX,this.state.zoneY,this.state.zoneRadius,nextRadius,this.state.zoneStage,28,this.worldSize);
    this.state.nextZoneX=target.x;
    this.state.nextZoneY=target.y;
    this.state.nextZoneRadius=target.radius;
  }

  private zoneWaitSeconds(){return (this.state.zoneStage===0?30:Math.max(10,24-this.state.zoneStage*2))*this.map.zoneWaitScale;}
  private zoneShrinkSeconds(){return Math.max(12,30-this.state.zoneStage*2.5)*this.map.zoneShrinkScale;}

  private updateZone(dt:number){
    const landed=[...this.state.players.values()].some((p)=>p.phase==='landed');
    if(!landed)return;
    const mult=this.state.zoneSpeed==='fast'?1.35:this.state.zoneSpeed==='slow'?.8:1;
    if(this.state.zoneState==='WAITING'){
      this.state.zoneTimer-=dt*mult;
      this.state.zoneProgress=0;
      if(this.state.zoneTimer<=0){
        this.state.zoneStartX=this.state.zoneX;
        this.state.zoneStartY=this.state.zoneY;
        this.state.zoneStartRadius=this.state.zoneRadius;
        this.zoneShrinkDuration=this.zoneShrinkSeconds();
        this.state.zoneTimer=this.zoneShrinkDuration;
        this.state.zoneState='SHRINKING';
      }
    }else if(this.state.zoneState==='SHRINKING'){
      this.state.zoneTimer-=dt*mult;
      const progress=clamp(1-Math.max(0,this.state.zoneTimer)/this.zoneShrinkDuration,0,1);
      this.state.zoneProgress=progress;
      this.state.zoneX=this.state.zoneStartX+(this.state.nextZoneX-this.state.zoneStartX)*progress;
      this.state.zoneY=this.state.zoneStartY+(this.state.nextZoneY-this.state.zoneStartY)*progress;
      this.state.zoneRadius=this.state.zoneStartRadius+(this.state.nextZoneRadius-this.state.zoneStartRadius)*progress;
      if(progress>=1){
        this.state.zoneX=this.state.nextZoneX;
        this.state.zoneY=this.state.nextZoneY;
        this.state.zoneRadius=this.state.nextZoneRadius;
        this.state.zoneStage++;
        if(this.state.zoneStage>=6){
          this.state.zoneState='FINAL';
          this.state.zoneTimer=0;
          this.state.zoneProgress=1;
        }else{
          this.prepareNextZone();
          this.state.zoneState='WAITING';
          this.state.zoneTimer=this.zoneWaitSeconds();
          this.state.zoneProgress=0;
        }
      }
    }
    for(const p of this.state.players.values()){
      if(p.alive&&p.phase==='landed'&&distance(p.x,p.y,this.state.zoneX,this.state.zoneY)>this.state.zoneRadius)this.damage(p,(2+this.state.zoneStage*1.8)*dt,'','자기장');
    }
  }

  private updateAi(dt:number){
    const now=this.now();
    this.cleanupLootReservations(now);
    for(const p of this.state.players.values()){
      if(!p.ai||!p.alive||p.phase!=='landed')continue;
      let intent=this.aiIntent.get(p.id);
      if(!intent){intent=this.newAiIntent(p);this.aiIntent.set(p.id,intent);}
      if(!this.aiLandedAt.has(p.id))this.aiLandedAt.set(p.id,now);
      if(now>=(this.aiThinkAt.get(p.id)??0)){
        this.aiThinkAt.set(p.id,now+(this.state.difficulty==='hard'?.14:this.state.difficulty==='easy'?.34:.22));
        this.planAi(p,intent);
      }
      this.runAi(p,intent,dt);
    }
  }

  private aiZoneTarget(p:PlayerState,cx:number,cy:number,radius:number):Point{
    let hash=0;
    for(const char of p.id)hash=(hash*31+char.charCodeAt(0))>>>0;
    const angle=(hash%360)/180*Math.PI;
    const ring=radius*(.18+((hash>>>8)%28)/100);
    const x=clamp(cx+Math.cos(angle)*ring,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
    const y=clamp(cy+Math.sin(angle)*ring,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
    return this.isPositionFree(x,y)?{x,y}:this.findNearestFreePoint(x,y,260)??{x:cx,y:cy};
  }

  private aiHasUsableGun(p:PlayerState){
    for(const id of [p.primary,p.secondary]){
      if(!id)continue;
      const weapon=WEAPONS[id as WeaponId];
      if(weapon&&this.getWeaponMagazine(p,weapon.id)+this.getAmmo(p,weapon.ammoType)>0)return true;
    }
    return false;
  }

  private aiCombatReady(p:PlayerState){
    if(p.hp<50)return false;
    for(const id of [p.primary,p.secondary]){
      if(!id)continue;
      const weapon=WEAPONS[id as WeaponId];
      if(weapon&&this.getWeaponMagazine(p,weapon.id)>0)return true;
    }
    return false;
  }

  private releaseLootReservation(aiId:string,lootId=''){
    for(const [id,reservation] of [...this.lootReservations]){
      if(reservation.aiId===aiId&&(!lootId||lootId===id))this.lootReservations.delete(id);
    }
  }

  private reserveLoot(p:PlayerState,loot:LootState){
    this.releaseLootReservation(p.id);
    this.lootReservations.set(loot.id,{aiId:p.id,expiresAt:this.now()+3,lastDistance:distance(p.x,p.y,loot.x,loot.y)});
  }

  private cleanupLootReservations(now=this.now()){
    for(const [lootId,reservation] of [...this.lootReservations]){
      const ai=this.state.players.get(reservation.aiId);
      const loot=this.state.loot.get(lootId);
      if(!ai?.alive||!loot||now>=reservation.expiresAt){this.lootReservations.delete(lootId);continue;}
      const current=distance(ai.x,ai.y,loot.x,loot.y);
      if(current>1100||current>reservation.lastDistance+180){this.lootReservations.delete(lootId);continue;}
      if(current<reservation.lastDistance-8){reservation.lastDistance=current;reservation.expiresAt=now+3;}
    }
  }

  private assignLootIntent(p:PlayerState,intent:AiIntent,loot:LootState,early=false){
    this.reserveLoot(p,loot);
    intent.lootId=loot.id;
    intent.targetId='';
    p.aiState=early?'EARLY_LOOT':this.aiLootState(loot.kind as LootKind);
    intent.state=p.aiState;
    intent.mode='move';
    this.setAiDestination(p,intent,loot.x,loot.y);
  }

  private planAi(p:PlayerState,intent:AiIntent){
    const now=this.now();
    const previousLoot=intent.lootId;
    intent.targetId='';
    intent.mode='move';

    const outside=distance(p.x,p.y,this.state.zoneX,this.state.zoneY)>this.state.zoneRadius-180;
    const nextUrgent=this.state.zoneState==='SHRINKING'||this.state.zoneTimer<14;
    const outsideNext=distance(p.x,p.y,this.state.nextZoneX,this.state.nextZoneY)>this.state.nextZoneRadius-120;
    if(outside||(nextUrgent&&outsideNext)){
      this.releaseLootReservation(p.id,previousLoot);
      intent.lootId='';
      this.cancelHeal(p);
      p.aiState='ZONE_ESCAPE';
      intent.state='ZONE_ESCAPE';
      const safe=this.aiZoneTarget(p,outside?this.state.zoneX:this.state.nextZoneX,outside?this.state.zoneY:this.state.nextZoneY,outside?this.state.zoneRadius:this.state.nextZoneRadius);
      this.setAiDestination(p,intent,safe.x,safe.y);
      return;
    }

    const target=this.findVisibleTarget(p,950);
    const targetDistance=target?distance(p.x,p.y,target.x,target.y):Number.POSITIVE_INFINITY;
    const recentlyAttacked=now<(this.aiDefendUntil.get(p.id)??0);
    const combatReady=this.aiCombatReady(p);
    const early=now-(this.aiLandedAt.get(p.id)??now)<15&&!combatReady;
    const danger=target&&targetDistance<430;

    if(this.healUntil.has(p.id)){
      this.releaseLootReservation(p.id,previousLoot);
      intent.lootId='';
      p.aiState='HEAL';intent.state='HEAL';intent.mode='hold';return;
    }

    if(p.hp<=55&&(p.bandages>0||p.medkits>0)&&!danger){
      if(this.beginHeal(p,'auto')){
        this.releaseLootReservation(p.id,previousLoot);
        intent.lootId='';intent.state='HEAL';intent.mode='hold';return;
      }
    }

    if(early){
      const loot=this.findBestLoot(p);
      if(loot&&(!target||targetDistance>65||!recentlyAttacked)){
        this.assignLootIntent(p,intent,loot,true);
        return;
      }
      this.releaseLootReservation(p.id,previousLoot);
      intent.lootId='';
      if(target){
        const dx=p.x-target.x,dy=p.y-target.y,len=Math.hypot(dx,dy)||1;
        if(targetDistance<=65&&p.hp>35){
          intent.targetId=target.id;
          p.aiState='DEFEND';intent.state='DEFEND';intent.mode='hold';
          this.setEquipped(p,p.melee&&p.melee!=='fists'?p.melee as MeleeId:'fists',true);
          p.angle=Math.atan2(target.y-p.y,target.x-p.x);
        }else{
          p.aiState='RETREAT';intent.state='RETREAT';intent.mode='retreat';
          this.setAiDestination(p,intent,p.x+dx/len*320,p.y+dy/len*320);
        }
        return;
      }
      p.aiState=this.aiHasUsableGun(p)?'COMBAT_READY':'PATROL';
      intent.state=p.aiState;
      this.setAiDestination(p,intent,this.state.zoneX+(this.lootRandom()-.5)*500,this.state.zoneY+(this.lootRandom()-.5)*500);
      return;
    }

    this.releaseLootReservation(p.id,previousLoot);
    intent.lootId='';
    if(target){
      intent.targetId=target.id;
      intent.lastSeenX=target.x;intent.lastSeenY=target.y;intent.lastSeenUntil=now+2;
      this.chooseAiWeapon(p,targetDistance);
      const weapon=WEAPONS[p.equipped as WeaponId];
      if(weapon&&weapon.id!=='fists'&&this.getWeaponMagazine(p,weapon.id)<=0){
        if(this.getAmmo(p,weapon.ammoType)>0){
          this.beginReload(p,weapon.id);p.aiState='RELOAD';intent.state='RELOAD';intent.mode='retreat';
          this.setAiDestination(p,intent,p.x-(target.x-p.x),p.y-(target.y-p.y));return;
        }
        this.chooseAiWeapon(p,targetDistance,true);
      }
      p.aiState=p.hp<30?'RETREAT':'ENGAGE';intent.state=p.aiState;
      const desired=this.desiredRange(p.equipped as EquippedId);
      if(p.hp<30||targetDistance<desired*.48){intent.mode='retreat';this.setAiDestination(p,intent,p.x-(target.x-p.x),p.y-(target.y-p.y));}
      else if(targetDistance>desired*1.12){intent.mode='move';this.setAiDestination(p,intent,target.x,target.y);}
      else{intent.mode='hold';intent.route=[];intent.tx=target.x;intent.ty=target.y;}
      return;
    }

    if(intent.lastSeenUntil>now){p.aiState='REPOSITION';intent.state='REPOSITION';this.setAiDestination(p,intent,intent.lastSeenX,intent.lastSeenY);return;}
    const noise=this.findRecentNoise(p);
    if(noise){p.aiState='INVESTIGATE';intent.state='INVESTIGATE';this.setAiDestination(p,intent,noise.x,noise.y);return;}

    this.chooseAiWeapon(p);
    const current=WEAPONS[p.equipped as WeaponId];
    if(current&&current.id!=='fists'&&this.getWeaponMagazine(p,current.id)<=0&&this.getAmmo(p,current.ammoType)>0)this.beginReload(p,current.id);
    const loot=this.findBestLoot(p);
    if(loot){this.assignLootIntent(p,intent,loot,false);return;}
    p.aiState='PATROL';intent.state='PATROL';
    this.setAiDestination(p,intent,this.state.zoneX+(this.lootRandom()-.5)*Math.min(650,this.state.zoneRadius*.45),this.state.zoneY+(this.lootRandom()-.5)*Math.min(650,this.state.zoneRadius*.45));
  }

  private runAi(p:PlayerState,intent:AiIntent,dt:number){
    if(this.healUntil.has(p.id))return;
    const target=intent.targetId?this.state.players.get(intent.targetId):undefined;
    if(target?.alive&&this.canSeeTarget(p,target)){
      const clear=!this.map.bulletObstacles.some((r)=>this.segmentRect(p.x,p.y,target.x,target.y,r));
      if(clear){
        const d=distance(p.x,p.y,target.x,target.y);
        p.angle=Math.atan2(target.y-p.y,target.x-p.x);
        this.chooseAiWeapon(p,d);
        if(p.equipped==='fists'||p.equipped in MELEE_WEAPONS){
          const melee=p.equipped==='fists'?WEAPONS.fists:MELEE_WEAPONS[p.equipped as MeleeId];
          if(d<=melee.range+4)this.meleePlayer(p);
        }else{
          const weapon=WEAPONS[p.equipped as WeaponId]!;
          if(this.getWeaponMagazine(p,weapon.id)>0)this.firePlayer(p);
          else if(this.getAmmo(p,weapon.ammoType)>0)this.beginReload(p,weapon.id);
        }
      }
    }

    const loot=intent.lootId?this.state.loot.get(intent.lootId):undefined;
    if(loot&&distance(p.x,p.y,loot.x,loot.y)<72&&buildingSpacesInteractable(p,loot)){
      if(this.aiLootScore(p,loot.kind as LootKind)>0){
        const result=this.applyLoot(p,loot.kind as LootKind,loot);
        if(result.success){this.state.loot.delete(loot.id);this.lootReservations.delete(loot.id);}
      }
      this.releaseLootReservation(p.id,intent.lootId);
      intent.lootId='';
      intent.route=[];
      this.aiThinkAt.set(p.id,0);
    }

    if(intent.mode==='hold'){
      if(target){
        const side=p.angle+Math.PI/2*intent.avoidSign;
        this.tryMove(p,Math.cos(side)*72*dt,Math.sin(side)*72*dt);
      }
      return;
    }

    this.advanceAiRoute(p,intent);
    const waypoint=intent.route[0]??{x:intent.tx,y:intent.ty};
    let angle=Math.atan2(waypoint.y-p.y,waypoint.x-p.x);
    if(intent.mode==='retreat'&&target)angle=Math.atan2(p.y-target.y,p.x-target.x);
    if(!target)p.angle=angle;
    const speed=this.state.difficulty==='hard'?235:this.state.difficulty==='easy'?175:205;
    let moved=this.tryMove(p,Math.cos(angle)*speed*dt,Math.sin(angle)*speed*dt);
    if(!moved){
      const side=angle+intent.avoidSign*Math.PI/2;
      moved=this.tryMove(p,Math.cos(side)*speed*.9*dt,Math.sin(side)*speed*.9*dt);
      if(!moved){
        intent.avoidSign*=-1;
        const other=angle+intent.avoidSign*Math.PI/2;
        this.tryMove(p,Math.cos(other)*speed*.85*dt,Math.sin(other)*speed*.85*dt);
      }
    }

    const progress=distance(p.x,p.y,intent.lastX,intent.lastY);
    intent.stuckFor=progress<.7?intent.stuckFor+dt:Math.max(0,intent.stuckFor-dt*2.4);
    if(intent.stuckFor>.55){
      this.ensureAiFree(p);
      intent.avoidSign*=-1;
      intent.repathAt=0;
      const escape=this.findAiEscapePoint(p,intent);
      const rebuilt=this.buildRoute(escape?.x??p.x,escape?.y??p.y,intent.tx,intent.ty);
      intent.route=escape?[escape,...rebuilt]:rebuilt;
      intent.stuckFor=0;
      this.aiThinkAt.set(p.id,0);
    }
    intent.lastX=p.x;
    intent.lastY=p.y;
  }

  private findAiEscapePoint(p:PlayerState,intent:AiIntent):Point|undefined{
    let selected:Point|undefined;
    let best=Number.POSITIVE_INFINITY;
    const goalAngle=Math.atan2(intent.ty-p.y,intent.tx-p.x);
    for(const radius of [72,120,180,250]){
      for(let i=0;i<16;i++){
        const offset=(i%2===0?1:-1)*Math.ceil(i/2)*(Math.PI/12);
        const angle=goalAngle+offset;
        const x=clamp(p.x+Math.cos(angle)*radius,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
        const y=clamp(p.y+Math.sin(angle)*radius,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
        if(!this.isPositionFree(x,y)||this.segmentBlocked(p.x,p.y,x,y,PLAYER_BODY_RADIUS))continue;
        const score=distance(x,y,intent.tx,intent.ty)+Math.abs(offset)*35;
        if(score<best){best=score;selected={x,y};}
      }
      if(selected)break;
    }
    return selected;
  }

  private findVisibleTarget(p:PlayerState,maxDistance:number){
    let target:PlayerState|undefined;
    let best=maxDistance;
    for(const q of this.state.players.values()){
      if(q.id===p.id||!q.alive||q.phase!=='landed')continue;
      const d=distance(p.x,p.y,q.x,q.y);
      if(d>=best)continue;
      if(!this.canSeeTarget(p,q))continue;
      if(q.inBush&&!q.bushRevealed&&d>BUSH_HIDE_DISTANCE)continue;
      if(this.map.bulletObstacles.some((r)=>this.segmentRect(p.x,p.y,q.x,q.y,r)))continue;
      best=d;
      target=q;
    }
    return target;
  }

  private findRecentNoise(p:PlayerState){
    const now=this.now();
    let selected:Noise|undefined;
    let best=900;
    for(const noise of this.noises){
      if(noise.owner===p.id||now-noise.at>2.5)continue;
      const d=distance(p.x,p.y,noise.x,noise.y);
      if(d<best){best=d;selected=noise;}
    }
    return selected;
  }

  private findBestLoot(p:PlayerState){
    let selected:LootState|undefined;
    let best=0;
    for(const l of this.state.loot.values()){
      if(l.pickupLockedForPlayerId===p.id&&this.now()<l.pickupLockedUntil)continue;
      const reservation=this.lootReservations.get(l.id);
      if(reservation&&reservation.aiId!==p.id)continue;
      const d=distance(p.x,p.y,l.x,l.y);
      if(d>950)continue;
      const zoneRisk=distance(l.x,l.y,this.state.zoneX,this.state.zoneY)>this.state.zoneRadius-100?55:0;
      let enemyRisk=0;
      for(const q of this.state.players.values()){
        if(q.id===p.id||!q.alive||q.phase!=='landed')continue;
        const enemyDistance=distance(l.x,l.y,q.x,q.y);
        if(enemyDistance<180)enemyRisk=Math.max(enemyRisk,55);
        else if(enemyDistance<360)enemyRisk=Math.max(enemyRisk,22);
      }
      const score=this.aiLootScore(p,l.kind as LootKind)-d*.035-zoneRisk-enemyRisk;
      if(score>best){best=score;selected=l;}
    }
    return selected;
  }

  private aiLootScore(p:PlayerState,k:LootKind){
    if(k in WEAPONS&&k!=='fists'){
      const id=k as WeaponId;
      const incoming=this.weaponBaseScore(id);
      const held=Math.max(0,...[p.primary,p.secondary].filter(Boolean).map((heldId)=>this.weaponBaseScore(heldId as WeaponId)));
      return incoming>held+4?95+(incoming-held):0;
    }
    if(k in MELEE_WEAPONS){
      const held=p.melee==='fists'?0:this.meleeScore(p.melee as MeleeId);
      const incoming=this.meleeScore(k as MeleeId);
      return incoming>held?42+(incoming-held):0;
    }
    if(k==='pistol_ammo')return [p.primary,p.secondary].includes('pistol')&&p.pistolAmmo<90?62-p.pistolAmmo*.25:0;
    if(k==='standard_ammo')return [p.primary,p.secondary].some((id)=>['smg','rifle','sniper'].includes(id))&&p.standardAmmo<96?70-p.standardAmmo*.3:0;
    if(k==='shotgun_ammo')return [p.primary,p.secondary].includes('shotgun')&&p.shotgunAmmo<28?64-p.shotgunAmmo*.8:0;
    if(k==='vest')return p.armor<70?72-p.armor*.4:0;
    if(k==='bandage')return p.bandages<3?55-p.bandages*12:0;
    if(k==='medkit')return p.medkits<2?68-p.medkits*20:0;
    return 0;
  }

  private aiLootState(k:LootKind){
    if(k in WEAPONS)return'SEEK_WEAPON';
    if(k==='pistol_ammo'||k==='standard_ammo'||k==='shotgun_ammo')return'SEEK_AMMO';
    if(k==='vest')return'SEEK_ARMOR';
    if(k==='bandage'||k==='medkit')return'SEEK_HEAL';
    return'LOOT';
  }

  private chooseAiWeapon(p:PlayerState,targetDistance=350,force=false){
    const candidates:EquippedId[]=['fists'];
    if(p.melee&&p.melee!=='fists')candidates.push(p.melee as MeleeId);
    if(p.secondary)candidates.push(p.secondary as WeaponId);
    if(p.primary)candidates.push(p.primary as WeaponId);
    let bestId:EquippedId='fists';
    let best=-999;
    for(const id of candidates){
      const score=this.aiWeaponScore(p,id,targetDistance);
      if(score>best){best=score;bestId=id;}
    }
    const currentScore=this.aiWeaponScore(p,p.equipped as EquippedId,targetDistance);
    const currentUsable=currentScore>-500;
    if(force||!currentUsable||best>currentScore+7)this.setEquipped(p,bestId,force||!currentUsable);
    else this.syncMagazine(p);
  }

  private aiWeaponScore(p:PlayerState,id:EquippedId,d:number){
    if(id==='fists')return d<=70?35:-700;
    if(id in MELEE_WEAPONS){const melee=MELEE_WEAPONS[id as MeleeId]!;return d<=melee.range+18?58+this.meleeScore(id as MeleeId):-650;}
    const w=WEAPONS[id as WeaponId];
    if(!w)return-999;
    const ammo=this.getWeaponMagazine(p,w.id)+this.getAmmo(p,w.ammoType);
    if(ammo<=0)return-800;
    let score=this.weaponBaseScore(w.id);
    if(w.id==='shotgun')score+=d<220?55:d>500?-65:8;
    if(w.id==='smg')score+=d>=90&&d<=420?38:d>650?-35:5;
    if(w.id==='rifle')score+=d>260?44:d<120?-28:12;
    if(w.id==='sniper')score+=d>620?72:d<240?-70:18;
    if(w.id==='pistol')score+=d>650?12:4;
    if(this.getWeaponMagazine(p,w.id)<=0)score-=18;
    return score;
  }

  private desiredRange(id:EquippedId):number{
    if(id==='fists')return 58;
    if(id in MELEE_WEAPONS)return MELEE_WEAPONS[id as MeleeId]!.range*.82;
    if(id==='shotgun')return 175;
    if(id==='smg')return 260;
    if(id==='rifle')return 410;
    if(id==='sniper')return 780;
    return 330;
  }

  private weaponBaseScore(id:WeaponId):number{return id==='sniper'?98:id==='rifle'?90:id==='smg'?82:id==='shotgun'?78:id==='pistol'?52:0;}
  private meleeScore(id:MeleeId):number{return id==='pan'?30:id==='bat'?27:id==='pipe'?24:19;}

  private setAiDestination(p:PlayerState,intent:AiIntent,x:number,y:number,force=false){
    const tx=clamp(x,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
    const ty=clamp(y,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
    const changed=distance(intent.routeGoalX,intent.routeGoalY,tx,ty)>84;
    intent.tx=tx;
    intent.ty=ty;
    if(force||changed||intent.route.length===0){
      intent.route=this.buildRoute(p.x,p.y,tx,ty);
      intent.routeGoalX=tx;
      intent.routeGoalY=ty;
      intent.repathAt=this.now()+.9+Math.random()*.45;
    }
  }

  private buildRoute(sx:number,sy:number,tx:number,ty:number):Point[]{
    const startPoint=this.isPositionFree(sx,sy)?{x:sx,y:sy}:this.findNearestFreePoint(sx,sy)??{x:sx,y:sy};
    const goalPoint=this.isPositionFree(tx,ty)?{x:tx,y:ty}:this.findNearestFreePoint(tx,ty)??{x:tx,y:ty};
    if(!this.segmentBlocked(startPoint.x,startPoint.y,goalPoint.x,goalPoint.y))return[goalPoint];

    const clearance=PLAYER_BODY_RADIUS+12;
    const source=this.buildingAt(startPoint.x,startPoint.y);
    const target=this.buildingAt(goalPoint.x,goalPoint.y);
    const relevant=this.map.buildings.filter((building)=>{
      if(building===source||building===target)return true;
      return this.segmentRect(startPoint.x,startPoint.y,goalPoint.x,goalPoint.y,{
        x:building.x-clearance-90,
        y:building.y-clearance-90,
        w:building.w+(clearance+90)*2,
        h:building.h+(clearance+90)*2,
      });
    });

    const nodes:Point[]=[startPoint,goalPoint];
    const add=(point:Point)=>{
      const x=clamp(point.x,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
      const y=clamp(point.y,PLAYER_BODY_RADIUS,this.worldSize-PLAYER_BODY_RADIUS);
      if(!this.isPositionFree(x,y,PLAYER_BODY_RADIUS+1))return;
      if(nodes.some((node)=>distance(node.x,node.y,x,y)<12))return;
      nodes.push({x,y});
    };
    for(const building of relevant){
      add({x:building.x-clearance,y:building.y-clearance});
      add({x:building.x+building.w+clearance,y:building.y-clearance});
      add({x:building.x-clearance,y:building.y+building.h+clearance});
      add({x:building.x+building.w+clearance,y:building.y+building.h+clearance});
      const door=this.doorPoints(building);
      add(door.outside);
      add(door.inside);
    }
    const routeObstacles=[...this.map.propObstacles,...this.map.obstacles];
    for(const prop of routeObstacles){
      if(!this.segmentRect(startPoint.x,startPoint.y,goalPoint.x,goalPoint.y,{x:prop.x-clearance-48,y:prop.y-clearance-48,w:prop.w+(clearance+48)*2,h:prop.h+(clearance+48)*2}))continue;
      add({x:prop.x-clearance,y:prop.y-clearance});
      add({x:prop.x+prop.w+clearance,y:prop.y-clearance});
      add({x:prop.x-clearance,y:prop.y+prop.h+clearance});
      add({x:prop.x+prop.w+clearance,y:prop.y+prop.h+clearance});
    }

    const edges=new Map<number,Array<{to:number;cost:number}>>();
    for(let i=0;i<nodes.length;i++)edges.set(i,[]);
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i]!;
        const b=nodes[j]!;
        if(this.segmentBlocked(a.x,a.y,b.x,b.y))continue;
        const cost=distance(a.x,a.y,b.x,b.y);
        edges.get(i)!.push({to:j,cost});
        edges.get(j)!.push({to:i,cost});
      }
    }

    const distances=new Array<number>(nodes.length).fill(Number.POSITIVE_INFINITY);
    const previous=new Array<number>(nodes.length).fill(-1);
    const visited=new Set<number>();
    distances[0]=0;
    for(let count=0;count<nodes.length;count++){
      let current=-1;
      let best=Number.POSITIVE_INFINITY;
      for(let i=0;i<nodes.length;i++){
        if(!visited.has(i)&&distances[i]<best){best=distances[i];current=i;}
      }
      if(current<0||current===1)break;
      visited.add(current);
      for(const edge of edges.get(current)??[]){
        const next=best+edge.cost;
        if(next<distances[edge.to]){distances[edge.to]=next;previous[edge.to]=current;}
      }
    }
    if(!Number.isFinite(distances[1]))return this.fallbackRoute(startPoint,goalPoint,relevant);
    const indices:number[]=[];
    for(let cursor=1;cursor>=0;cursor=previous[cursor]){
      indices.push(cursor);
      if(cursor===0)break;
    }
    indices.reverse();
    return indices.slice(1).map((index)=>nodes[index]!);
  }

  private fallbackRoute(start:Point,goal:Point,buildings:Building[]):Point[]{
    const candidates:Point[]=[];
    const clearance=PLAYER_BODY_RADIUS+16;
    for(const building of buildings){
      candidates.push(
        {x:building.x-clearance,y:building.y-clearance},
        {x:building.x+building.w+clearance,y:building.y-clearance},
        {x:building.x-clearance,y:building.y+building.h+clearance},
        {x:building.x+building.w+clearance,y:building.y+building.h+clearance},
      );
      const door=this.doorPoints(building);
      candidates.push(door.outside,door.inside);
    }
    let best:Point|undefined;
    let bestScore=Number.POSITIVE_INFINITY;
    for(const point of candidates){
      if(!this.isPositionFree(point.x,point.y)||this.segmentBlocked(start.x,start.y,point.x,point.y))continue;
      const score=distance(start.x,start.y,point.x,point.y)+distance(point.x,point.y,goal.x,goal.y);
      if(score<bestScore){bestScore=score;best=point;}
    }
    return best?[best,goal]:[goal];
  }

  private segmentBlocked(x1:number,y1:number,x2:number,y2:number,clearance=PLAYER_BODY_RADIUS+3){
    return this.map.collisionObstacles.some((rect)=>this.segmentRect(x1,y1,x2,y2,{
      x:rect.x-clearance,
      y:rect.y-clearance,
      w:rect.w+clearance*2,
      h:rect.h+clearance*2,
    }));
  }

  private buildingAt(x:number,y:number){return this.map.buildings.find((b)=>x>b.x+18&&x<b.x+b.w-18&&y>b.y+18&&y<b.y+b.h-18);}

  private doorPoints(b:Building){
    const margin=PLAYER_BODY_RADIUS+14;
    const wall=18;
    if(b.doorSide==='north'){
      const x=b.x+b.w*b.doorOffset;
      return{outside:{x,y:b.y-margin},inside:{x,y:b.y+wall+margin}};
    }
    if(b.doorSide==='south'){
      const x=b.x+b.w*b.doorOffset;
      return{outside:{x,y:b.y+b.h+margin},inside:{x,y:b.y+b.h-wall-margin}};
    }
    if(b.doorSide==='west'){
      const y=b.y+b.h*b.doorOffset;
      return{outside:{x:b.x-margin,y},inside:{x:b.x+wall+margin,y}};
    }
    const y=b.y+b.h*b.doorOffset;
    return{outside:{x:b.x+b.w+margin,y},inside:{x:b.x+b.w-wall-margin,y}};
  }

  private advanceAiRoute(p:PlayerState,intent:AiIntent){
    while(intent.route.length&&distance(p.x,p.y,intent.route[0]!.x,intent.route[0]!.y)<44)intent.route.shift();
  }

  private damage(p:PlayerState,amount:number,attackerId:string,reason:string,knockbackOverride=0,hitAngleOverride?:number){
    if(!p.alive)return;
    this.cancelHeal(p);
    if(reason!=='자기장')this.revealBushPlayer(p,BUSH_HIT_REVEAL_SECONDS);
    let actual=amount;
    if(p.armor>0&&reason==='총기'){
      const absorbed=actual*.3;
      actual-=absorbed;
      p.armor=Math.max(0,p.armor-absorbed*1.5);
    }
    const attacker=this.state.players.get(attackerId);
    if(p.ai&&attackerId&&attackerId!==p.id)this.aiDefendUntil.set(p.id,this.now()+3);
    const hitAngle=Number.isFinite(hitAngleOverride)?Number(hitAngleOverride):attacker?Math.atan2(p.y-attacker.y,p.x-attacker.x):p.lastHitAngle;
    p.hitSeq++;
    p.lastHitAngle=hitAngle;
    p.lastHitDamage=actual;
    if(attacker&&reason!=='자기장'){
      const power=knockbackOverride>0?knockbackOverride:this.knockbackPower(attacker,reason);
      if(power>0){
        const current=this.knockback.get(p.id)??{vx:0,vy:0};
        current.vx+=Math.cos(hitAngle)*power;
        current.vy+=Math.sin(hitAngle)*power;
        const max=420;
        const len=Math.hypot(current.vx,current.vy);
        if(len>max){current.vx=current.vx/len*max;current.vy=current.vy/len*max;}
        this.knockback.set(p.id,current);
      }
    }
    p.hp-=actual;
    if(attacker)attacker.damageDone+=actual;
    if(p.hp<=0){
      p.hp=0;
      p.alive=false;
      p.phase='dead';
      p.aiState='DEAD';
      p.isSniperScoped=false;
      const cause=reason==='자기장'?'zone':reason==='오토바이 충돌'?'motorcycle_collision':reason==='오토바이 폭발'?'motorcycle_explosion':attacker?.equipped==='sniper'?'sniper':attacker?.equipped==='shotgun'?'shotgun':reason==='총기'?'bullet':'other';
      this.broadcast('characterDeath',{
        entityId:p.id,entityType:p.ai?'ai':'player',x:p.x,y:p.y,angle:p.angle,buildingId:p.buildingId,
        displayName:p.name,ai:p.ai,equipped:p.equipped,killerId:attackerId,cause,
        hitDirectionX:Math.cos(hitAngle),hitDirectionY:Math.sin(hitAngle),inBush:p.inBush,bushRevealed:p.bushRevealed,diedAt:this.now(),
      });
      this.clearVault(p);
      this.detachPlayerFromVehicle(p);
      this.knockback.delete(p.id);
      this.aiIntent.delete(p.id);
      this.releaseLootReservation(p.id);
      this.aiLandedAt.delete(p.id);
      this.aiDefendUntil.delete(p.id);
      this.bushRevealUntil.delete(p.id);
      p.inBush=false;
      p.bushRevealed=false;
      this.cancelReload(p);
      this.lastSafePositions.delete(p.id);
      this.state.placements.unshift(p.name);
      if(attacker&&attacker.id!==p.id){
        attacker.kills++;
        this.emitAudioEvent('kill_confirm',{sourceId:attacker.id,targetId:p.id,variant:cause},this.playerClient(attacker.id));
        this.broadcast('killfeed',{killer:attacker.name,victim:p.name,reason});
      }else this.broadcast('killfeed',{killer:reason,victim:p.name,reason});
      this.dropInventory(p);
    }
  }

  private knockbackPower(attacker:PlayerState,reason:string):number{
    if(reason==='주먹')return 230;
    if(reason==='야구방망이')return 320;
    if(reason==='프라이팬')return 360;
    if(reason==='쇠파이프')return 285;
    if(reason==='식칼')return 165;
    if(reason==='총기')return attacker.equipped==='sniper'?310:attacker.equipped==='shotgun'?230:attacker.equipped==='rifle'?90:attacker.equipped==='pistol'?72:38;
    return 0;
  }

  private dropInventory(p:PlayerState){
    const kinds:LootKind[]=[];
    if(p.primary)kinds.push(p.primary as LootKind);
    if(p.secondary)kinds.push(p.secondary as LootKind);
    if(p.melee!=='fists')kinds.push(p.melee as LootKind);
    if(p.pistolAmmo>0)kinds.push('pistol_ammo');
    if(p.standardAmmo>0)kinds.push('standard_ammo');
    if(p.shotgunAmmo>0)kinds.push('shotgun_ammo');
    if(p.armor>0)kinds.push('vest');
    if(p.bandages>0)kinds.push('bandage');
    if(p.medkits>0)kinds.push('medkit');
    const total=Math.max(1,kinds.length);
    kinds.forEach((kind,index)=>{
      const ring=kind==='vest'?70:kind==='bandage'||kind==='medkit'?58:kind.includes('ammo')||kind==='shotgun_ammo'?45:kind in WEAPONS?30:38;
      const angle=index/total*Math.PI*2;
      const baseX=p.x+Math.cos(angle)*ring;
      const baseY=p.y+Math.sin(angle)*ring;
      const pos=this.findSeparatedLootPosition(baseX,baseY,kind)??this.findNearestFreePoint(baseX,baseY,180);
      if(!pos)return;
      const loot=new LootState();
      loot.id=`loot-${++this.lootSeq}`;loot.kind=kind;loot.x=pos.x;loot.y=pos.y;loot.buildingId=buildingIdAt(loot.x,loot.y,0,this.map.buildingVisibilityZones);
      this.state.loot.set(loot.id,loot);
    });
  }

  private finishCheck(){
    const alive=[...this.state.players.values()].filter((p)=>p.alive);
    this.state.aliveCount=alive.length;
    if(alive.length<=1&&this.state.players.size>1&&this.state.phase!=='FINISHED'){
      this.state.phase='FINISHED';
      this.state.winner=alive[0]?.name??'없음';
      if(alive[0])this.state.placements.unshift(alive[0].name);
      this.broadcast('result',{winner:this.state.winner,placements:[...this.state.placements]});
    }
  }

  private resetLobby(){
    this.clearTransient();
    for(const [id,p] of [...this.state.players]){
      if(p.ai)this.state.players.delete(id);
      else{
        p.ready=false;
        p.alive=true;
        p.hp=100;
        p.phase='lobby';
        p.primary='';
        p.secondary='';
        p.melee='fists';
        p.equipped='fists';
        p.magazine=0;
        p.pistolMagazine=0;
        p.smgMagazine=0;
        p.rifleMagazine=0;
        p.shotgunMagazine=0;
        p.sniperMagazine=0;
        p.pistolAmmo=0;
        p.standardAmmo=0;
        p.shotgunAmmo=0;
        p.bandages=0;
        p.medkits=0;
        p.healingKind='';
        p.healingProgress=0;
        p.reloading=false;
        p.reloadWeapon='';
        p.reloadProgress=0;
        p.attackSeq=0;
        p.hitSeq=0;
        p.lastHitAngle=0;
        p.lastHitDamage=0;
        p.inBush=false;
        p.bushRevealed=false;
        p.buildingId='';
        p.insideBuilding=false;
        p.buildingTransitionSeq=0;
        p.isSniperScoped=false;
        p.isDriving=false;
        p.vehicleId='';
        p.isVaulting=false;
        p.vaultProgress=0;
        p.vaultWindowId='';
        p.aiState='';
      }
    }
    this.state.phase='LOBBY';
    this.state.winner='';
    this.state.placements.clear();
    this.state.aliveCount=this.state.players.size;
    this.syncRoomRegistry();
  }

  private updateBuildingStates(){
    for(const player of this.state.players.values()){
      if(player.phase!=='landed'){
        if(player.buildingId){player.buildingId='';player.insideBuilding=false;player.buildingTransitionSeq++;}
        continue;
      }
      if(player.isVaulting)continue;
      const current=player.buildingId;
      let next='';
      if(current){
        const zone=buildingZoneById(current,this.map.buildingVisibilityZones);
        if(zone){
          const margin=12;
          const inside=player.x>=zone.interior.x-margin&&player.x<=zone.interior.x+zone.interior.w+margin&&player.y>=zone.interior.y-margin&&player.y<=zone.interior.y+zone.interior.h+margin;
          if(inside)next=current;
        }
      }
      if(!next)next=buildingIdAt(player.x,player.y,12,this.map.buildingVisibilityZones);
      if(next!==current){player.buildingId=next;player.insideBuilding=Boolean(next);player.buildingTransitionSeq++;}
    }
  }

  private canSeeTarget(viewer:PlayerState,target:PlayerState){
    return visibilitySampleResult(
      viewer.x,viewer.y,target.x,target.y,
      this.map.visibilityObstacles,PLAYER_HIT_RADIUS,2,
    ).characterVisible;
  }

  private syncRoomRegistry(){
    const humans=[...this.state.players.values()].filter((player)=>!player.ai);
    const host=this.state.players.get(this.state.hostId)??humans[0];
    upsertPublicRoom({
      roomId:this.roomId,
      roomCode:this.state.roomCode,
      hostName:host?.name??'대기 중',
      players:this.state.players.size,
      humans:humans.length,
      maxPlayers:this.maxClients,
      phase:this.state.phase as 'LOBBY'|'PLANE'|'DROP'|'ACTIVE'|'FINISHED',
      fillAi:this.state.fillAi,
      publicRoom:this.state.publicRoom,
      mapSizeMode:this.state.mapSizeMode as MapSizeMode,
      mapDisplayName:this.map.displayName,
      createdAt:this.createdAt,
      updatedAt:Date.now(),
    });
  }

  private getWeaponMagazine(p:PlayerState,id:WeaponId):number{
    if(id==='pistol')return p.pistolMagazine;
    if(id==='smg')return p.smgMagazine;
    if(id==='rifle')return p.rifleMagazine;
    if(id==='shotgun')return p.shotgunMagazine;
    if(id==='sniper')return p.sniperMagazine;
    return 0;
  }

  private setWeaponMagazine(p:PlayerState,id:WeaponId,value:number,sync=true){
    const amount=Math.max(0,Math.floor(value));
    if(id==='pistol')p.pistolMagazine=amount;
    else if(id==='smg')p.smgMagazine=amount;
    else if(id==='rifle')p.rifleMagazine=amount;
    else if(id==='shotgun')p.shotgunMagazine=amount;
    else if(id==='sniper')p.sniperMagazine=amount;
    if(sync&&p.equipped===id)p.magazine=amount;
  }

  private syncMagazine(p:PlayerState){
    const id=p.equipped as WeaponId;
    p.magazine=id in WEAPONS&&id!=='fists'?this.getWeaponMagazine(p,id):0;
  }

  private getAmmo(p:PlayerState,t:AmmoType){return t==='pistol_ammo'?p.pistolAmmo:t==='standard_ammo'?p.standardAmmo:t==='shotgun_ammo'?p.shotgunAmmo:0;}
  private setAmmo(p:PlayerState,t:AmmoType,v:number){if(t==='pistol_ammo')p.pistolAmmo=v;else if(t==='standard_ammo')p.standardAmmo=v;else if(t==='shotgun_ammo')p.shotgunAmmo=v;}
  private now(){return this.clock.elapsedTime/1000;}
  private angleDiff(a:number,b:number){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}

  private segmentRect(x1:number,y1:number,x2:number,y2:number,r:{x:number;y:number;w:number;h:number}){
    return segmentRectIntersectionT(x1,y1,x2,y2,r)!==null;
  }
}
