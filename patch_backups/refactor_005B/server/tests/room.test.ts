import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import app from '../src/app.config.js';
import { BUILDINGS, BUSHES, BUSH_HIDE_DISTANCE, COLLISION_OBSTACLES, LOOT_DOOR_CLEARANCE, LOOT_MIN_DISTANCE, OBSTACLES, PROP_OBSTACLES, PLAYER_RADIUS, circleHitsRect, distance } from '@drop8/shared';
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

    // REFRACTOR_004B_SYNC_HOTFIX: waitForNextPatch() advances the server patch clock, but the
    // second SDK client may decode that patch a few milliseconds later.
    const syncStartedAt = Date.now();
    while (
      (first.state.players?.size ?? 0) !== 2 ||
      (second.state.players?.size ?? 0) !== 2 ||
      typeof second.state.roomCode !== 'string' ||
      second.state.roomCode.length !== 6
    ) {
      if (Date.now() - syncStartedAt >= 1_500) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    expect(room.state.roomCode).toBe(room.roomId);
    expect(first.state.players.size).toBe(2);
    expect(second.state.players.size).toBe(2);
    expect(second.state.roomCode).toBe(room.roomId);
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
    player!.x = 1300;
    player!.y = 1800;
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


  it('prioritizes a nearby weapon over chasing while an AI is unprepared', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: true });
    const client = quiet(await server.connectTo(room, { nickname: 'NearbyEnemy' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 120));

    const human = room.state.players.get(client.sessionId)!;
    const ai = [...room.state.players.values()].find((player) => player.ai)!;
    for (const [id, player] of [...room.state.players]) if (player.ai && id !== ai.id) room.state.players.delete(id);
    const internal = room as unknown as {
      aiThinkAt: Map<string, number>;
      aiLandedAt: Map<string, number>;
      aiIntent: Map<string, { lootId: string }>;
    };
    human.phase = 'landed'; human.x = 2950; human.y = 2000;
    ai.phase = 'landed'; ai.x = 2700; ai.y = 2000; ai.primary = ''; ai.secondary = ''; ai.equipped = 'fists';
    room.state.loot.clear();
    const pistol = new LootState(); pistol.id = 'early-pistol'; pistol.kind = 'pistol'; pistol.x = 2835; pistol.y = 2000;
    room.state.loot.set(pistol.id, pistol);
    internal.aiLandedAt.set(ai.id, 0);
    internal.aiThinkAt.set(ai.id, 0);

    await new Promise((resolve) => setTimeout(resolve, 160));
    expect(['EARLY_LOOT', 'SEEK_WEAPON']).toContain(ai.aiState);
    expect(internal.aiIntent.get(ai.id)?.lootId).toBe(pistol.id);
  });

  it('reserves one loot target for only one AI at a time', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: true });
    const client = quiet(await server.connectTo(room, { nickname: 'Observer' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 120));

    const human = room.state.players.get(client.sessionId)!;
    const ais = [...room.state.players.values()].filter((player) => player.ai).slice(0, 2);
    for (const [id, player] of [...room.state.players]) if (player.ai && !ais.includes(player)) room.state.players.delete(id);
    human.phase = 'landed'; human.x = 3900; human.y = 3900;
    const internal = room as unknown as {
      aiThinkAt: Map<string, number>;
      aiLandedAt: Map<string, number>;
      aiIntent: Map<string, { lootId: string }>;
      lootReservations: Map<string, { aiId: string }>;
    };
    ais.forEach((ai, index) => {
      ai.phase = 'landed'; ai.x = 2600; ai.y = 1900 + index * 160; ai.primary = ''; ai.secondary = ''; ai.equipped = 'fists';
      internal.aiLandedAt.set(ai.id, 0); internal.aiThinkAt.set(ai.id, 0);
    });
    room.state.loot.clear();
    const pistol = new LootState(); pistol.id = 'reserved-pistol'; pistol.kind = 'pistol'; pistol.x = 2800; pistol.y = 1980;
    room.state.loot.set(pistol.id, pistol);

    await new Promise((resolve) => setTimeout(resolve, 220));
    const claimers = ais.filter((ai) => internal.aiIntent.get(ai.id)?.lootId === pistol.id);
    expect(claimers).toHaveLength(1);
    expect(internal.lootReservations.get(pistol.id)?.aiId).toBe(claimers[0]?.id);
  });

  it('spawns separated loot away from doors and walls', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const client = quiet(await server.connectTo(room, { nickname: 'Inspector' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 120));
    const loot = [...room.state.loot.values()];
    for (let index = 0; index < loot.length; index += 1) {
      const item = loot[index]!;
      expect(OBSTACLES.some((rect) => circleHitsRect(item.x, item.y, 28, rect))).toBe(false);
      for (let other = index + 1; other < loot.length; other += 1) {
        expect(distance(item.x, item.y, loot[other]!.x, loot[other]!.y)).toBeGreaterThanOrEqual(LOOT_MIN_DISTANCE - 0.01);
      }
      for (const building of BUILDINGS) {
        const door = building.doorSide === 'north' || building.doorSide === 'south'
          ? { x: building.x + building.w * building.doorOffset, y: building.doorSide === 'north' ? building.y : building.y + building.h }
          : { x: building.doorSide === 'west' ? building.x : building.x + building.w, y: building.y + building.h * building.doorOffset };
        expect(distance(item.x, item.y, door.x, door.y)).toBeGreaterThanOrEqual(LOOT_DOOR_CLEARANCE - 0.01);
      }
    }
  });

  it('spreads death drops instead of stacking them at one point', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const client = quiet(await server.connectTo(room, { nickname: 'Dropper' }));
    const player = room.state.players.get(client.sessionId)!;
    player.x = 2700; player.y = 2000; player.primary = 'rifle'; player.secondary = 'pistol'; player.melee = 'pan';
    player.smallAmmo = 20; player.rifleAmmo = 24; player.shells = 6; player.armor = 80; player.bandages = 2; player.medkits = 1;
    room.state.loot.clear();
    (room as unknown as { dropInventory: (value: typeof player) => void }).dropInventory(player);
    const drops = [...room.state.loot.values()];
    expect(drops.length).toBeGreaterThan(5);
    expect(new Set(drops.map((item) => `${Math.round(item.x)}:${Math.round(item.y)}`)).size).toBe(drops.length);
    expect(drops.every((item) => !OBSTACLES.some((rect) => circleHitsRect(item.x, item.y, PLAYER_RADIUS, rect)))).toBe(true);
  });


  it('conceals a bush player from distant AI until the player attacks', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: true });
    const client = quiet(await server.connectTo(room, { nickname: 'BushTarget' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 120));

    const target = room.state.players.get(client.sessionId)!;
    const ai = [...room.state.players.values()].find((player) => player.ai)!;
    for (const [id, player] of [...room.state.players]) if (player.ai && id !== ai.id) room.state.players.delete(id);
    const internal = room as unknown as {
      updateBushStates: () => void;
      findVisibleTarget: (player: typeof ai, range: number) => typeof target | undefined;
      segmentBlocked: (ax: number, ay: number, bx: number, by: number, radius: number) => boolean;
      aiThinkAt: Map<string, number>;
    };

    const bush = BUSHES.find((candidate) => {
      for (let angleIndex = 0; angleIndex < 16; angleIndex += 1) {
        const angle = angleIndex / 16 * Math.PI * 2;
        const x = candidate.x + Math.cos(angle) * (BUSH_HIDE_DISTANCE + 100);
        const y = candidate.y + Math.sin(angle) * (BUSH_HIDE_DISTANCE + 100);
        if (x < PLAYER_RADIUS || y < PLAYER_RADIUS || x > 4096 - PLAYER_RADIUS || y > 4096 - PLAYER_RADIUS) continue;
        if (OBSTACLES.some((rect) => circleHitsRect(x, y, PLAYER_RADIUS, rect))) continue;
        if (!internal.segmentBlocked(candidate.x, candidate.y, x, y, PLAYER_RADIUS)) return true;
      }
      return false;
    });
    expect(bush).toBeDefined();
    let observerPoint: { x: number; y: number } | undefined;
    for (let angleIndex = 0; angleIndex < 16; angleIndex += 1) {
      const angle = angleIndex / 16 * Math.PI * 2;
      const point = { x: bush!.x + Math.cos(angle) * (BUSH_HIDE_DISTANCE + 100), y: bush!.y + Math.sin(angle) * (BUSH_HIDE_DISTANCE + 100) };
      if (OBSTACLES.some((rect) => circleHitsRect(point.x, point.y, PLAYER_RADIUS, rect))) continue;
      if (!internal.segmentBlocked(bush!.x, bush!.y, point.x, point.y, PLAYER_RADIUS)) { observerPoint = point; break; }
    }
    expect(observerPoint).toBeDefined();

    target.phase = 'landed'; target.x = bush!.x; target.y = bush!.y; target.secondary = 'pistol'; target.equipped = 'pistol'; target.pistolMagazine = 2; target.magazine = 2;
    ai.phase = 'landed'; ai.x = observerPoint!.x; ai.y = observerPoint!.y; ai.primary = 'rifle'; ai.rifleMagazine = 8; ai.equipped = 'rifle'; ai.magazine = 8;
    internal.updateBushStates();
    expect(target.inBush).toBe(true);
    expect(target.bushRevealed).toBe(false);
    expect(internal.findVisibleTarget(ai, 950)).toBeUndefined();

    client.send('input', { x: 0, y: 0, angle: Math.PI, seq: 1 });
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('fire');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(target.bushRevealed).toBe(true);
    expect(internal.findVisibleTarget(ai, 950)?.id).toBe(target.id);
  });


  it('synchronizes reload progress and only fills the magazine after completion', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const client = quiet(await server.connectTo(room, { nickname: 'Reloader' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 90));
    const player = room.state.players.get(client.sessionId)!;
    player.phase = 'landed'; player.secondary = 'pistol'; player.equipped = 'pistol'; player.pistolMagazine = 0; player.magazine = 0; player.smallAmmo = 12;

    client.send('reload');
    await new Promise((resolve) => setTimeout(resolve, 220));
    expect(player.reloading).toBe(true);
    expect(player.reloadWeapon).toBe('pistol');
    expect(player.reloadProgress).toBeGreaterThan(0);
    expect(player.reloadProgress).toBeLessThan(1);
    expect(player.pistolMagazine).toBe(0);
    const bulletsBefore = room.state.bullets.size;
    client.send('fire');
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(room.state.bullets.size).toBe(bulletsBefore);

    await new Promise((resolve) => setTimeout(resolve, 1250));
    expect(player.reloading).toBe(false);
    expect(player.reloadProgress).toBe(0);
    expect(player.pistolMagazine).toBe(12);
    expect(player.smallAmmo).toBe(0);
  });

  it('cancels reload cleanly when switching weapons', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const client = quiet(await server.connectTo(room, { nickname: 'Switcher' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 90));
    const player = room.state.players.get(client.sessionId)!;
    player.phase = 'landed'; player.secondary = 'pistol'; player.equipped = 'pistol'; player.pistolMagazine = 0; player.magazine = 0; player.smallAmmo = 12;
    client.send('reload');
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(player.reloading).toBe(true);
    client.send('switch', { slot: 3 });
    await new Promise((resolve) => setTimeout(resolve, 90));
    expect(player.equipped).toBe('fists');
    expect(player.reloading).toBe(false);
    expect(player.reloadWeapon).toBe('');
    expect(player.pistolMagazine).toBe(0);
  });

  it('recovers a human player placed inside a building wall', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const client = quiet(await server.connectTo(room, { nickname: 'Unstuck' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 90));
    const player = room.state.players.get(client.sessionId)!;
    const wall = OBSTACLES[0]!;
    player.phase = 'landed'; player.x = wall.x + wall.w / 2; player.y = wall.y + wall.h / 2;
    expect(OBSTACLES.some((rect) => circleHitsRect(player.x, player.y, PLAYER_RADIUS, rect))).toBe(true);
    client.send('input', { x: 1, y: 0, angle: 0, seq: 1 });
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(OBSTACLES.some((rect) => circleHitsRect(player.x, player.y, PLAYER_RADIUS, rect))).toBe(false);
  });

  it('validates and broadcasts chat with the authoritative player identity', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const first = quiet(await server.connectTo(room, { nickname: '승이형' }));
    const second = quiet(await server.connectTo(room, { nickname: '친구' }));
    const waitForExpectedChat = (client: typeof first) => new Promise<any>((resolve) => {
      client.onMessage('chat', (message: any) => {
        if (message.text === '병원에 두 명 있어') resolve(message);
      });
    });
    const fromFirst = waitForExpectedChat(first);
    const fromSecond = waitForExpectedChat(second);

    first.send('chat', { text: '  병원에 두 명 있어  ', nickname: '가짜 이름' });
    const [ownMessage, otherMessage] = await Promise.all([fromFirst, fromSecond]);

    for (const message of [ownMessage, otherMessage]) {
      expect(message.text).toBe('병원에 두 명 있어');
      expect(message.sender).toBe('승이형');
      expect(message.nickname).toBe('승이형');
      expect(message.playerId).toBe(first.sessionId);
      expect(message.channel).toBe('lobby');
      expect(message.sentAt).toBeTypeOf('number');
    }
  });


  it('blocks human movement through a solid field prop and publishes server timing metrics', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const client = quiet(await server.connectTo(room, { nickname: 'PropTester' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 90));
    const player = room.state.players.get(client.sessionId)!;
    const prop = PROP_OBSTACLES.find((rect) => rect.w >= 60 && rect.h >= 40)!;
    player.phase = 'landed';
    player.x = prop.x - PLAYER_RADIUS - 3;
    player.y = prop.y + prop.h / 2;
    client.send('input', { x: 1, y: 0, angle: 0, seq: 1 });
    await new Promise((resolve) => setTimeout(resolve, 620));
    expect(circleHitsRect(player.x, player.y, PLAYER_RADIUS, prop)).toBe(false);
    expect(player.x).toBeLessThan(prop.x);
    expect(room.state.serverTickAvg).toBeGreaterThanOrEqual(0);
    expect(room.state.serverTickMax).toBeGreaterThanOrEqual(room.state.serverTickAvg);
  });

  it('synchronizes a randomized plane route and a contained next zone', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const client = quiet(await server.connectTo(room, { nickname: 'RouteTester' }));
    client.send('ready');
    await new Promise((resolve) => setTimeout(resolve, 60));
    client.send('start');
    await new Promise((resolve) => setTimeout(resolve, 120));
    const routeLength = distance(room.state.planeStartX, room.state.planeStartY, room.state.planeEndX, room.state.planeEndY);
    expect(routeLength).toBeGreaterThan(4096);
    expect(Number.isFinite(room.state.planeAngle)).toBe(true);
    expect(distance(room.state.zoneX, room.state.zoneY, room.state.nextZoneX, room.state.nextZoneY) + room.state.nextZoneRadius)
      .toBeLessThanOrEqual(room.state.zoneRadius - 27.5);
    expect(COLLISION_OBSTACLES.length).toBeGreaterThan(OBSTACLES.length);
  });



});
