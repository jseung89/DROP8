import type { MapRect, RoomZone, SpacePortal } from './types.js';

type LargeBuilding={x:number;y:number;w:number;h:number};

const BUILDINGS:LargeBuilding[]=[
  {x:4200,y:1700,w:920,h:560},
  {x:650,y:1800,w:1050,h:640},
  {x:2450,y:3900,w:1120,h:620},
  {x:4200,y:4100,w:900,h:700},
];

function splitWall(x:number,y:number,h:number,openings:Array<{y:number;h:number}>):MapRect[]{
  const result:MapRect[]=[];let cursor=y;
  for(const opening of [...openings].sort((a,b)=>a.y-b.y)){
    if(opening.y>cursor)result.push({x,y:cursor,w:18,h:opening.y-cursor});
    cursor=Math.max(cursor,opening.y+opening.h);
  }
  if(cursor<y+h)result.push({x,y:cursor,w:18,h:y+h-cursor});
  return result;
}

export const LARGE_CUSTOM_ROOMS:RoomZone[]=[];
export const LARGE_INTERNAL_WALLS:MapRect[]=[];
export const LARGE_INTERNAL_PORTALS:SpacePortal[]=[];

for(let index=0;index<BUILDINGS.length;index++){
  const building=BUILDINGS[index]!;
  const buildingId=`large-building-${27+index}`;
  const base=7001+index*2;
  const innerX=building.x+18,innerY=building.y+18,innerW=building.w-36,innerH=building.h-36;
  const dividerX=Math.round(building.x+building.w/2-9);
  const leftW=dividerX-innerX;
  const rightX=dividerX+18;
  const rightW=innerX+innerW-rightX;
  LARGE_CUSTOM_ROOMS.push(
    {id:`${buildingId}-room-a`,buildingId,index:base,rect:{x:innerX,y:innerY,w:leftW,h:innerH},kind:'main'},
    {id:`${buildingId}-room-b`,buildingId,index:base+1,rect:{x:rightX,y:innerY,w:rightW,h:innerH},kind:index===0?'office':index===1?'storage':index===2?'hall':'storage'},
  );
  const doorY=Math.round(building.y+building.h*.62-60);
  const windowY=Math.round(building.y+building.h*.28-42);
  LARGE_INTERNAL_WALLS.push(...splitWall(dividerX,innerY,innerH,[{y:windowY,h:84},{y:doorY,h:120}]));
  LARGE_INTERNAL_PORTALS.push(
    {id:`${buildingId}-internal-window`,buildingId,kind:'window',sideARoomIndex:base,sideBRoomIndex:base+1,opening:{x:dividerX,y:windowY,w:18,h:84},approachA:{x:dividerX-48,y:windowY+42},approachB:{x:dividerX+66,y:windowY+42},landingA:{x:dividerX-48,y:windowY+42},landingB:{x:dividerX+66,y:windowY+42},vaultable:true,allowsVision:true,allowsBullets:true},
    {id:`${buildingId}-internal-door`,buildingId,kind:'door',sideARoomIndex:base,sideBRoomIndex:base+1,opening:{x:dividerX,y:doorY,w:18,h:120},approachA:{x:dividerX-40,y:doorY+60},approachB:{x:dividerX+58,y:doorY+60},landingA:{x:dividerX-40,y:doorY+60},landingB:{x:dividerX+58,y:doorY+60},vaultable:false,allowsVision:true,allowsBullets:true},
  );
}
