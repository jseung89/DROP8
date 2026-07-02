// DROP8_REFACTOR_017_ADHESIVE_STRIP_LOBBY_BAZOOKA_WATER
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { publicRoomInfoFromListing } from '../src/roomRegistry.js';
import { Drop8Room } from '../src/rooms/Drop8Room.js';
import { PlayerState } from '../src/rooms/schema.js';


describe('Refactor 017 lobby room list integration',()=>{
  it('uses matchMaker.query and filters private or unlisted rooms',()=>{
    const registry=readFileSync(fileURLToPath(new URL('../src/roomRegistry.ts',import.meta.url)),'utf8');
    expect(registry).toContain("matchMaker.query({name:'drop8'})");
    const rooms=[
      {roomId:'PUBLIC1',clients:2,maxClients:8,locked:false,metadata:{roomCode:'PUBLIC1',hostName:'방장',players:2,humans:2,phase:'LOBBY',fillAi:true,publicRoom:true,mapSizeMode:'small',mapDisplayName:'작은 맵',createdAt:10,updatedAt:20}},
      {roomId:'PRIVATE',clients:1,maxClients:8,private:true,metadata:{roomCode:'PRIVATE',publicRoom:true}},
      {roomId:'OLD',clients:1,maxClients:8,unlisted:true,metadata:{roomCode:'OLD',publicRoom:true}},
    ].map((listing)=>publicRoomInfoFromListing(listing as any)).filter(Boolean);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({roomCode:'PUBLIC1',players:2,maxPlayers:8,phase:'LOBBY'});
  });

  it('publishes safe metadata without exposing the room password',async()=>{
    const room=new Drop8Room() as any;
    room.state.roomCode='SAFE17';room.state.publicRoom=true;room.state.phase='LOBBY';room.state.mapId='small';room.password='do-not-expose';
    const host=new PlayerState();host.id='host';host.name='승이형';host.host=true;room.state.players.set(host.id,host);room.state.hostId=host.id;
    const setMatchmaking=vi.fn().mockResolvedValue(undefined);room.setMatchmaking=setMatchmaking;
    room.syncRoomRegistry();await room.registrySyncQueue;
    const settings=setMatchmaking.mock.calls[0]?.[0];
    expect(settings).toMatchObject({private:false,unlisted:false,maxClients:8});
    expect(settings.metadata).toMatchObject({roomCode:'SAFE17',hostName:'승이형',players:1,humans:1,publicRoom:true});
    expect(settings.metadata).not.toHaveProperty('password');
  });

  it('keeps Schema classes below the Colyseus 64-field limit and the client polling route intact',()=>{
    const schema=readFileSync(fileURLToPath(new URL('../src/rooms/schema.ts',import.meta.url)),'utf8');
    const count=(name:string,next:string)=>((schema.split(`export class ${name}`)[1]?.split(`export class ${next}`)[0]??'').match(/@type\(/g)??[]).length;
    expect(count('PlayerState','TacticalInventoryState')).toBeLessThanOrEqual(64);
    expect(count('Drop8State','')).toBeLessThanOrEqual(64);
    const client=readFileSync(fileURLToPath(new URL('../../client/src/main.ts',import.meta.url)),'utf8');
    expect(client).toContain("fetch('/api/rooms'");expect(client).toContain('AbortController');expect(client).toContain('2500');
  });
});
