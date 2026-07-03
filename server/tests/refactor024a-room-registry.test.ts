// DROP8_REFACTOR_024A_OPEN_ARENA_FOUNDATION
import { describe,expect,it } from 'vitest';
import { publicRoomInfoFromListing } from '../src/roomRegistry.js';

describe('Refactor 024A room registry metadata',()=>{
  it('exposes Open Arena human and AI capacities independently',()=>{
    const room=publicRoomInfoFromListing({roomId:'ABC123',clients:4,maxClients:8,metadata:{roomCode:'ABC123',hostName:'승이형',players:11,humans:4,phase:'ACTIVE',fillAi:true,publicRoom:true,mapSizeMode:'dock8',mapDisplayName:'8번 부두',createdAt:1,updatedAt:2,gameMode:'openArena',maxHumans:8,configuredAiCount:7,joinInProgress:true,lifecycle:'active'}} as any);
    expect(room).toMatchObject({gameMode:'openArena',humans:4,maxHumans:8,configuredAiCount:7,joinInProgress:true,lifecycle:'active'});
  });
});
