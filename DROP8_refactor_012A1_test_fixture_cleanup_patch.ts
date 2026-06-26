import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const PATCH_NAME = 'Refactor 012A1 — AI Navigation Test Fixture Cleanup';
const PATCH_MARKER = 'DROP8_REFACTOR_012A1_TEST_FIXTURE_CLEANUP';
const dryRun = process.argv.includes('--dry-run');

type Edit = {
  file: string;
  apply: (source: string) => string;
};

function findProjectRoot(start = process.cwd()): string {
  let current = resolve(start);
  for (let depth = 0; depth < 8; depth += 1) {
    const required = [
      join(current, 'package.json'),
      join(current, 'server', 'src', 'rooms', 'Drop8Room.ts'),
      join(current, 'server', 'tests', 'room.test.ts'),
    ];
    if (required.every(existsSync)) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('DROP8 프로젝트 루트를 찾지 못했습니다. 패치 파일을 프로젝트 최상위 폴더에서 실행하세요.');
}

function replaceExactly(source: string, before: string, after: string, label: string): string {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: 예상 문맥이 정확히 1개여야 하지만 ${count}개 발견되었습니다.`);
  }
  return source.replace(before, after);
}

function preserveEol(original: string, normalized: string): string {
  return original.includes('\r\n') ? normalized.replace(/\n/g, '\r\n') : normalized;
}

function writeAtomic(path: string, content: string): void {
  const temp = `${path}.012A1.tmp`;
  writeFileSync(temp, content, 'utf8');
  renameSync(temp, path);
}

const root = findProjectRoot();
console.log(`[${PATCH_NAME}] 프로젝트 루트: ${root}`);

const roomSourcePath = join(root, 'server', 'src', 'rooms', 'Drop8Room.ts');
const roomTestPath = join(root, 'server', 'tests', 'room.test.ts');
const throwableTestPath = join(root, 'server', 'tests', 'throwables.test.ts');

if (!existsSync(throwableTestPath)) {
  throw new Error('Refactor 012 투척물 테스트 파일을 찾지 못했습니다. Refactor 012/012A 적용 상태를 확인하세요.');
}

const currentRoomSource = readFileSync(roomSourcePath, 'utf8');
const currentRoomTest = readFileSync(roomTestPath, 'utf8');

if (currentRoomSource.includes(PATCH_MARKER) && currentRoomTest.includes(PATCH_MARKER)) {
  console.log(`[${PATCH_NAME}] 이미 적용되어 있습니다.`);
  process.exit(0);
}
if (!currentRoomSource.includes('DROP8_REFACTOR_012A_SMOKE_MOTORCYCLE_AI_NAV')) {
  throw new Error('Refactor 012A 적용 마커를 찾지 못했습니다. 012A 패치를 먼저 적용하세요.');
}

const edits: Edit[] = [
  {
    file: 'server/src/rooms/Drop8Room.ts',
    apply: (source) => replaceExactly(
      source,
      "const DROP8_REFACTOR_012A_SMOKE_MOTORCYCLE_AI_NAV=true;\nconst AI_NAV_DEBUG=false;",
      `// DROP8_REFACTOR_012A_SMOKE_MOTORCYCLE_AI_NAV\n// ${PATCH_MARKER}\nconst AI_NAV_DEBUG=false;`,
      '미사용 012A 마커 상수 정리',
    ),
  },
  {
    file: 'server/tests/room.test.ts',
    apply: (source) => {
      let next = replaceExactly(
        source,
        "for (const type of ['chat', 'killfeed', 'result', 'error', 'notice', 'kicked', 'pickupResult', 'positionRecovery', 'vehicleRecovery', 'characterDeath']) {",
        "for (const type of ['chat', 'killfeed', 'result', 'error', 'notice', 'kicked', 'pickupResult', 'positionRecovery', 'vehicleRecovery', 'characterDeath', 'audioEvent']) {",
        'room 테스트 audioEvent 수신 등록',
      );
      next = replaceExactly(
        next,
        "    (room as unknown as { aiThinkAt: Map<string, number> }).aiThinkAt.set(ai.id, 0);\n    human.phase = 'landed';\n    human.x = 3900;\n    human.y = 3900;",
        `    // ${PATCH_MARKER}: 이 테스트는 문 경로를 검증하므로 북쪽 창문을 잠시 경로 후보에서 제외한다.\n    const aiInternals = room as unknown as {\n      aiThinkAt: Map<string, number>;\n      aiIntent: Map<string, { failedWindowId: string; failedWindowUntil: number }>;\n      now: () => number;\n    };\n    aiInternals.aiThinkAt.set(ai.id, 0);\n    const doorRouteWindow = BUILDING_VISIBILITY_ZONES[0]?.windows[0];\n    const doorRouteIntent = aiInternals.aiIntent.get(ai.id);\n    if (doorRouteWindow && doorRouteIntent) {\n      doorRouteIntent.failedWindowId = doorRouteWindow.id;\n      doorRouteIntent.failedWindowUntil = aiInternals.now() + 10;\n    }\n    human.phase = 'landed';\n    human.x = 3900;\n    human.y = 3900;`,
        '문 경로 테스트의 창문 경로 분리',
      );
      next = replaceExactly(
        next,
        "    loot.x = 460;\n    loot.y = 410;\n    room.state.loot.set(loot.id, loot);",
        "    loot.x = 460;\n    loot.y = 410;\n    loot.buildingId = buildingIdAt(loot.x, loot.y, 0, BUILDING_VISIBILITY_ZONES);\n    room.state.loot.set(loot.id, loot);",
        '건물 내부 테스트 전리품 buildingId 설정',
      );
      return next;
    },
  },
  {
    file: 'server/tests/throwables.test.ts',
    apply: (source) => replaceExactly(
      source,
      "    client.onMessage('audioEvent',()=>undefined);client.onMessage('notice',()=>undefined);",
      "    client.onMessage('audioEvent',()=>undefined);client.onMessage('notice',()=>undefined);client.onMessage('chat',()=>undefined);",
      '투척물 테스트 chat 수신 등록',
    ),
  },
];

const prepared = edits.map((edit) => {
  const path = join(root, edit.file);
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`필수 파일이 없습니다: ${edit.file}`);
  const original = readFileSync(path, 'utf8');
  const eolNormalized = original.replace(/\r\n/g, '\n');
  const changedNormalized = edit.apply(eolNormalized);
  if (changedNormalized === eolNormalized) throw new Error(`변경 결과가 없습니다: ${edit.file}`);
  return { ...edit, path, original, changed: preserveEol(original, changedNormalized) };
});

console.log(`[${PATCH_NAME}] 사전 검증 성공: ${prepared.length}개 파일 수정 준비 완료`);
if (dryRun) {
  for (const item of prepared) console.log(`- ${item.file}`);
  console.log(`[${PATCH_NAME}] dry-run 성공. 어떤 파일도 수정하지 않았습니다.`);
  process.exit(0);
}

const backupDir = join(root, 'patch_backups', 'refactor_012A1_test_fixture_cleanup');
mkdirSync(backupDir, { recursive: true });
const written: typeof prepared = [];
try {
  for (const item of prepared) {
    const backupPath = join(backupDir, item.file.replace(/[\\/]/g, '__'));
    copyFileSync(item.path, backupPath);
    writeAtomic(item.path, item.changed);
    written.push(item);
  }

  const verifiedSource = readFileSync(roomSourcePath, 'utf8');
  const verifiedTest = readFileSync(roomTestPath, 'utf8');
  if (!verifiedSource.includes(PATCH_MARKER) || !verifiedTest.includes(PATCH_MARKER)) {
    throw new Error('적용 후 마커 검증에 실패했습니다.');
  }
  if (!verifiedTest.includes('loot.buildingId = buildingIdAt')) {
    throw new Error('테스트 전리품 buildingId 검증에 실패했습니다.');
  }

  console.log(`[${PATCH_NAME}] 적용 성공`);
  console.log(`백업: ${backupDir}`);
  console.log('다음 명령으로 검증하세요:');
  console.log('pnpm --filter @drop8/server exec vitest run tests/room.test.ts -t "routes AI around building walls, through the door, and out of collision" --pool=threads --maxWorkers=1 --no-file-parallelism --testTimeout=20000 --hookTimeout=20000');
  console.log('pnpm run lint && pnpm run test');
} catch (error) {
  for (const item of written.reverse()) {
    try {
      writeAtomic(item.path, item.original);
    } catch {
      // 롤백 실패는 아래 오류와 함께 안내한다.
    }
  }
  for (const item of prepared) {
    const temp = `${item.path}.012A1.tmp`;
    if (existsSync(temp)) unlinkSync(temp);
  }
  throw error;
}
