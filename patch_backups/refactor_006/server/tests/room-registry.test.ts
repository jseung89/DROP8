import { beforeEach, describe, expect, it } from 'vitest';
import { clearPublicRooms, listPublicRooms, upsertPublicRoom } from '../src/roomRegistry.js';

describe('Refactor 005B room registry', () => {
  beforeEach(() => clearPublicRooms());

  it('lists public rooms and hides code-only rooms', () => {
    upsertPublicRoom({ roomId:'A',roomCode:'AAAAAA',hostName:'승이형',players:1,humans:1,maxPlayers:8,phase:'LOBBY',fillAi:true,publicRoom:true,createdAt:1,updatedAt:2 });
    upsertPublicRoom({ roomId:'B',roomCode:'BBBBBB',hostName:'비공개',players:1,humans:1,maxPlayers:8,phase:'LOBBY',fillAi:false,publicRoom:false,createdAt:1,updatedAt:3 });
    expect(listPublicRooms().map((room) => room.roomCode)).toEqual(['AAAAAA']);
  });
});
