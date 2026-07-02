# DROP 8 Refactor 020 FIXED v2 적용 가이드

패치 파일:

`DROP8_refactor_020_ai_vehicle_supply_werewolf_predator_adhesive_patch_FIXED_v2.ts`

이 파일은 **FIXED v1의 누적 대체본**입니다.

- 아직 v1을 적용하지 않았다면 v2만 적용합니다.
- 이미 v1을 성공 적용했다면 같은 v2를 그대로 실행할 수 있습니다.
- v1과 v2를 연속으로 새로 적용할 필요는 없습니다.

## 포함 기능

- AI 오토바이 쟁탈·탑승·주행·목표 근처 하차
- AI 일반 아이템·보급·늑대인간 제단 이용
- 목표 획득 후 기존 오토바이 재탑승
- 늑대인간 기본 추격력과 질주력 강화
- 늑대인간 일반 총탄·샷건·폭발·근접·화염·차량 피해 저항 강화
- 은화살과 자기장 규칙 유지
- 늑대인간 근접 오라 도트 피해
- 늑대가 오토바이에 0.8초 이상 비비면 오토바이 도트 피해와 운전자 강제 하차
- 점착 분사기 3단계 누적 감속
- 분사 종료 뒤 3초간 점진적 속도 회복
- 오토바이 점착 감속 강화
- 점착 단계 네트워크 동기화·로컬 이동 예측·시각 효과

## 주요 수치

### 늑대인간

- 일반 이동속도: 오토바이 최고속도 기준 `1.18배`
- 질주속도: 오토바이 최고속도 기준 `1.55배`
- 총탄 피해: `20%`
- 폭발 피해: `35%`
- 근접 피해: `18%`
- 화염 피해: `22%`
- 차량 충돌 피해: `25%`
- 자기장 피해: `100%`
- 은화살: 기존 전용 피해 유지
- 근접 오라 반경: `60px`
- 사람 오라 피해: `0.4초마다 3`
- 오토바이 오라 피해: `0.4초마다 2`
- 오토바이 접촉 강제 하차: `0.8초 지속 접촉`

샷건은 `15 × 8 × 20% = 최대 24 피해`입니다.

### 점착 분사기

- 1단계: 속도 `72%`, 2.5초 유지
- 2단계: 속도 `55%`, 3.5초 유지
- 3단계: 속도 `38%`, 4.5초 유지
- 이후 `3초` 동안 정상 속도로 점진 회복
- 오토바이 최대속도 `45%`, 가속 `30%`, 조향 `65%`
- 오토바이 기본 감속 지속 `5초`, 연장 상한 `7초`

## 적용 순서

프로젝트 루트:

```text
C:\Users\Playdata\Downloads\DROP8_SOURCE_ONLY\DROP8_SOURCE
```

### 1. SHA256 확인

```cmd
certutil -hashfile DROP8_refactor_020_ai_vehicle_supply_werewolf_predator_adhesive_patch_FIXED_v2.ts SHA256
```

### 2. Dry-run

```cmd
node --experimental-strip-types DROP8_refactor_020_ai_vehicle_supply_werewolf_predator_adhesive_patch_FIXED_v2.ts --dry-run
```

마지막에 아래 문구가 나와야 합니다.

```text
dry-run 성공: 실제 파일과 백업을 만들지 않았습니다.
```

### 3. 실제 적용

```cmd
node --experimental-strip-types DROP8_refactor_020_ai_vehicle_supply_werewolf_predator_adhesive_patch_FIXED_v2.ts
```

패치가 자동으로 실행하는 검사:

- 전체 TypeScript typecheck
- ESLint
- shared 늑대·점착 집중 테스트
- AI 차량·늑대 오라·점착 집중 테스트
- Room·보급·늑대·점착 회귀 테스트
- 전체 테스트
- 전체 빌드
- git diff check

실패하면 이번 패치가 변경한 파일 전체를 자동 롤백합니다.

### 4. 게임 실행

```cmd
set DROP8_AI_DEBUG=1 && pnpm dev:lan
```

## 수동 롤백

적용 성공 로그에 표시된 백업 경로를 사용합니다.

```cmd
node --experimental-strip-types DROP8_refactor_020_ai_vehicle_supply_werewolf_predator_adhesive_patch_FIXED_v2.ts --rollback "patch_backups\refactor_020_ai_vehicle_werewolf_predator_adhesive\날짜시간"
```
