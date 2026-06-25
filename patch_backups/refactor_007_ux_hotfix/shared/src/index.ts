export const GAME_NAME = 'DROP 8';
export const MAX_PLAYERS = 8;
export const SMALL_WORLD_SIZE = 4096;
export const LARGE_WORLD_SIZE = 6144;
export const WORLD_SIZE = SMALL_WORLD_SIZE;
export const SERVER_TICK_RATE = 30;
export const PATCH_RATE_MS = 50;
export const CHAT_RADIUS = 700;
export const PLAYER_BODY_RADIUS = 22;
export const PLAYER_HIT_RADIUS = 24;
export const PLAYER_SEPARATION_RADIUS = 24;
export const PLAYER_RADIUS = PLAYER_BODY_RADIUS;
export const PLAYER_SPEED = 260;
export const SNIPER_SCOPE_MOVE_MULTIPLIER = .6;
export const MOTORCYCLE_RADIUS = 30;
export const MOTORCYCLE_MOUNT_DISTANCE = 72;
export const MOTORCYCLE_MAX_SPEED = 650;
export const MOTORCYCLE_REVERSE_SPEED = 230;
export const MOTORCYCLE_ACCELERATION = 430;
export const MOTORCYCLE_BRAKE = 620;
export const MOTORCYCLE_DRAG = 210;
export const MOTORCYCLE_MAX_TURN_RATE = 2.25;
export const MOTORCYCLE_SCOPE_SPEED_RATIO = .15;
export const MOTORCYCLE_COLLISION_COOLDOWN = .85;
export const PLANE_DURATION = 24;
export const FALL_START_ALTITUDE = 1000;

export type GamePhase = 'LOBBY' | 'PLANE' | 'DROP' | 'ACTIVE' | 'FINISHED';
export type PlayerPhase = 'lobby' | 'plane' | 'falling' | 'parachute' | 'landed' | 'dead';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type ZoneSpeed = 'slow' | 'normal' | 'fast';
export type WeaponId = 'fists' | 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'sniper';
export type MeleeId = 'bat' | 'pan' | 'pipe' | 'knife';
export type EquippedId = WeaponId | MeleeId;
export type AmmoType = 'none' | 'shotgun_ammo' | 'standard_ammo' | 'pistol_ammo';
export type LootKind = WeaponId | MeleeId | 'shotgun_ammo' | 'standard_ammo' | 'pistol_ammo' | 'vest' | 'bandage' | 'medkit';
export type MapSizeMode = 'small' | 'large';
export type RegionId = 'factory' | 'residential' | 'hospital' | 'warehouse' | 'military' | 'forestCamp';

export interface WeaponData {
  id: WeaponId; name: string; damage: number; fireInterval: number; magazine: number;
  reloadSeconds: number; spread: number; projectileSpeed: number; range: number;
  pellets: number; moveMultiplier: number; ammoType: AmmoType; slot: 'melee' | 'secondary' | 'primary';
}

export interface MeleeData {
  id: MeleeId; name: string; damage: number; fireInterval: number; range: number; arc: number; moveMultiplier: number;
}

export const WEAPONS: Record<WeaponId, WeaponData> = {
  fists: { id:'fists', name:'주먹', damage:10, fireInterval:.55, magazine:0, reloadSeconds:0, spread:0, projectileSpeed:0, range:65, pellets:1, moveMultiplier:1, ammoType:'none', slot:'melee' },
  pistol:{ id:'pistol', name:'권총', damage:18, fireInterval:.28, magazine:12, reloadSeconds:1.35, spread:.025, projectileSpeed:1050, range:850, pellets:1, moveMultiplier:1, ammoType:'pistol_ammo', slot:'secondary' },
  smg:{ id:'smg', name:'기관단총', damage:11, fireInterval:.085, magazine:30, reloadSeconds:1.55, spread:.08, projectileSpeed:1120, range:760, pellets:1, moveMultiplier:1.05, ammoType:'standard_ammo', slot:'primary' },
  rifle:{ id:'rifle', name:'돌격소총', damage:17, fireInterval:.13, magazine:24, reloadSeconds:1.7, spread:.038, projectileSpeed:1320, range:1050, pellets:1, moveMultiplier:.98, ammoType:'standard_ammo', slot:'primary' },
  shotgun:{ id:'shotgun', name:'샷건', damage:10, fireInterval:.72, magazine:5, reloadSeconds:2.0, spread:.24, projectileSpeed:860, range:440, pellets:7, moveMultiplier:.96, ammoType:'shotgun_ammo', slot:'primary' },
  sniper:{ id:'sniper', name:'저격소총', damage:72, fireInterval:1.2, magazine:4, reloadSeconds:2.8, spread:.006, projectileSpeed:2900, range:2300, pellets:1, moveMultiplier:.84, ammoType:'standard_ammo', slot:'primary' }
};

export const MELEE_WEAPONS: Record<MeleeId, MeleeData> = {
  bat:{id:'bat',name:'야구방망이',damage:24,fireInterval:.72,range:88,arc:1.15,moveMultiplier:1},
  pan:{id:'pan',name:'프라이팬',damage:29,fireInterval:.88,range:72,arc:1.05,moveMultiplier:.97},
  pipe:{id:'pipe',name:'쇠파이프',damage:22,fireInterval:.66,range:82,arc:1.1,moveMultiplier:.99},
  knife:{id:'knife',name:'식칼',damage:17,fireInterval:.38,range:60,arc:.95,moveMultiplier:1.04}
};

export const LOOT_LABELS: Record<LootKind,string> = {
  fists:'주먹', pistol:'권총', smg:'기관단총', rifle:'돌격소총', shotgun:'샷건', sniper:'저격소총',
  bat:'야구방망이', pan:'프라이팬', pipe:'쇠파이프', knife:'식칼',
  pistol_ammo:'권총탄', standard_ammo:'일반 총알', shotgun_ammo:'샷건탄', vest:'방탄조끼', bandage:'붕대', medkit:'구급상자'
};

export const LOOT_COLORS: Record<LootKind,number> = {
  fists:0xf6f7f8, pistol:0xffd451, smg:0xffb84d, rifle:0xff8f4d, shotgun:0xff6b55, sniper:0x88d7ff,
  bat:0xc98b55, pan:0xaeb9c2, pipe:0x8da0ad, knife:0xdde7ee,
  pistol_ammo:0xffe88a, standard_ammo:0xff9f64, shotgun_ammo:0xff6f7a, vest:0x73b9ff, bandage:0x58e49d, medkit:0x2ecf78
};

export interface Rect { x:number; y:number; w:number; h:number; }
export interface Region { id:RegionId; name:string; x:number; y:number; w:number; h:number; color:number; }
export interface WeightedLoot { kind:LootKind; weight:number; }
export type DoorSide = 'north'|'south'|'east'|'west';
export interface Building extends Rect { doorSide:DoorSide; doorOffset:number; doorWidth:number; regionId:RegionId; }
export interface DoorVisibilityZone { id:string; buildingId:string; x:number; y:number; width:number; height:number; insideRevealDistance:number; outsideRevealDistance:number; }
export interface BuildingVisibilityZone { id:string; regionId:RegionId; buildingIndex:number; interior:Rect; roof:Rect; doors:DoorVisibilityZone[]; }
export type DecorKind = 'machine'|'tank'|'container'|'yard'|'fence'|'medicalCross'|'bed'|'ambulance'|'crate'|'forklift'|'sandbag'|'helipad'|'tent'|'campfire'|'log'|'tree';
export interface RegionTheme { ground:number; groundAccent:number; wall:number; roof:number; accent:number; trait:string; }
export interface Decoration { id:string; regionId:RegionId; kind:DecorKind; x:number; y:number; w:number; h:number; rotation?:number; }
export interface Bush { id:string; regionId:RegionId; x:number; y:number; radius:number; density:number; }
export type WorldPropCollision='solid'|'thin'|'none';
export interface WorldProp extends Decoration { collision:WorldPropCollision; blocksBullets:boolean; blocksLoot:boolean; }
export interface PlaneRoute { startX:number; startY:number; endX:number; endY:number; angle:number; }
export interface ZoneTarget { x:number; y:number; radius:number; }
export interface ProjectileConfig extends WeaponData { lifetimeMs:number; radius:number; knockback:number; canPenetratePlayers:boolean; canPenetrateProps:boolean; }
export interface MotorcycleSpawn { id:string; x:number; y:number; rotation:number; }
export interface MapConfig {
  id:string; mode:MapSizeMode; displayName:string; width:number; height:number; recommendedPlayers:{min:number;max:number}; maxPlayers:number;
  initialZoneRadius:number; zoneWaitScale:number; zoneShrinkScale:number; planeSpeed:number; planeMargin:number; lootBudget:number; aiCountDefault:number; minimapScale:number;
  regions:Region[]; buildings:Building[]; buildingVisibilityZones:BuildingVisibilityZone[]; decorations:Decoration[]; worldProps:WorldProp[]; obstacles:Rect[]; propObstacles:Rect[]; collisionObstacles:Rect[]; bulletObstacles:Rect[]; bushes:Bush[]; lootSpawns:Array<{x:number;y:number;region:string;regionId:RegionId}>; motorcycleSpawns:MotorcycleSpawn[]; emergencySpawnPoints:Array<{x:number;y:number}>;
}

export const AMMO_DISPLAY_NAMES:Record<Exclude<AmmoType,'none'>,string>={shotgun_ammo:'샷건탄',standard_ammo:'일반 총알',pistol_ammo:'권총탄'};
export const RENDER_DEPTH={GROUND:0,FLOOR_DECORATION:5,GROUND_ITEM:10,WORLD_PROP:20,VEHICLE:27,PLAYER:30,PLAYER_OVERLAY:35,BUILDING_ROOF:50,PLANE_SHADOW:80,TRANSPORT_PLANE:100,PLANE_EFFECT:105,WORLD_EFFECT:120,HUD:1000,MODAL:2000} as const;


export const REGIONS: Region[] = [
  { id:'factory', name:'폐공장', x:220, y:260, w:980, h:800, color:0x5f6b73 },
  { id:'residential', name:'주택가', x:1510, y:240, w:980, h:900, color:0x85755f },
  { id:'hospital', name:'병원', x:2890, y:300, w:760, h:720, color:0x668a8f },
  { id:'warehouse', name:'창고지대', x:240, y:2520, w:1020, h:900, color:0x8a6b55 },
  { id:'military', name:'군사시설', x:1600, y:2650, w:930, h:900, color:0x5d6d57 },
  { id:'forestCamp', name:'숲속 캠프', x:2920, y:2500, w:820, h:980, color:0x3f704d }
];

export const REGION_THEMES:Record<RegionId,RegionTheme> = {
  factory:{ground:0x4d565c,groundAccent:0x89939a,wall:0x3e474d,roof:0x566168,accent:0xf3a64b,trait:'중거리 총기와 탄약이 많은 공업 지대'},
  residential:{ground:0x716653,groundAccent:0xa58f70,wall:0x68594b,roof:0x8d6a54,accent:0xf0d39a,trait:'권총·붕대 중심의 균형 잡힌 주거 지역'},
  hospital:{ground:0x5f8589,groundAccent:0xb7e0df,wall:0x3f666b,roof:0xd8efed,accent:0xff5b66,trait:'붕대와 구급상자가 집중되는 의료 지역'},
  warehouse:{ground:0x765d4b,groundAccent:0xb98a62,wall:0x59483c,roof:0x7f6652,accent:0xffba62,trait:'샷건·산탄과 근접 장비가 많은 창고 지역'},
  military:{ground:0x52614d,groundAccent:0x87967d,wall:0x39483a,roof:0x5e6e59,accent:0xd2c36f,trait:'돌격소총과 방탄 장비가 나오는 고위험 지역'},
  forestCamp:{ground:0x356441,groundAccent:0x6f9d63,wall:0x5b4937,roof:0x7c5e3f,accent:0xffc45e,trait:'부쉬 은폐와 근접 파밍에 유리한 숲 지역'},
};

export const BUSH_HIDE_DISTANCE=150;
export const BUSH_FIRE_REVEAL_SECONDS=1.25;
export const BUSH_HIT_REVEAL_SECONDS=.8;

export const REGION_LOOT_TABLES: Record<RegionId, WeightedLoot[]> = {
  factory:[
    {kind:'smg',weight:16},{kind:'rifle',weight:13},{kind:'sniper',weight:3},{kind:'pistol_ammo',weight:17},{kind:'standard_ammo',weight:17},{kind:'pipe',weight:12},
    {kind:'pistol',weight:8},{kind:'vest',weight:7},{kind:'bandage',weight:6},{kind:'medkit',weight:1},{kind:'shotgun',weight:1},
  ],
  residential:[
    {kind:'pistol',weight:19},{kind:'bandage',weight:18},{kind:'pistol_ammo',weight:18},{kind:'bat',weight:12},
    {kind:'vest',weight:10},{kind:'smg',weight:8},{kind:'medkit',weight:7},{kind:'rifle',weight:4},{kind:'shotgun',weight:4},
  ],
  hospital:[
    {kind:'bandage',weight:27},{kind:'medkit',weight:21},{kind:'vest',weight:18},{kind:'pistol',weight:12},{kind:'pistol_ammo',weight:12},
    {kind:'smg',weight:7},{kind:'rifle',weight:2},{kind:'shotgun',weight:1},
  ],
  warehouse:[
    {kind:'shotgun',weight:20},{kind:'shotgun_ammo',weight:22},{kind:'smg',weight:15},{kind:'pan',weight:12},
    {kind:'vest',weight:10},{kind:'pistol_ammo',weight:9},{kind:'bandage',weight:7},{kind:'rifle',weight:3},{kind:'medkit',weight:2},
  ],
  military:[
    {kind:'rifle',weight:20},{kind:'sniper',weight:7},{kind:'standard_ammo',weight:24},{kind:'vest',weight:18},{kind:'smg',weight:12},{kind:'medkit',weight:9},
    {kind:'pistol_ammo',weight:7},{kind:'shotgun',weight:3},{kind:'pistol',weight:3},
  ],
  forestCamp:[
    {kind:'pistol',weight:16},{kind:'shotgun',weight:14},{kind:'bandage',weight:18},{kind:'knife',weight:12},{kind:'bat',weight:11},
    {kind:'shotgun_ammo',weight:9},{kind:'pistol_ammo',weight:9},{kind:'medkit',weight:6},{kind:'rifle',weight:3},{kind:'vest',weight:2},
  ],
};

export const LOOT_MIN_DISTANCE=58;
export const GUN_LOOT_MIN_DISTANCE=72;
export const LOOT_DOOR_CLEARANCE=65;
export const LOOT_WALL_CLEARANCE=28;

export function createSeededRandom(seed:number):()=>number {
  let state=(seed>>>0)||0x6d2b79f5;
  return ()=>{
    state=(state+0x6d2b79f5)>>>0;
    let value=state;
    value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
}

export function weightedLootChoice(table:readonly WeightedLoot[],random:()=>number=Math.random):LootKind {
  const total=table.reduce((sum,item)=>sum+Math.max(0,item.weight),0);
  if(total<=0)return 'bandage';
  let roll=random()*total;
  for(const item of table){roll-=Math.max(0,item.weight);if(roll<=0)return item.kind;}
  return table[table.length-1]?.kind??'bandage';
}

export function regionAt(x:number,y:number,regions:readonly Region[]=REGIONS):Region|undefined {
  return regions.find((region)=>x>=region.x&&x<=region.x+region.w&&y>=region.y&&y<=region.y+region.h);
}

export const BUILDING_WALL=18;

const RAW_BUILDINGS: Rect[] = [
  {x:300,y:350,w:320,h:120},{x:720,y:380,w:340,h:100},{x:360,y:700,w:160,h:260},{x:760,y:690,w:290,h:190},
  {x:1600,y:360,w:260,h:210},{x:1980,y:350,w:330,h:170},{x:1600,y:760,w:220,h:250},{x:2040,y:730,w:310,h:210},
  {x:3010,y:420,w:520,h:180},{x:3100,y:730,w:180,h:230},{x:3390,y:720,w:180,h:230},
  {x:330,y:2640,w:360,h:170},{x:780,y:2650,w:350,h:170},{x:400,y:3010,w:240,h:220},{x:810,y:3010,w:260,h:210},
  {x:1690,y:2760,w:370,h:190},{x:2140,y:2760,w:280,h:190},{x:1710,y:3150,w:220,h:250},{x:2100,y:3150,w:300,h:220},
  {x:3020,y:2660,w:170,h:170},{x:3350,y:2740,w:160,h:160},{x:3140,y:3100,w:170,h:170},{x:3500,y:3220,w:150,h:150},
  {x:1350,y:1550,w:360,h:180},{x:2320,y:1450,w:190,h:390},{x:1750,y:1900,w:450,h:190}
];

const DOOR_SIDES:DoorSide[]=['south','east','north','west'];
export const BUILDINGS:Building[] = RAW_BUILDINGS.map((r,i)=>({
  ...r,
  regionId:regionAt(r.x+r.w/2,r.y+r.h/2)?.id??'residential',
  doorSide:DOOR_SIDES[i%DOOR_SIDES.length]!,
  doorOffset:.5,
  doorWidth:Math.max(92,Math.min(128,(i%2===0?r.w:r.h)*.4))
}));

export function buildingDoorCenter(building:Building):{x:number;y:number}{
  if(building.doorSide==='north'||building.doorSide==='south')return{x:building.x+building.w*building.doorOffset,y:building.doorSide==='north'?building.y:building.y+building.h};
  return{x:building.doorSide==='west'?building.x:building.x+building.w,y:building.y+building.h*building.doorOffset};
}

export function createBuildingVisibilityZones(buildings:readonly Building[],prefix='small'):BuildingVisibilityZone[]{return buildings.map((building,index)=>{
  const id=`${prefix}-building-${index+1}`;
  const center=buildingDoorCenter(building);
  const horizontal=building.doorSide==='north'||building.doorSide==='south';
  return{
    id,regionId:building.regionId,buildingIndex:index,
    interior:{x:building.x+BUILDING_WALL,y:building.y+BUILDING_WALL,w:Math.max(1,building.w-BUILDING_WALL*2),h:Math.max(1,building.h-BUILDING_WALL*2)},
    roof:{x:building.x+BUILDING_WALL,y:building.y+BUILDING_WALL,w:Math.max(1,building.w-BUILDING_WALL*2),h:Math.max(1,building.h-BUILDING_WALL*2)},
    doors:[{id:`${id}-door`,buildingId:id,x:center.x-(horizontal?building.doorWidth/2:BUILDING_WALL),y:center.y-(horizontal?BUILDING_WALL:building.doorWidth/2),width:horizontal?building.doorWidth:BUILDING_WALL*2,height:horizontal?BUILDING_WALL*2:building.doorWidth,insideRevealDistance:105,outsideRevealDistance:105}],
  };
});}

export const BUILDING_VISIBILITY_ZONES:BuildingVisibilityZone[]=createBuildingVisibilityZones(BUILDINGS,'small');
let ALL_BUILDING_VISIBILITY_ZONES:BuildingVisibilityZone[]=BUILDING_VISIBILITY_ZONES;
export function buildingZoneById(id:string,zones:readonly BuildingVisibilityZone[]=ALL_BUILDING_VISIBILITY_ZONES):BuildingVisibilityZone|undefined{return zones.find((zone)=>zone.id===id);}
export function buildingIdAt(x:number,y:number,inset=0,zones:readonly BuildingVisibilityZone[]=BUILDING_VISIBILITY_ZONES):string{
  const zone=zones.find((item)=>x>=item.interior.x+inset&&x<=item.interior.x+item.interior.w-inset&&y>=item.interior.y+inset&&y<=item.interior.y+item.interior.h-inset);
  return zone?.id??'';
}
export function buildingSpacesVisible(a:{x:number;y:number;buildingId?:string},b:{x:number;y:number;buildingId?:string}):boolean{
  const aId=a.buildingId??'',bId=b.buildingId??'';
  if(aId===bId)return true;
  if(aId&&bId)return false;
  const indoor=aId?a:b;
  const outdoor=aId?b:a;
  const zone=buildingZoneById(indoor.buildingId??'');
  if(!zone)return false;
  return zone.doors.some((door)=>distance(indoor.x,indoor.y,door.x+door.width/2,door.y+door.height/2)<=door.insideRevealDistance&&distance(outdoor.x,outdoor.y,door.x+door.width/2,door.y+door.height/2)<=door.outsideRevealDistance);
}

const WALL=BUILDING_WALL;
export function wallsForBuilding(b:Building):Rect[]{
  const walls:Rect[]=[];
  const addHorizontal=(y:number,door:boolean)=>{
    if(!door){walls.push({x:b.x,y,w:b.w,h:WALL});return;}
    const center=b.x+b.w*b.doorOffset,half=b.doorWidth/2;
    const left=Math.max(0,center-half-b.x),rightStart=center+half;
    if(left>0)walls.push({x:b.x,y,w:left,h:WALL});
    if(rightStart<b.x+b.w)walls.push({x:rightStart,y,w:b.x+b.w-rightStart,h:WALL});
  };
  const addVertical=(x:number,door:boolean)=>{
    if(!door){walls.push({x,y:b.y,w:WALL,h:b.h});return;}
    const center=b.y+b.h*b.doorOffset,half=b.doorWidth/2;
    const top=Math.max(0,center-half-b.y),bottomStart=center+half;
    if(top>0)walls.push({x,y:b.y,w:WALL,h:top});
    if(bottomStart<b.y+b.h)walls.push({x,y:bottomStart,w:WALL,h:b.y+b.h-bottomStart});
  };
  addHorizontal(b.y,b.doorSide==='north');
  addHorizontal(b.y+b.h-WALL,b.doorSide==='south');
  addVertical(b.x,b.doorSide==='west');
  addVertical(b.x+b.w-WALL,b.doorSide==='east');
  return walls;
}

export const OBSTACLES:Rect[] = BUILDINGS.flatMap(wallsForBuilding);


export const DECORATIONS:Decoration[] = [
  {id:'factory-machine-1',regionId:'factory',kind:'machine',x:420,y:560,w:110,h:54},
  {id:'factory-machine-2',regionId:'factory',kind:'machine',x:850,y:555,w:125,h:58},
  {id:'factory-tank-1',regionId:'factory',kind:'tank',x:1110,y:820,w:54,h:76},
  {id:'factory-container-1',regionId:'factory',kind:'container',x:250,y:985,w:150,h:55},
  {id:'factory-container-2',regionId:'factory',kind:'container',x:940,y:980,w:170,h:55},
  {id:'res-yard-1',regionId:'residential',kind:'yard',x:1880,y:600,w:105,h:80},
  {id:'res-yard-2',regionId:'residential',kind:'yard',x:2260,y:1010,w:105,h:80},
  {id:'res-fence-1',regionId:'residential',kind:'fence',x:1500,y:665,w:210,h:18},
  {id:'res-fence-2',regionId:'residential',kind:'fence',x:2050,y:650,w:250,h:18},
  {id:'res-fence-3',regionId:'residential',kind:'fence',x:1810,y:1090,w:190,h:18},
  {id:'hospital-cross-1',regionId:'hospital',kind:'medicalCross',x:3210,y:510,w:54,h:54},
  {id:'hospital-cross-2',regionId:'hospital',kind:'medicalCross',x:3460,y:835,w:48,h:48},
  {id:'hospital-bed-1',regionId:'hospital',kind:'bed',x:3140,y:805,w:72,h:32},
  {id:'hospital-bed-2',regionId:'hospital',kind:'bed',x:3410,y:805,w:72,h:32},
  {id:'hospital-ambulance',regionId:'hospital',kind:'ambulance',x:2925,y:930,w:120,h:58},
  {id:'warehouse-crate-1',regionId:'warehouse',kind:'crate',x:700,y:2910,w:62,h:62},
  {id:'warehouse-crate-2',regionId:'warehouse',kind:'crate',x:740,y:2982,w:62,h:62},
  {id:'warehouse-crate-3',regionId:'warehouse',kind:'crate',x:1100,y:3180,w:70,h:70},
  {id:'warehouse-forklift',regionId:'warehouse',kind:'forklift',x:260,y:3300,w:98,h:54},
  {id:'warehouse-container',regionId:'warehouse',kind:'container',x:1060,y:2550,w:160,h:52},
  {id:'military-sandbag-1',regionId:'military',kind:'sandbag',x:1605,y:3000,w:155,h:32},
  {id:'military-sandbag-2',regionId:'military',kind:'sandbag',x:2370,y:3040,w:150,h:32},
  {id:'military-sandbag-3',regionId:'military',kind:'sandbag',x:1965,y:3490,w:170,h:32},
  {id:'military-helipad',regionId:'military',kind:'helipad',x:2440,y:3420,w:110,h:110},
  {id:'forest-tent-1',regionId:'forestCamp',kind:'tent',x:2925,y:2920,w:86,h:68},
  {id:'forest-tent-2',regionId:'forestCamp',kind:'tent',x:3650,y:2890,w:86,h:68},
  {id:'forest-campfire',regionId:'forestCamp',kind:'campfire',x:3310,y:2970,w:50,h:50},
  {id:'forest-log-1',regionId:'forestCamp',kind:'log',x:2990,y:3400,w:105,h:28,rotation:.18},
  {id:'forest-log-2',regionId:'forestCamp',kind:'log',x:3500,y:3500,w:105,h:28,rotation:-.2},
  {id:'forest-tree-1',regionId:'forestCamp',kind:'tree',x:2950,y:2580,w:62,h:62},
  {id:'forest-tree-2',regionId:'forestCamp',kind:'tree',x:3710,y:2670,w:62,h:62},
  {id:'forest-tree-3',regionId:'forestCamp',kind:'tree',x:3260,y:3460,w:62,h:62},
];

const SOLID_PROP_KINDS=new Set<DecorKind>(['machine','tank','container','bed','ambulance','crate','forklift','sandbag','tent','log','tree']);
const THIN_PROP_KINDS=new Set<DecorKind>(['fence']);
export const WORLD_PROPS:WorldProp[]=DECORATIONS.map((decoration)=>{
  const collision:WorldPropCollision=THIN_PROP_KINDS.has(decoration.kind)?'thin':SOLID_PROP_KINDS.has(decoration.kind)?'solid':'none';
  return {...decoration,collision,blocksBullets:collision!=='none',blocksLoot:collision!=='none'};
});

export const PROP_OBSTACLES:Rect[]=WORLD_PROPS.filter((prop)=>prop.collision!=='none').map((prop)=>({x:prop.x,y:prop.y,w:prop.w,h:prop.h}));
export const COLLISION_OBSTACLES:Rect[]=[...OBSTACLES,...PROP_OBSTACLES];
export const BULLET_OBSTACLES:Rect[]=COLLISION_OBSTACLES;

export function createPlaneRoute(random:()=>number=Math.random,worldSize=WORLD_SIZE,margin=280):PlaneRoute{
  const directions=[
    {x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},
    {x:Math.SQRT1_2,y:Math.SQRT1_2},{x:Math.SQRT1_2,y:-Math.SQRT1_2},
    {x:-Math.SQRT1_2,y:Math.SQRT1_2},{x:-Math.SQRT1_2,y:-Math.SQRT1_2},
  ];
  const direction=directions[Math.floor(random()*directions.length)]??directions[0]!;
  const perpendicular={x:-direction.y,y:direction.x};
  const offset=(random()-.5)*worldSize*.34;
  const center={x:worldSize/2+perpendicular.x*offset,y:worldSize/2+perpendicular.y*offset};
  const min=-margin,max=worldSize+margin;
  const distanceToEdge=(dx:number,dy:number)=>{
    const tx=dx>0?(max-center.x)/dx:dx<0?(min-center.x)/dx:Number.POSITIVE_INFINITY;
    const ty=dy>0?(max-center.y)/dy:dy<0?(min-center.y)/dy:Number.POSITIVE_INFINITY;
    return Math.min(tx>0?tx:Number.POSITIVE_INFINITY,ty>0?ty:Number.POSITIVE_INFINITY);
  };
  const forward=distanceToEdge(direction.x,direction.y);
  const backward=distanceToEdge(-direction.x,-direction.y);
  const startX=center.x-direction.x*backward;
  const startY=center.y-direction.y*backward;
  const endX=center.x+direction.x*forward;
  const endY=center.y+direction.y*forward;
  return {startX,startY,endX,endY,angle:Math.atan2(endY-startY,endX-startX)};
}

export function createNextZone(
  random:()=>number,
  currentX:number,currentY:number,currentRadius:number,nextRadius:number,stage:number,
  safetyMargin=28,worldSize=WORLD_SIZE,
):ZoneTarget{
  const factors=[.3,.5,.7,.85,1,1];
  const factor=factors[Math.max(0,Math.min(factors.length-1,stage))]??1;
  const maxDistance=Math.max(0,currentRadius-nextRadius-safetyMargin)*factor;
  for(let attempt=0;attempt<32;attempt++){
    const angle=random()*Math.PI*2;
    const minDistance=maxDistance>40?maxDistance*.18:0;
    const travel=minDistance+(maxDistance-minDistance)*Math.sqrt(random());
    const x=currentX+Math.cos(angle)*travel;
    const y=currentY+Math.sin(angle)*travel;
    if(x-nextRadius<0||x+nextRadius>worldSize||y-nextRadius<0||y+nextRadius>worldSize)continue;
    return {x,y,radius:nextRadius};
  }
  return {x:clamp(currentX,nextRadius,worldSize-nextRadius),y:clamp(currentY,nextRadius,worldSize-nextRadius),radius:nextRadius};
}


function createBushes():Bush[]{
  const random=createSeededRandom(0x004b2026);
  const plans:Array<[RegionId,number]>=[['factory',3],['residential',5],['hospital',2],['warehouse',3],['military',5],['forestCamp',30]];
  const bushes:Bush[]=[];
  for(const [regionId,count] of plans){
    const region=REGIONS.find((item)=>item.id===regionId)!;
    let placed=0;
    for(let attempt=0;attempt<count*60&&placed<count;attempt++){
      const radius=regionId==='forestCamp'?36+random()*18:32+random()*13;
      const x=region.x+55+random()*Math.max(1,region.w-110);
      const y=region.y+55+random()*Math.max(1,region.h-110);
      if(COLLISION_OBSTACLES.some((rect)=>circleHitsRect(x,y,radius+10,rect)))continue;
      if(BUILDINGS.some((building)=>distance(x,y,buildingDoorCenter(building).x,buildingDoorCenter(building).y)<radius+82))continue;
      if(bushes.some((bush)=>distance(x,y,bush.x,bush.y)<radius+bush.radius+22))continue;
      bushes.push({id:`bush-${regionId}-${placed+1}`,regionId,x:Math.round(x),y:Math.round(y),radius:Math.round(radius),density:.72+random()*.24});
      placed++;
    }
  }
  return bushes;
}

export const BUSHES:Bush[]=createBushes();
export function bushContaining(x:number,y:number,padding=0):Bush|undefined{return BUSHES.find((bush)=>distance(x,y,bush.x,bush.y)<=Math.max(1,bush.radius-padding));}

export const LOOT_SPAWNS = Array.from({length: 76}, (_,i) => {
  const r = REGIONS[i % REGIONS.length]!;
  const col = i % 6, row = Math.floor(i / 6) % 5;
  return { x: r.x + 90 + col * Math.max(95, (r.w-180)/6), y: r.y + 100 + row * Math.max(105, (r.h-200)/5), region: r.name, regionId:r.id };
});


const LARGE_SCALE=1.5;
function scaleRegion(region:Region):Region{return{...region,x:Math.round(region.x*LARGE_SCALE),y:Math.round(region.y*LARGE_SCALE),w:Math.round(region.w*LARGE_SCALE),h:Math.round(region.h*LARGE_SCALE)};}
function scaleBuilding(building:Building):Building{return{...building,x:Math.round(building.x*LARGE_SCALE),y:Math.round(building.y*LARGE_SCALE),w:Math.round(building.w*LARGE_SCALE),h:Math.round(building.h*LARGE_SCALE),doorWidth:Math.round(building.doorWidth*1.18)};}
function scaleDecoration(item:Decoration):Decoration{return{...item,id:`large-${item.id}`,x:Math.round(item.x*LARGE_SCALE),y:Math.round(item.y*LARGE_SCALE),w:Math.round(item.w*1.2),h:Math.round(item.h*1.2)};}
export const LARGE_REGIONS:Region[]=REGIONS.map(scaleRegion);
const LARGE_EXTRA_BUILDINGS:Building[]=[
  {x:4200,y:1700,w:920,h:560,doorSide:'south',doorOffset:.28,doorWidth:170,regionId:'hospital'},
  {x:650,y:1800,w:1050,h:640,doorSide:'east',doorOffset:.56,doorWidth:180,regionId:'factory'},
  {x:2450,y:3900,w:1120,h:620,doorSide:'north',doorOffset:.46,doorWidth:190,regionId:'warehouse'},
  {x:4200,y:4100,w:900,h:700,doorSide:'west',doorOffset:.48,doorWidth:180,regionId:'military'},
];
export const LARGE_BUILDINGS:Building[]=[...BUILDINGS.map(scaleBuilding),...LARGE_EXTRA_BUILDINGS];
export const LARGE_BUILDING_VISIBILITY_ZONES=createBuildingVisibilityZones(LARGE_BUILDINGS,'large');
export const LARGE_INTERIOR_WALLS:Rect[]=LARGE_EXTRA_BUILDINGS.flatMap((building)=>{
  const wall=BUILDING_WALL;
  const centerX=building.x+building.w/2-wall/2;
  const gapHalf=Math.max(78,building.doorWidth*.48);
  const top=building.y+wall+46;
  const bottom=building.y+building.h-wall-46;
  const centerY=building.y+building.h/2;
  return [
    {x:centerX,y:top,w:wall,h:Math.max(20,centerY-gapHalf-top)},
    {x:centerX,y:centerY+gapHalf,w:wall,h:Math.max(20,bottom-(centerY+gapHalf))},
  ];
});
export const LARGE_OBSTACLES:Rect[]=[...LARGE_BUILDINGS.flatMap(wallsForBuilding),...LARGE_INTERIOR_WALLS];
export const LARGE_DECORATIONS:Decoration[]=[...DECORATIONS.map(scaleDecoration),
  {id:'large-hospital-courtyard',regionId:'hospital',kind:'bed',x:4460,y:2030,w:130,h:46},
  {id:'large-factory-machine-a',regionId:'factory',kind:'machine',x:980,y:2100,w:180,h:72},
  {id:'large-logistics-containers',regionId:'warehouse',kind:'container',x:2750,y:4300,w:220,h:70},
  {id:'large-military-sandbag',regionId:'military',kind:'sandbag',x:4100,y:4720,w:260,h:42},
];
export const LARGE_WORLD_PROPS:WorldProp[]=LARGE_DECORATIONS.map((decoration)=>{const collision:WorldPropCollision=THIN_PROP_KINDS.has(decoration.kind)?'thin':SOLID_PROP_KINDS.has(decoration.kind)?'solid':'none';return{...decoration,collision,blocksBullets:collision!=='none',blocksLoot:collision!=='none'};});
export const LARGE_PROP_OBSTACLES:Rect[]=LARGE_WORLD_PROPS.filter((prop)=>prop.collision!=='none').map((prop)=>({x:prop.x,y:prop.y,w:prop.w,h:prop.h}));
export const LARGE_COLLISION_OBSTACLES:Rect[]=[...LARGE_OBSTACLES,...LARGE_PROP_OBSTACLES];
export const LARGE_BULLET_OBSTACLES:Rect[]=LARGE_COLLISION_OBSTACLES;
function makeBushesForMap(regions:readonly Region[],buildings:readonly Building[],obstacles:readonly Rect[],seed:number,large=false):Bush[]{
  const random=createSeededRandom(seed);const plans:Array<[RegionId,number]>=[['factory',large?6:3],['residential',large?9:5],['hospital',large?5:2],['warehouse',large?6:3],['military',large?9:5],['forestCamp',large?48:30]];const bushes:Bush[]=[];
  for(const [regionId,count] of plans){const region=regions.find((item)=>item.id===regionId)!;let placed=0;for(let attempt=0;attempt<count*80&&placed<count;attempt++){const radius=regionId==='forestCamp'?36+random()*20:32+random()*14;const x=region.x+55+random()*Math.max(1,region.w-110);const y=region.y+55+random()*Math.max(1,region.h-110);if(obstacles.some((rect)=>circleHitsRect(x,y,radius+10,rect)))continue;if(buildings.some((building)=>distance(x,y,buildingDoorCenter(building).x,buildingDoorCenter(building).y)<radius+82))continue;if(bushes.some((bush)=>distance(x,y,bush.x,bush.y)<radius+bush.radius+22))continue;bushes.push({id:`${large?'large':'small'}-bush-${regionId}-${placed+1}`,regionId,x:Math.round(x),y:Math.round(y),radius:Math.round(radius),density:.72+random()*.24});placed++;}}
  return bushes;
}
export const LARGE_BUSHES=makeBushesForMap(LARGE_REGIONS,LARGE_BUILDINGS,LARGE_COLLISION_OBSTACLES,0x006e2026,true);
function makeLootSpawns(regions:readonly Region[],count:number){return Array.from({length:count},(_,i)=>{const r=regions[i%regions.length]!;const col=i%7,row=Math.floor(i/7)%6;return{x:r.x+90+col*Math.max(95,(r.w-180)/7),y:r.y+100+row*Math.max(105,(r.h-200)/6),region:r.name,regionId:r.id};});}
export const LARGE_LOOT_SPAWNS=makeLootSpawns(LARGE_REGIONS,126);

export const SMALL_MOTORCYCLE_SPAWNS:MotorcycleSpawn[]=[
  {id:'bike-small-1',x:1320,y:1260,rotation:0},
  {id:'bike-small-2',x:1360,y:3520,rotation:-Math.PI/2},
  {id:'bike-small-3',x:2780,y:2240,rotation:Math.PI},
];
export const LARGE_MOTORCYCLE_SPAWNS:MotorcycleSpawn[]=[
  {id:'bike-large-1',x:1250,y:1250,rotation:0},
  {id:'bike-large-2',x:2520,y:1600,rotation:Math.PI/2},
  {id:'bike-large-3',x:3700,y:3200,rotation:Math.PI},
  {id:'bike-large-4',x:5200,y:2500,rotation:-Math.PI/2},
  {id:'bike-large-5',x:4400,y:5450,rotation:Math.PI},
  {id:'bike-large-6',x:1050,y:5000,rotation:0},
];

export function motorcycleSpreadRadians(weaponId:WeaponId,baseSpread:number,speedRatio:number,turnRatio:number):number{
  const speed=clamp(speedRatio,0,1),turn=clamp(turnRatio,0,1);
  const factor=weaponId==='pistol'?.62:weaponId==='sniper'?2.25:weaponId==='shotgun'?1.12:1;
  const extra=weaponId==='sniper'?speed*.115+turn*.055:weaponId==='pistol'?speed*.012+turn*.008:weaponId==='shotgun'?speed*.035+turn*.018:speed*.025+turn*.014;
  return baseSpread*(1+(speed*2+turn*.75)*factor)+extra;
}

export function motorcycleCollisionDamage(speed:number,maxSpeed=MOTORCYCLE_MAX_SPEED,reverse=false):number{
  const ratio=clamp(Math.abs(speed)/Math.max(1,maxSpeed),0,1);
  if(ratio<.25)return 0;
  const normalized=(ratio-.25)/.75;
  const damage=Math.round(12+normalized*48);
  return reverse?Math.round(damage*.5):damage;
}

export const MAP_CONFIGS:Record<MapSizeMode,MapConfig>={
  small:{id:'small',mode:'small',displayName:'작은 맵',width:SMALL_WORLD_SIZE,height:SMALL_WORLD_SIZE,recommendedPlayers:{min:2,max:4},maxPlayers:MAX_PLAYERS,initialZoneRadius:1950,zoneWaitScale:1,zoneShrinkScale:1,planeSpeed:1,planeMargin:280,lootBudget:76,aiCountDefault:8,minimapScale:1,regions:REGIONS,buildings:BUILDINGS,buildingVisibilityZones:BUILDING_VISIBILITY_ZONES,decorations:DECORATIONS,worldProps:WORLD_PROPS,obstacles:OBSTACLES,propObstacles:PROP_OBSTACLES,collisionObstacles:COLLISION_OBSTACLES,bulletObstacles:BULLET_OBSTACLES,bushes:BUSHES,lootSpawns:LOOT_SPAWNS,motorcycleSpawns:SMALL_MOTORCYCLE_SPAWNS,emergencySpawnPoints:[{x:180,y:180},{x:SMALL_WORLD_SIZE-180,y:180},{x:180,y:SMALL_WORLD_SIZE-180},{x:SMALL_WORLD_SIZE-180,y:SMALL_WORLD_SIZE-180}]},
  large:{id:'large',mode:'large',displayName:'큰 맵',width:LARGE_WORLD_SIZE,height:LARGE_WORLD_SIZE,recommendedPlayers:{min:6,max:8},maxPlayers:MAX_PLAYERS,initialZoneRadius:2920,zoneWaitScale:1.2,zoneShrinkScale:1.15,planeSpeed:1.28,planeMargin:360,lootBudget:126,aiCountDefault:8,minimapScale:.67,regions:LARGE_REGIONS,buildings:LARGE_BUILDINGS,buildingVisibilityZones:LARGE_BUILDING_VISIBILITY_ZONES,decorations:LARGE_DECORATIONS,worldProps:LARGE_WORLD_PROPS,obstacles:LARGE_OBSTACLES,propObstacles:LARGE_PROP_OBSTACLES,collisionObstacles:LARGE_COLLISION_OBSTACLES,bulletObstacles:LARGE_BULLET_OBSTACLES,bushes:LARGE_BUSHES,lootSpawns:LARGE_LOOT_SPAWNS,motorcycleSpawns:LARGE_MOTORCYCLE_SPAWNS,emergencySpawnPoints:[{x:240,y:240},{x:LARGE_WORLD_SIZE-240,y:240},{x:240,y:LARGE_WORLD_SIZE-240},{x:LARGE_WORLD_SIZE-240,y:LARGE_WORLD_SIZE-240},{x:LARGE_WORLD_SIZE/2,y:LARGE_WORLD_SIZE/2}]},
};
ALL_BUILDING_VISIBILITY_ZONES=[...BUILDING_VISIBILITY_ZONES,...LARGE_BUILDING_VISIBILITY_ZONES];
export function getMapConfig(mode:MapSizeMode|string='small'):MapConfig{return mode==='large'?MAP_CONFIGS.large:MAP_CONFIGS.small;}
export function normalizeAmmoType(value:unknown):Exclude<AmmoType,'none'>|undefined{const raw=String(value??'').toLowerCase();if(['shotgun_ammo','shotgun_shell','shell','shells'].includes(raw))return'shotgun_ammo';if(['pistol_ammo','pistol_round','handgun_ammo','small','small_ammo'].includes(raw))return'pistol_ammo';if(['standard_ammo','rifle','rifle_ammo','smg_ammo','sniper_ammo','assault_ammo','machinegun_ammo'].includes(raw))return'standard_ammo';return undefined;}
export function segmentCircleIntersectionT(x1:number,y1:number,x2:number,y2:number,cx:number,cy:number,radius:number):number|null{const dx=x2-x1,dy=y2-y1,fx=x1-cx,fy=y1-cy;const a=dx*dx+dy*dy;if(a<=1e-9)return fx*fx+fy*fy<=radius*radius?0:null;const b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-radius*radius,disc=b*b-4*a*c;if(disc<0)return null;const root=Math.sqrt(disc),t1=(-b-root)/(2*a),t2=(-b+root)/(2*a);if(t1>=0&&t1<=1)return t1;if(t2>=0&&t2<=1)return t2;return null;}
export function segmentRectIntersectionT(x1:number,y1:number,x2:number,y2:number,rect:Rect,padding=0):number|null{const minX=rect.x-padding,maxX=rect.x+rect.w+padding,minY=rect.y-padding,maxY=rect.y+rect.h+padding,dx=x2-x1,dy=y2-y1;let tMin=0,tMax=1;for(const [start,delta,min,max] of [[x1,dx,minX,maxX],[y1,dy,minY,maxY]] as const){if(Math.abs(delta)<1e-9){if(start<min||start>max)return null;continue;}let a=(min-start)/delta,b=(max-start)/delta;if(a>b)[a,b]=[b,a];tMin=Math.max(tMin,a);tMax=Math.min(tMax,b);if(tMin>tMax)return null;}return tMin;}
export const PROJECTILE_CONFIGS:Record<Exclude<WeaponId,'fists'>,ProjectileConfig>=Object.fromEntries((Object.keys(WEAPONS) as WeaponId[]).filter((id)=>id!=='fists').map((id)=>{const weapon=WEAPONS[id];return[id,{...weapon,lifetimeMs:Math.ceil(weapon.range/weapon.projectileSpeed*1000+120),radius:id==='shotgun'?3:2.4,knockback:id==='sniper'?520:id==='shotgun'?330:id==='rifle'?260:190,canPenetratePlayers:false,canPenetrateProps:false}];})) as Record<Exclude<WeaponId,'fists'>,ProjectileConfig>;

const SAFE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createRoomCode(random=Math.random): string {
  let result=''; for(let i=0;i<6;i++) result += SAFE_CHARS[Math.floor(random()*SAFE_CHARS.length)]; return result;
}
export function sanitizeText(value:unknown,max=80):string { return String(value ?? '').replace(/[<>]/g,'').replace(/[\u0000-\u001F\u007F]/g,'').trim().slice(0,max); }
export function clamp(n:number,min:number,max:number):number { return Math.max(min,Math.min(max,n)); }
export function distance(ax:number,ay:number,bx:number,by:number):number { return Math.hypot(ax-bx,ay-by); }
export function distanceSq(ax:number,ay:number,bx:number,by:number):number { const dx=ax-bx,dy=ay-by; return dx*dx+dy*dy; }
export function isFiniteNumber(v:unknown):v is number { return typeof v==='number' && Number.isFinite(v); }
export function circleHitsRect(x:number,y:number,r:number,rect:Rect):boolean { const nx=clamp(x,rect.x,rect.x+rect.w), ny=clamp(y,rect.y,rect.y+rect.h); return (x-nx)**2+(y-ny)**2 < r*r; }
