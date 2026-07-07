// DROP8_REFACTOR_028_RECURRING_WEREWOLF_RITUAL_CYCLE
// DROP8_REFACTOR_027_OPEN_ARENA_RECURRING_SUPPLY_DROPS
// DROP8_REFACTOR_024D_OPEN_ARENA_PERSISTENT_WORLD
export interface ArenaLootSlot{
  slotId:string;
  spawnIndex:number;
  currentLootId:string;
  respawnAt:number;
  generation:number;
}
export interface ArenaVehicleSlot{
  slotId:string;
  spawnId:string;
  x:number;
  y:number;
  rotation:number;
  currentVehicleId:string;
  respawnAt:number;
  generation:number;
}
export function arenaLootRespawnSeconds(category:string){
  if(category==='ammo')return 20;
  if(category==='heal')return 25;
  if(category==='weapon')return 40;
  if(category==='throwable')return 45;
  return 55;
}
export const OPEN_ARENA_DROP_TTL_SECONDS=60;
export const OPEN_ARENA_SUPPLY_DROP_FIRST_DELAY_SECONDS=60;
export const OPEN_ARENA_SUPPLY_DROP_INTERVAL_SECONDS=90;
export const OPEN_ARENA_MAX_ACTIVE_SUPPLY_DROPS=3;
export const OPEN_ARENA_SUPPLY_DROP_RETRY_SECONDS=15;
export const OPEN_ARENA_RITUAL_FIRST_DELAY_SECONDS=90;
export const OPEN_ARENA_RITUAL_WARNING_SECONDS=15;
export const OPEN_ARENA_RITUAL_ACTIVE_SECONDS=45;
export const OPEN_ARENA_RITUAL_COOLDOWN_SECONDS=120;
export const OPEN_ARENA_RITUAL_COMPLETION_SECONDS=5;
export const OPEN_ARENA_RITUAL_SUPPLY_CLEARANCE=520;
export const OPEN_ARENA_VEHICLE_RESPAWN_SECONDS=75;
export const OPEN_ARENA_WORLD_CLEANUP_INTERVAL_SECONDS=1;
