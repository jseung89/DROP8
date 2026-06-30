// DROP8_REFACTOR_013H_FIXED_V3_VISIBILITY_ROOF_RIVER_ZONE_SNIPER_AI
// DROP8_REFACTOR_013H_VISIBILITY_ROOF_RIVER_ZONE_SNIPER
// DROP8_REFACTOR_013H1_LARGE_NESTED_ROOM_WINDOW_DOCK8_TERRAIN_LOOT
export type MapId='small'|'large'|'dock8';
export type RoomKind='main'|'hall'|'corridor'|'office'|'storage'|'lounge';
export type PortalKind013='door'|'window';
export type CrossingKind='vehicle_bridge'|'foot_bridge'|'service_bridge'|'ford';
export type AiMacroKind='region'|'door'|'window'|'bridge'|'ford'|'swim_entry'|'shore_exit';
export type AiMovementMode='land'|'vault'|'swim';
export type TerrainKind='land'|'building'|'bridge'|'ford'|'shore'|'shallow-water'|'deep-water';

export interface MapPoint{x:number;y:number;}
export interface MapRect{x:number;y:number;w:number;h:number;}

export interface RoomZone{
  id:string;
  buildingId:string;
  index:number;
  rect:MapRect;
  kind:RoomKind;
}

export interface SpacePortal{
  id:string;
  buildingId:string;
  kind:PortalKind013;
  sideARoomIndex:number;
  sideBRoomIndex:number;
  sideABuildingId?:string;
  sideBBuildingId?:string;
  opening:MapRect;
  approachA:MapPoint;
  approachB:MapPoint;
  landingA:MapPoint;
  landingB:MapPoint;
  vaultable:boolean;
  allowsVision:boolean;
  allowsBullets:boolean;
}

export interface LootAnchor{
  id:string;
  x:number;
  y:number;
  regionId:string;
  buildingId:string;
  roomIndex:number;
  groupId?:string;
  category?:'weapon'|'ammo'|'heal'|'throwable'|'normal';
}

export interface RiverBand{
  id:string;
  points:MapPoint[];
  widths:number[];
}

export interface WaterZone extends MapRect{
  id:string;
  movementMultiplier:number;
}

export interface LandCrossing{
  id:string;
  rect:MapRect;
  kind:CrossingKind;
  allowsPlayer:boolean;
  allowsMotorcycle:boolean;
  movementMultiplier:number;
}

export interface ShoreExit{
  id:string;
  waterZoneId:string;
  entry:MapRect;
  landingPoint:MapPoint;
  normal:MapPoint;
}

export interface AiMacroNode extends MapPoint{
  id:string;
  kind:AiMacroKind;
  roomIndex:number;
  side?:'west'|'east';
}

export interface AiMacroEdge{
  from:string;
  to:string;
  baseCost:number;
  movementMode:AiMovementMode;
}

export interface SpaceDescriptor{
  buildingId:string;
  roomIndex:number;
  outdoors:boolean;
}

export interface SpaceVisibilityTrace{
  visible:boolean;
  crossedPortalIds:string[];
  roomsCrossed:number;
}
