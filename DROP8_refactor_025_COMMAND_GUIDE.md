# DROP 8 Refactor 025 — Open Arena Kill Limit & Match Cycle

## 현재 최신 ZIP 확인 결과

첨부된 최신 ZIP의 실제 실행 소스에는 Refactor 024A~024D가 적용되어 있고, Refactor 024E 패치 실행기 파일은 존재하지만 024E 소스 마커는 아직 적용되지 않았습니다.

따라서 반드시 024E를 먼저 적용한 뒤 025를 실행합니다.

## 1. Refactor 024E 확인 및 적용

```cmd
node --experimental-strip-types DROP8_refactor_024E_open_arena_scoreboard_ux_patch_FIXED_v1.ts --dry-run
```

성공하면:

```cmd
node --experimental-strip-types DROP8_refactor_024E_open_arena_scoreboard_ux_patch_FIXED_v1.ts
```

## 2. Refactor 025 Dry-run

```cmd
node --experimental-strip-types DROP8_refactor_025_open_arena_kill_limit_match_cycle_patch_FIXED_v1.ts --dry-run
```

## 3. Refactor 025 실제 적용

```cmd
node --experimental-strip-types DROP8_refactor_025_open_arena_kill_limit_match_cycle_patch_FIXED_v1.ts
```

## 4. Refactor 025 롤백

```cmd
node --experimental-strip-types DROP8_refactor_025_open_arena_kill_limit_match_cycle_patch_FIXED_v1.ts --rollback
```

## 적용 기능

- Open Arena 방 생성 시 10킬 / 20킬 / 30킬 / 무제한 선택
- 기본값 20킬
- 인간이 인간 또는 AI를 처치한 킬 모두 목표 킬에 포함
- AI는 라운드 승자가 될 수 없음
- AI는 실시간 인간 순위 및 정산 순위에서 제외
- 인간킬과 AI킬 분리 표시
- 목표 달성 후 총 8초 정산 및 카운트다운
- 같은 방, 같은 방장, 같은 AI 설정으로 다음 라운드 재시작
- 무제한 방은 자동 정산 및 점수 초기화 없음
- 기존 Battle Royale 규칙 보존

## 실행기 안전장치

- Refactor 024E 직전 단계 확인
- 정확한 원본 파일 SHA256 검증
- dry-run
- 이미 적용됨 및 부분 적용 탐지
- 전체 대상 파일 백업
- 실패 시 자동 롤백
- 명시적 `--rollback`
- typecheck / lint / 집중 테스트 / 회귀 테스트 / 전체 테스트 / build / git diff --check
