# 실행과 배포

## 개발

```text
npm install
npm run dev
```

클라이언트와 서버가 `http://localhost:2567`에서 함께 실행됩니다.

## LAN

```text
npm run dev:lan
```

표시된 IPv4 주소를 같은 와이파이 친구에게 전달합니다. 방화벽 자동 변경 기능은 없으며 Windows 알림에서 개인 네트워크만 허용합니다.

## 프로덕션

```text
npm run build
npm start
```

빌드 결과는 사용자의 PC에서 생성됩니다. 소스 ZIP에는 JavaScript 빌드 결과를 포함하지 않습니다.

## 인터넷 배포

Node.js 24 환경에 소스를 업로드하고 `npm install`, `npm run build`, `npm start`를 실행합니다. HTTPS reverse proxy를 사용할 때 WebSocket 업그레이드 헤더를 전달해야 합니다. 공개 서비스에서는 인증, 영구 저장소, 운영 로그, 레이트 리밋과 별도 보안 검토가 필요합니다.
