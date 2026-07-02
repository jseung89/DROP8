// DROP8_REFACTOR_017_ADHESIVE_STRIP_LOBBY_BAZOOKA_WATER
export const STRIP_TRAP_BALANCE={
  placementDistance:64,
  length:100,
  width:14,
  activatesAfterSeconds:.8,
  lifetimeSeconds:60,
  maxActivePerOwner:2,
  maxCarry:4,
  pickupAmount:1,
  hp:30,
  motorcycleTriggerPadding:4,
  overlapPadding:18,
} as const;

export interface StripTrapGeometry{x:number;y:number;angle:number;length:number;width:number;}

export function pointSegmentDistanceSquared(px:number,py:number,ax:number,ay:number,bx:number,by:number){
  const abx=bx-ax,aby=by-ay,lengthSquared=abx*abx+aby*aby;
  if(lengthSquared<=1e-9){const dx=px-ax,dy=py-ay;return dx*dx+dy*dy;}
  const ratio=Math.max(0,Math.min(1,((px-ax)*abx+(py-ay)*aby)/lengthSquared));
  const dx=px-(ax+abx*ratio),dy=py-(ay+aby*ratio);
  return dx*dx+dy*dy;
}

export function stripTrapEndpoints(trap:StripTrapGeometry){
  const half=trap.length/2,dx=Math.cos(trap.angle)*half,dy=Math.sin(trap.angle)*half;
  return{ax:trap.x-dx,ay:trap.y-dy,bx:trap.x+dx,by:trap.y+dy};
}

export function circleHitsStripTrap(circleX:number,circleY:number,circleRadius:number,trap:StripTrapGeometry,padding=0){
  const {ax,ay,bx,by}=stripTrapEndpoints(trap);
  const radius=Math.max(0,circleRadius+trap.width/2+padding);
  return pointSegmentDistanceSquared(circleX,circleY,ax,ay,bx,by)<=radius*radius;
}

export function stripTrapsOverlap(a:StripTrapGeometry,b:StripTrapGeometry,padding=0){
  const aEnds=stripTrapEndpoints(a),bEnds=stripTrapEndpoints(b);
  const threshold=(a.width+b.width)/2+padding;
  const distances=[
    pointSegmentDistanceSquared(aEnds.ax,aEnds.ay,bEnds.ax,bEnds.ay,bEnds.bx,bEnds.by),
    pointSegmentDistanceSquared(aEnds.bx,aEnds.by,bEnds.ax,bEnds.ay,bEnds.bx,bEnds.by),
    pointSegmentDistanceSquared(bEnds.ax,bEnds.ay,aEnds.ax,aEnds.ay,aEnds.bx,aEnds.by),
    pointSegmentDistanceSquared(bEnds.bx,bEnds.by,aEnds.ax,aEnds.ay,aEnds.bx,aEnds.by),
  ];
  return Math.min(...distances)<=threshold*threshold;
}
