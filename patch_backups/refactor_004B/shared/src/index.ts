export const GAME_NAME = 'DROP 8';
export const MAX_PLAYERS = 8;
export const WORLD_SIZE = 4096;
export const SERVER_TICK_RATE = 30;
export const PATCH_RATE_MS = 50;
export const CHAT_RADIUS = 700;
export const PLAYER_RADIUS = 22;
export const PLAYER_SPEED = 260;
export const PLANE_DURATION = 24;
export const FALL_START_ALTITUDE = 1000;

export type GamePhase = 'LOBBY' | 'PLANE' | 'DROP' | 'ACTIVE' | 'FINISHED';
export type PlayerPhase = 'lobby' | 'plane' | 'falling' | 'parachute' | 'landed' | 'dead';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type ZoneSpeed = 'slow' | 'normal' | 'fast';
export type WeaponId = 'fists' | 'pistol' | 'smg' | 'rifle' | 'shotgun';
export type MeleeId = 'bat' | 'pan' | 'pipe' | 'knife';
export type EquippedId = WeaponId | MeleeId;
export type LootKind = WeaponId | MeleeId | 'small_ammo' | 'rifle_ammo' | 'shells' | 'vest' | 'bandage' | 'medkit';
export type RegionId = 'factory' | 'residential' | 'hospital' | 'warehouse' | 'military' | 'forestCamp';

export interface WeaponData {
  id: WeaponId; name: string; damage: number; fireInterval: number; magazine: number;
  reloadSeconds: number; spread: number; projectileSpeed: number; range: number;
  pellets: number; moveMultiplier: number; ammoType: 'none' | 'small' | 'rifle' | 'shells'; slot: 'melee' | 'secondary' | 'primary';
}

export interface MeleeData {
  id: MeleeId; name: string; damage: number; fireInterval: number; range: number; arc: number; moveMultiplier: number;
}

export const WEAPONS: Record<WeaponId, WeaponData> = {
  fists: { id:'fists', name:'주먹', damage:10, fireInterval:.55, magazine:0, reloadSeconds:0, spread:0, projectileSpeed:0, range:65, pellets:1, moveMultiplier:1, ammoType:'none', slot:'melee' },
  pistol:{ id:'pistol', name:'권총', damage:18, fireInterval:.28, magazine:12, reloadSeconds:1.35, spread:.025, projectileSpeed:1050, range:850, pellets:1, moveMultiplier:1, ammoType:'small', slot:'secondary' },
  smg:{ id:'smg', name:'기관단총', damage:11, fireInterval:.085, magazine:30, reloadSeconds:1.55, spread:.08, projectileSpeed:920, range:680, pellets:1, moveMultiplier:1.05, ammoType:'small', slot:'primary' },
  rifle:{ id:'rifle', name:'돌격소총', damage:17, fireInterval:.13, magazine:24, reloadSeconds:1.7, spread:.038, projectileSpeed:1100, range:980, pellets:1, moveMultiplier:.98, ammoType:'rifle', slot:'primary' },
  shotgun:{ id:'shotgun', name:'샷건', damage:10, fireInterval:.72, magazine:5, reloadSeconds:2.0, spread:.24, projectileSpeed:820, range:420, pellets:7, moveMultiplier:.96, ammoType:'shells', slot:'primary' }
};

export const MELEE_WEAPONS: Record<MeleeId, MeleeData> = {
  bat:{id:'bat',name:'야구방망이',damage:24,fireInterval:.72,range:88,arc:1.15,moveMultiplier:1},
  pan:{id:'pan',name:'프라이팬',damage:29,fireInterval:.88,range:72,arc:1.05,moveMultiplier:.97},
  pipe:{id:'pipe',name:'쇠파이프',damage:22,fireInterval:.66,range:82,arc:1.1,moveMultiplier:.99},
  knife:{id:'knife',name:'식칼',damage:17,fireInterval:.38,range:60,arc:.95,moveMultiplier:1.04}
};

export const LOOT_LABELS: Record<LootKind,string> = {
  fists:'주먹', pistol:'권총', smg:'기관단총', rifle:'돌격소총', shotgun:'샷건',
  bat:'야구방망이', pan:'프라이팬', pipe:'쇠파이프', knife:'식칼',
  small_ammo:'소형탄', rifle_ammo:'소총탄', shells:'산탄', vest:'방탄조끼', bandage:'붕대', medkit:'구급상자'
};

export const LOOT_COLORS: Record<LootKind,number> = {
  fists:0xf6f7f8, pistol:0xffd451, smg:0xffb84d, rifle:0xff8f4d, shotgun:0xff6b55,
  bat:0xc98b55, pan:0xaeb9c2, pipe:0x8da0ad, knife:0xdde7ee,
  small_ammo:0xffe88a, rifle_ammo:0xff9f64, shells:0xff6f7a, vest:0x73b9ff, bandage:0x58e49d, medkit:0x2ecf78
};

export interface Rect { x:number; y:number; w:number; h:number; }
export interface Region { id:RegionId; name:string; x:number; y:number; w:number; h:number; color:number; }
export interface WeightedLoot { kind:LootKind; weight:number; }
export type DoorSide = 'north'|'south'|'east'|'west';
export interface Building extends Rect { doorSide:DoorSide; doorOffset:number; doorWidth:number; }

export const REGIONS: Region[] = [
  { id:'factory', name:'폐공장', x:220, y:260, w:980, h:800, color:0x5f6b73 },
  { id:'residential', name:'주택가', x:1510, y:240, w:980, h:900, color:0x85755f },
  { id:'hospital', name:'병원', x:2890, y:300, w:760, h:720, color:0x668a8f },
  { id:'warehouse', name:'창고지대', x:240, y:2520, w:1020, h:900, color:0x8a6b55 },
  { id:'military', name:'군사시설', x:1600, y:2650, w:930, h:900, color:0x5d6d57 },
  { id:'forestCamp', name:'숲속 캠프', x:2920, y:2500, w:820, h:980, color:0x3f704d }
];

export const REGION_LOOT_TABLES: Record<RegionId, WeightedLoot[]> = {
  factory:[
    {kind:'smg',weight:16},{kind:'rifle',weight:15},{kind:'small_ammo',weight:17},{kind:'rifle_ammo',weight:17},{kind:'pipe',weight:12},
    {kind:'pistol',weight:8},{kind:'vest',weight:7},{kind:'bandage',weight:6},{kind:'medkit',weight:1},{kind:'shotgun',weight:1},
  ],
  residential:[
    {kind:'pistol',weight:19},{kind:'bandage',weight:18},{kind:'small_ammo',weight:18},{kind:'bat',weight:12},
    {kind:'vest',weight:10},{kind:'smg',weight:8},{kind:'medkit',weight:7},{kind:'rifle',weight:4},{kind:'shotgun',weight:4},
  ],
  hospital:[
    {kind:'bandage',weight:27},{kind:'medkit',weight:21},{kind:'vest',weight:18},{kind:'pistol',weight:12},{kind:'small_ammo',weight:12},
    {kind:'smg',weight:7},{kind:'rifle',weight:2},{kind:'shotgun',weight:1},
  ],
  warehouse:[
    {kind:'shotgun',weight:20},{kind:'shells',weight:22},{kind:'smg',weight:15},{kind:'pan',weight:12},
    {kind:'vest',weight:10},{kind:'small_ammo',weight:9},{kind:'bandage',weight:7},{kind:'rifle',weight:3},{kind:'medkit',weight:2},
  ],
  military:[
    {kind:'rifle',weight:24},{kind:'rifle_ammo',weight:24},{kind:'vest',weight:18},{kind:'smg',weight:12},{kind:'medkit',weight:9},
    {kind:'small_ammo',weight:7},{kind:'shotgun',weight:3},{kind:'pistol',weight:3},
  ],
  forestCamp:[
    {kind:'pistol',weight:16},{kind:'shotgun',weight:14},{kind:'bandage',weight:18},{kind:'knife',weight:12},{kind:'bat',weight:11},
    {kind:'shells',weight:9},{kind:'small_ammo',weight:9},{kind:'medkit',weight:6},{kind:'rifle',weight:3},{kind:'vest',weight:2},
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

export function regionAt(x:number,y:number):Region|undefined {
  return REGIONS.find((region)=>x>=region.x&&x<=region.x+region.w&&y>=region.y&&y<=region.y+region.h);
}

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
  doorSide:DOOR_SIDES[i%DOOR_SIDES.length]!,
  doorOffset:.5,
  doorWidth:Math.max(72,Math.min(118,(i%2===0?r.w:r.h)*.36))
}));

const WALL=18;
function wallsForBuilding(b:Building):Rect[]{
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

export const LOOT_SPAWNS = Array.from({length: 76}, (_,i) => {
  const r = REGIONS[i % REGIONS.length]!;
  const col = i % 6, row = Math.floor(i / 6) % 5;
  return { x: r.x + 90 + col * Math.max(95, (r.w-180)/6), y: r.y + 100 + row * Math.max(105, (r.h-200)/5), region: r.name, regionId:r.id };
});

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
