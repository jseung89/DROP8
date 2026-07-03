# DROP 8 Refactor 024E / 025 FIXED v2 실행 가이드

## 원인

024E FIXED v1이 생성한 `client/src/main.ts`의 HTML 이스케이프 함수에 불필요한 이스케이프가 있었습니다.

```ts
"\\'":"&#39;"
```

ESLint의 `no-useless-escape` 오류를 발생시키므로 다음처럼 수정했습니다.

```ts
"'":"&#39;"
```

024E v1을 기반으로 제작된 025 v1에도 같은 코드가 포함돼 있어 두 실행기를 모두 FIXED v2로 교체합니다.

## 현재 상태

024E v1 검증 실패 뒤 자동 롤백이 완료된 상태에서 진행합니다.

`client/src/main.ts`에서 024E 마커가 검색되지 않는 것이 정상입니다.
기존 `patch_backups/refactor_024e_*_FIXED_v1` 폴더는 실패 시점 백업이며 실행에 영향을 주지 않습니다.

## 사용하지 않을 파일

```text
DROP8_refactor_024E_open_arena_scoreboard_ux_patch_FIXED_v1.ts
DROP8_refactor_025_open_arena_kill_limit_match_cycle_patch_FIXED_v1.ts
```

삭제하지 않아도 되지만 다시 실행하지 않습니다.

## 1. 024E FIXED v2 Dry-run

```cmd
node --experimental-strip-types DROP8_refactor_024E_open_arena_scoreboard_ux_patch_FIXED_v2.ts --dry-run
```

## 2. 024E FIXED v2 실제 적용

```cmd
node --experimental-strip-types DROP8_refactor_024E_open_arena_scoreboard_ux_patch_FIXED_v2.ts
```

마지막에 다음 문구를 확인합니다.

```text
[DROP8 Refactor 024E Open Arena Scoreboard & UX FIXED v2] 적용 성공
```

## 3. 025 FIXED v2 Dry-run

024E v2 적용 성공 후에만 실행합니다.

```cmd
node --experimental-strip-types DROP8_refactor_025_open_arena_kill_limit_match_cycle_patch_FIXED_v2.ts --dry-run
```

## 4. 025 FIXED v2 실제 적용

```cmd
node --experimental-strip-types DROP8_refactor_025_open_arena_kill_limit_match_cycle_patch_FIXED_v2.ts
```

## 롤백

025만 롤백:

```cmd
node --experimental-strip-types DROP8_refactor_025_open_arena_kill_limit_match_cycle_patch_FIXED_v2.ts --rollback
```

024E까지 롤백하려면 반드시 역순으로 실행합니다.

```cmd
node --experimental-strip-types DROP8_refactor_025_open_arena_kill_limit_match_cycle_patch_FIXED_v2.ts --rollback
node --experimental-strip-types DROP8_refactor_024E_open_arena_scoreboard_ux_patch_FIXED_v2.ts --rollback
```

## Git 참고

다음 미추적 파일과 백업 폴더는 게임 소스 오류가 아닙니다.

```text
?? DROP8_refactor_025_COMMAND_GUIDE.md
?? DROP8_refactor_025_open_arena_kill_limit_match_cycle_patch_FIXED_v1.ts
?? patch_backups/refactor_024e_open_arena_scoreboard_ux_FIXED_v1/...
```

024E v2와 025 v2 적용 검증이 끝날 때까지 백업 폴더는 보존하는 것을 권장합니다.
