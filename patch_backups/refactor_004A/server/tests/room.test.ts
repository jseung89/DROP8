import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import app from '../src/app.config.js';
import { OBSTACLES, PLAYER_RADIUS, circleHitsRect } from '@drop8/shared';
import { LootState, type Drop8State } from '../src/rooms/schema.js';

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


  it('keeps a healing item until completion and restores health', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const client = quiet(await server.connectTo(room, { nickname: 'Healer' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 80));

    const player = room.state.players.get(client.sessionId)!;
    player.phase = 'landed';
    player.x = 2048;
    player.y = 2048;
    player.hp = 50;
    player.bandages = 1;
    client.send('heal', { kind: 'auto' });
    await new Promise((resolve) => setTimeout(resolve, 140));

    expect(player.healingKind).toBe('bandage');
    expect(player.bandages).toBe(1);
    expect(player.healingProgress).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 2050));
    expect(player.hp).toBe(75);
    expect(player.bandages).toBe(0);
    expect(player.healingKind).toBe('');
  });

  it('preserves a separate magazine for each firearm', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const client = quiet(await server.connectTo(room, { nickname: 'Switcher' }));
    const player = room.state.players.get(client.sessionId)!;
    player.primary = 'rifle';
    player.secondary = 'pistol';
    player.rifleMagazine = 5;
    player.pistolMagazine = 11;

    client.send('switch', { slot: 1 });
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(player.equipped).toBe('rifle');
    expect(player.magazine).toBe(5);

    client.send('switch', { slot: 2 });
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(player.equipped).toBe('pistol');
    expect(player.magazine).toBe(11);
  });

  it('lets AI choose a suitable loaded weapon for a distant target', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: true });
    const client = quiet(await server.connectTo(room, { nickname: 'Target' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 120));

    const human = room.state.players.get(client.sessionId)!;
    const ai = [...room.state.players.values()].find((player) => player.ai)!;
    for (const [id, player] of [...room.state.players]) {
      if (player.ai && id !== ai.id) room.state.players.delete(id);
    }
    (room as unknown as { aiThinkAt: Map<string, number> }).aiThinkAt.set(ai.id, 0);
    human.phase = 'landed';
    human.x = 3350;
    human.y = 2000;
    ai.phase = 'landed';
    ai.x = 2700;
    ai.y = 2000;
    ai.primary = 'rifle';
    ai.secondary = 'pistol';
    ai.rifleMagazine = 8;
    ai.pistolMagazine = 12;
    ai.equipped = 'pistol';
    ai.magazine = 12;

    const hpBefore = human.hp;
    await new Promise((resolve) => setTimeout(resolve, 520));
    expect(ai.equipped).toBe('rifle');
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(human.hp < hpBefore || !human.alive).toBe(true);
  });

  it('routes AI around building walls, through the door, and out of collision', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: true });
    const client = quiet(await server.connectTo(room, { nickname: 'Observer' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 120));

    const human = room.state.players.get(client.sessionId)!;
    const ai = [...room.state.players.values()].find((player) => player.ai)!;
    for (const [id, player] of [...room.state.players]) {
      if (player.ai && id !== ai.id) room.state.players.delete(id);
    }
    (room as unknown as { aiThinkAt: Map<string, number> }).aiThinkAt.set(ai.id, 0);
    human.phase = 'landed';
    human.x = 3900;
    human.y = 3900;
    ai.phase = 'landed';
    ai.x = 460;
    ai.y = 250;
    ai.primary = '';
    ai.secondary = '';
    ai.equipped = 'fists';
    room.state.zoneX = 460;
    room.state.zoneY = 410;
    room.state.zoneRadius = 1800;
    room.state.loot.clear();

    const loot = new LootState();
    loot.id = 'door-route-pistol';
    loot.kind = 'pistol';
    loot.x = 460;
    loot.y = 410;
    room.state.loot.set(loot.id, loot);

    await new Promise((resolve) => setTimeout(resolve, 5200));
    expect(ai.secondary).toBe('pistol');
    expect(OBSTACLES.some((rect) => circleHitsRect(ai.x, ai.y, PLAYER_RADIUS, rect))).toBe(false);
  });

  it('allows a safe low-health AI to use a bandage', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: true });
    const client = quiet(await server.connectTo(room, { nickname: 'FarAway' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 120));

    const human = room.state.players.get(client.sessionId)!;
    const ai = [...room.state.players.values()].find((player) => player.ai)!;
    human.phase = 'landed';
    human.x = 3900;
    human.y = 3900;
    ai.phase = 'landed';
    ai.x = 2700;
    ai.y = 2000;
    ai.hp = 30;
    ai.bandages = 1;

    await new Promise((resolve) => setTimeout(resolve, 5350));
    expect(ai.hp).toBeGreaterThanOrEqual(55);
    expect(ai.bandages).toBe(0);
    expect(ai.healingKind).toBe('');
  });

});
