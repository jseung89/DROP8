import Phaser from 'phaser';
import {
  BUILDINGS, LOOT_COLORS, LOOT_LABELS, MELEE_WEAPONS, OBSTACLES, PLAYER_RADIUS, PLAYER_SPEED, REGIONS, WEAPONS, WORLD_SIZE, circleHitsRect, clamp,
  type EquippedId, type LootKind, type WeaponId, type MeleeId
} from '@drop8/shared';
import type { Network } from './network';

type DisplayPoint={x:number;y:number};

export class GameScene extends Phaser.Scene {
  private staticG!:Phaser.GameObjects.Graphics;
  private dynamicG!:Phaser.GameObjects.Graphics;
  private slowG!:Phaser.GameObjects.Graphics;
  private hitG!:Phaser.GameObjects.Graphics;
  private mini!:Phaser.GameObjects.Graphics;
  private pickupText!:Phaser.GameObjects.Text;
  private fpsText!:Phaser.GameObjects.Text;
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

  constructor(private net:Network){super('game');}

  create(){
    this.cameras.main.setBounds(0,0,WORLD_SIZE,WORLD_SIZE);
    this.cameras.main.setBackgroundColor('#153424');
    this.staticG=this.add.graphics().setDepth(0);
    this.slowG=this.add.graphics().setDepth(3);
    this.dynamicG=this.add.graphics().setDepth(5);
    this.hitG=this.add.graphics().setScrollFactor(0).setDepth(45);
    this.mini=this.add.graphics().setScrollFactor(0).setDepth(40);
    this.pickupText=this.add.text(this.scale.width/2,this.scale.height-92,'',{fontFamily:'sans-serif',fontSize:'18px',fontStyle:'bold',color:'#ffffff',backgroundColor:'#071018dd',padding:{x:12,y:8}}).setOrigin(.5).setScrollFactor(0).setDepth(50).setVisible(false);
    this.fpsText=this.add.text(12,12,'',{fontFamily:'monospace',fontSize:'12px',color:'#9fb2bf',backgroundColor:'#071018aa',padding:{x:6,y:4}}).setScrollFactor(0).setDepth(50);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,E,R,ONE,TWO,THREE,FOUR,M,SPACE,ENTER,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    this.keys.LEFT.on('down',()=>{this.spectateIndex=Math.max(0,this.spectateIndex-1);});
    this.keys.RIGHT.on('down',()=>{this.spectateIndex++;});
    this.keys.E.on('down',()=>this.net.send('pickup'));
    this.keys.R.on('down',()=>this.net.send('reload'));
    this.keys.ONE.on('down',()=>this.net.send('switch',{slot:1}));
    this.keys.TWO.on('down',()=>this.net.send('switch',{slot:2}));
    this.keys.THREE.on('down',()=>this.net.send('switch',{slot:3}));
    this.keys.FOUR.on('down',()=>this.net.send('heal',{kind:'bandage'}));
    this.keys.SPACE.on('down',()=>this.net.send('jump'));
    this.keys.M.on('down',()=>{this.mapOpen=!this.mapOpen;this.lastMiniDraw=0;});
    this.scale.on('resize',(size:Phaser.Structs.Size)=>{
      this.pickupText.setPosition(size.width/2,size.height-92);
      this.lastMiniDraw=0;
    });
    this.drawStaticMap();
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
      g.fillStyle(r.color,.22).fillRoundedRect(r.x,r.y,r.w,r.h,28);
      g.lineStyle(3,0xffffff,.1).strokeRoundedRect(r.x,r.y,r.w,r.h,28);
      this.add.text(r.x+20,r.y+18,r.name,{fontFamily:'sans-serif',fontSize:'30px',fontStyle:'bold',color:'#ffffff55'}).setDepth(.5);
    }
    for(const b of BUILDINGS){
      g.fillStyle(0x26373d,.92).fillRect(b.x+18,b.y+18,Math.max(1,b.w-36),Math.max(1,b.h-36));
      g.lineStyle(2,0x87a1ac,.2).strokeRect(b.x+18,b.y+18,Math.max(1,b.w-36),Math.max(1,b.h-36));
    }
    for(const wall of OBSTACLES){
      g.fillStyle(0x4a5b63).fillRect(wall.x,wall.y,wall.w,wall.h);
      g.lineStyle(2,0x10181d,.9).strokeRect(wall.x,wall.y,wall.w,wall.h);
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
      if(!p.alive||!visible(p.x,p.y,100))continue;
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
    g.fillStyle(bodyColor).fillCircle(x,y,20*scale);
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
    const label=LOOT_LABELS[nearest.kind as LootKind]??nearest.kind;
    this.pickupText.setText(`E  줍기 · ${label}`).setVisible(true);
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
    for(const r of REGIONS)g.fillStyle(r.color,.45).fillRect(x+r.x*sc,y+r.y*sc,r.w*sc,r.h*sc);
    for(const b of BUILDINGS)g.fillStyle(0x70818a,.52).fillRect(x+b.x*sc,y+b.y*sc,Math.max(1,b.w*sc),Math.max(1,b.h*sc));
    g.lineStyle(2,0x4db5ff).strokeCircle(x+s.zoneX*sc,y+s.zoneY*sc,s.zoneRadius*sc);
    for(const p of s.players){if(!p.alive)continue;g.fillStyle(p.id===this.net.sessionId?0x54dcff:0xff686e).fillCircle(x+p.x*sc,y+p.y*sc,p.id===this.net.sessionId?5:3);}
  }
}
