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
  mapSizeMode:'small'|'large';
  mapDisplayName:string;
  createdAt:number;
  updatedAt:number;
};

const rooms=new Map<string,PublicRoomInfo>();

export function upsertPublicRoom(info:PublicRoomInfo){rooms.set(info.roomId,{...info});}
export function removePublicRoom(roomId:string){rooms.delete(roomId);}
export function listPublicRooms(){
  return [...rooms.values()]
    .filter((room)=>room.publicRoom)
    .sort((a,b)=>a.phase===b.phase?b.updatedAt-a.updatedAt:a.phase==='LOBBY'?-1:b.phase==='LOBBY'?1:0)
    .map((room)=>({...room}));
}
export function clearPublicRooms(){rooms.clear();}
