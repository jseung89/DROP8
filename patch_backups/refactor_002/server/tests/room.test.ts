import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import app from '../src/app.config.js';
import type { Drop8State } from '../src/rooms/schema.js';

describe('DROP 8 room integration', () => {
  let server: ColyseusTestServer<typeof app>;

  beforeAll(async () => {
    server = await boot(app);
  });

  afterAll(async () => {
    await server.shutdown();
  });

  beforeEach(async () => {
    await server.cleanup();
  });

  const quiet = <T extends { onMessage: (type: string, callback: () => void) => unknown }>(client: T): T => {
    for (const type of ['chat', 'killfeed', 'result', 'error']) {
      client.onMessage(type, () => undefined);
    }
    return client;
  };

  it('creates a room and synchronizes two clients', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const first = quiet(await server.connectTo(room, { nickname: 'A' }));
    const second = quiet(await server.connectTo(room, { nickname: 'B' }));
    await room.waitForNextPatch();

    expect(first.state.players.size).toBe(2);
    expect(second.state.roomCode).toHaveLength(6);
  });

  it('fills empty slots with AI after every human is ready', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: true });
    const client = quiet(await server.connectTo(room, { nickname: 'A' }));

    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 80));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(room.state.players.size).toBe(8);
    expect(['PLANE', 'DROP']).toContain(room.state.phase);
  });

  it('accepts eight human clients without adding AI', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const clients = [];

    for (let index = 0; index < 8; index += 1) {
      clients.push(quiet(await server.connectTo(room, { nickname: `P${index + 1}` })));
    }
    for (const client of clients) {
      client.send('ready');
    }
    await new Promise((resolve) => setTimeout(resolve, 160));
    clients[0]?.send('start');
    await new Promise((resolve) => setTimeout(resolve, 180));

    expect(room.state.players.size).toBe(8);
    expect([...room.state.players.values()].filter((player) => player.ai)).toHaveLength(0);
    expect(['PLANE', 'DROP']).toContain(room.state.phase);
  });

  it('moves a client through server-authoritative input', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const client = quiet(await server.connectTo(room, { nickname: 'Mover' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 80));
    client.send('jump');
    await new Promise((resolve) => setTimeout(resolve, 80));

    const player = room.state.players.get(client.sessionId);
    expect(player).toBeDefined();
    player!.altitude = 0;
    player!.phase = 'landed';
    const beforeX = player!.x;
    client.send('input', { x: 1, y: 0, angle: 0, seq: 1 });
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(player!.x).toBeGreaterThan(beforeX);
  });
});
