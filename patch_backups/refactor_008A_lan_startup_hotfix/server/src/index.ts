import os from 'node:os';
import { listen } from '@colyseus/tools';
import app from './app.config.js';

const port = Number(process.env.PORT ?? 2567);
const isLan = process.env.DROP8_LAN === '1';

function getLanAddresses(): string[] {
  const addresses = new Set<string>();
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const info of interfaces ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        addresses.add(info.address);
      }
    }
  }
  return [...addresses];
}

await listen(app, port);

console.log('');
console.log(process.env.NODE_ENV === 'production' ? 'DROP 8 서버 실행 중' : 'DROP 8 개발 서버 실행 중');
console.log('');
console.log(`내 접속 주소: http://localhost:${port}`);
if (isLan) {
  const addresses = getLanAddresses();
  if (addresses.length === 0) {
    console.log('친구 접속 주소를 자동으로 찾지 못했습니다. ipconfig에서 IPv4 주소를 확인하세요.');
  } else {
    for (const address of addresses) {
      console.log(`친구 접속 주소: http://${address}:${port}`);
    }
  }
  console.log('Windows 방화벽 알림이 뜨면 개인 네트워크만 허용하세요.');
}
console.log(`사용 포트: ${port}`);
console.log('종료: 터미널에서 Ctrl+C');
console.log('');
