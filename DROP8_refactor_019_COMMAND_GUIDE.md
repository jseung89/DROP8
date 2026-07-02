# DROP 8 Refactor 019 AI 인간화 패치 실행 가이드

패치 파일:

`DROP8_refactor_019_ai_humanization_perception_combat_dialogue_patch_FIXED_v1.ts`

SHA256:

`65270ad0b0a0ef33690657cc363d79a1c8d378e7bc0fdedcca0209cee86f6275`

## 1. 패치 파일을 프로젝트 루트로 복사

패치 파일을 다음 파일들이 있는 폴더에 둔다.

- `package.json`
- `pnpm-workspace.yaml`
- `server`
- `client`
- `shared`

## 2. SHA256 확인

```cmd
certutil -hashfile DROP8_refactor_019_ai_humanization_perception_combat_dialogue_patch_FIXED_v1.ts SHA256
```

## 3. dry-run

```cmd
node --experimental-strip-types DROP8_refactor_019_ai_humanization_perception_combat_dialogue_patch_FIXED_v1.ts --dry-run
```

`dry-run 성공`과 현재 수동 밸런스 보호 결과를 확인한다.

## 4. 실제 적용

```cmd
node --experimental-strip-types DROP8_refactor_019_ai_humanization_perception_combat_dialogue_patch_FIXED_v1.ts
```

패치 실행기는 자동으로 다음을 수행한다.

- 전체 대상 파일 백업
- Refactor 019 적용
- typecheck
- lint
- Refactor 019 집중 테스트
- 기존 Room·채팅·창문·늑대 회귀 테스트
- 전체 테스트
- 전체 빌드
- `git diff --check`
- 실패 시 전체 자동 롤백

## 5. 개별 검증 재실행

```cmd
pnpm run typecheck
```

```cmd
pnpm run lint
```

```cmd
pnpm --filter @drop8/shared exec vitest run tests/refactor019-ai-humanization.test.ts --reporter=verbose
```

```cmd
pnpm --filter @drop8/server exec vitest run tests/refactor019-ai-humanization.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --testTimeout=30000 --hookTimeout=30000 --reporter=verbose
```

```cmd
pnpm run test
```

```cmd
pnpm run build
```

## 6. 실행

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 2567 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue}" && pnpm dev:lan
```

## 7. AI 디버그 로그

```cmd
set DROP8_AI_DEBUG=1 && pnpm dev:lan
```

서버창에서 다음 로그를 확인할 수 있다.

- `[DROP8 AI HUMAN] acquire`
- `[DROP8 AI HUMAN] lost`
- `[DROP8 AI HUMAN] sound`
- `[DROP8 AI DIALOGUE]`

로그를 끄려면 새 CMD 창에서 평소처럼 실행하거나 다음을 사용한다.

```cmd
set DROP8_AI_DEBUG= && pnpm dev:lan
```

## 8. 백업 확인

```cmd
dir /ad /o-d patch_backups\refactor_019_ai_humanization_perception_combat_dialogue
```

각 백업 폴더에는 다음이 들어 있다.

- 원본 대상 파일
- `manifest.json`
- `verification-log.txt`
- 신규 생성 파일 목록

## 9. 롤백

실제 적용 성공 출력에 표시된 정확한 명령을 사용한다.

형식:

```cmd
node --experimental-strip-types DROP8_refactor_019_ai_humanization_perception_combat_dialogue_patch_FIXED_v1.ts --rollback "patch_backups\refactor_019_ai_humanization_perception_combat_dialogue\<timestamp>"
```

## 10. 성능 확인

AI 7명 경기에서 기존 개발 성능 표시의 다음 값을 패치 전후 비교한다.

- `serverAiMs`
- `serverTickAvg`
- `serverTickP95`
- `serverTickMax`

상세 플레이 검증은 함께 제공된 수동 테스트 체크리스트를 사용한다.
