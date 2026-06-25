import Phaser from 'phaser';
import {
  BUILDINGS, BUILDING_VISIBILITY_ZONES, BUSHES, BUSH_HIDE_DISTANCE, COLLISION_OBSTACLES, DECORATIONS, LOOT_COLORS, LOOT_LABELS, MELEE_WEAPONS, OBSTACLES, PLAYER_RADIUS, PLAYER_SPEED,
  REGIONS, REGION_THEMES, WEAPONS, WORLD_SIZE, buildingSpacesVisible, buildingZoneById, circleHitsRect, clamp, distance, regionAt,
  type DecorKind, type EquippedId, type LootKind, type WeaponId, type MeleeId
} from '@drop8/shared';
import type { Network } from './network';
import { pushPositionSnapshot, samplePosition, zoneDirection, type PositionSnapshot, type VisibilityResult } from './interpolation';

type DisplayPoint={x:number;y:number};
type ChatPayload={playerId?:string;sender?:string;nickname?:string;text?:string;channel?:string;time?:number;sentAt?:number};
type PlayerOverlay={
  container:Phaser.GameObjects.Container;
  name:Phaser.GameObjects.Text;
  bubbleBg:Phaser.GameObjects.Graphics;
  bubbleText:Phaser.GameObjects.Text;
  bubbleExpiresAt:number;
};

export class GameScene extends Phaser.Scene {
  private staticG!:Phaser.GameObjects.Graphics;
  private dynamicG!:Phaser.GameObjects.Graphics;
  private slowG!:Phaser.GameObjects.Graphics;
  private hitG!:Phaser.GameObjects.Graphics;
  private foliageG!:Phaser.GameObjects.Graphics;
  private mini!:Phaser.GameObjects.Graphics;
  private indoorMaskG!:Phaser.GameObjects.Graphics;
  private buildingRoofs=new Map<string,Phaser.GameObjects.Graphics>();
  private pickupText!:Phaser.GameObjects.Text;
  private fpsText!:Phaser.GameObjects.Text;
  private perfText!:Phaser.GameObjects.Text;
  private regionText!:Phaser.GameObjects.Text;
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private seq=0;
  private lastInput=0;
  private lastFire=0;
  private lastMiniDraw=0;
  private lastSlowDraw=0;
  private lastFpsDraw=0;
  private mapOpen=false;
  private spectateIndex=0;
  private displayPlayers=new Map<string,DisplayPoint>();
  private remoteBuffers=new Map<string,PositionSnapshot[]>();
  private lastVisibility=new Map<string,boolean>();
  private revealStartedAt=new Map<string,number>();
  private framePositions=new Map<string,{x:number;y:number;angle:number}>();
  private perfVisible=false;
  private snapCorrections=0;
  private bufferMisses=0;
  private displayBullets=new Map<string,DisplayPoint>();
  private lastAttackSeq=new Map<string,number>();
  private attackStartedAt=new Map<string,number>();
  private lastHitSeq=new Map<string,number>();
  private hitStartedAt=new Map<string,number>();
  private predictedLocal:DisplayPoint|null=null;
  private localAimAngle=0;
  private localHitUntil=0;
  private localHitAngle=0;
  private viewerPoint:DisplayPoint|null=null;
  private viewerPlayer:any=null;
  private activeBuildingId='';
  private currentRegionId='';
  private chatBlocked=false;
  private playerOverlays=new Map<string,PlayerOverlay>();
  private chatMessageHandler=(type:string,payload:any)=>{if(type==='chat')this.receiveChat(payload as ChatPayload);};
  private chatStateHandler=(event:Event)=>{
    const open=Boolean((event as CustomEvent<{open?:boolean}>).detail?.open);
    this.chatBlocked=open;
    if(this.input.keyboard)this.input.keyboard.enabled=!open;
    if(open){
      for(const key of Object.values(this.keys??{}))key.reset();
      this.net.send('input',{x:0,y:0,angle:this.localAimAngle,seq:++this.seq});
    }
  };

  constructor(private net:Network){super('game');}

  create(){
    this.cameras.main.setBounds(0,0,WORLD_SIZE,WORLD_SIZE);
    this.cameras.main.setBackgroundColor('#153424');
    this.staticG=this.add.graphics().setDepth(0);
    this.slowG=this.add.graphics().setDepth(3);
    this.dynamicG=this.add.graphics().setDepth(5);
    this.foliageG=this.add.graphics().setDepth(8);
    this.hitG=this.add.graphics().setScrollFactor(0).setDepth(45);
    this.mini=this.add.graphics().setScrollFactor(0).setDepth(40);
    this.indoorMaskG=this.add.graphics().setScrollFactor(0).setDepth(12);
    this.pickupText=this.add.text(this.scale.width/2,this.scale.height-118,'',{fontFamily:'sans-serif',fontSize:'18px',fontStyle:'bold',color:'#ffffff',backgroundColor:'#071018dd',padding:{x:12,y:8}}).setOrigin(.5).setScrollFactor(0).setDepth(50).setVisible(false);
    this.fpsText=this.add.text(12,12,'',{fontFamily:'monospace',fontSize:'12px',color:'#9fb2bf',backgroundColor:'#071018aa',padding:{x:6,y:4}}).setScrollFactor(0).setDepth(50);
    this.perfText=this.add.text(12,78,'',{fontFamily:'monospace',fontSize:'12px',color:'#d9edf8',backgroundColor:'#061018e8',padding:{x:8,y:7}}).setScrollFactor(0).setDepth(52).setVisible(false);
    this.regionText=this.add.text(12,46,'',{fontFamily:'sans-serif',fontSize:'13px',fontStyle:'bold',color:'#f4f7ef',backgroundColor:'#071018cc',padding:{x:9,y:6}}).setScrollFactor(0).setDepth(50).setVisible(false);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,E,R,ONE,TWO,THREE,FOUR,M,F3,SPACE,ENTER,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    this.keys.LEFT.on('down',()=>{this.spectateIndex=Math.max(0,this.spectateIndex-1);});
    this.keys.RIGHT.on('down',()=>{this.spectateIndex++;});
    this.keys.E.on('down',()=>{if(!this.isTyping())this.net.send('pickup');});
    this.keys.R.on('down',()=>{if(!this.isTyping())this.net.send('reload');});
    this.keys.ONE.on('down',()=>{if(!this.isTyping())this.net.send('switch',{slot:1});});
    this.keys.TWO.on('down',()=>{if(!this.isTyping())this.net.send('switch',{slot:2});});
    this.keys.THREE.on('down',()=>{if(!this.isTyping())this.net.send('switch',{slot:3});});
    this.keys.FOUR.on('down',()=>{if(!this.isTyping())this.net.send('heal',{kind:'auto'});});
    this.keys.SPACE.on('down',()=>{if(!this.isTyping())this.net.send('jump');});
    this.keys.M.on('down',()=>{this.mapOpen=!this.mapOpen;this.lastMiniDraw=0;});
    this.keys.F3.on('down',()=>{if(this.isTyping())return;this.perfVisible=!this.perfVisible;this.perfText.setVisible(this.perfVisible);});
    this.scale.on('resize',(size:Phaser.Structs.Size)=>{
      this.pickupText.setPosition(size.width/2,size.height-118);
      this.lastMiniDraw=0;
    });
    this.net.messages.add(this.chatMessageHandler);
    window.addEventListener('drop8-chat-state',this.chatStateHandler as EventListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      this.net.messages.delete(this.chatMessageHandler);
      window.removeEventListener('drop8-chat-state',this.chatStateHandler as EventListener);
      for(const overlay of this.playerOverlays.values())overlay.container.destroy(true);
      this.playerOverlays.clear();
      this.remoteBuffers.clear();
      this.lastVisibility.clear();
      this.revealStartedAt.clear();
      for(const roof of this.buildingRoofs.values())roof.destroy();
      this.buildingRoofs.clear();
    });
    this.drawStaticMap();
    this.createBuildingRoofs();
    this.drawFoliage();
  }

  update(time:number){
    const s=this.net.snapshot;
    if(!s)return;
    const me=this.local();
    this.trackRemotePlayers(s);
    if(me){
      const typing=this.isTyping();
      const rawX=typing?0:(this.keys.D.isDown?1:0)-(this.keys.A.isDown?1:0);
      const rawY=typing?0:(this.keys.S.isDown?1:0)-(this.keys.W.isDown?1:0);
      const inputLength=Math.hypot(rawX,rawY)||1;
      const x=rawX/inputLength,y=rawY/inputLength;
      const pointer=this.input.activePointer;
      const aimBase=this.predictedLocal??{x:me.x,y:me.y};
      this.localAimAngle=Math.atan2(pointer.worldY-aimBase.y,pointer.worldX-aimBase.x);
      if(me.alive&&me.phase==='landed')this.updateLocalPrediction(me,x,y,this.game.loop.delta/1000);
      else this.predictedLocal={x:me.x,y:me.y};
      const alive=s.players.filter(p=>p.alive);
      const target=me.alive?me:(alive.length?alive[this.spectateIndex%alive.length]:me);
      const shown=target.id===me.id&&this.predictedLocal?this.predictedLocal:this.remotePosition(target,time);
      this.cameras.main.centerOn(shown.x,shown.y);
      this.viewerPoint={x:shown.x,y:shown.y};
      this.viewerPlayer=target;
      this.updateBuildingPresentation(target);
      this.updateRegionLabel(shown.x,shown.y);
      if(time-this.lastInput>=50){
        this.net.send('input',{x,y,angle:this.localAimAngle,seq:++this.seq});
        this.lastInput=time;
      }
      if(!typing&&pointer.isDown&&time-this.lastFire>=55){
        this.net.send(me.equipped==='fists'||me.equipped in MELEE_WEAPONS?'melee':'fire');
        this.lastFire=time;
      }
    }
    this.updateHitState(s,time);
    if(time-this.lastSlowDraw>=100){this.drawSlowLayers(s);this.lastSlowDraw=time;}
    this.drawDynamic(time);
    this.drawHitEffects(time);
    this.updatePickupPrompt();
    if(time-this.lastFpsDraw>=500){
      this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
      if(this.perfVisible)this.updatePerfText(s);
      this.lastFpsDraw=time;
    }
  }

  private local(){return this.net.snapshot?.players.find(p=>p.id===this.net.sessionId);}

  private isTyping(){
    const active=document.activeElement;
    return this.chatBlocked||active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement;
  }

  private drawStaticMap(){
    const g=this.staticG;
    g.clear();
    g.fillStyle(0x153424).fillRect(0,0,WORLD_SIZE,WORLD_SIZE);
    for(const r of REGIONS){
      const theme=REGION_THEMES[r.id];
      g.fillStyle(theme.ground,.7).fillRoundedRect(r.x,r.y,r.w,r.h,28);
      g.lineStyle(4,theme.groundAccent,.32).strokeRoundedRect(r.x,r.y,r.w,r.h,28);
      for(let stripe=0;stripe<5;stripe++){
        const sy=r.y+90+stripe*Math.max(90,(r.h-180)/5);
        g.lineStyle(2,theme.groundAccent,.08).lineBetween(r.x+30,sy,r.x+r.w-30,sy);
      }
      this.add.text(r.x+20,r.y+18,r.name,{fontFamily:'sans-serif',fontSize:'30px',fontStyle:'bold',color:'#ffffff88'}).setDepth(.5);
    }
    for(const b of BUILDINGS){
      const theme=REGION_THEMES[b.regionId];
      g.fillStyle(theme.groundAccent,.28).fillRect(b.x+18,b.y+18,Math.max(1,b.w-36),Math.max(1,b.h-36));
      g.lineStyle(2,theme.accent,.14).strokeRect(b.x+18,b.y+18,Math.max(1,b.w-36),Math.max(1,b.h-36));
      for(let lineY=b.y+42;lineY<b.y+b.h-24;lineY+=42)g.lineStyle(1,0xffffff,.045).lineBetween(b.x+24,lineY,b.x+b.w-24,lineY);
    }
    for(const decoration of DECORATIONS)this.drawDecoration(g,decoration.kind,decoration.x,decoration.y,decoration.w,decoration.h,decoration.rotation??0);
    for(const bush of BUSHES)this.drawBushBase(g,bush.x,bush.y,bush.radius,bush.density);
    for(const wall of OBSTACLES){
      const building=BUILDINGS.find((item)=>wall.x>=item.x-1&&wall.x<=item.x+item.w+1&&wall.y>=item.y-1&&wall.y<=item.y+item.h+1);
      const theme=building?REGION_THEMES[building.regionId]:REGION_THEMES.residential;
      g.fillStyle(theme.wall).fillRect(wall.x,wall.y,wall.w,wall.h);
      g.lineStyle(2,0x10181d,.82).strokeRect(wall.x,wall.y,wall.w,wall.h);
    }
  }

  private createBuildingRoofs(){
    for(const zone of BUILDING_VISIBILITY_ZONES){
      const building=BUILDINGS[zone.buildingIndex]!;
      const theme=REGION_THEMES[building.regionId];
      const roof=this.add.graphics().setDepth(10);
      roof.fillStyle(theme.roof,.97).fillRect(zone.roof.x,zone.roof.y,zone.roof.w,zone.roof.h);
      roof.lineStyle(3,theme.accent,.34).strokeRect(zone.roof.x,zone.roof.y,zone.roof.w,zone.roof.h);
      if(building.regionId==='hospital'){
        const cx=building.x+building.w/2,cy=building.y+building.h/2;
        roof.fillStyle(0xffffff,.82).fillRect(cx-22,cy-7,44,14).fillRect(cx-7,cy-22,14,44);
      }else if(building.regionId==='military'){
        roof.lineStyle(2,theme.accent,.28).strokeRect(building.x+30,building.y+30,Math.max(1,building.w-60),Math.max(1,building.h-60));
      }
      this.buildingRoofs.set(zone.id,roof);
    }
  }

  private updateBuildingPresentation(viewer:any){
    const buildingId=String(viewer?.buildingId??'');
    if(buildingId!==this.activeBuildingId){
      this.activeBuildingId=buildingId;
      for(const [id,roof] of this.buildingRoofs){
        this.tweens.killTweensOf(roof);
        this.tweens.add({targets:roof,alpha:id===buildingId?0:1,duration:150,ease:'Linear'});
      }
    }
    this.drawIndoorMask(buildingId);
  }

  private drawIndoorMask(buildingId:string){
    const g=this.indoorMaskG;g.clear();
    if(!buildingId)return;
    const zone=buildingZoneById(buildingId);if(!zone)return;
    const camera=this.cameras.main;
    const left=zone.interior.x-camera.scrollX,top=zone.interior.y-camera.scrollY;
    const right=left+zone.interior.w,bottom=top+zone.interior.h;
    const width=this.scale.width,height=this.scale.height;
    g.fillStyle(0x02070b,.88);
    g.fillRect(0,0,width,Math.max(0,top));
    g.fillRect(0,Math.max(0,bottom),width,Math.max(0,height-bottom));
    g.fillRect(0,Math.max(0,top),Math.max(0,left),Math.max(0,bottom-top));
    g.fillRect(Math.max(0,right),Math.max(0,top),Math.max(0,width-right),Math.max(0,bottom-top));
  }

  private viewerEntity(){return this.viewerPlayer??this.local();}

  private spaceVisible(entity:any){
    const viewer=this.viewerEntity();
    if(!viewer)return false;
    return buildingSpacesVisible(viewer,entity);
  }

  private drawDecoration(g:Phaser.GameObjects.Graphics,kind:DecorKind,x:number,y:number,w:number,h:number,rotation:number){
    const cx=x+w/2,cy=y+h/2;
    if(kind==='machine'||kind==='tank'){
      g.fillStyle(kind==='tank'?0x69777d:0x303a40,.92).fillRoundedRect(x,y,w,h,8);
      g.lineStyle(3,0xb7c2c7,.35).strokeRoundedRect(x,y,w,h,8);
      for(let i=1;i<4;i++)g.fillStyle(0xf1a64b,.8).fillCircle(x+w*i/4,y+h/2,4);
    }else if(kind==='container'){
      g.fillStyle(0x9a583f,.9).fillRoundedRect(x,y,w,h,5);
      for(let px=x+15;px<x+w;px+=24)g.lineStyle(2,0x4d2b24,.45).lineBetween(px,y+4,px,y+h-4);
    }else if(kind==='yard'){
      g.fillStyle(0x64804d,.55).fillRect(x,y,w,h);g.lineStyle(2,0xe5d0aa,.35).strokeRect(x,y,w,h);
    }else if(kind==='fence'){
      g.lineStyle(5,0xc2b08b,.7).lineBetween(x,y+h/2,x+w,y+h/2);
      for(let px=x;px<=x+w;px+=24)g.lineStyle(3,0xe0cfaa,.65).lineBetween(px,y,px,y+h);
    }else if(kind==='medicalCross'){
      g.fillStyle(0xffffff,.85).fillRoundedRect(x,y,w,h,8);g.fillStyle(0xff4f5e,.95).fillRect(cx-w*.32,cy-h*.1,w*.64,h*.2).fillRect(cx-w*.1,cy-h*.32,w*.2,h*.64);
    }else if(kind==='bed'){
      g.fillStyle(0xddeeed,.9).fillRoundedRect(x,y,w,h,6);g.fillStyle(0x68a7aa,.9).fillRect(x,y+h-7,w,7);g.fillStyle(0xffffff,.85).fillCircle(x+14,cy,9);
    }else if(kind==='ambulance'){
      g.fillStyle(0xe9f3f2,.92).fillRoundedRect(x,y,w,h,10);g.fillStyle(0xff5360,.9).fillRect(x+10,cy-4,w-20,8);g.fillStyle(0x25343a).fillCircle(x+24,y+h,10).fillCircle(x+w-24,y+h,10);
    }else if(kind==='crate'){
      g.fillStyle(0x8b603c,.9).fillRect(x,y,w,h);g.lineStyle(3,0xd0a16b,.5).strokeRect(x,y,w,h).lineBetween(x,y,x+w,y+h).lineBetween(x+w,y,x,y+h);
    }else if(kind==='forklift'){
      g.fillStyle(0xe8a638,.9).fillRoundedRect(x,y,w*.65,h,7);g.lineStyle(5,0x2e3438,1).lineBetween(x+w*.68,y,x+w*.68,y+h).lineBetween(x+w*.68,y+h,x+w,y+h);g.fillStyle(0x263139).fillCircle(x+20,y+h,10).fillCircle(x+w*.55,y+h,10);
    }else if(kind==='sandbag'){
      for(let px=x;px<x+w;px+=26)g.fillStyle(0xb1a074,.88).fillEllipse(px+13,cy,30,h*.78);
    }else if(kind==='helipad'){
      g.lineStyle(5,0xd7d17a,.62).strokeCircle(cx,cy,Math.min(w,h)/2);g.lineStyle(8,0xe9e39a,.7).lineBetween(cx-w*.18,cy-h*.28,cx-w*.18,cy+h*.28).lineBetween(cx+w*.18,cy-h*.28,cx+w*.18,cy+h*.28).lineBetween(cx-w*.18,cy,cx+w*.18,cy);
    }else if(kind==='tent'){
      g.fillStyle(0x87704a,.92).fillTriangle(x, y+h, cx, y, x+w, y+h);g.lineStyle(3,0xd6bf82,.6).lineBetween(cx,y,cx,y+h);
    }else if(kind==='campfire'){
      g.lineStyle(6,0x6e4930,.9).lineBetween(x+8,y+h-8,x+w-8,y+8).lineBetween(x+w-8,y+h-8,x+8,y+8);g.fillStyle(0xff8738,.85).fillTriangle(cx,y,cx-13,y+h-10,cx+13,y+h-10);g.fillStyle(0xffd052,.9).fillTriangle(cx,y+10,cx-7,y+h-10,cx+7,y+h-10);
    }else if(kind==='log'){
      const dx=Math.cos(rotation)*w/2,dy=Math.sin(rotation)*w/2;g.lineStyle(h,0x755033,.9).lineBetween(cx-dx,cy-dy,cx+dx,cy+dy);g.fillStyle(0xb48757).fillCircle(cx-dx,cy-dy,h/2).fillCircle(cx+dx,cy+dy,h/2);
    }else if(kind==='tree'){
      g.fillStyle(0x6f4b31,.95).fillCircle(cx,cy,9);g.fillStyle(0x2b673d,.92).fillCircle(cx-12,cy-8,w*.34).fillCircle(cx+12,cy-7,w*.34).fillCircle(cx,cy-18,w*.36);
    }
  }

  private drawBushBase(g:Phaser.GameObjects.Graphics,x:number,y:number,radius:number,density:number){
    g.fillStyle(0x1f542f,.6*density).fillCircle(x,y,radius*.8);
    for(let i=0;i<7;i++){
      const angle=i/7*Math.PI*2,r=radius*(.34+(i%3)*.1);
      g.fillStyle(i%2?0x377c45:0x2d6b3b,.72*density).fillCircle(x+Math.cos(angle)*r,y+Math.sin(angle)*r,radius*.37);
    }
  }

  private drawFoliage(){
    const g=this.foliageG;g.clear();
    for(const bush of BUSHES){
      for(let i=0;i<9;i++){
        const angle=(i*.78+bush.x*.001)%(Math.PI*2),r=bush.radius*(.18+(i%4)*.13);
        g.fillStyle(i%3===0?0x4b9655:0x367a44,.32+bush.density*.28).fillCircle(bush.x+Math.cos(angle)*r,bush.y+Math.sin(angle)*r,bush.radius*(.25+(i%2)*.07));
      }
      g.lineStyle(2,0x8fc36e,.12).strokeCircle(bush.x,bush.y,bush.radius*.9);
    }
  }

  private drawDynamic(time:number){
    const s=this.net.snapshot;
    if(!s)return;
    const g=this.dynamicG;
    g.clear();
    const view=this.cameras.main.worldView;
    const visible=(x:number,y:number,m=120)=>x>=view.x-m&&x<=view.right+m&&y>=view.y-m&&y<=view.bottom+m;

    const activeBulletIds=new Set<string>();
    for(const b of s.bullets){
      activeBulletIds.add(b.id);
      if(!this.spaceVisible(b)||!visible(b.x,b.y,40))continue;
      const d=this.getDisplayBullet(b.id,b.x,b.y);
      g.lineStyle(3,0xffef9a,.9).lineBetween(d.x-b.vx*.012,d.y-b.vy*.012,d.x,d.y);
      g.fillStyle(0xfff6bd).fillCircle(d.x,d.y,3);
    }
    for(const id of this.displayBullets.keys())if(!activeBulletIds.has(id))this.displayBullets.delete(id);

    if(['PLANE','DROP'].includes(s.phase)){
      g.lineStyle(4,0xffffff,.16).lineBetween(s.planeStartX,s.planeStartY,s.planeEndX,s.planeEndY);
      this.drawTransportPlane(g,s.planeX,s.planeY,s.planeAngle,1);
    }

    const visibleIds=new Set<string>();
    const existingIds=new Set<string>();
    this.framePositions.clear();
    for(const p of s.players){
      existingIds.add(p.id);
      if(!p.alive)continue;
      const local=p.id===this.net.sessionId;
      const pos=local&&this.predictedLocal?{...this.predictedLocal,angle:this.localAimAngle}:this.remotePosition(p,time);
      this.framePositions.set(p.id,pos);
      const visibility=this.getPlayerVisibility(p);
      const inView=visible(pos.x,pos.y,100);
      const previouslyVisible=this.lastVisibility.get(p.id)??visibility.visibleInWorld;
      if(visibility.visibleInWorld&&!previouslyVisible)this.revealStartedAt.set(p.id,time);
      this.lastVisibility.set(p.id,visibility.visibleInWorld);
      if(!visibility.visibleInWorld||!inView)continue;
      visibleIds.add(p.id);
      const fadeStart=this.revealStartedAt.get(p.id)??time-200;
      const alpha=local?1:clamp((time-fadeStart)/160,0,1);
      const shown=local?{...p,angle:this.localAimAngle}:p;
      this.drawPlayer(g,shown,pos.x,pos.y,time,alpha);
      this.updatePlayerOverlay(shown,pos.x,pos.y,time,true,alpha);
    }
    for(const [id,overlay] of this.playerOverlays){
      if(!existingIds.has(id)||!s.players.find(p=>p.id===id)?.alive){overlay.container.destroy(true);this.playerOverlays.delete(id);continue;}
      if(!visibleIds.has(id))overlay.container.setVisible(false);
    }
    for(const id of this.displayPlayers.keys())if(!existingIds.has(id))this.displayPlayers.delete(id);
    for(const id of this.remoteBuffers.keys())if(!existingIds.has(id)){this.remoteBuffers.delete(id);this.lastVisibility.delete(id);this.revealStartedAt.delete(id);}

    if(time-this.lastMiniDraw>=100){
      this.drawMini(s);
      this.lastMiniDraw=time;
    }
  }

  private getPlayerVisibility(player:any):VisibilityResult{
    if(player.id===this.net.sessionId)return{visibleInWorld:true,visibleOnMinimap:true,revealedByShot:false,revealedByHit:false};
    const viewer=this.viewerPoint??this.local();
    if(!viewer)return{visibleInWorld:false,visibleOnMinimap:false,revealedByShot:false,revealedByHit:false};
    const viewerEntity=this.viewerEntity()??viewer;
    const crossesBoundary=String(viewerEntity.buildingId??'')!==String(player.buildingId??'');
    const sameSpace=buildingSpacesVisible(viewerEntity,player)&&(!crossesBoundary||!this.segmentOccluded(viewerEntity.x,viewerEntity.y,player.x,player.y));
    const nearby=distance(viewer.x,viewer.y,player.x,player.y)<=BUSH_HIDE_DISTANCE;
    const concealed=Boolean(player.inBush&&!player.bushRevealed&&!nearby);
    const visible=sameSpace&&!concealed;
    return{visibleInWorld:visible,visibleOnMinimap:visible,revealedByShot:Boolean(player.bushRevealed),revealedByHit:Boolean(player.bushRevealed)};
  }

  private segmentOccluded(x1:number,y1:number,x2:number,y2:number){
    const steps=Math.max(1,Math.ceil(distance(x1,y1,x2,y2)/14));
    for(let index=1;index<steps;index++){
      const t=index/steps,x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;
      if(COLLISION_OBSTACLES.some((rect)=>x>=rect.x&&x<=rect.x+rect.w&&y>=rect.y&&y<=rect.y+rect.h))return true;
    }
    return false;
  }

  private trackRemotePlayers(s:any){
    const receivedAt=Number(s.receivedAt)||performance.now();
    for(const player of s.players){
      if(player.id===this.net.sessionId)continue;
      const buffer=this.remoteBuffers.get(player.id)??[];
      pushPositionSnapshot(buffer,{x:player.x,y:player.y,angle:player.angle,receivedAt});
      this.remoteBuffers.set(player.id,buffer);
    }
  }

  private remotePosition(player:any,_time:number){
    if(player.id===this.net.sessionId)return{x:player.x,y:player.y,angle:player.angle};
    const sampled=samplePosition(this.remoteBuffers.get(player.id)??[],performance.now()-100);
    if(!sampled){this.bufferMisses++;return{x:player.x,y:player.y,angle:player.angle};}
    if(Math.hypot(sampled.x-player.x,sampled.y-player.y)>260)this.snapCorrections++;
    return{x:sampled.x,y:sampled.y,angle:sampled.angle};
  }


  private receiveChat(payload:ChatPayload){
    if(!payload?.playerId||!payload.text||payload.channel==='system'||payload.channel==='lobby')return;
    const player=this.net.snapshot?.players.find((item)=>item.id===payload.playerId);
    if(!player)return;
    const overlay=this.getOrCreatePlayerOverlay(player);
    overlay.bubbleText.setText(String(payload.text).slice(0,80));
    const width=Math.min(196,Math.max(72,overlay.bubbleText.width+22));
    const height=Math.min(58,Math.max(34,overlay.bubbleText.height+16));
    overlay.bubbleBg.clear().fillStyle(0x071018,.94).fillRoundedRect(-width/2,-height/2,width,height,9);
    overlay.bubbleBg.lineStyle(2,player.id===this.net.sessionId?0x54dcff:0xffffff,.42).strokeRoundedRect(-width/2,-height/2,width,height,9);
    overlay.bubbleExpiresAt=this.time.now+4000;
  }

  private getOrCreatePlayerOverlay(player:any){
    const existing=this.playerOverlays.get(player.id);
    if(existing)return existing;
    const bubbleBg=this.add.graphics();
    const bubbleText=this.add.text(0,-82,'',{fontFamily:'sans-serif',fontSize:'13px',fontStyle:'bold',color:'#ffffff',align:'center',wordWrap:{width:174,useAdvancedWrap:true}}).setOrigin(.5);
    bubbleBg.setPosition(0,-82);
    const name=this.add.text(0,-50,'',{fontFamily:'sans-serif',fontSize:'13px',fontStyle:'bold',color:'#ffffff',stroke:'#071018',strokeThickness:4}).setOrigin(.5);
    const container=this.add.container(player.x,player.y,[bubbleBg,bubbleText,name]).setDepth(14);
    bubbleBg.setVisible(false);bubbleText.setVisible(false);
    const overlay={container,name,bubbleBg,bubbleText,bubbleExpiresAt:0};
    this.playerOverlays.set(player.id,overlay);
    return overlay;
  }

  private displayPlayerName(player:any){
    const raw=String(player.name??'').slice(0,16)||'이름 없음';
    const base=player.ai?(raw.startsWith('AI-')?raw.replace(/^AI-/,'AI · '):`AI · ${raw}`):raw;
    return player.id===this.net.sessionId?`${base} (나)`:base;
  }

  private updatePlayerOverlay(player:any,x:number,y:number,time:number,visible:boolean,alpha=1){
    const overlay=this.getOrCreatePlayerOverlay(player);
    overlay.container.setPosition(x,y).setVisible(visible).setAlpha(alpha);
    overlay.name.setText(this.displayPlayerName(player));
    const remaining=overlay.bubbleExpiresAt-time;
    const showBubble=visible&&remaining>0;
    overlay.bubbleBg.setVisible(showBubble);
    overlay.bubbleText.setVisible(showBubble);
    if(showBubble){
      const alpha=remaining<1000?clamp(remaining/1000,0,1):1;
      overlay.bubbleBg.setAlpha(alpha);
      overlay.bubbleText.setAlpha(alpha);
    }
  }

  private updateRegionLabel(x:number,y:number){
    const region=regionAt(x,y);
    const id=region?.id??'';
    if(id===this.currentRegionId)return;
    this.currentRegionId=id;
    if(!region){this.regionText.setVisible(false);return;}
    const theme=REGION_THEMES[region.id];
    this.regionText.setText(`${region.name} · ${theme.trait}`).setVisible(true);
  }

  private drawSlowLayers(s:any){
    const g=this.slowG;
    g.clear();
    const view=this.cameras.main.worldView;
    const visible=(x:number,y:number,m=120)=>x>=view.x-m&&x<=view.right+m&&y>=view.y-m&&y<=view.bottom+m;
    g.lineStyle(6,0x4db5ff,.72).strokeCircle(s.zoneX,s.zoneY,s.zoneRadius);
    g.lineStyle(3,0xffffff,.36).strokeCircle(s.nextZoneX,s.nextZoneY,s.nextZoneRadius);
    for(const l of s.loot){if(this.spaceVisible(l)&&visible(l.x,l.y,80))this.drawLootIcon(g,l.kind as LootKind,l.x,l.y,1);}
  }

  private updateLocalPrediction(me:any,x:number,y:number,dt:number){
    if(!this.predictedLocal)this.predictedLocal={x:me.x,y:me.y};
    const error=Math.hypot(this.predictedLocal.x-me.x,this.predictedLocal.y-me.y);
    if(error>130){this.predictedLocal.x=me.x;this.predictedLocal.y=me.y;}
    else if(error>16){this.predictedLocal.x=Phaser.Math.Linear(this.predictedLocal.x,me.x,.085);this.predictedLocal.y=Phaser.Math.Linear(this.predictedLocal.y,me.y,.085);}
    const ranged=WEAPONS[(me.equipped||'fists') as WeaponId];
    const melee=MELEE_WEAPONS[me.equipped as MeleeId];
    const multiplier=ranged?.moveMultiplier??melee?.moveMultiplier??1;
    const step=Math.min(.04,Math.max(0,dt))*PLAYER_SPEED*multiplier;
    this.movePredicted(x*step,y*step);
  }

  private movePredicted(dx:number,dy:number){
    if(!this.predictedLocal)return;
    const blocked=(x:number,y:number)=>COLLISION_OBSTACLES.some(r=>circleHitsRect(x,y,PLAYER_RADIUS,r));
    const me=this.local();
    if(blocked(this.predictedLocal.x,this.predictedLocal.y)&&me&&!blocked(me.x,me.y))this.predictedLocal={x:me.x,y:me.y};
    const total=Math.hypot(dx,dy),steps=Math.max(1,Math.ceil(total/6)),sx=dx/steps,sy=dy/steps;
    for(let i=0;i<steps;i++){
      const nx=clamp(this.predictedLocal.x+sx,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
      const ny=clamp(this.predictedLocal.y+sy,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
      if(!blocked(nx,ny)){this.predictedLocal.x=nx;this.predictedLocal.y=ny;continue;}
      if(!blocked(nx,this.predictedLocal.y)){this.predictedLocal.x=nx;continue;}
      if(!blocked(this.predictedLocal.x,ny)){this.predictedLocal.y=ny;continue;}
      break;
    }
  }

  private updateHitState(s:any,time:number){
    const active=new Set<string>();
    for(const p of s.players){
      active.add(p.id);
      const seq=Number(p.hitSeq??0),prev=this.lastHitSeq.get(p.id);
      if(prev===undefined)this.lastHitSeq.set(p.id,seq);
      else if(prev!==seq){
        this.lastHitSeq.set(p.id,seq);this.hitStartedAt.set(p.id,time);
        if(p.id===this.net.sessionId){this.localHitUntil=time+220;this.localHitAngle=Number(p.lastHitAngle??0);this.cameras.main.shake(95,Math.min(.012,.003+Number(p.lastHitDamage??0)/6000));}
      }
    }
    for(const id of this.lastHitSeq.keys())if(!active.has(id)){this.lastHitSeq.delete(id);this.hitStartedAt.delete(id);}
  }

  private drawHitEffects(time:number){
    const g=this.hitG;g.clear();
    if(time>=this.localHitUntil)return;
    const pulse=(this.localHitUntil-time)/220,w=this.scale.width,h=this.scale.height;
    g.fillStyle(0xff2538,.06+.11*pulse).fillRect(0,0,w,h);
    g.lineStyle(8,0xff3348,.2+.45*pulse).strokeRect(4,4,w-8,h-8);
    const cx=w/2,cy=h/2,r=72;
    const ax=cx+Math.cos(this.localHitAngle)*r,ay=cy+Math.sin(this.localHitAngle)*r;
    g.lineStyle(6,0xff5968,.85*pulse).lineBetween(cx,cy,ax,ay);
    g.fillStyle(0xff5968,.9*pulse).fillCircle(ax,ay,7);
  }

  private drawPlayer(g:Phaser.GameObjects.Graphics,p:any,x:number,y:number,time:number,alpha=1){
    const color=p.id===this.net.sessionId?0x45d7ff:p.ai?0xff8b5f:0xf06dba;
    const hitAt=this.hitStartedAt.get(p.id)??-999;
    const hitPulse=Math.max(0,1-(time-hitAt)/180);
    const bodyColor=hitPulse>0&&Math.floor((time-hitAt)/45)%2===0?0xffffff:color;
    const scale=p.phase==='falling'?1.7:p.phase==='parachute'?1.35:1;
    const altitudeOffset=20+Math.min(50,p.altitude/15);
    g.fillStyle(0x000000,.22*alpha).fillEllipse(x,y+altitudeOffset,40,18);
    const concealAlpha=p.inBush&&!p.bushRevealed&&p.id!==this.net.sessionId ? .72 : 1;
    g.fillStyle(bodyColor,concealAlpha*alpha).fillCircle(x,y,20*scale);
    if(p.inBush)g.lineStyle(3,p.bushRevealed?0xffd45a:0x7ddf7f,(p.id===this.net.sessionId ? .88 : .45)*alpha).strokeCircle(x,y,25*scale);
    if(hitPulse>0)g.lineStyle(4,0xff4c57,hitPulse*alpha).strokeCircle(x,y,27+8*(1-hitPulse));
    g.lineStyle(4,0xffffff,(p.id===this.net.sessionId?1:.38)*alpha).strokeCircle(x,y,20*scale);

    const attackSeq=Number(p.attackSeq??0);
    const previous=this.lastAttackSeq.get(p.id);
    if(previous===undefined)this.lastAttackSeq.set(p.id,attackSeq);
    else if(previous!==attackSeq){this.lastAttackSeq.set(p.id,attackSeq);this.attackStartedAt.set(p.id,time);}
    const started=this.attackStartedAt.get(p.id)??-999;
    const attackProgress=Math.max(0,Math.min(1,(time-started)/170));
    const attackPulse=attackProgress<1?Math.sin(attackProgress*Math.PI):0;
    const reloadProgress=clamp(Number(p.reloadProgress??0),0,1);
    const heldAngle=p.reloading?p.angle+Math.sin(reloadProgress*Math.PI)*.5:p.angle;
    this.drawHeldItem(g,p.equipped as EquippedId,x,y,heldAngle,attackPulse,attackSeq,alpha);
    if(p.reloading){
      g.lineStyle(4,0x24323b,.95*alpha).strokeCircle(x,y-52,12);
      g.lineStyle(4,0xffd34f,alpha).beginPath().arc(x,y-52,12,-Math.PI/2,-Math.PI/2+Math.PI*2*reloadProgress,false).strokePath();
      g.fillStyle(0xffd34f,.95*alpha).fillTriangle(x-4,y-55,x+5,y-55,x,y-47);
    }

    g.fillStyle(p.hp>40?0x55dd8c:0xff5f67,alpha).fillRect(x-25,y-37,50*Math.max(0,p.hp)/100,5);
  }

  private drawHeldItem(g:Phaser.GameObjects.Graphics,id:EquippedId,x:number,y:number,a:number,pulse:number,seq:number,alpha=1){
    const pt=(forward:number,side:number)=>({x:x+Math.cos(a)*forward-Math.sin(a)*side,y:y+Math.sin(a)*forward+Math.cos(a)*side});
    if(id==='fists'){
      const side=seq%2===0?1:-1;
      for(const hand of [-1,1]){
        const extend=hand===side?22*pulse:0;
        const elbow=pt(14+extend*.35,hand*12);
        const fist=pt(24+extend,hand*12);
        g.lineStyle(6,0xf0b28d,alpha).lineBetween(elbow.x,elbow.y,fist.x,fist.y);
        g.fillStyle(0xffc39d,alpha).fillCircle(fist.x,fist.y,6);
      }
      return;
    }

    if(id in MELEE_WEAPONS){
      const swing=a-.7+1.4*pulse;
      const hand=pt(15,0);
      const length=id==='knife'?34:id==='pan'?45:54;
      const end={x:hand.x+Math.cos(swing)*length,y:hand.y+Math.sin(swing)*length};
      g.lineStyle(id==='bat'?9:id==='pipe'?7:5,id==='bat'?0xc98b55:id==='pipe'?0x9eb1bb:0xd9e4ea,alpha).lineBetween(hand.x,hand.y,end.x,end.y);
      if(id==='pan')g.fillStyle(0x9aaab4,alpha).fillCircle(end.x,end.y,13);
      if(id==='knife')g.fillStyle(0xe9f1f5,alpha).fillTriangle(end.x,end.y,end.x-Math.cos(swing-.55)*15,end.y-Math.sin(swing-.55)*15,end.x-Math.cos(swing+.55)*15,end.y-Math.sin(swing+.55)*15);
      return;
    }

    const recoil=4*pulse;
    const hand=pt(15-recoil,0);
    if(id==='pistol'){
      const muzzle=pt(40-recoil,0),grip=pt(23-recoil,9);
      g.lineStyle(7,0x222a31,alpha).lineBetween(hand.x,hand.y,muzzle.x,muzzle.y);
      g.lineStyle(6,0x39454d,alpha).lineBetween(pt(23-recoil,1).x,pt(23-recoil,1).y,grip.x,grip.y);
      g.fillStyle(0xffd451,alpha).fillCircle(muzzle.x,muzzle.y,3);
    }else if(id==='smg'){
      const end=pt(46-recoil,0),stock=pt(7-recoil,0),mag=pt(29-recoil,11);
      g.lineStyle(10,0x303a42,alpha).lineBetween(stock.x,stock.y,end.x,end.y);
      g.lineStyle(7,0x1e252b,alpha).lineBetween(pt(28-recoil,2).x,pt(28-recoil,2).y,mag.x,mag.y);
      g.fillStyle(0xffb84d,alpha).fillCircle(end.x,end.y,3);
    }else if(id==='rifle'){
      const end=pt(58-recoil,0),stockTop=pt(4-recoil,-7),stockBottom=pt(4-recoil,7),stockBack=pt(-5-recoil,0),mag=pt(32-recoil,12);
      g.lineStyle(7,0x303940,alpha).lineBetween(hand.x,hand.y,end.x,end.y);
      g.lineStyle(5,0x4a3427,alpha).lineBetween(stockTop.x,stockTop.y,stockBack.x,stockBack.y).lineBetween(stockBack.x,stockBack.y,stockBottom.x,stockBottom.y);
      g.lineStyle(6,0x1c2429,alpha).lineBetween(pt(31-recoil,2).x,pt(31-recoil,2).y,mag.x,mag.y);
      g.fillStyle(0xff8f4d,alpha).fillCircle(end.x,end.y,3);
    }else if(id==='shotgun'){
      const endA=pt(58-recoil,-3),endB=pt(58-recoil,3),pump=pt(36-recoil,0);
      g.lineStyle(5,0x30383e,alpha).lineBetween(hand.x,hand.y,endA.x,endA.y).lineBetween(hand.x,hand.y,endB.x,endB.y);
      g.fillStyle(0x8b5b38,alpha).fillCircle(pump.x,pump.y,6);
      g.fillStyle(0xff6b55,alpha).fillCircle(endA.x,endA.y,3).fillCircle(endB.x,endB.y,3);
    }
  }

  private drawLootIcon(g:Phaser.GameObjects.Graphics,kind:LootKind,x:number,y:number,scale:number){
    const c=LOOT_COLORS[kind]??0xffffff;
    g.fillStyle(0x061018,.72).fillCircle(x,y,16*scale);
    g.lineStyle(2,c,1);
    const line=(x1:number,y1:number,x2:number,y2:number,w=3)=>{g.lineStyle(w,c,1).lineBetween(x+x1*scale,y+y1*scale,x+x2*scale,y+y2*scale);};
    if(kind==='pistol'){line(-8,-2,8,-2,4);line(1,0,1,8,4);g.fillStyle(c).fillCircle(x+9*scale,y-2*scale,2.5*scale);}
    else if(kind==='smg'){line(-10,0,10,0,6);line(1,2,1,10,4);line(-10,0,-14,5,3);g.fillStyle(c).fillCircle(x+11*scale,y,2.5*scale);}
    else if(kind==='rifle'){line(-13,0,13,0,4);line(-13,0,-18,-6,3);line(2,1,2,10,4);g.fillStyle(c).fillCircle(x+14*scale,y,2.5*scale);}
    else if(kind==='shotgun'){line(-14,-3,14,-3,3);line(-14,3,14,3,3);g.fillStyle(c).fillCircle(x+15*scale,y-3*scale,2).fillCircle(x+15*scale,y+3*scale,2);}
    else if(kind==='small_ammo'||kind==='rifle_ammo'||kind==='shells'){for(const dx of [-6,0,6]){line(dx,-7,dx,6,3);g.fillStyle(c).fillCircle(x+dx*scale,y-7*scale,2*scale);}}
    else if(kind==='vest'){g.fillStyle(c).fillTriangle(x-10*scale,y-9*scale,x+10*scale,y-9*scale,x,y+12*scale);g.fillStyle(0x061018).fillCircle(x,y-2*scale,4*scale);}
    else if(kind==='bandage'){g.fillStyle(c).fillRoundedRect(x-11*scale,y-5*scale,22*scale,10*scale,4*scale);g.fillStyle(0xffffff).fillCircle(x,y,3*scale);}
    else if(kind==='medkit'){g.fillStyle(c).fillRoundedRect(x-11*scale,y-11*scale,22*scale,22*scale,4*scale);g.lineStyle(4,0xffffff,1).lineBetween(x-6*scale,y,x+6*scale,y).lineBetween(x,y-6*scale,x,y+6*scale);}
    else if(kind==='bat'){line(-11,8,11,-9,7);}
    else if(kind==='pipe'){line(-11,8,11,-9,5);g.fillStyle(c).fillCircle(x+11*scale,y-9*scale,3*scale);}
    else if(kind==='knife'){line(-10,8,2,-3,4);g.fillStyle(c).fillTriangle(x+2*scale,y-3*scale,x+13*scale,y-10*scale,x+7*scale,y+2*scale);}
    else if(kind==='pan'){line(-11,10,3,-4,4);g.fillStyle(c).fillCircle(x+8*scale,y-9*scale,8*scale);}
  }

  private updatePickupPrompt(){
    const s=this.net.snapshot,me=this.local();
    if(!s||!me||!me.alive||me.phase!=='landed'){this.pickupText.setVisible(false);return;}
    let nearest:any;let best=105*105;
    for(const l of s.loot){if(!buildingSpacesVisible(me,l))continue;const dx=l.x-me.x,dy=l.y-me.y,d=dx*dx+dy*dy;if(d<best){best=d;nearest=l;}}
    if(!nearest){this.pickupText.setVisible(false);return;}
    const kind=nearest.kind as LootKind;
    const label=LOOT_LABELS[kind]??kind;
    const lines=[`E  획득 · ${label}`,...this.itemComparison(me,kind)];
    this.pickupText.setText(lines.join('\n')).setVisible(true);
  }

  private itemComparison(me:any,kind:LootKind){
    if(kind in WEAPONS&&kind!=='fists'){
      const incoming=WEAPONS[kind as WeaponId]!;
      const currentId=incoming.slot==='primary'?me.primary:me.secondary;
      if(!currentId)return['추천 · 빈 슬롯'];
      if(currentId===kind)return['보유 중'];
      const current=WEAPONS[currentId as WeaponId];
      if(!current)return['추천'];
      const arrows=(a:number,b:number,reverse=false)=>{
        const better=reverse?a<b:a>b;const equal=Math.abs(a-b)<.001;return equal?'＝':better?'↑':'↓';
      };
      const power=`화력 ${arrows(incoming.damage*incoming.pellets,current.damage*current.pellets)}`;
      const range=`사거리 ${arrows(incoming.range,current.range)}`;
      const fire=`연사력 ${arrows(incoming.fireInterval,current.fireInterval,true)}`;
      const score=incoming.damage*incoming.pellets+incoming.range*.025+1/incoming.fireInterval*3;
      const oldScore=current.damage*current.pellets+current.range*.025+1/current.fireInterval*3;
      return[`${score>oldScore*1.08?'추천 · ':''}현재: ${current.name}`,`${power}  ${range}  ${fire}`];
    }
    if(kind in MELEE_WEAPONS){
      const current=me.melee&&me.melee!=='fists'?MELEE_WEAPONS[me.melee as MeleeId]:undefined;
      if(!current)return['추천 · 현재: 주먹'];
      if(me.melee===kind)return['보유 중'];
      const incoming=MELEE_WEAPONS[kind as MeleeId]!;
      return[`현재: ${current.name}`,`화력 ${incoming.damage>current.damage?'↑':'↓'}  사거리 ${incoming.range>current.range?'↑':'↓'}  속도 ${incoming.fireInterval<current.fireInterval?'↑':'↓'}`];
    }
    if(kind==='vest')return[me.armor>0?`현재 조끼 ${Math.ceil(me.armor)}%`:'추천 · 조끼 없음'];
    if(kind==='bandage')return[`현재 보유 ${me.bandages??0}개`];
    if(kind==='medkit')return[`현재 보유 ${me.medkits??0}개`];
    if(kind==='small_ammo')return[`소형탄 보유 ${me.smallAmmo??0}발`];
    if(kind==='rifle_ammo')return[`소총탄 보유 ${me.rifleAmmo??0}발`];
    if(kind==='shells')return[`산탄 보유 ${me.shells??0}발`];
    return[];
  }

  private drawTransportPlane(g:Phaser.GameObjects.Graphics,x:number,y:number,angle:number,scale:number){
    const point=(forward:number,side:number,offsetX=0,offsetY=0)=>({x:x+offsetX+Math.cos(angle)*forward*scale-Math.sin(angle)*side*scale,y:y+offsetY+Math.sin(angle)*forward*scale+Math.cos(angle)*side*scale});
    const polygon=(points:Array<[number,number]>,color:number,alpha=1,ox=0,oy=0)=>g.fillStyle(color,alpha).fillPoints(points.map(([f,s])=>{const p=point(f,s,ox,oy);return new Phaser.Math.Vector2(p.x,p.y);}),true);
    polygon([[128,0],[72,-24],[20,-30],[-48,-28],[-118,-12],[-132,0],[-118,12],[-48,28],[20,30],[72,24]],0x000000,.24,12,14);
    polygon([[132,0],[76,-18],[30,-22],[-82,-19],[-126,-8],[-138,0],[-126,8],[-82,19],[30,22],[76,18]],0xc6d0d5,1);
    polygon([[38,-18],[-22,-92],[-62,-92],[-40,-17],[-40,17],[-62,92],[-22,92],[38,18]],0xaebac1,1);
    polygon([[-76,-17],[-112,-50],[-132,-48],[-119,-10],[-119,10],[-132,48],[-112,50],[-76,17]],0x8f9da5,1);
    const nose=point(118,0);g.fillStyle(0xe5edf0).fillCircle(nose.x,nose.y,16*scale);
    for(const side of [-52,52]){const engine=point(2,side);g.fillStyle(0x4a5962).fillEllipse(engine.x,engine.y,34*scale,17*scale);}
    const left=point(-24,-88),right=point(-24,88);g.fillStyle(0xff4d55,.72+.28*Math.sin(this.time.now*.012)).fillCircle(left.x,left.y,5*scale);g.fillStyle(0x5bff91,.72+.28*Math.sin(this.time.now*.012+Math.PI)).fillCircle(right.x,right.y,5*scale);
  }

  private updatePerfText(s:any){
    const players=s.players.length,ai=s.players.filter((p:any)=>p.ai).length;
    this.perfText.setText([
      `F3 성능  FPS ${Math.round(this.game.loop.actualFps)}  RTT ${Math.round(this.net.rtt)}ms`,
      `패치 ${this.net.patchInterval.toFixed(1)}ms  수신 ${(this.net.incomingBytesPerSecond/1024).toFixed(1)}KB/s`,
      `서버 tick 평균 ${Number(s.serverTickAvg||0).toFixed(1)}  p95 ${Number(s.serverTickP95||0).toFixed(1)}  max ${Number(s.serverTickMax||0).toFixed(1)}ms`,
      `AI ${Number(s.serverAiMs||0).toFixed(1)}  충돌 ${Number(s.serverCollisionMs||0).toFixed(1)}  자기장 ${Number(s.serverZoneMs||0).toFixed(1)}ms`,
      `플레이어 ${players} / AI ${ai} / 총알 ${s.bullets.length} / 아이템 ${s.loot.length}`,
      `보간 버퍼 ${this.remoteBuffers.size} / 스냅 ${this.snapCorrections} / 누락 ${this.bufferMisses}`,
    ].join('\n'));
  }

  private getDisplayPlayer(id:string,x:number,y:number,alpha:number){
    const current=this.displayPlayers.get(id)??{x,y};
    current.x=Phaser.Math.Linear(current.x,x,alpha);
    current.y=Phaser.Math.Linear(current.y,y,alpha);
    this.displayPlayers.set(id,current);
    return current;
  }

  private getDisplayBullet(id:string,x:number,y:number){
    const current=this.displayBullets.get(id)??{x,y};
    current.x=Phaser.Math.Linear(current.x,x,.55);
    current.y=Phaser.Math.Linear(current.y,y,.55);
    this.displayBullets.set(id,current);
    return current;
  }

  private drawMini(s:any){
    const g=this.mini;
    g.clear();
    const w=this.mapOpen?420:160,h=this.mapOpen?420:160,x=this.scale.width-w-14,y=this.mapOpen?70:82,sc=w/WORLD_SIZE;
    g.fillStyle(0x061018,.92).fillRoundedRect(x,y,w,h,12);
    g.lineStyle(2,0xffffff,.18).strokeRoundedRect(x,y,w,h,12);
    for(const r of REGIONS)g.fillStyle(REGION_THEMES[r.id].ground,.62).fillRect(x+r.x*sc,y+r.y*sc,r.w*sc,r.h*sc);
    for(const b of BUILDINGS)g.fillStyle(REGION_THEMES[b.regionId].roof,.68).fillRect(x+b.x*sc,y+b.y*sc,Math.max(1,b.w*sc),Math.max(1,b.h*sc));
    for(const bush of BUSHES)g.fillStyle(0x3f8c4c,.42).fillCircle(x+bush.x*sc,y+bush.y*sc,Math.max(1.5,bush.radius*sc));
    g.lineStyle(2,0x4db5ff,.95).strokeCircle(x+s.zoneX*sc,y+s.zoneY*sc,s.zoneRadius*sc);
    g.lineStyle(2,0xffffff,.72).strokeCircle(x+s.nextZoneX*sc,y+s.nextZoneY*sc,s.nextZoneRadius*sc);
    if(['PLANE','DROP'].includes(s.phase)){
      g.lineStyle(2,0xffffff,.35).lineBetween(x+s.planeStartX*sc,y+s.planeStartY*sc,x+s.planeEndX*sc,y+s.planeEndY*sc);
      const px=x+s.planeX*sc,py=y+s.planeY*sc,a=s.planeAngle;
      const tip={x:px+Math.cos(a)*8,y:py+Math.sin(a)*8};
      const left={x:px+Math.cos(a+2.45)*6,y:py+Math.sin(a+2.45)*6};
      const right={x:px+Math.cos(a-2.45)*6,y:py+Math.sin(a-2.45)*6};
      g.fillStyle(0xe6edf0).fillTriangle(tip.x,tip.y,left.x,left.y,right.x,right.y);
    }
    for(const p of s.players){
      if(!p.alive)continue;
      const visibility=this.getPlayerVisibility(p);
      if(p.id!==this.net.sessionId&&!visibility.visibleOnMinimap)continue;
      const position=this.framePositions.get(p.id)??{x:p.x,y:p.y};
      const color=p.id===this.net.sessionId?0x54dcff:p.bushRevealed?0xff424f:0xff686e;
      g.fillStyle(color).fillCircle(x+position.x*sc,y+position.y*sc,p.id===this.net.sessionId?5:3);
    }
    const direction=zoneDirection(s.nextZoneX-s.zoneX,s.nextZoneY-s.zoneY);
    g.fillStyle(0x061018,.82).fillRoundedRect(x,y+h+6,w,22,7);
    this.addOrUpdateMiniLabel(x+w/2,y+h+17,`다음 원 ${direction} · ${Math.max(0,Math.ceil(s.zoneTimer))}초`);
  }

  private miniLabel?:Phaser.GameObjects.Text;
  private addOrUpdateMiniLabel(x:number,y:number,text:string){
    if(!this.miniLabel)this.miniLabel=this.add.text(x,y,text,{fontFamily:'sans-serif',fontSize:'11px',fontStyle:'bold',color:'#e7f2f7'}).setOrigin(.5).setScrollFactor(0).setDepth(41);
    this.miniLabel.setPosition(x,y).setText(text).setVisible(true);
  }

}
