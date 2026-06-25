import { Client, type Room } from '@colyseus/sdk';
export type Snapshot={phase:string;roomCode:string;hostId:string;fillAi:boolean;difficulty:string;zoneSpeed:string;zoneX:number;zoneY:number;zoneRadius:number;nextZoneRadius:number;zoneTimer:number;zoneStage:number;planeX:number;planeY:number;planeEndX:number;planeEndY:number;planeProgress:number;aliveCount:number;winner:string;players:any[];bullets:any[];loot:any[]};
const endpoint=location.origin.replace(/^http/,'ws');
export class Network {
  client=new Client(endpoint); room:Room<any>|null=null; snapshot:Snapshot|null=null; listeners=new Set<()=>void>(); messages=new Set<(t:string,p:any)=>void>();
  async create(options:any){this.room=await this.client.create('drop8',options);this.attach();return this.room;}
  async join(code:string,options:any){this.room=await this.client.joinById(code.toUpperCase(),options);this.attach();return this.room;}
  private attach(){if(!this.room)return;const update=(s:any)=>{this.snapshot=this.toSnapshot(s);this.listeners.forEach(fn=>fn());};this.room.onStateChange(update);if(this.room.state?.players)update(this.room.state);for(const type of ['chat','killfeed','result','error'])this.room.onMessage(type,(p:any)=>this.messages.forEach(fn=>fn(type,p)));}
  private toSnapshot(s:any):Snapshot{const values=function(c:any){if(!c||typeof c.values!=='function')return [];return Array.from(c.values());};return {phase:s.phase,roomCode:s.roomCode,hostId:s.hostId,fillAi:s.fillAi,difficulty:s.difficulty,zoneSpeed:s.zoneSpeed,zoneX:s.zoneX,zoneY:s.zoneY,zoneRadius:s.zoneRadius,nextZoneRadius:s.nextZoneRadius,zoneTimer:s.zoneTimer,zoneStage:s.zoneStage,planeX:s.planeX,planeY:s.planeY,planeEndX:s.planeEndX,planeEndY:s.planeEndY,planeProgress:s.planeProgress,aliveCount:s.aliveCount,winner:s.winner,players:values(s.players).map((p:any)=>p.toJSON?.()??({...p})),bullets:values(s.bullets).map((b:any)=>b.toJSON?.()??({...b})),loot:values(s.loot).map((l:any)=>l.toJSON?.()??({...l}))};}
  send(type:string,payload?:any){this.room?.send(type,payload);} get sessionId(){return this.room?.sessionId??'';}
}
