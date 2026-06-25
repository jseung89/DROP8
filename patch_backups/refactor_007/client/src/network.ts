import { Client, type Room } from '@colyseus/sdk';

export type Snapshot={
  phase:string;roomCode:string;hostId:string;fillAi:boolean;publicRoom:boolean;difficulty:string;zoneSpeed:string;mapId:string;mapSizeMode:string;mapRevision:number;worldSize:number;
  zoneX:number;zoneY:number;zoneRadius:number;zoneStartX:number;zoneStartY:number;zoneStartRadius:number;
  nextZoneX:number;nextZoneY:number;nextZoneRadius:number;zoneTimer:number;zoneStage:number;zoneProgress:number;zoneState:string;
  planeStartX:number;planeStartY:number;planeX:number;planeY:number;planeEndX:number;planeEndY:number;planeAngle:number;planeProgress:number;
  serverTime:number;serverTickAvg:number;serverTickP95:number;serverTickMax:number;serverAiMs:number;serverCollisionMs:number;serverZoneMs:number;recoveryCount:number;activeBulletLimit:number;
  aliveCount:number;winner:string;players:any[];bullets:any[];loot:any[];receivedAt:number;
};

const endpoint=location.origin.replace(/^http/,'ws');

export class Network {
  client=new Client(endpoint);
  room:Room<any>|null=null;
  snapshot:Snapshot|null=null;
  listeners=new Set<()=>void>();
  messages=new Set<(t:string,p:any)=>void>();
  private playerCache=new Map<string,any>();
  private bulletCache=new Map<string,any>();
  private lootCache=new Map<string,any>();
  private lastPatchAt=0;
  private patchIntervals:number[]=[];
  private receivedBytesWindow=0;
  private bytesPerSecond=0;
  private bytesWindowAt=performance.now();
  private pingTimer=0;
  rtt=0;

  async create(options:any){this.room=await this.client.create('drop8',options);this.attach();return this.room;}
  async join(code:string,options:any){this.room=await this.client.joinById(code.toUpperCase(),options);this.attach();return this.room;}

  private attach(){
    if(!this.room)return;
    const update=(s:any)=>{
      const now=performance.now();
      if(this.lastPatchAt){this.patchIntervals.push(now-this.lastPatchAt);if(this.patchIntervals.length>120)this.patchIntervals.shift();}
      this.lastPatchAt=now;
      this.snapshot=this.toSnapshot(s,now);
      if(now-this.bytesWindowAt>=1000){this.bytesPerSecond=this.receivedBytesWindow;this.receivedBytesWindow=0;this.bytesWindowAt=now;}
      this.listeners.forEach(fn=>fn());
    };
    this.room.onStateChange(update);
    if(this.room.state?.players)update(this.room.state);
    for(const type of ['chat','killfeed','result','error','pong','kicked','pickupResult','positionRecovery'])this.room.onMessage(type,(p:any)=>{
      if(type==='pong'&&Number.isFinite(Number(p?.t)))this.rtt=Math.max(0,Date.now()-Number(p.t));
      this.messages.forEach(fn=>fn(type,p));
    });
    window.clearInterval(this.pingTimer);
    this.pingTimer=window.setInterval(()=>this.room?.send('ping',{t:Date.now()}),2000);
  }

  private syncCollection(collection:any,cache:Map<string,any>){
    const seen=new Set<string>();
    if(collection&&typeof collection.values==='function'){
      for(const raw of collection.values()){
        const json=raw?.toJSON?.()??({...raw});
        const id=String(json.id??'');
        if(!id)continue;
        seen.add(id);
        const existing=cache.get(id);
        if(existing)Object.assign(existing,json);
        else cache.set(id,json);
      }
    }
    for(const id of cache.keys())if(!seen.has(id))cache.delete(id);
    return [...cache.values()];
  }

  private toSnapshot(s:any,receivedAt:number):Snapshot{
    const snapshot:Snapshot={
      phase:s.phase,roomCode:s.roomCode,hostId:s.hostId,fillAi:s.fillAi,publicRoom:s.publicRoom,difficulty:s.difficulty,zoneSpeed:s.zoneSpeed,mapId:s.mapId,mapSizeMode:s.mapSizeMode,mapRevision:s.mapRevision,worldSize:s.worldSize,
      zoneX:s.zoneX,zoneY:s.zoneY,zoneRadius:s.zoneRadius,zoneStartX:s.zoneStartX,zoneStartY:s.zoneStartY,zoneStartRadius:s.zoneStartRadius,
      nextZoneX:s.nextZoneX, nextZoneY:s.nextZoneY,nextZoneRadius:s.nextZoneRadius,zoneTimer:s.zoneTimer,zoneStage:s.zoneStage,zoneProgress:s.zoneProgress,zoneState:s.zoneState,
      planeStartX:s.planeStartX,planeStartY:s.planeStartY,planeX:s.planeX,planeY:s.planeY,planeEndX:s.planeEndX,planeEndY:s.planeEndY,planeAngle:s.planeAngle,planeProgress:s.planeProgress,
      serverTime:s.serverTime,serverTickAvg:s.serverTickAvg,serverTickP95:s.serverTickP95,serverTickMax:s.serverTickMax,serverAiMs:s.serverAiMs,serverCollisionMs:s.serverCollisionMs,serverZoneMs:s.serverZoneMs,recoveryCount:s.recoveryCount,activeBulletLimit:s.activeBulletLimit,
      aliveCount:s.aliveCount,winner:s.winner,
      players:this.syncCollection(s.players,this.playerCache),bullets:this.syncCollection(s.bullets,this.bulletCache),loot:this.syncCollection(s.loot,this.lootCache),receivedAt,
    };
    if(receivedAt-this.bytesWindowAt<1000){
      this.receivedBytesWindow+=220+snapshot.players.length*150+snapshot.bullets.length*70+snapshot.loot.length*55;
    }
    return snapshot;
  }

  async leave(consented=true){
    window.clearInterval(this.pingTimer);
    const room=this.room;
    this.room=null;
    this.snapshot=null;
    this.playerCache.clear();
    this.bulletCache.clear();
    this.lootCache.clear();
    this.patchIntervals=[];
    this.lastPatchAt=0;
    this.receivedBytesWindow=0;
    this.bytesPerSecond=0;
    this.rtt=0;
    if(room){try{await room.leave(consented);}catch{/* connection may already be closed */}}
    this.listeners.forEach((listener)=>listener());
  }

  get patchInterval(){
    if(!this.patchIntervals.length)return 0;
    return this.patchIntervals.reduce((sum,value)=>sum+value,0)/this.patchIntervals.length;
  }
  get incomingBytesPerSecond(){return this.bytesPerSecond;}
  send(type:string,payload?:any){this.room?.send(type,payload);}
  get sessionId(){return this.room?.sessionId??'';}
}
