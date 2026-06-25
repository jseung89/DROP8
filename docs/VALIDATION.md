# 검증 결과

검증 환경: Linux 컨테이너, Node.js 22.16.0, npm 10.9.2

Windows 실행 목표: Node.js 24 LTS와 VS Code 또는 Windows Terminal

## 통과

- `npm install`
- `npm run typecheck`
- `npm run lint`
- 공유 규칙 Vitest 3개
- Colyseus 통합 Vitest 4개
- `npm run build`
- `npm run check`
- `npm run dev` 2567 포트 실행
- 개발 모드 `/api/health` HTTP 200
- 개발 모드 HTML 제공
- 실제 Colyseus SDK 클라이언트 2개 연결
- 방 생성, 두 사용자 참가, 준비, AI 6명 충원
- 비행기 단계와 두 사용자 동시 낙하
- `npm run dev:lan` LAN IPv4 주소 표시
- 프로덕션 `npm start` HTTP 200 및 HTML 제공
- `npm audit`: 취약점 0개

## 테스트 수

- 단위 테스트: 3개 통과
- 서버 통합 테스트: 4개 통과

## 제한

현재 환경은 Windows가 아니므로 VS Code와 Windows 방화벽 알림 자체는 직접 검증하지 못했습니다. ZIP에는 Windows가 위험 확장자로 분류하는 실행 스크립트와 사전 빌드 JavaScript를 포함하지 않습니다.
