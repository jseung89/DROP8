// DROP8_REFACTOR_013G_DOCK8_RECOVERY
import type { AiMacroEdge, AiMacroNode, LandCrossing, LootAnchor, MapPoint, MapRect, RiverBand, RoomZone, ShoreExit, SpacePortal, WaterZone } from './types.js';

export const DOCK8_WORLD_SIZE=7168;

export type Dock8Region={id:'factory'|'residential'|'hospital'|'warehouse'|'military'|'forestCamp';name:string;x:number;y:number;w:number;h:number;color:number};
export type Dock8Building=MapRect&{doorSide:'north'|'south'|'east'|'west';doorOffset:number;doorWidth:number;regionId:Dock8Region['id']};
export type Dock8Decoration={id:string;regionId:Dock8Region['id'];kind:string;x:number;y:number;w:number;h:number;rotation?:number};
export type Dock8WorldProp=Dock8Decoration&{collision:'solid'|'thin'|'none';blocksBullets:boolean;blocksLoot:boolean};

export const DOCK8_REGIONS:Dock8Region[]=[
  {id:'factory',name:'컨테이너 야적장',x:280,y:260,w:2520,h:2350,color:0x59656d},
  {id:'warehouse',name:'오토바이 정비소',x:360,y:4380,w:2300,h:2360,color:0x81624e},
  {id:'hospital',name:'항만 관리사무소',x:4300,y:380,w:2250,h:1650,color:0x5d858a},
  {id:'military',name:'8번 물류센터',x:4200,y:2100,w:2550,h:2450,color:0x59664f},
  {id:'residential',name:'냉동창고',x:4250,y:4720,w:2250,h:1900,color:0x6d6658},
  {id:'forestCamp',name:'강변 시설',x:2850,y:250,w:1450,h:6600,color:0x356744},
];

// Building 9 is the main logistics center, 10 the administration office and 11 the cold storage.
export const DOCK8_BUILDINGS:Dock8Building[]=[
  {x:520,y:520,w:700,h:360,doorSide:'south',doorOffset:.34,doorWidth:150,regionId:'factory'},
  {x:1440,y:480,w:840,h:420,doorSide:'south',doorOffset:.65,doorWidth:160,regionId:'factory'},
  {x:620,y:1280,w:520,h:440,doorSide:'east',doorOffset:.52,doorWidth:130,regionId:'factory'},
  {x:2120,y:1420,w:420,h:330,doorSide:'west',doorOffset:.48,doorWidth:115,regionId:'factory'},
  {x:2640,y:2860,w:390,h:620,doorSide:'west',doorOffset:.45,doorWidth:120,regionId:'warehouse'},
  {x:620,y:4920,w:1120,h:760,doorSide:'east',doorOffset:.48,doorWidth:190,regionId:'warehouse'},
  {x:1860,y:5100,w:610,h:520,doorSide:'west',doorOffset:.5,doorWidth:140,regionId:'warehouse'},
  {x:580,y:6100,w:420,h:330,doorSide:'north',doorOffset:.5,doorWidth:110,regionId:'warehouse'},
  {x:4500,y:2250,w:1800,h:1950,doorSide:'west',doorOffset:.53,doorWidth:220,regionId:'military'},
  {x:4720,y:620,w:1150,h:1050,doorSide:'south',doorOffset:.35,doorWidth:170,regionId:'hospital'},
  {x:4660,y:5000,w:1420,h:1180,doorSide:'west',doorOffset:.48,doorWidth:190,regionId:'residential'},
  {x:6240,y:720,w:430,h:340,doorSide:'west',doorOffset:.48,doorWidth:115,regionId:'hospital'},
  {x:4140,y:1720,w:480,h:360,doorSide:'south',doorOffset:.55,doorWidth:125,regionId:'hospital'},
  {x:6210,y:4840,w:520,h:390,doorSide:'west',doorOffset:.5,doorWidth:125,regionId:'residential'},
  {x:6250,y:5940,w:520,h:420,doorSide:'west',doorOffset:.5,doorWidth:125,regionId:'residential'},
  {x:4060,y:300,w:360,h:300,doorSide:'south',doorOffset:.5,doorWidth:105,regionId:'forestCamp'},
  {x:3960,y:6420,w:430,h:330,doorSide:'north',doorOffset:.5,doorWidth:110,regionId:'forestCamp'},
  {x:2460,y:3900,w:470,h:350,doorSide:'east',doorOffset:.5,doorWidth:120,regionId:'warehouse'},
  {x:400,y:3200,w:540,h:390,doorSide:'east',doorOffset:.5,doorWidth:130,regionId:'warehouse'},
  {x:6400,y:3100,w:420,h:360,doorSide:'west',doorOffset:.5,doorWidth:115,regionId:'military'},
];

export const DOCK8_CUSTOM_ROOMS:RoomZone[]=[
  {id:'dock8-logistics-main',buildingId:'dock8-building-9',index:9001,rect:{x:4518,y:2268,w:942,h:1914},kind:'main'},
  {id:'dock8-logistics-corridor',buildingId:'dock8-building-9',index:9002,rect:{x:5478,y:2268,w:162,h:1914},kind:'corridor'},
  {id:'dock8-logistics-office-a',buildingId:'dock8-building-9',index:9003,rect:{x:5658,y:2268,w:624,h:430},kind:'office'},
  {id:'dock8-logistics-office-b',buildingId:'dock8-building-9',index:9004,rect:{x:5658,y:2716,w:624,h:430},kind:'office'},
  {id:'dock8-logistics-lounge',buildingId:'dock8-building-9',index:9005,rect:{x:5658,y:3164,w:624,h:430},kind:'lounge'},
  {id:'dock8-logistics-storage',buildingId:'dock8-building-9',index:9006,rect:{x:5658,y:3612,w:624,h:570},kind:'storage'},
  {id:'dock8-admin-main',buildingId:'dock8-building-10',index:9010,rect:{x:4738,y:638,w:492,h:1014},kind:'main'},
  {id:'dock8-admin-corridor',buildingId:'dock8-building-10',index:9011,rect:{x:5248,y:638,w:150,h:1014},kind:'corridor'},
  {id:'dock8-admin-office',buildingId:'dock8-building-10',index:9012,rect:{x:5416,y:638,w:436,h:500},kind:'office'},
  {id:'dock8-admin-lounge',buildingId:'dock8-building-10',index:9013,rect:{x:5416,y:1156,w:436,h:496},kind:'lounge'},
  {id:'dock8-cold-main',buildingId:'dock8-building-11',index:9020,rect:{x:4678,y:5018,w:690,h:1144},kind:'main'},
  {id:'dock8-cold-corridor',buildingId:'dock8-building-11',index:9021,rect:{x:5386,y:5018,w:150,h:1144},kind:'corridor'},
  {id:'dock8-cold-storage-a',buildingId:'dock8-building-11',index:9022,rect:{x:5554,y:5018,w:508,h:554},kind:'storage'},
  {id:'dock8-cold-storage-b',buildingId:'dock8-building-11',index:9023,rect:{x:5554,y:5590,w:508,h:572},kind:'storage'},
];

function splitVerticalWall(x:number,y:number,h:number,openings:Array<{y:number;h:number}>,wall=18):MapRect[]{
  const sorted=[...openings].sort((a,b)=>a.y-b.y);const result:MapRect[]=[];let cursor=y;
  for(const opening of sorted){if(opening.y>cursor)result.push({x,y:cursor,w:wall,h:opening.y-cursor});cursor=Math.max(cursor,opening.y+opening.h);}
  if(cursor<y+h)result.push({x,y:cursor,w:wall,h:y+h-cursor});return result;
}

export const DOCK8_INTERIOR_WALLS:MapRect[]=[
  ...splitVerticalWall(5460,2268,1914,[{y:2490,h:126},{y:3000,h:96},{y:3710,h:130}]),
  ...splitVerticalWall(5640,2268,1914,[{y:2410,h:126},{y:2840,h:96},{y:3290,h:126},{y:3800,h:96}]),
  {x:5658,y:2698,w:624,h:18},{x:5658,y:3146,w:624,h:18},{x:5658,y:3594,w:624,h:18},
  ...splitVerticalWall(5230,638,1014,[{y:840,h:126},{y:1290,h:96}]),
  ...splitVerticalWall(5398,638,1014,[{y:790,h:126},{y:1260,h:126}]),
  {x:5416,y:1138,w:436,h:18},
  ...splitVerticalWall(5368,5018,1144,[{y:5240,h:126},{y:5810,h:96}]),
  ...splitVerticalWall(5536,5018,1144,[{y:5200,h:126},{y:5780,h:126}]),
  {x:5554,y:5572,w:508,h:18},
];

function portal(id:string,buildingId:string,kind:'door'|'window',a:number,b:number,opening:MapRect,approachA:MapPoint,approachB:MapPoint):SpacePortal{
  return{id,buildingId,kind,sideARoomIndex:a,sideBRoomIndex:b,opening,approachA,approachB,landingA:approachA,landingB:approachB,vaultable:kind==='window',allowsVision:true,allowsBullets:true};
}

export const DOCK8_INTERNAL_PORTALS:SpacePortal[]=[
  portal('dock8-logistics-main-door-a','dock8-building-9','door',9001,9002,{x:5460,y:2490,w:18,h:126},{x:5420,y:2553},{x:5500,y:2553}),
  portal('dock8-logistics-main-window','dock8-building-9','window',9001,9002,{x:5460,y:3000,w:18,h:96},{x:5412,y:3048},{x:5508,y:3048}),
  portal('dock8-logistics-main-door-b','dock8-building-9','door',9001,9002,{x:5460,y:3710,w:18,h:130},{x:5420,y:3775},{x:5500,y:3775}),
  portal('dock8-logistics-office-a-door','dock8-building-9','door',9002,9003,{x:5640,y:2410,w:18,h:126},{x:5600,y:2473},{x:5680,y:2473}),
  portal('dock8-logistics-office-b-window','dock8-building-9','window',9002,9004,{x:5640,y:2840,w:18,h:96},{x:5592,y:2888},{x:5688,y:2888}),
  portal('dock8-logistics-lounge-door','dock8-building-9','door',9002,9005,{x:5640,y:3290,w:18,h:126},{x:5600,y:3353},{x:5680,y:3353}),
  portal('dock8-logistics-storage-window','dock8-building-9','window',9002,9006,{x:5640,y:3800,w:18,h:96},{x:5592,y:3848},{x:5688,y:3848}),
  portal('dock8-admin-main-door','dock8-building-10','door',9010,9011,{x:5230,y:840,w:18,h:126},{x:5190,y:903},{x:5270,y:903}),
  portal('dock8-admin-main-window','dock8-building-10','window',9010,9011,{x:5230,y:1290,w:18,h:96},{x:5182,y:1338},{x:5278,y:1338}),
  portal('dock8-admin-office-door','dock8-building-10','door',9011,9012,{x:5398,y:790,w:18,h:126},{x:5358,y:853},{x:5438,y:853}),
  portal('dock8-admin-lounge-door','dock8-building-10','door',9011,9013,{x:5398,y:1260,w:18,h:126},{x:5358,y:1323},{x:5438,y:1323}),
  portal('dock8-cold-main-door','dock8-building-11','door',9020,9021,{x:5368,y:5240,w:18,h:126},{x:5328,y:5303},{x:5408,y:5303}),
  portal('dock8-cold-main-window','dock8-building-11','window',9020,9021,{x:5368,y:5810,w:18,h:96},{x:5320,y:5858},{x:5416,y:5858}),
  portal('dock8-cold-storage-a-door','dock8-building-11','door',9021,9022,{x:5536,y:5200,w:18,h:126},{x:5496,y:5263},{x:5576,y:5263}),
  portal('dock8-cold-storage-b-door','dock8-building-11','door',9021,9023,{x:5536,y:5780,w:18,h:126},{x:5496,y:5843},{x:5576,y:5843}),
];

export const DOCK8_RIVERS:RiverBand[]=[{
  id:'dock8-river',
  points:[{x:3500,y:-120},{x:3680,y:850},{x:3420,y:1740},{x:3760,y:2650},{x:3500,y:3550},{x:3820,y:4470},{x:3460,y:5400},{x:3710,y:6280},{x:3560,y:7288}],
  widths:[760,820,900,720,900,1040,850,720,780],
}];

export const DOCK8_CROSSINGS:LandCrossing[]=[
  {id:'dock8-foot-bridge-north',rect:{x:3020,y:1145,w:1260,h:110},kind:'foot_bridge',allowsPlayer:true,allowsMotorcycle:false,movementMultiplier:1},
  {id:'dock8-ford-north',rect:{x:3000,y:2260,w:1320,h:180},kind:'ford',allowsPlayer:true,allowsMotorcycle:false,movementMultiplier:.72},
  {id:'dock8-vehicle-bridge',rect:{x:2940,y:3375,w:1420,h:240},kind:'vehicle_bridge',allowsPlayer:true,allowsMotorcycle:true,movementMultiplier:1},
  {id:'dock8-ford-south',rect:{x:2940,y:4700,w:1500,h:190},kind:'ford',allowsPlayer:true,allowsMotorcycle:false,movementMultiplier:.72},
  {id:'dock8-service-bridge-south',rect:{x:3000,y:5885,w:1320,h:160},kind:'service_bridge',allowsPlayer:true,allowsMotorcycle:true,movementMultiplier:1},
];

export const DOCK8_SHALLOW_WATER:WaterZone[]=DOCK8_CROSSINGS.filter((crossing)=>crossing.kind==='ford').map((crossing)=>({id:`${crossing.id}-shallow`,...crossing.rect,movementMultiplier:crossing.movementMultiplier}));

function riverXAt(y:number){
  const points=DOCK8_RIVERS[0]!.points;
  for(let index=0;index<points.length-1;index++){
    const a=points[index]!,b=points[index+1]!;
    if(y<a.y||y>b.y)continue;const t=(y-a.y)/Math.max(1,b.y-a.y);return a.x+(b.x-a.x)*t;
  }
  return points.at(-1)!.x;
}

const shoreYs=[420,820,1540,1940,2820,3140,3970,4320,5160,5580,6460];
export const DOCK8_SHORE_EXITS:ShoreExit[]=shoreYs.flatMap((y,index)=>{
  const cx=riverXAt(y),width=DOCK8_RIVERS[0]!.widths[Math.min(DOCK8_RIVERS[0]!.widths.length-1,Math.floor(index*DOCK8_RIVERS[0]!.widths.length/shoreYs.length))]??820;
  const half=width/2;
  return[
    {id:`dock8-shore-west-${index+1}`,waterZoneId:'dock8-river',entry:{x:cx-half-90,y:y-70,w:180,h:140},landingPoint:{x:cx-half-105,y},normal:{x:-1,y:0}},
    {id:`dock8-shore-east-${index+1}`,waterZoneId:'dock8-river',entry:{x:cx+half-90,y:y-70,w:180,h:140},landingPoint:{x:cx+half+105,y},normal:{x:1,y:0}},
  ];
});

function prop(id:string,regionId:Dock8Region['id'],kind:string,x:number,y:number,w:number,h:number,collision:'solid'|'thin'|'none'='solid',rotation=0):Dock8WorldProp{
  return{id,regionId,kind,x,y,w,h,rotation,collision,blocksBullets:collision!=='none',blocksLoot:collision!=='none'};
}

export const DOCK8_WORLD_PROPS:Dock8WorldProp[]=[
  ...Array.from({length:12},(_,index)=>prop(`dock8-container-north-${index+1}`,'factory','container',360+(index%4)*570,980+Math.floor(index/4)*360,390,105)),
  ...Array.from({length:8},(_,index)=>prop(`dock8-container-mid-${index+1}`,'factory','container',420+(index%4)*560,2070+Math.floor(index/4)*250,370,100)),
  prop('dock8-repair-crate-a','warehouse','crate',420,4660,100,100),prop('dock8-repair-crate-b','warehouse','crate',2140,4740,120,110),
  prop('dock8-repair-forklift','warehouse','forklift',1840,5750,150,90),prop('dock8-river-pump','forestCamp','machine',2850,3720,190,110),
  prop('dock8-bridge-wreck-a','forestCamp','ambulance',3250,3435,165,82),prop('dock8-bridge-wreck-b','forestCamp','forklift',3880,3470,140,82),
  prop('dock8-admin-ambulance','hospital','ambulance',6040,1330,180,85),prop('dock8-logistics-crate-a','military','crate',4320,4350,110,110),
  prop('dock8-logistics-crate-b','military','crate',6400,4250,110,110),prop('dock8-cold-crate','residential','crate',6120,5480,120,120),
  prop('dock8-river-rock-w1','forestCamp','sandbag',2870,800,180,45,'solid'),prop('dock8-river-rock-e1','forestCamp','sandbag',4110,1840,190,45,'solid'),
  prop('dock8-river-rock-w2','forestCamp','sandbag',2770,5200,190,45,'solid'),prop('dock8-river-rock-e2','forestCamp','sandbag',4200,6320,180,45,'solid'),
  prop('dock8-foot-fence-a','forestCamp','fence',3020,1110,1260,20,'thin'),prop('dock8-foot-fence-b','forestCamp','fence',3020,1260,1260,20,'thin'),
];

export const DOCK8_DECORATIONS:Dock8Decoration[]=DOCK8_WORLD_PROPS.map(({collision:_collision,blocksBullets:_blocksBullets,blocksLoot:_blocksLoot,...decoration})=>decoration);

function gridAnchors(prefix:string,x:number,y:number,w:number,h:number,cols:number,rows:number,regionId:Dock8Region['id'],buildingId='',roomIndex=0):LootAnchor[]{
  const anchors:LootAnchor[]=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)anchors.push({id:`${prefix}-${row*cols+col+1}`,x:x+(col+.5)*w/cols,y:y+(row+.5)*h/rows,regionId,buildingId,roomIndex,category:'normal'});
  return anchors;
}

function categorized(anchors:LootAnchor[],pattern:NonNullable<LootAnchor['category']>[]=['normal','ammo','heal','normal','weapon','throwable']){
  return anchors.map((anchor,index)=>({...anchor,category:pattern[index%pattern.length]}));
}

function defaultRoomIndex(buildingNumber:number){
  if(buildingNumber<=8)return 10000+buildingNumber;
  if(buildingNumber>=12)return 9997+buildingNumber;
  return 0;
}

function buildingAnchors(buildingNumber:number,count:number){
  const building=DOCK8_BUILDINGS[buildingNumber-1]!;
  const cols=count>=6?3:count>=4?2:1,rows=Math.ceil(count/cols);
  const marginX=Math.min(92,Math.max(48,building.w*.16)),marginY=Math.min(88,Math.max(48,building.h*.18));
  return categorized(gridAnchors(`dock8-loot-building-${buildingNumber}`,building.x+marginX,building.y+marginY,Math.max(90,building.w-marginX*2),Math.max(90,building.h-marginY*2),cols,rows,building.regionId,`dock8-building-${buildingNumber}`,defaultRoomIndex(buildingNumber)).slice(0,count));
}

const logisticsAnchors=categorized([
  ...gridAnchors('dock8-loot-logistics-main',4630,2390,650,1650,4,3,'military','dock8-building-9',9001),
  ...gridAnchors('dock8-loot-logistics-corridor',5502,2390,112,1650,1,4,'military','dock8-building-9',9002),
  ...gridAnchors('dock8-loot-logistics-office-a',5740,2340,460,280,3,2,'military','dock8-building-9',9003).slice(0,5),
  ...gridAnchors('dock8-loot-logistics-office-b',5740,2790,460,280,3,2,'military','dock8-building-9',9004).slice(0,5),
  ...gridAnchors('dock8-loot-logistics-lounge',5740,3230,460,280,2,2,'military','dock8-building-9',9005),
  ...gridAnchors('dock8-loot-logistics-storage',5740,3700,460,360,4,2,'military','dock8-building-9',9006),
],['weapon','ammo','normal','heal','ammo','throwable']);
const adminAnchors=categorized([
  ...gridAnchors('dock8-loot-admin-main',4800,720,350,820,2,3,'hospital','dock8-building-10',9010),
  ...gridAnchors('dock8-loot-admin-corridor',5272,760,102,760,1,2,'hospital','dock8-building-10',9011),
  ...gridAnchors('dock8-loot-admin-office',5480,720,300,330,2,2,'hospital','dock8-building-10',9012),
  ...gridAnchors('dock8-loot-admin-lounge',5480,1230,300,300,2,2,'hospital','dock8-building-10',9013),
],['heal','ammo','normal','weapon','heal','throwable']);
const coldAnchors=categorized([
  ...gridAnchors('dock8-loot-cold-main',4770,5110,480,950,3,3,'residential','dock8-building-11',9020),
  ...gridAnchors('dock8-loot-cold-corridor',5410,5100,102,950,1,2,'residential','dock8-building-11',9021),
  ...gridAnchors('dock8-loot-cold-a',5620,5090,340,390,2,2,'residential','dock8-building-11',9022),
  ...gridAnchors('dock8-loot-cold-b',5620,5680,340,370,2,2,'residential','dock8-building-11',9023),
],['ammo','weapon','normal','heal','ammo','throwable']);
const secondaryBuildingAnchors=[
  ...buildingAnchors(1,4),...buildingAnchors(2,4),...buildingAnchors(3,3),...buildingAnchors(4,2),
  ...buildingAnchors(5,3),...buildingAnchors(6,6),...buildingAnchors(7,4),...buildingAnchors(8,2),
  ...buildingAnchors(12,2),...buildingAnchors(13,3),...buildingAnchors(14,3),...buildingAnchors(15,3),
  ...buildingAnchors(16,2),...buildingAnchors(17,2),...buildingAnchors(18,3),...buildingAnchors(19,3),...buildingAnchors(20,2),
];
const indoorAnchors=[...logisticsAnchors,...adminAnchors,...coldAnchors,...secondaryBuildingAnchors];
const outdoorGroups=[
  gridAnchors('dock8-loot-container-west',300,300,2350,2100,8,5,'factory'),
  gridAnchors('dock8-loot-repair-west',320,4420,2250,2120,7,4,'warehouse'),
  gridAnchors('dock8-loot-admin-east',4260,300,2400,1650,6,4,'hospital'),
  gridAnchors('dock8-loot-cold-east',4260,4650,2400,1900,6,4,'residential'),
  gridAnchors('dock8-loot-river-west',2300,260,280,6500,2,6,'forestCamp'),
  gridAnchors('dock8-loot-river-east',4380,260,280,6500,2,6,'forestCamp'),
];
const outdoorAnchors:LootAnchor[]=[];
for(let index=0;outdoorAnchors.length<140;index++)for(const group of outdoorGroups){const anchor=group[index];if(anchor)outdoorAnchors.push({...anchor,category:index%9===0?'weapon':index%7===0?'heal':index%5===0?'ammo':index%11===0?'throwable':'normal'});}

// 124 indoor candidates lead the list so the 216 active slots preserve a 57% indoor share.
export const DOCK8_LOOT_ANCHORS:LootAnchor[]=[...indoorAnchors,...outdoorAnchors].slice(0,264);

// Twelve fair candidates; the server selects eight with west/east/central guarantees per match.
export const DOCK8_MOTORCYCLE_SPAWNS=[
  {id:'bike-dock8-west-north-container',x:1040,y:2780,rotation:0},
  {id:'bike-dock8-west-guard',x:420,y:3780,rotation:Math.PI/2},
  {id:'bike-dock8-west-central-bridge',x:2760,y:3270,rotation:0},
  {id:'bike-dock8-west-repair-front',x:1080,y:4580,rotation:0},
  {id:'bike-dock8-west-repair-rear',x:2250,y:5940,rotation:-Math.PI/2},
  {id:'bike-dock8-west-south-service',x:2710,y:6120,rotation:0},
  {id:'bike-dock8-east-admin',x:6120,y:1880,rotation:Math.PI/2},
  {id:'bike-dock8-east-logistics-north',x:4880,y:2030,rotation:0},
  {id:'bike-dock8-east-central-bridge',x:4460,y:3260,rotation:Math.PI},
  {id:'bike-dock8-east-logistics-south',x:6500,y:4510,rotation:Math.PI},
  {id:'bike-dock8-east-cold',x:6410,y:5530,rotation:Math.PI/2},
  {id:'bike-dock8-east-south-service',x:4470,y:6210,rotation:Math.PI},
];

export const DOCK8_AI_MACRO_NODES:AiMacroNode[]=[
  {id:'dock8-west-north',x:1600,y:1500,kind:'region',roomIndex:0,side:'west'},
  {id:'dock8-west-south',x:1500,y:5450,kind:'region',roomIndex:0,side:'west'},
  {id:'dock8-east-north',x:5450,y:1250,kind:'region',roomIndex:0,side:'east'},
  {id:'dock8-east-center',x:5200,y:3300,kind:'region',roomIndex:0,side:'east'},
  {id:'dock8-east-south',x:5400,y:5550,kind:'region',roomIndex:0,side:'east'},
  ...DOCK8_CROSSINGS.flatMap((crossing)=>[
    {id:`${crossing.id}-west`,x:crossing.rect.x-80,y:crossing.rect.y+crossing.rect.h/2,kind:crossing.kind==='ford'?'ford':'bridge',roomIndex:0,side:'west'} as AiMacroNode,
    {id:`${crossing.id}-east`,x:crossing.rect.x+crossing.rect.w+80,y:crossing.rect.y+crossing.rect.h/2,kind:crossing.kind==='ford'?'ford':'bridge',roomIndex:0,side:'east'} as AiMacroNode,
  ]),
  ...DOCK8_SHORE_EXITS.filter((_,index)=>index%2===0).map((exit,index)=>({id:`dock8-swim-node-${index+1}`,x:exit.landingPoint.x,y:exit.landingPoint.y,kind:'shore_exit' as const,roomIndex:0,side:exit.normal.x<0?'west' as const:'east' as const})),
];

const crossingEdges:AiMacroEdge[]=DOCK8_CROSSINGS.map((crossing)=>({from:`${crossing.id}-west`,to:`${crossing.id}-east`,baseCost:crossing.rect.w/(crossing.movementMultiplier||1),movementMode:'land'}));
export const DOCK8_AI_MACRO_EDGES:AiMacroEdge[]=[
  ...crossingEdges,...crossingEdges.map((edge)=>({...edge,from:edge.to,to:edge.from})),
  {from:'dock8-west-north',to:'dock8-west-south',baseCost:4100,movementMode:'land'},
  {from:'dock8-west-south',to:'dock8-west-north',baseCost:4100,movementMode:'land'},
  {from:'dock8-east-north',to:'dock8-east-center',baseCost:2200,movementMode:'land'},
  {from:'dock8-east-center',to:'dock8-east-north',baseCost:2200,movementMode:'land'},
  {from:'dock8-east-center',to:'dock8-east-south',baseCost:2300,movementMode:'land'},
  {from:'dock8-east-south',to:'dock8-east-center',baseCost:2300,movementMode:'land'},
];

export const DOCK8_EMERGENCY_SPAWNS=[{x:260,y:260},{x:6908,y:260},{x:260,y:6908},{x:6908,y:6908},{x:1700,y:3500},{x:5500,y:3500}];
