# DROP 8 Refactor 020 적용 가이드

## 패치 범위

- AI가 같은 빈 오토바이를 동시에 추적하는 쟁탈전
- 먼저 도착한 AI의 서버 권위 탑승
- 보급·전리품·자기장·순찰·늑대인간 제단을 향한 AI 주행
- 벽 사전 탐지, 한 방향 회피 유지, 후진 복구
- 목표 근처 안전 하차
- 보급 개봉과 주변 가치 아이템 연속 획득
- 사용한 오토바이로 복귀 및 재탑승
- AI의 제단 의식, 저주 획득, 자동 늑대인간 변신
- 기존 AI 이름·대화·순찰·대형 건물 경로·무기 및 차량 밸런스 보존

## 1. 파일 배치

`DROP8_refactor_020_ai_vehicle_supply_werewolf_objective_patch_FIXED_v1.ts`를 프로젝트 루트에 넣습니다.

예시:

```text
C:\Users\Playdata\Downloads\DROP8_SOURCE_ONLY\DROP8_SOURCE
```

## 2. Dry-run

```cmd
node --experimental-strip-types DROP8_refactor_020_ai_vehicle_supply_werewolf_objective_patch_FIXED_v1.ts --dry-run
```

`dry-run 성공`이 출력되어야 합니다.

## 3. 실제 적용

```cmd
node --experimental-strip-types DROP8_refactor_020_ai_vehicle_supply_werewolf_objective_patch_FIXED_v1.ts
```

패치가 자동으로 실행하는 검증:

- 전체 TypeScript typecheck
- ESLint
- Refactor 020 집중 테스트
- Room·보급·늑대인간 회귀 테스트
- 전체 테스트
- 전체 빌드
- git diff check

중간 검증이 실패하면 이번 패치가 변경한 파일을 자동 롤백합니다.

## 4. 실행

```cmd
set DROP8_AI_DEBUG=1 && pnpm dev:lan
```

주요 로그:

```text
[DROP8 AI VEHICLE] seek
[DROP8 AI VEHICLE] mounted
[DROP8 AI VEHICLE] reverse-recovery
[DROP8 AI VEHICLE] dismount-objective
[DROP8 AI VEHICLE] return
[DROP8 AI OBJECTIVE] select
[DROP8 AI OBJECTIVE] supply-open
[DROP8 AI OBJECTIVE] altar-ritual
[DROP8 AI RIVALRY] vehicle-lost
```

## 5. 실제 플레이 확인

1. AI 둘 이상이 같은 빈 오토바이를 향해 달리는지 확인합니다.
2. 한 AI만 탑승하고 나머지는 목표를 다시 판단하는지 확인합니다.
3. 운전 AI가 벽에 무한히 박지 않고 후진 또는 방향 전환하는지 확인합니다.
4. AI가 보급 근처에서 내려 상자를 열고 주변 아이템을 먹는지 확인합니다.
5. 먹은 뒤 오토바이가 남아 있으면 다시 돌아가 타는지 확인합니다.
6. AI가 활성 제단 근처에서 내려 의식을 시작하는지 확인합니다.
7. 의식 성공 후 저주를 얻고 자동 변신하는지 확인합니다.
8. 늑대인간 상태에서 오토바이를 다시 타지 않는지 확인합니다.

## 6. 수동 롤백

적용 성공 로그에 표시된 백업 경로를 사용합니다.

```cmd
node --experimental-strip-types DROP8_refactor_020_ai_vehicle_supply_werewolf_objective_patch_FIXED_v1.ts --rollback "patch_backups\refactor_020_ai_vehicle_supply_werewolf_objective\백업폴더"
```
