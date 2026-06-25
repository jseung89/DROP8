import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const target = path.join(root, 'server', 'tests', 'room.test.ts');
const backupDir = path.join(root, 'patch_backups', 'refactor_004B_sync_hotfix');
const marker = 'REFRACTOR_004B_SYNC_HOTFIX';

if (!fs.existsSync(target)) {
  throw new Error(`대상 파일을 찾을 수 없습니다: ${target}`);
}

const source = fs.readFileSync(target, 'utf8');
if (source.includes(marker)) {
  console.log('DROP 8 Refactor 004B 동기화 핫픽스가 이미 적용되어 있습니다.');
  process.exit(0);
}

const before = `  it('creates a room and synchronizes two clients', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const first = quiet(await server.connectTo(room, { nickname: 'A' }));
    const second = quiet(await server.connectTo(room, { nickname: 'B' }));
    await room.waitForNextPatch();

    expect(first.state.players.size).toBe(2);
    expect(second.state.roomCode).toHaveLength(6);
  });`;

const after = `  it('creates a room and synchronizes two clients', async () => {
    const room = await server.createRoom<Drop8State>('drop8', { fillAi: false });
    const first = quiet(await server.connectTo(room, { nickname: 'A' }));
    const second = quiet(await server.connectTo(room, { nickname: 'B' }));
    await room.waitForNextPatch();

    // ${marker}: waitForNextPatch() advances the server patch clock, but the
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
  });`;

if (!source.includes(before)) {
  throw new Error(
    '패치 기준과 현재 room.test.ts가 일치하지 않습니다. 강제로 덮어쓰지 않았습니다. ' +
    '이미 테스트를 수정했다면 해당 변경을 확인하세요.',
  );
}

fs.mkdirSync(path.dirname(path.join(backupDir, 'server', 'tests', 'room.test.ts')), { recursive: true });
fs.copyFileSync(target, path.join(backupDir, 'server', 'tests', 'room.test.ts'));
fs.writeFileSync(target, source.replace(before, after), 'utf8');

console.log('DROP 8 Refactor 004B 동기화 핫픽스 적용 완료');
console.log('수정 파일: server/tests/room.test.ts');
console.log('백업 위치: patch_backups/refactor_004B_sync_hotfix');
