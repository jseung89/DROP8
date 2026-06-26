import type { MapPoint, MapRect, RoomZone, SpaceDescriptor, SpacePortal, SpaceVisibilityTrace } from './types.js';

export interface BuildingZoneLike{
  id:string;
  interior:MapRect;
  doors:Array<{id:string;x:number;y:number;width:number;height:number}>;
  windows:Array<{id:string;x:number;y:number;width:number;height:number;vaultable:boolean;allowsVision:boolean;allowsBullets:boolean}>;
}

function contains(rect:MapRect,x:number,y:number,padding=0){return x>=rect.x-padding&&x<=rect.x+rect.w+padding&&y>=rect.y-padding&&y<=rect.y+rect.h+padding;}
function center(rect:MapRect){return{x:rect.x+rect.w/2,y:rect.y+rect.h/2};}
function segmentRectIntersectionT(x1:number,y1:number,x2:number,y2:number,rect:MapRect,padding=0):number|null{
  const minX=rect.x-padding,maxX=rect.x+rect.w+padding,minY=rect.y-padding,maxY=rect.y+rect.h+padding,dx=x2-x1,dy=y2-y1;
  let tMin=0,tMax=1;
  for(const [start,delta,min,max] of [[x1,dx,minX,maxX],[y1,dy,minY,maxY]] as const){
    if(Math.abs(delta)<1e-9){if(start<min||start>max)return null;continue;}
    let a=(min-start)/delta,b=(max-start)/delta;if(a>b)[a,b]=[b,a];tMin=Math.max(tMin,a);tMax=Math.min(tMax,b);if(tMin>tMax)return null;
  }
  return tMin;
}

export function createDefaultRoomZones(zones:readonly BuildingZoneLike[],startIndex=1,customRooms:readonly RoomZone[]=[]){
  const customBuildingIds=new Set(customRooms.map((room)=>room.buildingId));
  const rooms=[...customRooms];
  let index=Math.max(startIndex,...rooms.map((room)=>room.index+1));
  for(const zone of zones){
    if(customBuildingIds.has(zone.id))continue;
    rooms.push({id:`${zone.id}-main`,buildingId:zone.id,index:index++,rect:{...zone.interior},kind:'main'});
  }
  return rooms;
}

export function roomAt(x:number,y:number,rooms:readonly RoomZone[],buildingId=''){
  const candidates=buildingId?rooms.filter((room)=>room.buildingId===buildingId):rooms;
  return candidates.find((room)=>contains(room.rect,x,y));
}

export function roomByIndex(index:number,rooms:readonly RoomZone[]){return rooms.find((room)=>room.index===index);}

export function spaceAt(x:number,y:number,zones:readonly BuildingZoneLike[],rooms:readonly RoomZone[],padding=0):SpaceDescriptor{
  const zone=zones.find((candidate)=>contains(candidate.interior,x,y,padding));
  if(!zone)return{buildingId:'',roomIndex:0,outdoors:true};
  const room=roomAt(x,y,rooms,zone.id);
  return{buildingId:zone.id,roomIndex:room?.index??0,outdoors:false};
}

function openingSide(opening:MapRect,zone:BuildingZoneLike){
  const c=center(opening),i=zone.interior;
  const distances={north:Math.abs(c.y-i.y),south:Math.abs(c.y-(i.y+i.h)),west:Math.abs(c.x-i.x),east:Math.abs(c.x-(i.x+i.w))};
  return(Object.entries(distances).sort((a,b)=>a[1]-b[1])[0]?.[0]??'north') as 'north'|'south'|'west'|'east';
}

function inferSidePoints(opening:MapRect,zone:BuildingZoneLike,clearance=48){
  const c=center(opening),side=openingSide(opening,zone);
  if(side==='north')return{outside:{x:c.x,y:c.y-clearance},inside:{x:c.x,y:c.y+clearance}};
  if(side==='south')return{outside:{x:c.x,y:c.y+clearance},inside:{x:c.x,y:c.y-clearance}};
  if(side==='west')return{outside:{x:c.x-clearance,y:c.y},inside:{x:c.x+clearance,y:c.y}};
  return{outside:{x:c.x+clearance,y:c.y},inside:{x:c.x-clearance,y:c.y}};
}

function inferLegacyWindowVaultPoints(opening:MapRect,zone:BuildingZoneLike,outsideClearance=36,wallThickness=18){
  const c=center(opening),side=openingSide(opening,zone),insideClearance=outsideClearance+wallThickness;
  if(side==='north')return{outside:{x:c.x,y:c.y-outsideClearance},inside:{x:c.x,y:c.y+insideClearance}};
  if(side==='south')return{outside:{x:c.x,y:c.y+outsideClearance},inside:{x:c.x,y:c.y-insideClearance}};
  if(side==='west')return{outside:{x:c.x-outsideClearance,y:c.y},inside:{x:c.x+insideClearance,y:c.y}};
  return{outside:{x:c.x+outsideClearance,y:c.y},inside:{x:c.x-insideClearance,y:c.y}};
}

export function createExternalSpacePortals(zones:readonly BuildingZoneLike[],rooms:readonly RoomZone[]){
  const portals:SpacePortal[]=[];
  for(const zone of zones){
    for(const door of zone.doors){
      const opening={x:door.x,y:door.y,w:door.width,h:door.height};
      const points=inferSidePoints(opening,zone);
      const insideRoom=roomAt(points.inside.x,points.inside.y,rooms,zone.id)??rooms.find((room)=>room.buildingId===zone.id);
      portals.push({id:door.id,buildingId:zone.id,kind:'door',sideARoomIndex:0,sideBRoomIndex:insideRoom?.index??0,opening,approachA:points.outside,approachB:points.inside,landingA:points.outside,landingB:points.inside,vaultable:false,allowsVision:true,allowsBullets:true});
    }
    for(const window of zone.windows){
      const opening={x:window.x,y:window.y,w:window.width,h:window.height};
      // Preserve the pre-013 exterior-window landing geometry (36px outside, 54px inside).
      const points=inferLegacyWindowVaultPoints(opening,zone);
      const insideRoom=roomAt(points.inside.x,points.inside.y,rooms,zone.id)??rooms.find((room)=>room.buildingId===zone.id);
      portals.push({id:window.id,buildingId:zone.id,kind:'window',sideARoomIndex:0,sideBRoomIndex:insideRoom?.index??0,opening,approachA:points.outside,approachB:points.inside,landingA:points.outside,landingB:points.inside,vaultable:window.vaultable,allowsVision:window.allowsVision,allowsBullets:window.allowsBullets});
    }
  }
  return portals;
}

export function portalSideForSpace(portal:SpacePortal,roomIndex:number){
  if(roomIndex===portal.sideARoomIndex)return'A' as const;
  if(roomIndex===portal.sideBRoomIndex)return'B' as const;
  return null;
}

export function portalTraversal(portal:SpacePortal,roomIndex:number){
  const side=portalSideForSpace(portal,roomIndex);
  if(side==='A')return{from:'A' as const,start:portal.approachA,target:portal.landingB,targetRoomIndex:portal.sideBRoomIndex};
  if(side==='B')return{from:'B' as const,start:portal.approachB,target:portal.landingA,targetRoomIndex:portal.sideARoomIndex};
  return null;
}

export function findPortalVaultCandidate(x:number,y:number,buildingId:string,roomIndex:number,portals:readonly SpacePortal[],maxDistance=70){
  let best:{portal:SpacePortal;from:'A'|'B';start:MapPoint;target:MapPoint;targetBuildingId:string;targetRoomIndex:number;distance:number}|undefined;
  for(const portal of portals){
    if(portal.kind!=='window'||!portal.vaultable)continue;
    if(buildingId&&portal.buildingId!==buildingId)continue;
    const traversal=portalTraversal(portal,roomIndex);
    if(!traversal)continue;
    const d=Math.hypot(x-traversal.start.x,y-traversal.start.y);
    if(d>maxDistance||best&&d>=best.distance)continue;
    best={portal,from:traversal.from,start:traversal.start,target:traversal.target,targetBuildingId:traversal.targetRoomIndex===0?'':portal.buildingId,targetRoomIndex:traversal.targetRoomIndex,distance:d};
  }
  return best;
}

export function sameRoom(a:{buildingId?:string;roomIndex?:number},b:{buildingId?:string;roomIndex?:number}){
  return(a.buildingId??'')===(b.buildingId??'')&&Number(a.roomIndex??0)===Number(b.roomIndex??0);
}

export function spaceInteractionAllowed(a:{x:number;y:number;buildingId?:string;roomIndex?:number},b:{x:number;y:number;buildingId?:string;roomIndex?:number},portals:readonly SpacePortal[]){
  if(sameRoom(a,b))return true;
  const aRoom=Number(a.roomIndex??0),bRoom=Number(b.roomIndex??0);
  return portals.some((portal)=>{
    if(!((portal.sideARoomIndex===aRoom&&portal.sideBRoomIndex===bRoom)||(portal.sideARoomIndex===bRoom&&portal.sideBRoomIndex===aRoom)))return false;
    return segmentRectIntersectionT(a.x,a.y,b.x,b.y,portal.opening,4)!==null;
  });
}

export function traceSpacePortals(viewer:{x:number;y:number;roomIndex?:number},target:{x:number;y:number;roomIndex?:number},portals:readonly SpacePortal[],maxPortals=3):SpaceVisibilityTrace{
  const startRoom=Number(viewer.roomIndex??0),targetRoom=Number(target.roomIndex??0);
  if(startRoom===targetRoom)return{visible:true,crossedPortalIds:[],roomsCrossed:0};
  const intersections=portals
    .filter((portal)=>portal.allowsVision)
    .map((portal)=>({portal,t:segmentRectIntersectionT(viewer.x,viewer.y,target.x,target.y,portal.opening,2)}))
    .filter((candidate):candidate is {portal:SpacePortal;t:number}=>candidate.t!==null)
    .sort((a,b)=>a.t-b.t);
  let room=startRoom;
  const crossed:string[]=[];
  for(const candidate of intersections){
    const portal=candidate.portal;
    let next=-1;
    if(portal.sideARoomIndex===room)next=portal.sideBRoomIndex;
    else if(portal.sideBRoomIndex===room)next=portal.sideARoomIndex;
    else continue;
    crossed.push(portal.id);room=next;
    if(room===targetRoom)return{visible:true,crossedPortalIds:crossed,roomsCrossed:crossed.length};
    if(crossed.length>=maxPortals)break;
  }
  return{visible:false,crossedPortalIds:crossed,roomsCrossed:crossed.length};
}

export function traceSpaceVisibility(viewer:{x:number;y:number;roomIndex?:number},target:{x:number;y:number;roomIndex?:number},portals:readonly SpacePortal[],blockingRects:readonly MapRect[]=[],maxPortals=3):SpaceVisibilityTrace{
  const trace=traceSpacePortals(viewer,target,portals,maxPortals);
  if(!trace.visible)return trace;
  const portalIds=new Set(trace.crossedPortalIds);
  for(const rect of blockingRects){
    const hit=segmentRectIntersectionT(viewer.x,viewer.y,target.x,target.y,rect,1);
    if(hit===null)continue;
    const openingAllows=portals.some((portal)=>portalIds.has(portal.id)&&segmentRectIntersectionT(viewer.x,viewer.y,target.x,target.y,portal.opening,3)!==null&&contains(portal.opening,viewer.x+(target.x-viewer.x)*hit,viewer.y+(target.y-viewer.y)*hit,4));
    if(!openingAllows)return{visible:false,crossedPortalIds:trace.crossedPortalIds,roomsCrossed:trace.roomsCrossed};
  }
  return trace;
}
