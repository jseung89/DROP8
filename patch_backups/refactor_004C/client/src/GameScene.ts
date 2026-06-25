import Phaser from 'phaser';
import {
  BUILDINGS, BUSHES, BUSH_HIDE_DISTANCE, DECORATIONS, LOOT_COLORS, LOOT_LABELS, MELEE_WEAPONS, OBSTACLES, PLAYER_RADIUS, PLAYER_SPEED,
  REGIONS, REGION_THEMES, WEAPONS, WORLD_SIZE, circleHitsRect, clamp, distance, regionAt,
  type DecorKind, type EquippedId, type LootKind, type WeaponId, type MeleeId
} from '@drop8/shared';
import type { Network } from './network';

type DisplayPoint={x:number;y:number};

export class GameScene extends Phaser.Scene {
  private staticG!:Phaser.GameObjects.Graphics;
  private dynamicG!:Phaser.GameObjects.Graphics;
  private slowG!:Phaser.GameObjects.Graphics;
  private hitG!:Phaser.GameObjects.Graphics;
  private foliageG!:Phaser.GameObjects.Graphics;
  private mini!:Phaser.GameObjects.Graphics;
  private pickupText!:Phaser.GameObjects.Text;
  private fpsText!:Phaser.GameObjects.Text;
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
  private currentRegionId='';

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
    this.pickupText=this.add.text(this.scale.width/2,this.scale.height-118,'',{fontFamily:'sans-serif',fontSize:'18px',fontStyle:'bold',color:'#ffffff',backgroundColor:'#071018dd',padding:{x:12,y:8}}).setOrigin(.5).setScrollFactor(0).setDepth(50).setVisible(false);
    this.fpsText=this.add.text(12,12,'',{fontFamily:'monospace',fontSize:'12px',color:'#9fb2bf',backgroundColor:'#071018aa',padding:{x:6,y:4}}).setScrollFactor(0).setDepth(50);
    this.regionText=this.add.text(12,46,'',{fontFamily:'sans-serif',fontSize:'13px',fontStyle:'bold',color:'#f4f7ef',backgroundColor:'#071018cc',padding:{x:9,y:6}}).setScrollFactor(0).setDepth(50).setVisible(false);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,E,R,ONE,TWO,THREE,FOUR,M,SPACE,ENTER,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    this.keys.LEFT.on('down',()=>{this.spectateIndex=Math.max(0,this.spectateIndex-1);});
    this.keys.RIGHT.on('down',()=>{this.spectateIndex++;});
    this.keys.E.on('down',()=>this.net.send('pickup'));
    this.keys.R.on('down',()=>this.net.send('reload'));
    this.keys.ONE.on('down',()=>this.net.send('switch',{slot:1}));
    this.keys.TWO.on('down',()=>this.net.send('switch',{slot:2}));
    this.keys.THREE.on('down',()=>this.net.send('switch',{slot:3}));
    this.keys.FOUR.on('down',()=>this.net.send('heal',{kind:'auto'}));
    this.keys.SPACE.on('down',()=>this.net.send('jump'));
    this.keys.M.on('down',()=>{this.mapOpen=!this.mapOpen;this.lastMiniDraw=0;});
    this.scale.on('resize',(size:Phaser.Structs.Size)=>{
      this.pickupText.setPosition(size.width/2,size.height-118);
      this.lastMiniDraw=0;
    });
    this.drawStaticMap();
    this.drawFoliage();
  }

  update(time:number){
    const s=this.net.snapshot;
    if(!s)return;
    const me=this.local();
    if(me){
      const rawX=(this.keys.D.isDown?1:0)-(this.keys.A.isDown?1:0);
      const rawY=(this.keys.S.isDown?1:0)-(this.keys.W.isDown?1:0);
      const inputLength=Math.hypot(rawX,rawY)||1;
      const x=rawX/inputLength,y=rawY/inputLength;
      const pointer=this.input.activePointer;
      const aimBase=this.predictedLocal??{x:me.x,y:me.y};
      this.localAimAngle=Math.atan2(pointer.worldY-aimBase.y,pointer.worldX-aimBase.x);
      if(me.alive&&me.phase==='landed')this.updateLocalPrediction(me,x,y,this.game.loop.delta/1000);
      else this.predictedLocal={x:me.x,y:me.y};
      const alive=s.players.filter(p=>p.alive);
      const target=me.alive?me:(alive.length?alive[this.spectateIndex%alive.length]:me);
      const shown=target.id===me.id&&this.predictedLocal?this.predictedLocal:this.getDisplayPlayer(target.id,target.x,target.y,.2);
      this.cameras.main.centerOn(shown.x,shown.y);
      this.viewerPoint={x:shown.x,y:shown.y};
      this.updateRegionLabel(shown.x,shown.y);
      if(time-this.lastInput>=50){
        this.net.send('input',{x,y,angle:this.localAimAngle,seq:++this.seq});
        this.lastInput=time;
      }
      if(pointer.isDown&&time-this.lastFire>=55){
        this.net.send(me.equipped==='fists'||me.equipped in MELEE_WEAPONS?'melee':'fire');
        this.lastFire=time;
      }
    }
    this.updateHitState(s,time);
    if(time-this.lastSlowDraw>=100){this.drawSlowLayers(s);this.lastSlowDraw=time;}
    this.drawDynamic(time);
    this.drawHitEffects(time);
    this.updatePickupPrompt();
    if(time-this.lastFpsDraw>=500){this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);this.lastFpsDraw=time;}
  }

  private local(){return this.net.snapshot?.players.find(p=>p.id===this.net.sessionId);}

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
      g.fillStyle(theme.roof,.94).fillRect(b.x+18,b.y+18,Math.max(1,b.w-36),Math.max(1,b.h-36));
      g.lineStyle(3,theme.accent,.24).strokeRect(b.x+18,b.y+18,Math.max(1,b.w-36),Math.max(1,b.h-36));
      if(b.regionId==='hospital'){
        const cx=b.x+b.w/2,cy=b.y+b.h/2;
        g.fillStyle(0xffffff,.78).fillRect(cx-22,cy-7,44,14).fillRect(cx-7,cy-22,14,44);
      }else if(b.regionId==='military'){
        g.lineStyle(2,theme.accent,.22).strokeRect(b.x+30,b.y+30,Math.max(1,b.w-60),Math.max(1,b.h-60));
      }else if(b.regionId==='warehouse'||b.regionId==='factory'){
        for(let x=b.x+35;x<b.x+b.w-25;x+=46)g.lineStyle(2,theme.groundAccent,.15).lineBetween(x,b.y+22,x,b.y+b.h-22);
      }
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
      if(!visible(b.x,b.y,40))continue;
      const d=this.getDisplayBullet(b.id,b.x,b.y);
      g.lineStyle(3,0xffef9a,.9).lineBetween(d.x-b.vx*.012,d.y-b.vy*.012,d.x,d.y);
      g.fillStyle(0xfff6bd).fillCircle(d.x,d.y,3);
    }
    for(const id of this.displayBullets.keys())if(!activeBulletIds.has(id))this.displayBullets.delete(id);

    if(['PLANE','DROP'].includes(s.phase)){
      g.lineStyle(4,0xffffff,.2).lineBetween(0,s.planeY,s.planeEndX,s.planeEndY);
      g.fillStyle(0xf1f3f4).fillTriangle(s.planeX+30,s.planeY,s.planeX-25,s.planeY-18,s.planeX-25,s.planeY+18);
    }

    const activeIds=new Set<string>();
    for(const p of s.players){
      if(!p.alive||!visible(p.x,p.y,100)||!this.canSeePlayer(p))continue;
      activeIds.add(p.id);
      const local=p.id===this.net.sessionId;
      const pos=local&&this.predictedLocal?this.predictedLocal:this.getDisplayPlayer(p.id,p.x,p.y,.24);
      const shown=local?{...p,angle:this.localAimAngle}:p;
      this.drawPlayer(g,shown,pos.x,pos.y,time);
    }
    for(const id of this.displayPlayers.keys())if(!activeIds.has(id)&&!s.players.some(p=>p.id===id))this.displayPlayers.delete(id);

    if(time-this.lastMiniDraw>=100){
      this.drawMini(s);
      this.lastMiniDraw=time;
    }
  }

  private canSeePlayer(player:any){
    if(player.id===this.net.sessionId||!player.inBush||player.bushRevealed)return true;
    const viewer=this.viewerPoint??this.local();
    if(!viewer)return false;
    return distance(viewer.x,viewer.y,player.x,player.y)<=BUSH_HIDE_DISTANCE;
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
    g.lineStyle(3,0xffffff,.2).strokeCircle(s.zoneX,s.zoneY,s.nextZoneRadius);
    for(const l of s.loot){if(visible(l.x,l.y,80))this.drawLootIcon(g,l.kind as LootKind,l.x,l.y,1);}
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
    const nx=clamp(this.predictedLocal.x+dx,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
    const ny=clamp(this.predictedLocal.y+dy,PLAYER_RADIUS,WORLD_SIZE-PLAYER_RADIUS);
    if(!OBSTACLES.some(r=>circleHitsRect(nx,this.predictedLocal!.y,PLAYER_RADIUS,r)))this.predictedLocal.x=nx;
    if(!OBSTACLES.some(r=>circleHitsRect(this.predictedLocal!.x,ny,PLAYER_RADIUS,r)))this.predictedLocal.y=ny;
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

  private drawPlayer(g:Phaser.GameObjects.Graphics,p:any,x:number,y:number,time:number){
    const color=p.id===this.net.sessionId?0x45d7ff:p.ai?0xff8b5f:0xf06dba;
    const hitAt=this.hitStartedAt.get(p.id)??-999;
    const hitPulse=Math.max(0,1-(time-hitAt)/180);
    const bodyColor=hitPulse>0&&Math.floor((time-hitAt)/45)%2===0?0xffffff:color;
    const scale=p.phase==='falling'?1.7:p.phase==='parachute'?1.35:1;
    const altitudeOffset=20+Math.min(50,p.altitude/15);
    g.fillStyle(0x000000,.22).fillEllipse(x,y+altitudeOffset,40,18);
    const concealAlpha=p.inBush&&!p.bushRevealed&&p.id!==this.net.sessionId ? .72 : 1;
    g.fillStyle(bodyColor,concealAlpha).fillCircle(x,y,20*scale);
    if(p.inBush)g.lineStyle(3,p.bushRevealed?0xffd45a:0x7ddf7f,p.id===this.net.sessionId ? .88 : .45).strokeCircle(x,y,25*scale);
    if(hitPulse>0)g.lineStyle(4,0xff4c57,hitPulse).strokeCircle(x,y,27+8*(1-hitPulse));
    g.lineStyle(4,0xffffff,p.id===this.net.sessionId?1:.38).strokeCircle(x,y,20*scale);

    const attackSeq=Number(p.attackSeq??0);
    const previous=this.lastAttackSeq.get(p.id);
    if(previous===undefined)this.lastAttackSeq.set(p.id,attackSeq);
    else if(previous!==attackSeq){this.lastAttackSeq.set(p.id,attackSeq);this.attackStartedAt.set(p.id,time);}
    const started=this.attackStartedAt.get(p.id)??-999;
    const attackProgress=Math.max(0,Math.min(1,(time-started)/170));
    const attackPulse=attackProgress<1?Math.sin(attackProgress*Math.PI):0;
    this.drawHeldItem(g,p.equipped as EquippedId,x,y,p.angle,attackPulse,attackSeq);

    g.fillStyle(p.hp>40?0x55dd8c:0xff5f67).fillRect(x-25,y-37,50*Math.max(0,p.hp)/100,5);
  }

  private drawHeldItem(g:Phaser.GameObjects.Graphics,id:EquippedId,x:number,y:number,a:number,pulse:number,seq:number){
    const pt=(forward:number,side:number)=>({x:x+Math.cos(a)*forward-Math.sin(a)*side,y:y+Math.sin(a)*forward+Math.cos(a)*side});
    if(id==='fists'){
      const side=seq%2===0?1:-1;
      for(const hand of [-1,1]){
        const extend=hand===side?22*pulse:0;
        const elbow=pt(14+extend*.35,hand*12);
        const fist=pt(24+extend,hand*12);
        g.lineStyle(6,0xf0b28d,1).lineBetween(elbow.x,elbow.y,fist.x,fist.y);
        g.fillStyle(0xffc39d).fillCircle(fist.x,fist.y,6);
      }
      return;
    }

    if(id in MELEE_WEAPONS){
      const swing=a-.7+1.4*pulse;
      const hand=pt(15,0);
      const length=id==='knife'?34:id==='pan'?45:54;
      const end={x:hand.x+Math.cos(swing)*length,y:hand.y+Math.sin(swing)*length};
      g.lineStyle(id==='bat'?9:id==='pipe'?7:5,id==='bat'?0xc98b55:id==='pipe'?0x9eb1bb:0xd9e4ea,1).lineBetween(hand.x,hand.y,end.x,end.y);
      if(id==='pan')g.fillStyle(0x9aaab4).fillCircle(end.x,end.y,13);
      if(id==='knife')g.fillStyle(0xe9f1f5).fillTriangle(end.x,end.y,end.x-Math.cos(swing-.55)*15,end.y-Math.sin(swing-.55)*15,end.x-Math.cos(swing+.55)*15,end.y-Math.sin(swing+.55)*15);
      return;
    }

    const recoil=4*pulse;
    const hand=pt(15-recoil,0);
    if(id==='pistol'){
      const muzzle=pt(40-recoil,0),grip=pt(23-recoil,9);
      g.lineStyle(7,0x222a31,1).lineBetween(hand.x,hand.y,muzzle.x,muzzle.y);
      g.lineStyle(6,0x39454d,1).lineBetween(pt(23-recoil,1).x,pt(23-recoil,1).y,grip.x,grip.y);
      g.fillStyle(0xffd451).fillCircle(muzzle.x,muzzle.y,3);
    }else if(id==='smg'){
      const end=pt(46-recoil,0),stock=pt(7-recoil,0),mag=pt(29-recoil,11);
      g.lineStyle(10,0x303a42,1).lineBetween(stock.x,stock.y,end.x,end.y);
      g.lineStyle(7,0x1e252b,1).lineBetween(pt(28-recoil,2).x,pt(28-recoil,2).y,mag.x,mag.y);
      g.fillStyle(0xffb84d).fillCircle(end.x,end.y,3);
    }else if(id==='rifle'){
      const end=pt(58-recoil,0),stockTop=pt(4-recoil,-7),stockBottom=pt(4-recoil,7),stockBack=pt(-5-recoil,0),mag=pt(32-recoil,12);
      g.lineStyle(7,0x303940,1).lineBetween(hand.x,hand.y,end.x,end.y);
      g.lineStyle(5,0x4a3427,1).lineBetween(stockTop.x,stockTop.y,stockBack.x,stockBack.y).lineBetween(stockBack.x,stockBack.y,stockBottom.x,stockBottom.y);
      g.lineStyle(6,0x1c2429,1).lineBetween(pt(31-recoil,2).x,pt(31-recoil,2).y,mag.x,mag.y);
      g.fillStyle(0xff8f4d).fillCircle(end.x,end.y,3);
    }else if(id==='shotgun'){
      const endA=pt(58-recoil,-3),endB=pt(58-recoil,3),pump=pt(36-recoil,0);
      g.lineStyle(5,0x30383e,1).lineBetween(hand.x,hand.y,endA.x,endA.y).lineBetween(hand.x,hand.y,endB.x,endB.y);
      g.fillStyle(0x8b5b38).fillCircle(pump.x,pump.y,6);
      g.fillStyle(0xff6b55).fillCircle(endA.x,endA.y,3).fillCircle(endB.x,endB.y,3);
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
    for(const l of s.loot){const dx=l.x-me.x,dy=l.y-me.y,d=dx*dx+dy*dy;if(d<best){best=d;nearest=l;}}
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
    const w=this.mapOpen?420:190,h=this.mapOpen?420:190,x=this.scale.width-w-14,y=14,sc=w/WORLD_SIZE;
    g.fillStyle(0x061018,.9).fillRoundedRect(x,y,w,h,12);
    for(const r of REGIONS)g.fillStyle(REGION_THEMES[r.id].ground,.62).fillRect(x+r.x*sc,y+r.y*sc,r.w*sc,r.h*sc);
    for(const b of BUILDINGS)g.fillStyle(REGION_THEMES[b.regionId].roof,.68).fillRect(x+b.x*sc,y+b.y*sc,Math.max(1,b.w*sc),Math.max(1,b.h*sc));
    for(const bush of BUSHES)g.fillStyle(0x3f8c4c,.48).fillCircle(x+bush.x*sc,y+bush.y*sc,Math.max(1.5,bush.radius*sc));
    g.lineStyle(2,0x4db5ff).strokeCircle(x+s.zoneX*sc,y+s.zoneY*sc,s.zoneRadius*sc);
    for(const p of s.players){if(!p.alive)continue;g.fillStyle(p.id===this.net.sessionId?0x54dcff:0xff686e).fillCircle(x+p.x*sc,y+p.y*sc,p.id===this.net.sessionId?5:3);}
  }
}
