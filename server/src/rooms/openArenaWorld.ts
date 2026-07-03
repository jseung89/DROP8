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
export const OPEN_ARENA_VEHICLE_RESPAWN_SECONDS=75;
export const OPEN_ARENA_WORLD_CLEANUP_INTERVAL_SECONDS=1;
