import os from 'node:os';
import { listen } from '@colyseus/tools';
import app from './app.config.js';

const port = Number(process.env.PORT ?? 2567);
const isLanMode = process.env.DROP8_LAN === '1';
const isCloud = process.env.COLYSEUS_CLOUD !== undefined;

// Refactor 008A LAN startup hotfix
function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function getLanAddresses(): string[] {
  const privateAddresses = new Set<string>();
  const fallbackAddresses = new Set<string>();
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const info of interfaces ?? []) {
      if (info.family !== 'IPv4' || info.internal || info.address.startsWith('169.254.')) continue;
      fallbackAddresses.add(info.address);
      if (isPrivateIpv4(info.address)) privateAddresses.add(info.address);
    }
  }
  return [...(privateAddresses.size > 0 ? privateAddresses : fallbackAddresses)].sort();
}

await listen(app, port);

console.log('');
console.log(process.env.NODE_ENV === 'production' ? 'DROP 8 서버 실행 중' : 'DROP 8 개발 서버 실행 중');
console.log('');
console.log(`내 접속 주소: http://localhost:${port}`);
const lanAddresses = isCloud ? [] : getLanAddresses();
if (lanAddresses.length === 0) {
  console.log('친구 접속 주소를 자동으로 찾지 못했습니다. Windows에서 ipconfig를 실행해 Wi-Fi IPv4 주소를 확인하세요.');
} else {
  for (const address of lanAddresses) {
    console.log(`친구 접속 주소: http://${address}:${port}/`);
  }
  console.log(`연결 확인 주소: http://${lanAddresses[0]}:${port}/api/health`);
}
if (isLanMode) {
  console.log('LAN 모드: 같은 와이파이의 친구가 위 주소로 접속할 수 있습니다.');
  console.log('Windows 방화벽 알림이 뜨면 개인 네트워크만 허용하세요.');
} else {
  console.log('LAN 전용 실행: pnpm dev:lan 또는 빌드 후 pnpm start:lan');
}
console.log(`사용 포트: ${port}`);
console.log('종료: 터미널에서 Ctrl+C');
console.log('');
