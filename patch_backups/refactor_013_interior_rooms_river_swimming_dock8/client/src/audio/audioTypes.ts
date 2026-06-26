import type { AudioCategory, SoundOcclusion } from '@drop8/shared';

export type SoundId =
  | 'ui_click' | 'ui_confirm' | 'ui_error' | 'chat_send'
  | 'countdown_tick' | 'match_start' | 'victory' | 'defeat'
  | 'weapon_pistol_fire' | 'weapon_smg_fire' | 'weapon_rifle_fire' | 'weapon_shotgun_fire' | 'weapon_sniper_fire'
  | 'weapon_dry_fire' | 'reload_start' | 'reload_complete'
  | 'impact_wall' | 'impact_ground' | 'impact_frame' | 'impact_vehicle' | 'impact_player'
  | 'local_damage' | 'low_health' | 'hit_confirm' | 'kill_confirm' | 'player_death'
  | 'footstep_outdoor' | 'footstep_indoor' | 'bush_move'
  | 'item_pickup' | 'ammo_pickup' | 'weapon_equip' | 'armor_equip'
  | 'heal_start' | 'heal_complete' | 'action_denied'
  | 'window_vault_start' | 'window_vault_land'
  | 'motorcycle_mount' | 'motorcycle_idle' | 'motorcycle_engine' | 'motorcycle_collision'
  | 'motorcycle_hit' | 'motorcycle_critical' | 'motorcycle_warning' | 'motorcycle_explosion'
  | 'zone_warning' | 'zone_start' | 'zone_damage' | 'zone_final'
  | 'throwable_select' | 'throwable_prepare' | 'throwable_throw' | 'throwable_bounce'
  | 'frag_explosion' | 'smoke_deploy' | 'fire_ignite' | 'throwable_pickup' | 'throwable_swap';

export interface SoundDefinition {
  id: SoundId;
  category: AudioCategory;
  volume: number;
  maxDistance: number;
  priority: number;
  maxVoices: number;
  cooldownMs?: number;
  assetUrl?: string;
}

export interface WorldSoundOptions {
  x: number;
  y: number;
  volume?: number;
  maxDistance?: number;
  sourceId?: string;
  eventId?: string;
  category?: AudioCategory;
  occlusion?: SoundOcclusion;
}

export interface LoopSoundOptions extends WorldSoundOptions {
  pitch?: number;
}

export interface AudioEventMessage {
  id?: string;
  type?: string;
  sourceId?: string;
  targetId?: string;
  x?: number;
  y?: number;
  buildingId?: string;
  variant?: string;
  sequence?: number;
  createdAt?: number;
}
