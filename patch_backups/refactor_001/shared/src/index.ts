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
export type LootKind = WeaponId | 'small_ammo' | 'rifle_ammo' | 'shells' | 'vest' | 'bandage' | 'medkit' | 'bat' | 'pan' | 'pipe' | 'knife';

export interface WeaponData {
  id: WeaponId; name: string; damage: number; fireInterval: number; magazine: number;
  reloadSeconds: number; spread: number; projectileSpeed: number; range: number;
  pellets: number; moveMultiplier: number; ammoType: 'none' | 'small' | 'rifle' | 'shells'; slot: 'melee' | 'secondary' | 'primary';
}

export const WEAPONS: Record<WeaponId, WeaponData> = {
  fists: { id:'fists', name:'주먹', damage:10, fireInterval:.55, magazine:0, reloadSeconds:0, spread:0, projectileSpeed:0, range:65, pellets:1, moveMultiplier:1, ammoType:'none', slot:'melee' },
  pistol:{ id:'pistol', name:'권총', damage:18, fireInterval:.28, magazine:12, reloadSeconds:1.35, spread:.025, projectileSpeed:1050, range:850, pellets:1, moveMultiplier:1, ammoType:'small', slot:'secondary' },
  smg:{ id:'smg', name:'기관단총', damage:11, fireInterval:.085, magazine:30, reloadSeconds:1.55, spread:.08, projectileSpeed:920, range:680, pellets:1, moveMultiplier:1.05, ammoType:'small', slot:'primary' },
  rifle:{ id:'rifle', name:'돌격소총', damage:17, fireInterval:.13, magazine:24, reloadSeconds:1.7, spread:.038, projectileSpeed:1100, range:980, pellets:1, moveMultiplier:.98, ammoType:'rifle', slot:'primary' },
  shotgun:{ id:'shotgun', name:'샷건', damage:10, fireInterval:.72, magazine:5, reloadSeconds:2.0, spread:.24, projectileSpeed:820, range:420, pellets:7, moveMultiplier:.96, ammoType:'shells', slot:'primary' }
};

export interface Rect { x:number; y:number; w:number; h:number; }
export interface Region { name:string; x:number; y:number; w:number; h:number; color:number; }

export const REGIONS: Region[] = [
  { name:'폐공장', x:220, y:260, w:980, h:800, color:0x5f6b73 },
  { name:'주택가', x:1510, y:240, w:980, h:900, color:0x85755f },
  { name:'병원', x:2890, y:300, w:760, h:720, color:0x668a8f },
  { name:'창고지대', x:240, y:2520, w:1020, h:900, color:0x8a6b55 },
  { name:'군사시설', x:1600, y:2650, w:930, h:900, color:0x5d6d57 },
  { name:'숲속 캠프', x:2920, y:2500, w:820, h:980, color:0x3f704d }
];

export const OBSTACLES: Rect[] = [
  {x:300,y:350,w:320,h:120},{x:720,y:380,w:340,h:100},{x:360,y:700,w:160,h:260},{x:760,y:690,w:290,h:190},
  {x:1600,y:360,w:260,h:210},{x:1980,y:350,w:330,h:170},{x:1600,y:760,w:220,h:250},{x:2040,y:730,w:310,h:210},
  {x:3010,y:420,w:520,h:180},{x:3100,y:730,w:180,h:230},{x:3390,y:720,w:180,h:230},
  {x:330,y:2640,w:360,h:170},{x:780,y:2650,w:350,h:170},{x:400,y:3010,w:240,h:220},{x:810,y:3010,w:260,h:210},
  {x:1690,y:2760,w:370,h:190},{x:2140,y:2760,w:280,h:190},{x:1710,y:3150,w:220,h:250},{x:2100,y:3150,w:300,h:220},
  {x:3020,y:2660,w:170,h:170},{x:3350,y:2740,w:160,h:160},{x:3140,y:3100,w:170,h:170},{x:3500,y:3220,w:150,h:150},
  {x:1350,y:1550,w:360,h:100},{x:2320,y:1450,w:120,h:390},{x:1750,y:1900,w:450,h:110}
];

export const LOOT_SPAWNS = Array.from({length: 76}, (_,i) => {
  const r = REGIONS[i % REGIONS.length]!;
  const col = i % 6, row = Math.floor(i / 6) % 5;
  return { x: r.x + 90 + col * Math.max(95, (r.w-180)/6), y: r.y + 100 + row * Math.max(105, (r.h-200)/5), region: r.name };
});

const SAFE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function createRoomCode(random=Math.random): string {
  let result=''; for(let i=0;i<6;i++) result += SAFE_CHARS[Math.floor(random()*SAFE_CHARS.length)]; return result;
}
export function sanitizeText(value:unknown,max=80):string { return String(value ?? '').replace(/[<>]/g,'').replace(/[\u0000-\u001F\u007F]/g,'').trim().slice(0,max); }
export function clamp(n:number,min:number,max:number):number { return Math.max(min,Math.min(max,n)); }
export function distance(ax:number,ay:number,bx:number,by:number):number { return Math.hypot(ax-bx,ay-by); }
export function isFiniteNumber(v:unknown):v is number { return typeof v==='number' && Number.isFinite(v); }
export function circleHitsRect(x:number,y:number,r:number,rect:Rect):boolean { const nx=clamp(x,rect.x,rect.x+rect.w), ny=clamp(y,rect.y,rect.y+rect.h); return (x-nx)**2+(y-ny)**2 < r*r; }
