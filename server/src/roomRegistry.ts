// DROP8_REFACTOR_017_ADHESIVE_STRIP_LOBBY_BAZOOKA_WATER
import { matchMaker } from '@colyseus/core';

export type PublicRoomStatus='LOBBY'|'PLANE'|'DROP'|'ACTIVE'|'FINISHED';
export type PublicRoomInfo={
  roomId:string;
  roomCode:string;
  hostName:string;
  players:number;
  humans:number;
  maxPlayers:number;
  phase:PublicRoomStatus;
  fillAi:boolean;
  publicRoom:boolean;
  locked:boolean;
  mapSizeMode:'small'|'large'|'dock8';
  mapDisplayName:string;
  createdAt:number;
  updatedAt:number;
};

type RoomListing={roomId:string;clients:number;maxClients:number;locked?:boolean;private?:boolean;unlisted?:boolean;createdAt?:Date|string|number;metadata?:Partial<Omit<PublicRoomInfo,'roomId'|'maxPlayers'|'locked'>>};

export function publicRoomInfoFromListing(listing:RoomListing):PublicRoomInfo|null{
  const metadata=listing.metadata;
  if(!metadata||listing.private||listing.unlisted||metadata.publicRoom===false)return null;
  const roomCode=String(metadata.roomCode??listing.roomId).toUpperCase();
  if(!roomCode)return null;
  const createdAt=Number(metadata.createdAt??(listing.createdAt instanceof Date?listing.createdAt.getTime():listing.createdAt)??Date.now());
  const updatedAt=Number(metadata.updatedAt??createdAt);
  const phase=(['LOBBY','PLANE','DROP','ACTIVE','FINISHED'].includes(String(metadata.phase))?metadata.phase:'LOBBY') as PublicRoomStatus;
  const mapSizeMode=(['small','large','dock8'].includes(String(metadata.mapSizeMode))?metadata.mapSizeMode:'small') as PublicRoomInfo['mapSizeMode'];
  return{
    roomId:listing.roomId,
    roomCode,
    hostName:String(metadata.hostName??'대기 중'),
    players:Number(metadata.players??listing.clients)||0,
    humans:Number(metadata.humans)||0,
    maxPlayers:Number(listing.maxClients)||8,
    phase,
    fillAi:Boolean(metadata.fillAi),
    publicRoom:true,
    locked:Boolean(listing.locked),
    mapSizeMode,
    mapDisplayName:String(metadata.mapDisplayName??(mapSizeMode==='large'?'큰 맵':mapSizeMode==='dock8'?'8번 부두':'작은 맵')),
    createdAt:Number.isFinite(createdAt)?createdAt:Date.now(),
    updatedAt:Number.isFinite(updatedAt)?updatedAt:Date.now(),
  };
}

export async function listPublicRooms(){
  const listings=await matchMaker.query({name:'drop8'});
  return listings
    .map((listing)=>publicRoomInfoFromListing(listing as RoomListing))
    .filter((room):room is PublicRoomInfo=>Boolean(room))
    .sort((a,b)=>a.phase===b.phase?b.updatedAt-a.updatedAt:a.phase==='LOBBY'?-1:b.phase==='LOBBY'?1:0);
}
