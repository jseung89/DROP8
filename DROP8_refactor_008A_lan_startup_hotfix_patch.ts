import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PATCH_NAME = 'Refactor 008A LAN Startup Hotfix';
const BACKUP_DIR = 'patch_backups/refactor_008A_lan_startup_hotfix';

function findProjectRoot(start: string): string {
  let current = path.resolve(start);
  while (true) {
    const packageJson = path.join(current, 'package.json');
    const serverIndex = path.join(current, 'server/src/index.ts');
    if (fs.existsSync(packageJson) && fs.existsSync(serverIndex)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('DROP 8 프로젝트 루트를 찾지 못했습니다. 이 파일을 프로젝트 최상위 폴더에 넣고 실행하세요.');
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = (() => {
  for (const candidate of [process.cwd(), scriptDir]) {
    try { return findProjectRoot(candidate); } catch { /* try next */ }
  }
  return findProjectRoot(process.cwd());
})();

const targets = [
  'package.json',
  'server/src/index.ts',
  'README.md',
  'docs/PATCH_NOTES.md',
] as const;

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function write(relative: string, content: string): void {
  fs.writeFileSync(path.join(root, relative), content, 'utf8');
}

function backup(): void {
  const backupRoot = path.join(root, BACKUP_DIR);
  fs.mkdirSync(backupRoot, { recursive: true });
  for (const relative of targets) {
    const source = path.join(root, relative);
    if (!fs.existsSync(source)) continue;
    const destination = path.join(backupRoot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

function patchPackageJson(source: string): string {
  const parsed = JSON.parse(source) as { scripts?: Record<string, string>; [key: string]: unknown };
  parsed.scripts ??= {};
  parsed.scripts['start:lan'] = 'cross-env NODE_ENV=production DROP8_LAN=1 PORT=2567 node server/build/index.js';
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function patchServerIndex(source: string): string {
  if (source.includes('Refactor 008A LAN startup hotfix')) return source;

  const oldHeader = `const port = Number(process.env.PORT ?? 2567);\nconst isLan = process.env.DROP8_LAN === '1';\n\nfunction getLanAddresses(): string[] {\n  const addresses = new Set<string>();\n  for (const interfaces of Object.values(os.networkInterfaces())) {\n    for (const info of interfaces ?? []) {\n      if (info.family === 'IPv4' && !info.internal) {\n        addresses.add(info.address);\n      }\n    }\n  }\n  return [...addresses];\n}`;

  const newHeader = `const port = Number(process.env.PORT ?? 2567);\nconst isLanMode = process.env.DROP8_LAN === '1';\nconst isCloud = process.env.COLYSEUS_CLOUD !== undefined;\n\n// Refactor 008A LAN startup hotfix\nfunction isPrivateIpv4(address: string): boolean {\n  const parts = address.split('.').map(Number);\n  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;\n  return parts[0] === 10\n    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)\n    || (parts[0] === 192 && parts[1] === 168);\n}\n\nfunction getLanAddresses(): string[] {\n  const privateAddresses = new Set<string>();\n  const fallbackAddresses = new Set<string>();\n  for (const interfaces of Object.values(os.networkInterfaces())) {\n    for (const info of interfaces ?? []) {\n      if (info.family !== 'IPv4' || info.internal || info.address.startsWith('169.254.')) continue;\n      fallbackAddresses.add(info.address);\n      if (isPrivateIpv4(info.address)) privateAddresses.add(info.address);\n    }\n  }\n  return [...(privateAddresses.size > 0 ? privateAddresses : fallbackAddresses)].sort();\n}`;

  if (!source.includes(oldHeader)) {
    throw new Error('server/src/index.ts의 LAN 주소 탐색 코드를 찾지 못했습니다. 이미 다른 패치로 구조가 바뀌었는지 확인하세요.');
  }
  let result = source.replace(oldHeader, newHeader);

  const oldOutput = `console.log(\`내 접속 주소: http://localhost:\${port}\`);\nif (isLan) {\n  const addresses = getLanAddresses();\n  if (addresses.length === 0) {\n    console.log('친구 접속 주소를 자동으로 찾지 못했습니다. ipconfig에서 IPv4 주소를 확인하세요.');\n  } else {\n    for (const address of addresses) {\n      console.log(\`친구 접속 주소: http://\${address}:\${port}\`);\n    }\n  }\n  console.log('Windows 방화벽 알림이 뜨면 개인 네트워크만 허용하세요.');\n}\nconsole.log(\`사용 포트: \${port}\`);`;

  const newOutput = `console.log(\`내 접속 주소: http://localhost:\${port}\`);\nconst lanAddresses = isCloud ? [] : getLanAddresses();\nif (lanAddresses.length === 0) {\n  console.log('친구 접속 주소를 자동으로 찾지 못했습니다. Windows에서 ipconfig를 실행해 Wi-Fi IPv4 주소를 확인하세요.');\n} else {\n  for (const address of lanAddresses) {\n    console.log(\`친구 접속 주소: http://\${address}:\${port}/\`);\n  }\n  console.log(\`연결 확인 주소: http://\${lanAddresses[0]}:\${port}/api/health\`);\n}\nif (isLanMode) {\n  console.log('LAN 모드: 같은 와이파이의 친구가 위 주소로 접속할 수 있습니다.');\n  console.log('Windows 방화벽 알림이 뜨면 개인 네트워크만 허용하세요.');\n} else {\n  console.log('LAN 전용 실행: pnpm dev:lan 또는 빌드 후 pnpm start:lan');\n}\nconsole.log(\`사용 포트: \${port}\`);`;

  if (!result.includes(oldOutput)) {
    throw new Error('server/src/index.ts의 시작 주소 출력 코드를 찾지 못했습니다.');
  }
  result = result.replace(oldOutput, newOutput);
  return result;
}

function patchReadme(source: string): string {
  const marker = '## LAN 시작 주소 Hotfix';
  if (source.includes(marker)) return source;
  return `${source.trimEnd()}\n\n${marker}\n\n개발 모드에서 같은 와이파이로 실행:\n\n\`\`\`text\npnpm dev:lan\n\`\`\`\n\n프로덕션 빌드 후 같은 와이파이로 실행:\n\n\`\`\`text\npnpm build\npnpm start:lan\n\`\`\`\n\n서버가 시작되면 \`친구 접속 주소: http://IPv4주소:2567/\`가 표시됩니다. \`pnpm dev\` 또는 \`pnpm start\`로 실행해도 탐지 가능한 LAN 주소는 함께 출력됩니다.\n`;
}

function patchNotes(source: string): string {
  const marker = '## Refactor 008A — LAN 시작 주소 Hotfix';
  if (source.includes(marker)) return source;
  return `${source.trimEnd()}\n\n${marker}\n\n- 일반 개발 및 프로덕션 시작에서도 같은 와이파이용 IPv4 접속 주소를 출력합니다.\n- 가상·링크 로컬 주소보다 10.x, 172.16~31.x, 192.168.x 사설 IPv4를 우선합니다.\n- 빌드 서버용 \`pnpm start:lan\` 명령을 추가합니다.\n- 접속 확인용 \`/api/health\` 주소를 함께 출력합니다.\n`;
}

function run(command: string): void {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) throw new Error(`검사 실패: ${command}`);
}

console.log(`\n${PATCH_NAME}`);
console.log(`프로젝트: ${root}`);

const packageBefore = read('package.json');
const serverBefore = read('server/src/index.ts');
if (serverBefore.includes('Refactor 008A LAN startup hotfix')) {
  console.log('이미 Refactor 008A가 적용되어 있습니다. 파일을 다시 수정하지 않습니다.');
  process.exit(0);
}

const patched = new Map<string, string>([
  ['package.json', patchPackageJson(packageBefore)],
  ['server/src/index.ts', patchServerIndex(serverBefore)],
  ['README.md', patchReadme(read('README.md'))],
  ['docs/PATCH_NOTES.md', patchNotes(read('docs/PATCH_NOTES.md'))],
]);

// 전체 변환이 성공한 다음에만 원본을 백업하고 기록한다.
backup();
for (const [relative, content] of patched) write(relative, content);

console.log(`\n백업 완료: ${BACKUP_DIR}`);
console.log('수정 완료: package.json, server/src/index.ts, README.md, docs/PATCH_NOTES.md');

run('pnpm typecheck');
run('pnpm lint');
run('pnpm test');
run('pnpm build');

console.log('\nRefactor 008A 적용 및 자동 검사가 완료되었습니다.');
console.log('개발 LAN 실행: pnpm dev:lan');
console.log('빌드 LAN 실행: pnpm start:lan');
console.log('터미널에 표시되는 "친구 접속 주소"를 같은 와이파이 사용자에게 전달하세요.');
