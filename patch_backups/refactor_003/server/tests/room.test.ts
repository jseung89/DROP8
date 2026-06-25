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

  it('moves landed AI continuously between decision ticks', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: true });
    const client = quiet(await server.connectTo(room, { nickname: 'Host' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 120));

    const ai = [...room.state.players.values()].find((player) => player.ai);
    expect(ai).toBeDefined();
    ai!.phase = 'landed';
    ai!.x = 2700;
    ai!.y = 2000;
    const before = { x: ai!.x, y: ai!.y };
    await new Promise((resolve) => setTimeout(resolve, 520));

    expect(Math.hypot(ai!.x - before.x, ai!.y - before.y)).toBeGreaterThan(8);
  });

  it('applies hit state and knockback for a fist attack', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const attacker = quiet(await server.connectTo(room, { nickname: 'Attacker' }));
    const victim = quiet(await server.connectTo(room, { nickname: 'Victim' }));
    attacker.send('ready');
    victim.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 70));
    attacker.send('start');
    await new Promise((resolve) => setTimeout(resolve, 100));

    const a = room.state.players.get(attacker.sessionId)!;
    const v = room.state.players.get(victim.sessionId)!;
    a.phase = 'landed';
    v.phase = 'landed';
    a.x = 2700;
    a.y = 2000;
    v.x = 2750;
    v.y = 2000;
    const beforeX = v.x;
    attacker.send('input', { x: 0, y: 0, angle: 0, seq: 1 });
    await new Promise((resolve) => setTimeout(resolve, 60));
    attacker.send('melee');
    await new Promise((resolve) => setTimeout(resolve, 180));

    expect(v.hitSeq).toBeGreaterThan(0);
    expect(v.lastHitDamage).toBeGreaterThan(0);
    expect(v.x).toBeGreaterThan(beforeX);
  });

});
