import type { SoundDefinition, SoundId } from './audioTypes';

const define=(id:SoundId,category:SoundDefinition['category'],volume:number,maxDistance:number,priority:number,maxVoices:number,cooldownMs=0):SoundDefinition=>({id,category,volume,maxDistance,priority,maxVoices,cooldownMs});

const entries:SoundDefinition[]=[
  define('ui_click','ui',.32,0,2,3,90),define('ui_confirm','ui',.46,0,4,3,90),define('ui_error','ui',.48,0,5,2,180),define('chat_send','ui',.34,0,2,2,90),
  define('countdown_tick','system',.44,0,5,3,120),define('match_start','system',.65,0,7,2,500),define('victory','music',.72,0,10,1,1200),define('defeat','music',.62,0,10,1,1200),
  define('weapon_pistol_fire','weapon',.72,800,8,12,40),define('weapon_smg_fire','weapon',.57,900,8,12,28),define('weapon_rifle_fire','weapon',.72,1100,8,12,45),define('weapon_shotgun_fire','weapon',.96,1050,9,8,90),define('weapon_sniper_fire','weapon',1,1500,10,6,150),
  define('weapon_dry_fire','weapon',.34,0,4,2,180),define('reload_start','weapon',.38,340,4,4,120),define('reload_complete','weapon',.48,340,5,4,120),
  define('impact_wall','impact',.42,650,4,10,35),define('impact_ground','impact',.32,560,3,8,45),define('impact_frame','impact',.5,700,5,8,45),define('impact_vehicle','impact',.62,780,6,8,45),define('impact_player','impact',.42,620,6,6,45),
  define('local_damage','system',.64,0,9,3,80),define('low_health','system',.42,0,7,1,900),define('hit_confirm','system',.36,0,8,5,35),define('kill_confirm','system',.62,0,10,2,180),define('player_death','system',.72,760,9,4,160),
  define('footstep_outdoor','movement',.28,350,3,8,130),define('footstep_indoor','movement',.32,300,3,8,130),define('bush_move','environment',.37,400,4,8,220),
  define('item_pickup','ui',.38,0,4,3,70),define('ammo_pickup','ui',.34,0,4,3,70),define('weapon_equip','ui',.48,0,5,3,90),define('armor_equip','ui',.48,0,5,3,90),
  define('heal_start','system',.36,280,4,3,150),define('heal_complete','system',.5,280,5,3,150),define('action_denied','ui',.4,0,5,2,160),
  define('window_vault_start','movement',.34,360,4,5,150),define('window_vault_land','movement',.46,420,5,5,150),
  define('motorcycle_mount','vehicle',.5,460,5,4,200),define('motorcycle_idle','vehicle',.28,900,5,8,0),define('motorcycle_engine','vehicle',.6,1100,6,8,0),define('motorcycle_collision','vehicle',.68,1000,8,6,120),
  define('motorcycle_hit','vehicle',.48,850,6,8,70),define('motorcycle_critical','vehicle',.62,1000,8,4,300),define('motorcycle_warning','vehicle',.5,1000,9,5,90),define('motorcycle_explosion','vehicle',1,1600,10,4,120),
  define('zone_warning','system',.54,0,8,2,400),define('zone_start','system',.64,0,9,2,600),define('zone_damage','system',.5,0,8,2,250),define('zone_final','music',.54,0,9,1,1500),
  define('throwable_select','ui',.42,0,5,3,90),define('throwable_prepare','weapon',.34,260,4,4,120),define('throwable_throw','weapon',.48,520,6,8,70),define('throwable_bounce','impact',.45,620,5,10,55),
  define('frag_explosion','impact',1,1600,10,5,120),define('smoke_deploy','environment',.64,850,7,5,180),define('fire_ignite','environment',.78,1000,8,5,180),define('throwable_pickup','ui',.42,0,5,3,80),define('throwable_swap','ui',.52,0,6,3,110),
];

export const SOUND_REGISTRY = Object.fromEntries(entries.map((entry)=>[entry.id,entry])) as Record<SoundId,SoundDefinition>;
export const soundDefinition=(id:SoundId)=>SOUND_REGISTRY[id];

export function soundIdForWeapon(weaponId:string):SoundId|undefined{
  if(weaponId==='pistol')return'weapon_pistol_fire';
  if(weaponId==='smg')return'weapon_smg_fire';
  if(weaponId==='rifle')return'weapon_rifle_fire';
  if(weaponId==='shotgun')return'weapon_shotgun_fire';
  if(weaponId==='sniper')return'weapon_sniper_fire';
  return undefined;
}
