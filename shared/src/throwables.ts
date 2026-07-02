import type { BuildingVisibilityZone, Bush, MapConfig, Rect } from './index.js';

// DROP8_REFACTOR_012_THROWABLE_ARSENAL
export type ThrowableType='fragGrenade'|'smokeGrenade'|'incendiaryGrenade';
export type ThrowablePhase='flying'|'resting';
export type ThrowableCollisionKind='none'|'ground'|'wall'|'window-frame'|'world-boundary';

export interface ThrowableConfig{
  type:ThrowableType;
  name:string;
  color:number;
  maxCount:number;
  fuseMs:number;
  effectRadius:number;
  restitution:number;
  groundFriction:number;
}

export const THROWABLE_MAX_CHARGE_MS=850;
export const THROWABLE_MIN_DISTANCE=120;
export const THROWABLE_MAX_DISTANCE=480;
export const THROWABLE_GRAVITY=720;
export const THROWABLE_INITIAL_Z=26;
export const THROWABLE_INITIAL_VZ=285;
export const THROWABLE_RADIUS=7;
export const THROWABLE_SIM_STEP=1/60;
export const THROWABLE_WINDOW_MIN_Z=34;
export const THROWABLE_WINDOW_MAX_Z=116;
export const THROWABLE_SMOKE_NEAR_VISIBILITY=80;
export const THROWABLE_FIRE_TICK_MS=250;

export const THROWABLE_CONFIGS:Record<ThrowableType,ThrowableConfig>={
  fragGrenade:{type:'fragGrenade',name:'파편 수류탄',color:0x455b39,maxCount:3,fuseMs:2500,effectRadius:180,restitution:.48,groundFriction:.72},
  smokeGrenade:{type:'smokeGrenade',name:'연막탄',color:0xb9c0c6,maxCount:3,fuseMs:700,effectRadius:0,restitution:.38,groundFriction:.68},
  incendiaryGrenade:{type:'incendiaryGrenade',name:'화염탄',color:0xd64a37,maxCount:3,fuseMs:0,effectRadius:115,restitution:.12,groundFriction:.45},
};

export const SMOKE_TIMING={deployDelayMs:700,growMs:1200,holdMs:8000,fadeMs:1500} as const;
export const FIRE_TIMING={durationMs:8000,tickMs:THROWABLE_FIRE_TICK_MS,playerInitialDamage:12,playerTickDamage:4,vehicleInitialDamage:12,vehicleDamagePerSecond:12} as const;

export interface ThrowableMotion{
  x:number;y:number;z:number;vx:number;vy:number;vz:number;
  bounces:number;phase:ThrowablePhase;
}
export interface ThrowableStepResult extends ThrowableMotion{
  collision:ThrowableCollisionKind;
  collisionX:number;
  collisionY:number;
}
export interface ThrowableTrajectoryPoint{
  x:number;y:number;z:number;time:number;collision:ThrowableCollisionKind;
}
export interface ThrowableTrajectory{
  points:ThrowableTrajectoryPoint[];
  landing:{x:number;y:number;z:number};
  firstCollision:ThrowableCollisionKind;
  blockedImmediately:boolean;
  duration:number;
}

const localClamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

export function isThrowableType(value:unknown):value is ThrowableType{
  return value==='fragGrenade'||value==='smokeGrenade'||value==='incendiaryGrenade';
}

export function throwableChargeRatio(heldMs:number){
  return localClamp(Number.isFinite(heldMs)?heldMs/THROWABLE_MAX_CHARGE_MS:0,0,1);
}

export function throwableDistanceForCharge(heldMs:number){
  const ratio=throwableChargeRatio(heldMs);
  const eased=ratio*ratio*(3-2*ratio);
  return THROWABLE_MIN_DISTANCE+(THROWABLE_MAX_DISTANCE-THROWABLE_MIN_DISTANCE)*eased;
}

export function throwableHorizontalSpeed(heldMs:number){
  const distance=throwableDistanceForCharge(heldMs);
  const flightTime=(THROWABLE_INITIAL_VZ+Math.sqrt(THROWABLE_INITIAL_VZ**2+2*THROWABLE_GRAVITY*THROWABLE_INITIAL_Z))/THROWABLE_GRAVITY;
  return distance/Math.max(.1,flightTime);
}

export function createThrowableMotion(x:number,y:number,aimX:number,aimY:number,heldMs:number):ThrowableMotion{
  const length=Math.hypot(aimX,aimY)||1;
  const speed=throwableHorizontalSpeed(heldMs);
  return{x,y,z:THROWABLE_INITIAL_Z,vx:aimX/length*speed,vy:aimY/length*speed,vz:THROWABLE_INITIAL_VZ,bounces:0,phase:'flying'};
}

function segmentRectEntry(x1:number,y1:number,x2:number,y2:number,rect:Rect,padding=0):{t:number;nx:number;ny:number}|null{
  const minX=rect.x-padding,maxX=rect.x+rect.w+padding,minY=rect.y-padding,maxY=rect.y+rect.h+padding;
  const dx=x2-x1,dy=y2-y1;
  let nearX=-Infinity,farX=Infinity,nearY=-Infinity,farY=Infinity;
  if(Math.abs(dx)<1e-9){if(x1<minX||x1>maxX)return null;}else{
    const tx1=(minX-x1)/dx,tx2=(maxX-x1)/dx;nearX=Math.min(tx1,tx2);farX=Math.max(tx1,tx2);
  }
  if(Math.abs(dy)<1e-9){if(y1<minY||y1>maxY)return null;}else{
    const ty1=(minY-y1)/dy,ty2=(maxY-y1)/dy;nearY=Math.min(ty1,ty2);farY=Math.max(ty1,ty2);
  }
  const tNear=Math.max(nearX,nearY),tFar=Math.min(farX,farY);
  if(tNear>tFar||tFar<0||tNear>1)return null;
  const t=localClamp(tNear,0,1);
  if(nearX>nearY)return{t,nx:dx>0?-1:1,ny:0};
  return{t,nx:0,ny:dy>0?-1:1};
}

function zAtStep(start:ThrowableMotion,dt:number,t:number){return start.z+start.vz*dt*t-.5*THROWABLE_GRAVITY*(dt*t)**2;}

function earliestWallCollision(start:ThrowableMotion,nextX:number,nextY:number,dt:number,map:Pick<MapConfig,'bulletObstacles'|'buildingVisibilityZones'|'width'|'height'>):{t:number;nx:number;ny:number;kind:ThrowableCollisionKind}|null{
  let best:{t:number;nx:number;ny:number;kind:ThrowableCollisionKind}|null=null;
  const accept=(candidate:{t:number;nx:number;ny:number;kind:ThrowableCollisionKind}|null)=>{if(candidate&&(!best||candidate.t<best.t))best=candidate;};
  for(const rect of map.bulletObstacles){
    const hit=segmentRectEntry(start.x,start.y,nextX,nextY,rect,THROWABLE_RADIUS);
    if(hit)accept({...hit,kind:'wall'});
  }
  // Current maps use permanently open door portals. A future or custom map may mark a door open:false.
  for(const zone of map.buildingVisibilityZones)for(const door of zone.doors){
    if(door.open!==false)continue;
    const hit=segmentRectEntry(start.x,start.y,nextX,nextY,{x:door.x,y:door.y,w:door.width,h:door.height},THROWABLE_RADIUS);
    if(hit)accept({...hit,kind:'wall'});
  }
  // Projectile walls contain window gaps. Re-create the frame only when the virtual height is outside the aperture.
  for(const zone of map.buildingVisibilityZones)for(const opening of zone.windows){
    const hit=segmentRectEntry(start.x,start.y,nextX,nextY,{x:opening.x,y:opening.y,w:opening.width,h:opening.height},-2);
    if(!hit)continue;
    const z=zAtStep(start,dt,hit.t);
    if(z<THROWABLE_WINDOW_MIN_Z||z>THROWABLE_WINDOW_MAX_Z)accept({...hit,kind:'window-frame'});
  }
  const boundaryPadding=THROWABLE_RADIUS;
  if(nextX<boundaryPadding)accept({t:localClamp((boundaryPadding-start.x)/(nextX-start.x||1),0,1),nx:1,ny:0,kind:'world-boundary'});
  if(nextX>map.width-boundaryPadding)accept({t:localClamp((map.width-boundaryPadding-start.x)/(nextX-start.x||1),0,1),nx:-1,ny:0,kind:'world-boundary'});
  if(nextY<boundaryPadding)accept({t:localClamp((boundaryPadding-start.y)/(nextY-start.y||1),0,1),nx:0,ny:1,kind:'world-boundary'});
  if(nextY>map.height-boundaryPadding)accept({t:localClamp((map.height-boundaryPadding-start.y)/(nextY-start.y||1),0,1),nx:0,ny:-1,kind:'world-boundary'});
  return best;
}

export function stepThrowableMotion(current:ThrowableMotion,dt:number,map:Pick<MapConfig,'bulletObstacles'|'buildingVisibilityZones'|'width'|'height'>,config:ThrowableConfig):ThrowableStepResult{
  if(current.phase==='resting')return{...current,collision:'none',collisionX:current.x,collisionY:current.y};
  const safeDt=localClamp(dt,0,.05);
  const nextX=current.x+current.vx*safeDt,nextY=current.y+current.vy*safeDt;
  const nextZ=current.z+current.vz*safeDt-.5*THROWABLE_GRAVITY*safeDt*safeDt;
  const nextVz=current.vz-THROWABLE_GRAVITY*safeDt;
  const wall=earliestWallCollision(current,nextX,nextY,safeDt,map);
  if(wall){
    const hitX=current.x+(nextX-current.x)*wall.t,hitY=current.y+(nextY-current.y)*wall.t;
    const dot=current.vx*wall.nx+current.vy*wall.ny;
    const reflectedX=(current.vx-2*dot*wall.nx)*config.restitution;
    const reflectedY=(current.vy-2*dot*wall.ny)*config.restitution;
    const remaining=safeDt*(1-wall.t);
    return{
      x:localClamp(hitX+wall.nx*(THROWABLE_RADIUS+.5)+reflectedX*remaining,THROWABLE_RADIUS,map.width-THROWABLE_RADIUS),
      y:localClamp(hitY+wall.ny*(THROWABLE_RADIUS+.5)+reflectedY*remaining,THROWABLE_RADIUS,map.height-THROWABLE_RADIUS),
      z:Math.max(0,zAtStep(current,safeDt,wall.t)),vx:reflectedX,vy:reflectedY,vz:nextVz*.92,bounces:current.bounces+1,
      phase:Math.hypot(reflectedX,reflectedY)<18&&Math.abs(nextVz)<28?'resting':'flying',collision:wall.kind,collisionX:hitX,collisionY:hitY,
    };
  }
  if(nextZ<=0&&nextVz<0){
    const a=-.5*THROWABLE_GRAVITY,b=current.vz,c=current.z;
    const disc=Math.max(0,b*b-4*a*c);
    const impactTime=localClamp((-b-Math.sqrt(disc))/(2*a),0,safeDt);
    const hitX=current.x+current.vx*impactTime,hitY=current.y+current.vy*impactTime;
    const vx=current.vx*config.groundFriction,vy=current.vy*config.groundFriction,vz=Math.abs(current.vz-THROWABLE_GRAVITY*impactTime)*config.restitution;
    const resting=vz<34&&Math.hypot(vx,vy)<34;
    return{x:hitX+vx*(safeDt-impactTime),y:hitY+vy*(safeDt-impactTime),z:resting?0:Math.max(0,vz*(safeDt-impactTime)-.5*THROWABLE_GRAVITY*(safeDt-impactTime)**2),vx:resting?0:vx,vy:resting?0:vy,vz:resting?0:vz-THROWABLE_GRAVITY*(safeDt-impactTime),bounces:current.bounces+1,phase:resting?'resting':'flying',collision:'ground',collisionX:hitX,collisionY:hitY};
  }
  return{x:nextX,y:nextY,z:nextZ,vx:current.vx,vy:current.vy,vz:nextVz,bounces:current.bounces,phase:'flying',collision:'none',collisionX:nextX,collisionY:nextY};
}

export function predictThrowableTrajectory(start:ThrowableMotion,map:Pick<MapConfig,'bulletObstacles'|'buildingVisibilityZones'|'width'|'height'>,config:ThrowableConfig,maxSeconds=3.4):ThrowableTrajectory{
  let state={...start};
  const points:ThrowableTrajectoryPoint[]=[{x:state.x,y:state.y,z:state.z,time:0,collision:'none'}];
  let elapsed=0,firstCollision:ThrowableCollisionKind='none';
  while(elapsed<maxSeconds&&state.phase!=='resting'){
    const next=stepThrowableMotion(state,THROWABLE_SIM_STEP,map,config);
    elapsed+=THROWABLE_SIM_STEP;
    if(next.collision!=='none'&&firstCollision==='none')firstCollision=next.collision;
    if(points.length===1||next.collision!=='none'||Math.floor(elapsed*12)!==Math.floor((elapsed-THROWABLE_SIM_STEP)*12))points.push({x:next.x,y:next.y,z:next.z,time:elapsed,collision:next.collision});
    state=next;
    if(state.bounces>8)break;
  }
  return{points,landing:{x:state.x,y:state.y,z:state.z},firstCollision,blockedImmediately:firstCollision!=='none'&&elapsed<.12,duration:elapsed};
}

export function fragPlayerDamage(distanceFromCenter:number){
  if(distanceFromCenter<0||distanceFromCenter>180)return 0;
  if(distanceFromCenter<=35)return 100;
  if(distanceFromCenter<=80)return 75;
  if(distanceFromCenter<=130)return 45;
  return 20;
}

export function fragVehicleDamage(distanceFromCenter:number){
  if(distanceFromCenter<0||distanceFromCenter>180)return 0;
  if(distanceFromCenter<=50)return 120;
  if(distanceFromCenter<=100)return 80;
  if(distanceFromCenter<=150)return 45;
  return 20;
}

export function representativeBushRadius(bushes:readonly Bush[]){
  if(!bushes.length)return 56;
  const sorted=bushes.map((bush)=>bush.radius).sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]!:((sorted[middle-1]??sorted[middle]??28)+(sorted[middle]??28))/2;
}

export function smokeRadiusForBushes(bushes:readonly Bush[]){return representativeBushRadius(bushes)*2;}

export function smokeRadiusAt(nowMs:number,startedAtMs:number,maxRadius:number){
  const elapsed=nowMs-startedAtMs;
  if(elapsed<0)return 0;
  if(elapsed<SMOKE_TIMING.growMs)return maxRadius*localClamp(elapsed/SMOKE_TIMING.growMs,0,1);
  const fadeStart=SMOKE_TIMING.growMs+SMOKE_TIMING.holdMs;
  if(elapsed<fadeStart)return maxRadius;
  if(elapsed<fadeStart+SMOKE_TIMING.fadeMs)return maxRadius*(1-localClamp((elapsed-fadeStart)/SMOKE_TIMING.fadeMs,0,1));
  return 0;
}

export function smokeAlphaAt(nowMs:number,startedAtMs:number){
  const elapsed=nowMs-startedAtMs;
  if(elapsed<0)return 0;
  if(elapsed<SMOKE_TIMING.growMs)return .15+.75*localClamp(elapsed/SMOKE_TIMING.growMs,0,1);
  const fadeStart=SMOKE_TIMING.growMs+SMOKE_TIMING.holdMs;
  if(elapsed<fadeStart)return .9;
  return .9*(1-localClamp((elapsed-fadeStart)/SMOKE_TIMING.fadeMs,0,1));
}

export interface SmokeLike{id?:string;x:number;y:number;radius:number;startedAt?:number;expiresAt?:number;buildingId?:string;}
export type SmokeVisibility='clear'|'hidden'|'near';

function segmentCircleIntersects(ax:number,ay:number,bx:number,by:number,cx:number,cy:number,radius:number){
  const dx=bx-ax,dy=by-ay,lengthSq=dx*dx+dy*dy;
  if(lengthSq<=1e-9)return Math.hypot(ax-cx,ay-cy)<=radius;
  const t=localClamp(((cx-ax)*dx+(cy-ay)*dy)/lengthSq,0,1);
  return Math.hypot(ax+dx*t-cx,ay+dy*t-cy)<=radius;
}

// DROP8_REFACTOR_012A_SMOKE_MOTORCYCLE_AI_NAV
export function smokeVisibilityBetween(viewer:{x:number;y:number;buildingId?:string},target:{x:number;y:number;buildingId?:string},fields:readonly SmokeLike[],nowSeconds=Date.now()/1000):SmokeVisibility{
  let sameField=false;
  for(const field of fields){
    if(field.expiresAt&&nowSeconds>=field.expiresAt)continue;
    const fieldBuilding=field.buildingId??'',viewerBuilding=viewer.buildingId??'',targetBuilding=target.buildingId??'';
    // A sealed wall must prevent a smoke circle from affecting an unrelated space.
    if(fieldBuilding){if(viewerBuilding!==fieldBuilding&&targetBuilding!==fieldBuilding)continue;}
    else if(viewerBuilding&&viewerBuilding===targetBuilding)continue;
    const radius=field.radius;
    if(radius<=0)continue;
    const viewerInside=Math.hypot(viewer.x-field.x,viewer.y-field.y)<=radius;
    const targetInside=Math.hypot(target.x-field.x,target.y-field.y)<=radius;
    if(viewerInside&&targetInside){sameField=true;continue;}
    if(viewerInside!==targetInside||segmentCircleIntersects(viewer.x,viewer.y,target.x,target.y,field.x,field.y,radius))return'hidden';
  }
  if(sameField)return Math.hypot(viewer.x-target.x,viewer.y-target.y)<=THROWABLE_SMOKE_NEAR_VISIBILITY?'near':'hidden';
  return'clear';
}

export function fireFieldContains(field:{x:number;y:number;radius:number;buildingId?:string},target:{x:number;y:number;buildingId?:string},zones:readonly BuildingVisibilityZone[]){
  if(Math.hypot(field.x-target.x,field.y-target.y)>field.radius)return false;
  const sourceId=field.buildingId??'',targetId=target.buildingId??'';
  if(sourceId===targetId)return true;
  // Fire may leak through a doorway, but never through a window.
  if(sourceId&&targetId)return false;
  const indoorId=sourceId||targetId;
  const zone=zones.find((item)=>item.id===indoorId);
  if(!zone)return false;
  return zone.doors.some((door)=>segmentRectEntry(field.x,field.y,target.x,target.y,{x:door.x,y:door.y,w:door.width,h:door.height})!==null);
}

export function throwableEffectRadius(type:ThrowableType,bushes:readonly Bush[]){return type==='smokeGrenade'?smokeRadiusForBushes(bushes):THROWABLE_CONFIGS[type].effectRadius;}
