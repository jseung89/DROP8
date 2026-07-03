# DROP 8 Refactor 021 AI Persona Fast Dialogue — CMD 가이드

프로젝트 루트:

```text
C:\Users\Playdata\Downloads\DROP8_SOURCE_ONLY\DROP8_SOURCE
```

패치 파일:

```text
DROP8_refactor_021_ai_persona_fast_dialogue_patch_FIXED_v1.ts
```

## 1. SHA256 확인

```cmd
certutil -hashfile DROP8_refactor_021_ai_persona_fast_dialogue_patch_FIXED_v1.ts SHA256
```

정상 SHA256:

```text
4b2f1b99b8bfe3d000327da0e66306eb3e525cc21705643279dd07fd26bc14c0
```

## 2. Dry-run

```cmd
node --experimental-strip-types DROP8_refactor_021_ai_persona_fast_dialogue_patch_FIXED_v1.ts --dry-run
```

마지막에 다음 문구가 표시되어야 한다.

```text
dry-run 성공: 실제 파일과 백업을 만들지 않았습니다.
```

## 3. 실제 적용

```cmd
node --experimental-strip-types DROP8_refactor_021_ai_persona_fast_dialogue_patch_FIXED_v1.ts
```

자동 검증 순서:

1. TypeScript typecheck
2. ESLint
3. Refactor 021 및 Refactor 019 집중 테스트
4. Room 및 Refactor 020 회귀 테스트
5. 전체 테스트
6. 전체 빌드
7. git diff --check

하나라도 실패하면 이번 패치가 변경한 파일을 자동 롤백한다.

## 4. 실행

```cmd
set DROP8_AI_DEBUG=1 && pnpm dev:lan
```

## 5. 적용 확인

```cmd
findstr /n /c:"DROP8_REFACTOR_021_AI_PERSONA_DIALOGUE" /c:"AI_PERSONA_NAMES" /c:"락승타" server\src\rooms\Drop8Room.ts server\src\rooms\aiDialogueProfiles.ts
```

## 6. 수동 롤백

실제 적용 성공 로그에 출력된 백업 경로를 사용한다.

```cmd
node --experimental-strip-types DROP8_refactor_021_ai_persona_fast_dialogue_patch_FIXED_v1.ts --rollback "patch_backups\refactor_021_ai_persona_fast_dialogue\YYYYMMDD_HHMMSS"
```

## 핵심 변경

- AI 이름을 `준희커`, `대성(빅생)`, `양정횬`, `페이커`, `케리아`, `윤석10`, `락승타`로 고정한다.
- 손흥민을 락승타로 교체한다.
- AI마다 150개 이상의 고유 대사와 고정 성격·숙련도 성향을 부여한다.
- 기존 Refactor 019 인지·전투 행동에 페르소나별 전술 대사를 연결한다.
- 평상시에도 AI가 자주 떠들고 가까운 AI가 0.4~1.5초 뒤 받아친다.
- 최근 15개 대사를 기억하며 같은 대사는 최소 40초 동안 반복하지 않는다.
- 평상시 잡담은 머리 위 말풍선에만 표시하고 왼쪽 채팅 로그를 도배하지 않는다.
- 플레이어 채팅 입력 및 Space 키 로직은 변경하지 않는다.
- 기존 무기·오토바이·늑대인간·제단·맵 밸런스는 변경하지 않는다.
