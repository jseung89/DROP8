// DROP8_REFACTOR_017_ADHESIVE_STRIP_LOBBY_BAZOOKA_WATER
import { describe, expect, it } from 'vitest';
import { publicRoomInfoFromListing } from '../src/roomRegistry.js';

describe('Refactor 017 matchmaker-backed room registry',()=>{
  it('maps safe public metadata and uses live listing counts',()=>{
    const room=publicRoomInfoFromListing({roomId:'ABC123',clients:3,maxClients:8,locked:false,metadata:{roomCode:'ABC123',hostName:'승이형',humans:2,phase:'LOBBY',fillAi:true,publicRoom:true,mapSizeMode:'dock8',mapDisplayName:'8번 부두',createdAt:10,updatedAt:20}});
    expect(room).toMatchObject({roomCode:'ABC123',hostName:'승이형',players:3,humans:2,maxPlayers:8,phase:'LOBBY',fillAi:true,publicRoom:true,locked:false,mapSizeMode:'dock8'});
    expect(room).not.toHaveProperty('password');
  });

  it('hides private, unlisted, and metadata-private rooms',()=>{
    const base={roomId:'A',clients:1,maxClients:8,metadata:{roomCode:'AAAAAA',publicRoom:true}};
    expect(publicRoomInfoFromListing({...base,private:true})).toBeNull();
    expect(publicRoomInfoFromListing({...base,unlisted:true})).toBeNull();
    expect(publicRoomInfoFromListing({...base,metadata:{...base.metadata,publicRoom:false}})).toBeNull();
  });
});
