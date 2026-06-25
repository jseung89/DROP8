import { Client, CloseCode, Room } from '@colyseus/core';
import { BulletState, Drop8State, LootState, PlayerState } from './schema.js';
import {
  BUILDINGS,
  BUSH_FIRE_REVEAL_SECONDS,
  BUSH_HIDE_DISTANCE,
  BUSH_HIT_REVEAL_SECONDS,
  CHAT_RADIUS,
  FALL_START_ALTITUDE,
  LOOT_SPAWNS,
  REGION_LOOT_TABLES,
  REGIONS,
  LOOT_MIN_DISTANCE,
  GUN_LOOT_MIN_DISTANCE,
  LOOT_DOOR_CLEARANCE,
  LOOT_WALL_CLEARANCE,
  MAX_PLAYERS,
  MELEE_WEAPONS,
  COLLISION_OBSTACLES,
  PROP_OBSTACLES,
  BULLET_OBSTACLES,
  PATCH_RATE_MS,
  PLANE_DURATION,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SERVER_TICK_RATE,
  WEAPONS,
  WORLD_SIZE,
  circleHitsRect,
  clamp,
  createRoomCode,
  createPlaneRoute,
  createNextZone,
  distance,
  isFiniteNumber,
  sanitizeText,
  createSeededRandom,
  weightedLootChoice,
  bushContaining,
  type Building,
  type Difficulty,
  type EquippedId,
  type LootKind,
  type RegionId,
  type MeleeId,
  type WeaponId,
  type ZoneSpeed,
} from '@drop8/shared';

type Input = { x:number; y:number; angle:number; seq:number };
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
type SafePoint={x:number;y:number};
type JoinOptions = {
  nickname?:unknown;
  password?:unknown;
  fillAi?:boolean;
  difficulty?:Difficulty;
  zoneSpeed?:ZoneSpeed;
  roomPassword?:unknown;
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
  private knockback=new Map<string,{vx:number;vy:number}>();
  private chatAt=new Map<string,number>();
  private noises:Noise[]=[];
  private password='';
  private elapsed=0;
  private bulletSeq=0;
  private lootSeq=0;
  private planeStart={x:0,y:0};
  private planeEnd={x:WORLD_SIZE,y:WORLD_SIZE};
  private lootRandom:()=>number=Math.random;
  private zoneShrinkDuration=28;
  private tickSamples:number[]=[];
  private perfLastPublish=0;

  async onCreate(options:JoinOptions) {
    let code=createRoomCode();
    for(let i=0;i<8 && await this.presence.get(`drop8:${code}`);i++)code=createRoomCode();
    await this.presence.setex(`drop8:${code}`,'1',60*60*8);
    this.roomId=code;
    this.state.roomCode=code;
    this.state.fillAi=options.fillAi!==false;
    this.state.difficulty=options.difficulty??'normal';
    this.state.zoneSpeed=options.zoneSpeed??'normal';
    this.password=sanitizeText(options.roomPassword,32);
    this.patchRate=PATCH_RATE_MS;
    this.setSimulationInterval((dt)=>this.tick(dt/1000),1000/SERVER_TICK_RATE);

    this.onMessage('ready',(c)=>this.ready(c));
    this.onMessage('settings',(c,m)=>this.settings(c,m));
    this.onMessage('start',(c)=>this.start(c));
    this.onMessage('input',(c,m)=>this.input(c,m));
    this.onMessage('jump',(c)=>this.jump(c));
    this.onMessage('fire',(c)=>this.fire(c));
    this.onMessage('melee',(c)=>this.melee(c));
    this.onMessage('reload',(c)=>this.reload(c));
    this.onMessage('pickup',(c)=>this.pickup(c));
    this.onMessage('switch',(c,m)=>this.switchWeapon(c,m));
    this.onMessage('heal',(c,m)=>this.heal(c,m));
    this.onMessage('chat',(c,m)=>this.chat(c,m));
    this.onMessage('ping',(c,m)=>c.send('pong',{t:Number(m?.t)||Date.now(),serverTime:Date.now()}));
    this.onMessage('rematch',(c)=>{
      if(this.state.phase==='FINISHED'&&this.state.players.get(c.sessionId)?.host)this.resetLobby();
    });
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
  }

  async onLeave(client:Client,code:CloseCode){
    const p=this.state.players.get(client.sessionId);
    if(!p)return;
    if(this.state.phase!=='LOBBY'&&code!==CloseCode.CONSENTED){
      try{await this.allowReconnection(client,15);return;}catch{/* reconnect timeout */}
    }
    const wasHost=p.host;
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.cancelHeal(p);
    this.cancelReload(p);
    this.lastSafePositions.delete(p.id);
    this.system(`${p.name}님이 퇴장했습니다.`);
    if(wasHost){
      const next=[...this.state.players.values()].find((v)=>!v.ai);
      if(next){next.host=true;this.state.hostId=next.id;}
    }
  }

  onDispose(){void this.presence.del(`drop8:${this.roomId}`);}

  private system(text:string){const now=Date.now();this.broadcast('chat',{channel:'system',sender:'시스템',nickname:'시스템',text,time:now,sentAt:now});}

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
  }

  private start(c:Client){
    const p=this.state.players.get(c.sessionId);
    if(!p?.host||this.state.phase!=='LOBBY')return;
    const humans=[...this.state.players.values()].filter((v)=>!v.ai);
    if(humans.some((v)=>!v.ready)){c.send('error','모든 실제 플레이어가 준비해야 합니다.');return;}
    if(this.state.fillAi)this.fillAi();
    this.beginMatch();
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
    this.state.zoneX=WORLD_SIZE/2;
    this.state.zoneY=WORLD_SIZE/2;
    this.state.zoneRadius=1950;
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
      p.smallAmmo=0;
      p.rifleAmmo=0;
      p.shells=0;
      p.bandages=0;
      p.medkits=0;
      p.healingKind='';
      p.healingProgress=0;
      p.x=this.planeStart.x;
      p.y=this.planeStart.y;
      this.lastSafePositions.set(p.id,{x:p.x,y:p.y});
      if(p.ai){
        this.aiThinkAt.set(p.id,3+aiIndex++*1.7);
        this.aiIntent.set(p.id,this.newAiIntent(p));
      }
    }
    this.state.aliveCount=this.state.players.size;
    this.spawnLoot();
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
    const route=createPlaneRoute(this.lootRandom);
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
    for(const spawn of LOOT_SPAWNS){
      const table=REGION_LOOT_TABLES[spawn.regionId as RegionId]??REGION_LOOT_TABLES.residential;
      const kind=weightedLootChoice(table,this.lootRandom);
      const pos=this.findSeparatedLootPosition(spawn.x,spawn.y,kind);
      if(!pos)continue;
      const l=new LootState();
      l.id=`loot-${++this.lootSeq}`;
      l.kind=kind;
      l.x=pos.x;
      l.y=pos.y;
      this.state.loot.set(l.id,l);
    }
  }

  private lootSpacing(kind:LootKind){return kind in WEAPONS&&kind!=='fists'?GUN_LOOT_MIN_DISTANCE:LOOT_MIN_DISTANCE;}

  private doorCenters():Point[]{
    return BUILDINGS.map((building)=>{
      if(building.doorSide==='north'||building.doorSide==='south')return{x:building.x+building.w*building.doorOffset,y:building.doorSide==='north'?building.y:building.y+building.h};
      return{x:building.doorSide==='west'?building.x:building.x+building.w,y:building.y+building.h*building.doorOffset};
    });
  }

  private isLootPositionValid(x:number,y:number,kind:LootKind,ignoreId=''){
    if(x<40||y<40||x>WORLD_SIZE-40||y>WORLD_SIZE-40)return false;
    if(COLLISION_OBSTACLES.some((rect)=>circleHitsRect(x,y,LOOT_WALL_CLEARANCE,rect)))return false;
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
      const x=clamp(baseX+Math.cos(angle)*radius,40,WORLD_SIZE-40);
      const y=clamp(baseY+Math.sin(angle)*radius,40,WORLD_SIZE-40);
      if(this.isLootPositionValid(x,y,kind))return{x,y};
    }
    const region=REGIONS.find((r)=>baseX>=r.x&&baseX<=r.x+r.w&&baseY>=r.y&&baseY<=r.y+r.h);
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
    this.knockback.clear();
    this.noises=[];
    this.tickSamples=[];
    this.perfLastPublish=0;
  }

  private input(c:Client,m:any){
    const p=this.state.players.get(c.sessionId);
    if(!p||p.ai||!p.alive)return;
    if(!isFiniteNumber(m?.x)||!isFiniteNumber(m?.y)||!isFiniteNumber(m?.angle))return;
    this.inputs.set(p.id,{x:clamp(m.x,-1,1),y:clamp(m.y,-1,1),angle:m.angle,seq:Number(m.seq)||0});
  }

  private jump(c:Client){const p=this.state.players.get(c.sessionId);if(p?.phase==='plane')this.doJump(p);}

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
    if(!p.alive||p.phase!=='landed')return;
    if(this.healUntil.has(p.id)){this.cancelHeal(p);return;}
    if(this.reloadUntil.has(p.id))return;
    const id=p.equipped as WeaponId;
    const w=WEAPONS[id];
    if(!w||w.id==='fists')return;
    const magazine=this.getWeaponMagazine(p,id);
    if(magazine<=0){this.beginReload(p,id);return;}
    const now=this.now();
    if(now-(this.shotAt.get(p.id)??-99)<w.fireInterval)return;
    this.shotAt.set(p.id,now);
    p.attackSeq++;
    this.setWeaponMagazine(p,id,magazine-1);
    this.revealBushPlayer(p,BUSH_FIRE_REVEAL_SECONDS);
    this.noises.push({x:p.x,y:p.y,at:now,owner:p.id});
    for(let i=0;i<w.pellets;i++){
      const a=p.angle+(Math.random()*2-1)*w.spread;
      const b=new BulletState();
      b.id=`b-${++this.bulletSeq}`;
      b.owner=p.id;
      b.x=p.x+Math.cos(a)*28;
      b.y=p.y+Math.sin(a)*28;
      b.vx=Math.cos(a)*w.projectileSpeed;
      b.vy=Math.sin(a)*w.projectileSpeed;
      b.life=w.range/w.projectileSpeed;
      b.damage=w.damage;
      this.state.bullets.set(b.id,b);
    }
  }

  private melee(c:Client){const p=this.state.players.get(c.sessionId);if(p)this.meleePlayer(p);}

  private meleePlayer(p:PlayerState){
    if(!p.alive||p.phase!=='landed')return;
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
      if(d<best&&Math.abs(this.angleDiff(Math.atan2(other.y-p.y,other.x-p.x),p.angle))<melee.arc){target=other;best=d;}
    }
    if(target)this.damage(target,melee.damage,p.id,p.equipped==='fists'?'주먹':melee.name);
  }

  private reload(c:Client){
    const p=this.state.players.get(c.sessionId);
    if(!p)return;
    if(this.healUntil.has(p.id)){this.cancelHeal(p);return;}
    this.beginReload(p);
  }

  private beginReload(p:PlayerState,weaponId:WeaponId=p.equipped as WeaponId){
    if(!p.alive||p.phase!=='landed'||this.reloadUntil.has(p.id))return false;
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
    return true;
  }

  private cancelReload(p:PlayerState){
    this.reloadUntil.delete(p.id);
    p.reloading=false;
    p.reloadWeapon='';
    p.reloadProgress=0;
  }

  private pickup(c:Client){
    const p=this.state.players.get(c.sessionId);
    if(!p||p.phase!=='landed'||!p.alive)return;
    if(this.healUntil.has(p.id))this.cancelHeal(p);
    let pick:LootState|undefined;
    let best=72;
    for(const l of this.state.loot.values()){
      const d=distance(p.x,p.y,l.x,l.y);
      if(d<best){best=d;pick=l;}
    }
    if(!pick)return;
    this.applyLoot(p,pick.kind as LootKind);
    this.state.loot.delete(pick.id);
    this.lootReservations.delete(pick.id);
  }

  private applyLoot(p:PlayerState,k:LootKind){
    if(k in WEAPONS&&k!=='fists'){
      const id=k as WeaponId;
      const w=WEAPONS[id]!;
      if(w.slot==='primary')p.primary=id;
      else p.secondary=id;
      if(this.getWeaponMagazine(p,id)<=0)this.setWeaponMagazine(p,id,w.magazine,false);
      if(w.ammoType==='small')p.smallAmmo+=w.magazine*2;
      if(w.ammoType==='rifle')p.rifleAmmo+=w.magazine*2;
      if(w.ammoType==='shells')p.shells+=w.magazine*2;
      this.setEquipped(p,id,true);
      return;
    }
    if(k in MELEE_WEAPONS){p.melee=k;this.setEquipped(p,k as MeleeId,true);return;}
    if(k==='small_ammo')p.smallAmmo+=30;
    else if(k==='rifle_ammo')p.rifleAmmo+=24;
    else if(k==='shells')p.shells+=12;
    else if(k==='vest')p.armor=Math.max(p.armor,100);
    else if(k==='bandage')p.bandages=Math.min(5,p.bandages+1);
    else if(k==='medkit')p.medkits=Math.min(2,p.medkits+1);
  }

  private switchWeapon(c:Client,m:any){
    const p=this.state.players.get(c.sessionId);
    if(!p)return;
    const slot=Number(m?.slot);
    const id=(slot===1?p.primary:slot===2?p.secondary:p.melee||'fists') as EquippedId;
    if(!id||(!(id in WEAPONS)&&!(id in MELEE_WEAPONS)))return;
    this.cancelHeal(p);
    this.setEquipped(p,id,true);
  }

  private setEquipped(p:PlayerState,id:EquippedId,force=false){
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
    if(!this.beginHeal(p,requested))c.send('error',p.hp>=100?'이미 체력이 가득합니다.':'사용할 회복 아이템이 없습니다.');
  }

  private beginHeal(p:PlayerState,requested:'auto'|HealKind='auto'){
    if(!p.alive||p.phase!=='landed'||p.hp>=100||this.healUntil.has(p.id))return false;
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
    const collisionStarted=performance.now();
    this.updatePlayers(dt);
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
    this.state.planeProgress=clamp(this.elapsed/PLANE_DURATION,0,1);
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
        if(p.altitude<=0){p.phase='landed';if(p.ai){p.aiState='EARLY_LOOT';this.aiLandedAt.set(p.id,this.now());}this.system(`${p.name} 착지`);}
        continue;
      }
      if(p.phase!=='landed')continue;

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
      const moveMultiplier=ranged?.moveMultiplier??melee?.moveMultiplier??1;
      this.tryMove(p,input.x*PLAYER_SPEED*moveMultiplier*dt,input.y*PLAYER_SPEED*moveMultiplier*dt);
    }
  }

  private tryMove(p:PlayerState,dx:number,dy:number){
    const beforeX=p.x;
    const beforeY=p.y;
    this.ensurePlayerFree(p);
    const total=Math.hypot(dx,dy);
    const steps=Math.max(1,Math.ceil(total/6));
    const sx=dx/steps;
    const sy=dy/steps;
    for(let i=0;i<steps;i++){
      const nx=clamp(p.x+sx,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
      const ny=clamp(p.y+sy,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
      if(this.isPositionFree(nx,ny)){p.x=nx;p.y=ny;continue;}
      if(this.isPositionFree(nx,p.y)){p.x=nx;continue;}
      if(this.isPositionFree(p.x,ny)){p.y=ny;continue;}
      const length=Math.hypot(sx,sy)||1;
      const slideX=-sy/length*Math.min(6,length);
      const slideY=sx/length*Math.min(6,length);
      if(this.isPositionFree(p.x+slideX,p.y+slideY)){p.x+=slideX;p.y+=slideY;continue;}
      if(this.isPositionFree(p.x-slideX,p.y-slideY)){p.x-=slideX;p.y-=slideY;continue;}
      break;
    }
    this.ensurePlayerFree(p);
    if(this.isPositionFree(p.x,p.y,PLAYER_RADIUS+2))this.lastSafePositions.set(p.id,{x:p.x,y:p.y});
    return Math.hypot(p.x-beforeX,p.y-beforeY)>.05;
  }

  private isPositionFree(x:number,y:number,radius=PLAYER_RADIUS){
    return !COLLISION_OBSTACLES.some((rect)=>circleHitsRect(x,y,radius,rect));
  }


  private revealBushPlayer(p:PlayerState,seconds:number){
    if(!p.alive||p.phase!=='landed')return;
    if(!p.inBush&&!bushContaining(p.x,p.y,4))return;
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
      p.inBush=Boolean(bushContaining(p.x,p.y,4));
      if(!p.inBush){p.bushRevealed=false;this.bushRevealUntil.delete(p.id);continue;}
      const revealUntil=this.bushRevealUntil.get(p.id)??0;
      p.bushRevealed=now<revealUntil;
      if(now>=revealUntil)this.bushRevealUntil.delete(p.id);
    }
  }

  private ensurePlayerFree(p:PlayerState){
    if(this.isPositionFree(p.x,p.y)){
      if(this.isPositionFree(p.x,p.y,PLAYER_RADIUS+2))this.lastSafePositions.set(p.id,{x:p.x,y:p.y});
      return true;
    }
    const previous=this.lastSafePositions.get(p.id);
    const point=previous&&this.isPositionFree(previous.x,previous.y)&&distance(p.x,p.y,previous.x,previous.y)<320
      ?previous
      :this.findNearestFreePoint(p.x,p.y);
    if(!point)return false;
    p.x=point.x;
    p.y=point.y;
    this.lastSafePositions.set(p.id,{x:p.x,y:p.y});
    const intent=this.aiIntent.get(p.id);
    if(intent){
      intent.route=[];
      intent.repathAt=0;
      intent.stuckFor=0;
      intent.lastX=p.x;
      intent.lastY=p.y;
    }
    return true;
  }

  private ensureAiFree(p:PlayerState){return this.ensurePlayerFree(p);}

  private findNearestFreePoint(x:number,y:number,maxRadius=360):Point|undefined{
    if(this.isPositionFree(x,y))return{x,y};
    for(let radius=32;radius<=maxRadius;radius+=24){
      const samples=Math.max(16,Math.ceil(radius/8));
      for(let i=0;i<samples;i++){
        const angle=i/samples*Math.PI*2;
        const px=clamp(x+Math.cos(angle)*radius,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
        const py=clamp(y+Math.sin(angle)*radius,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
        if(this.isPositionFree(px,py))return{x:px,y:py};
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
      this.cancelHeal(p);
      if(p.ai)p.aiState='PATROL';
    }
  }

  private updateBullets(dt:number){
    for(const [id,b] of [...this.state.bullets]){
      const ox=b.x;
      const oy=b.y;
      b.x+=b.vx*dt;
      b.y+=b.vy*dt;
      b.life-=dt;
      if(
        b.life<=0||b.x<0||b.y<0||b.x>WORLD_SIZE||b.y>WORLD_SIZE||
        BULLET_OBSTACLES.some((r)=>this.segmentRect(ox,oy,b.x,b.y,r))
      ){
        this.state.bullets.delete(id);
        continue;
      }
      for(const p of this.state.players.values()){
        if(!p.alive||p.id===b.owner||p.phase!=='landed')continue;
        if(distance(b.x,b.y,p.x,p.y)<PLAYER_RADIUS+5){
          this.damage(p,b.damage,b.owner,'총기');
          this.state.bullets.delete(id);
          break;
        }
      }
    }
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
    const target=createNextZone(this.lootRandom,this.state.zoneX,this.state.zoneY,this.state.zoneRadius,nextRadius,this.state.zoneStage);
    this.state.nextZoneX=target.x;
    this.state.nextZoneY=target.y;
    this.state.nextZoneRadius=target.radius;
  }

  private zoneWaitSeconds(){return this.state.zoneStage===0?30:Math.max(10,24-this.state.zoneStage*2);}
  private zoneShrinkSeconds(){return Math.max(12,30-this.state.zoneStage*2.5);}

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
    const x=clamp(cx+Math.cos(angle)*ring,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
    const y=clamp(cy+Math.sin(angle)*ring,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
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
    if(target?.alive){
      const clear=!BULLET_OBSTACLES.some((r)=>this.segmentRect(p.x,p.y,target.x,target.y,r));
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
    if(loot&&distance(p.x,p.y,loot.x,loot.y)<72){
      if(this.aiLootScore(p,loot.kind as LootKind)>0){
        this.applyLoot(p,loot.kind as LootKind);
        this.state.loot.delete(loot.id);
        this.lootReservations.delete(loot.id);
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
        const x=clamp(p.x+Math.cos(angle)*radius,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
        const y=clamp(p.y+Math.sin(angle)*radius,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
        if(!this.isPositionFree(x,y)||this.segmentBlocked(p.x,p.y,x,y,PLAYER_RADIUS))continue;
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
      if(q.inBush&&!q.bushRevealed&&d>BUSH_HIDE_DISTANCE)continue;
      if(BULLET_OBSTACLES.some((r)=>this.segmentRect(p.x,p.y,q.x,q.y,r)))continue;
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
      const w=WEAPONS[id];
      const incoming=this.weaponBaseScore(id);
      const held=w.slot==='primary'&&p.primary?this.weaponBaseScore(p.primary as WeaponId):w.slot==='secondary'&&p.secondary?this.weaponBaseScore(p.secondary as WeaponId):0;
      return incoming>held+4?95+(incoming-held):0;
    }
    if(k in MELEE_WEAPONS){
      const held=p.melee==='fists'?0:this.meleeScore(p.melee as MeleeId);
      const incoming=this.meleeScore(k as MeleeId);
      return incoming>held?42+(incoming-held):0;
    }
    if(k==='small_ammo')return(p.secondary==='pistol'||p.primary==='smg')&&p.smallAmmo<90?62-p.smallAmmo*.25:0;
    if(k==='rifle_ammo')return p.primary==='rifle'&&p.rifleAmmo<72?66-p.rifleAmmo*.35:0;
    if(k==='shells')return p.primary==='shotgun'&&p.shells<28?64-p.shells*.8:0;
    if(k==='vest')return p.armor<70?72-p.armor*.4:0;
    if(k==='bandage')return p.bandages<3?55-p.bandages*12:0;
    if(k==='medkit')return p.medkits<2?68-p.medkits*20:0;
    return 0;
  }

  private aiLootState(k:LootKind){
    if(k in WEAPONS)return'SEEK_WEAPON';
    if(k==='small_ammo'||k==='rifle_ammo'||k==='shells')return'SEEK_AMMO';
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
    return 330;
  }

  private weaponBaseScore(id:WeaponId):number{return id==='rifle'?90:id==='smg'?82:id==='shotgun'?78:id==='pistol'?52:0;}
  private meleeScore(id:MeleeId):number{return id==='pan'?30:id==='bat'?27:id==='pipe'?24:19;}

  private setAiDestination(p:PlayerState,intent:AiIntent,x:number,y:number,force=false){
    const tx=clamp(x,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
    const ty=clamp(y,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
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

    const clearance=PLAYER_RADIUS+12;
    const source=this.buildingAt(startPoint.x,startPoint.y);
    const target=this.buildingAt(goalPoint.x,goalPoint.y);
    const relevant=BUILDINGS.filter((building)=>{
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
      const x=clamp(point.x,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
      const y=clamp(point.y,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
      if(!this.isPositionFree(x,y,PLAYER_RADIUS+1))return;
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
    for(const prop of PROP_OBSTACLES){
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
    const clearance=PLAYER_RADIUS+16;
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

  private segmentBlocked(x1:number,y1:number,x2:number,y2:number,clearance=PLAYER_RADIUS+3){
    return COLLISION_OBSTACLES.some((rect)=>this.segmentRect(x1,y1,x2,y2,{
      x:rect.x-clearance,
      y:rect.y-clearance,
      w:rect.w+clearance*2,
      h:rect.h+clearance*2,
    }));
  }

  private buildingAt(x:number,y:number){return BUILDINGS.find((b)=>x>b.x+18&&x<b.x+b.w-18&&y>b.y+18&&y<b.y+b.h-18);}

  private doorPoints(b:Building){
    const margin=PLAYER_RADIUS+14;
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

  private damage(p:PlayerState,amount:number,attackerId:string,reason:string){
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
    const hitAngle=attacker?Math.atan2(p.y-attacker.y,p.x-attacker.x):p.lastHitAngle;
    p.hitSeq++;
    p.lastHitAngle=hitAngle;
    p.lastHitDamage=actual;
    if(attacker&&reason!=='자기장'){
      const power=this.knockbackPower(attacker,reason);
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
    if(reason==='총기')return attacker.equipped==='shotgun'?230:attacker.equipped==='rifle'?90:attacker.equipped==='pistol'?72:38;
    return 0;
  }

  private dropInventory(p:PlayerState){
    const kinds:LootKind[]=[];
    if(p.primary)kinds.push(p.primary as LootKind);
    if(p.secondary)kinds.push(p.secondary as LootKind);
    if(p.melee!=='fists')kinds.push(p.melee as LootKind);
    if(p.smallAmmo>0)kinds.push('small_ammo');
    if(p.rifleAmmo>0)kinds.push('rifle_ammo');
    if(p.shells>0)kinds.push('shells');
    if(p.armor>0)kinds.push('vest');
    if(p.bandages>0)kinds.push('bandage');
    if(p.medkits>0)kinds.push('medkit');
    const total=Math.max(1,kinds.length);
    kinds.forEach((kind,index)=>{
      const ring=kind==='vest'?70:kind==='bandage'||kind==='medkit'?58:kind.includes('ammo')||kind==='shells'?45:kind in WEAPONS?30:38;
      const angle=index/total*Math.PI*2;
      const baseX=p.x+Math.cos(angle)*ring;
      const baseY=p.y+Math.sin(angle)*ring;
      const pos=this.findSeparatedLootPosition(baseX,baseY,kind)??this.findNearestFreePoint(baseX,baseY,180);
      if(!pos)return;
      const loot=new LootState();
      loot.id=`loot-${++this.lootSeq}`;loot.kind=kind;loot.x=pos.x;loot.y=pos.y;
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
        p.aiState='';
      }
    }
    this.state.phase='LOBBY';
    this.state.winner='';
    this.state.placements.clear();
    this.state.aliveCount=this.state.players.size;
  }

  private getWeaponMagazine(p:PlayerState,id:WeaponId):number{
    if(id==='pistol')return p.pistolMagazine;
    if(id==='smg')return p.smgMagazine;
    if(id==='rifle')return p.rifleMagazine;
    if(id==='shotgun')return p.shotgunMagazine;
    return 0;
  }

  private setWeaponMagazine(p:PlayerState,id:WeaponId,value:number,sync=true){
    const amount=Math.max(0,Math.floor(value));
    if(id==='pistol')p.pistolMagazine=amount;
    else if(id==='smg')p.smgMagazine=amount;
    else if(id==='rifle')p.rifleMagazine=amount;
    else if(id==='shotgun')p.shotgunMagazine=amount;
    if(sync&&p.equipped===id)p.magazine=amount;
  }

  private syncMagazine(p:PlayerState){
    const id=p.equipped as WeaponId;
    p.magazine=id in WEAPONS&&id!=='fists'?this.getWeaponMagazine(p,id):0;
  }

  private getAmmo(p:PlayerState,t:string){return t==='small'?p.smallAmmo:t==='rifle'?p.rifleAmmo:t==='shells'?p.shells:0;}
  private setAmmo(p:PlayerState,t:string,v:number){if(t==='small')p.smallAmmo=v;else if(t==='rifle')p.rifleAmmo=v;else if(t==='shells')p.shells=v;}
  private now(){return this.clock.elapsedTime/1000;}
  private angleDiff(a:number,b:number){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}

  private segmentRect(x1:number,y1:number,x2:number,y2:number,r:{x:number;y:number;w:number;h:number}){
    const steps=Math.max(1,Math.ceil(distance(x1,y1,x2,y2)/18));
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      const x=x1+(x2-x1)*t;
      const y=y1+(y2-y1)*t;
      if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return true;
    }
    return false;
  }
}
