export type PositionSnapshot={x:number;y:number;angle:number;receivedAt:number};
export type VisibilityResult={visibleInWorld:boolean;visibleOnMinimap:boolean;revealedByShot:boolean;revealedByHit:boolean};

export function pushPositionSnapshot(buffer:PositionSnapshot[],snapshot:PositionSnapshot,max=8){
  const last=buffer.at(-1);
  if(last&&last.receivedAt===snapshot.receivedAt)return buffer;
  buffer.push(snapshot);
  while(buffer.length>max)buffer.shift();
  return buffer;
}

export function samplePosition(buffer:readonly PositionSnapshot[],targetTime:number){
  if(!buffer.length)return undefined;
  if(buffer.length===1||targetTime<=buffer[0]!.receivedAt)return {...buffer[0]!};
  for(let i=1;i<buffer.length;i++){
    const b=buffer[i]!;
    if(targetTime>b.receivedAt)continue;
    const a=buffer[i-1]!;
    const span=Math.max(1,b.receivedAt-a.receivedAt);
    const t=Math.max(0,Math.min(1,(targetTime-a.receivedAt)/span));
    const angleDelta=Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle));
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:a.angle+angleDelta*t,receivedAt:targetTime};
  }
  return {...buffer.at(-1)!};
}

export function zoneDirection(dx:number,dy:number){
  if(Math.hypot(dx,dy)<12)return '현재 위치';
  const names=['동','남동','남','남서','서','북서','북','북동'];
  const normalized=(Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2);
  return names[Math.round(normalized/(Math.PI/4))%8]!;
}
