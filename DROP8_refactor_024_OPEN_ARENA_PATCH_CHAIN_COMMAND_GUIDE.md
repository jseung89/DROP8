# DROP 8 Refactor 024 — Open Arena 패치 체인 실행 가이드

기준 소스: 최신 `DROP8_SOURCE.zip`  
기준 ZIP SHA256: `249aea52cdb24a2ea973a919410c2782673f31023f4b5747cf4f1fcf6cc95dad`

## 중요

반드시 아래 순서로 한 단계씩 적용한다.

```text
024A → 024B → 024C → 024D → 024E
```

각 단계 적용이 성공한 뒤 다음 단계로 이동한다. 직전 단계가 없거나 파일이 수동 변경된 경우 실행기가 자동으로 중단한다.

## 패치 역할

| 단계 | 내용 |
|---|---|
| 024A | 신규 Open Arena 모드, 인간 정원·AI 수 분리, 자기장·최후 생존자 종료 비활성화 |
| 024B | 진행 중 난입, 방장 승계, 마지막 인간 퇴장 후 EMPTY_GRACE 및 방 폐기 |
| 024C | 인간·AI 반복 리스폰, AI 고정 슬롯, 안전 스폰, 2초 스폰 보호 |
| 024D | 아이템 슬롯 재생성, 제한 사망 드롭, 60초 TTL, 오토바이 재생성, 월드 정리 |
| 024E | 킬·데스·K/D·연속 처치, 인간/AI 처치 구분, Open Arena 점수판과 HUD |

## 1. 프로젝트 최상위 폴더에 파일 복사

다음 파일 5개를 `package.json`, `server`, `client`, `shared` 폴더가 있는 프로젝트 최상위 폴더에 넣는다.

- `DROP8_refactor_024A_open_arena_foundation_patch_FIXED_v1.ts`
- `DROP8_refactor_024B_open_arena_lifecycle_host_migration_patch_FIXED_v1.ts`
- `DROP8_refactor_024C_open_arena_respawn_patch_FIXED_v1.ts`
- `DROP8_refactor_024D_open_arena_persistent_world_patch_FIXED_v1.ts`
- `DROP8_refactor_024E_open_arena_scoreboard_ux_patch_FIXED_v1.ts`

## 2. SHA256 확인

```cmd
certutil -hashfile DROP8_refactor_024A_open_arena_foundation_patch_FIXED_v1.ts SHA256
```

예상값: `e4cb42f5d2b05302763f81547a37a6aa216062e0ccc2beebe9896b0088f1c042`

```cmd
certutil -hashfile DROP8_refactor_024B_open_arena_lifecycle_host_migration_patch_FIXED_v1.ts SHA256
```

예상값: `cd8dc0481717b33a4c2a15df98f222c4b63aa9ad193c2656ab1b9a5cbd9fd97b`

```cmd
certutil -hashfile DROP8_refactor_024C_open_arena_respawn_patch_FIXED_v1.ts SHA256
```

예상값: `f3835a87e4e410675a851a1ee6bfec8ccb481f2270fbb4b8908a1d55a63cd7f6`

```cmd
certutil -hashfile DROP8_refactor_024D_open_arena_persistent_world_patch_FIXED_v1.ts SHA256
```

예상값: `7aaac10c40e06db65654176a2670d51a8bc9365c3e2f6c03971b16f6442a4749`

```cmd
certutil -hashfile DROP8_refactor_024E_open_arena_scoreboard_ux_patch_FIXED_v1.ts SHA256
```

예상값: `d3ca0d9b37916684cf5af1a900e6154fdf594406a9cbd67110f378a18dbb99b9`

## 3. 024A 적용

```cmd
node --experimental-strip-types DROP8_refactor_024A_open_arena_foundation_patch_FIXED_v1.ts --dry-run
node --experimental-strip-types DROP8_refactor_024A_open_arena_foundation_patch_FIXED_v1.ts
```

성공 메시지를 확인한 뒤 게임의 기존 배틀로얄 방 생성과 Open Arena 방 생성 화면을 확인한다.

## 4. 024B 적용

```cmd
node --experimental-strip-types DROP8_refactor_024B_open_arena_lifecycle_host_migration_patch_FIXED_v1.ts --dry-run
node --experimental-strip-types DROP8_refactor_024B_open_arena_lifecycle_host_migration_patch_FIXED_v1.ts
```

## 5. 024C 적용

```cmd
node --experimental-strip-types DROP8_refactor_024C_open_arena_respawn_patch_FIXED_v1.ts --dry-run
node --experimental-strip-types DROP8_refactor_024C_open_arena_respawn_patch_FIXED_v1.ts
```

## 6. 024D 적용

```cmd
node --experimental-strip-types DROP8_refactor_024D_open_arena_persistent_world_patch_FIXED_v1.ts --dry-run
node --experimental-strip-types DROP8_refactor_024D_open_arena_persistent_world_patch_FIXED_v1.ts
```

## 7. 024E 적용

```cmd
node --experimental-strip-types DROP8_refactor_024E_open_arena_scoreboard_ux_patch_FIXED_v1.ts --dry-run
node --experimental-strip-types DROP8_refactor_024E_open_arena_scoreboard_ux_patch_FIXED_v1.ts
```

## 단계별 롤백

각 단계는 자기 단계의 가장 최근 백업으로만 롤백한다.

```cmd
node --experimental-strip-types DROP8_refactor_024E_open_arena_scoreboard_ux_patch_FIXED_v1.ts --rollback
node --experimental-strip-types DROP8_refactor_024D_open_arena_persistent_world_patch_FIXED_v1.ts --rollback
node --experimental-strip-types DROP8_refactor_024C_open_arena_respawn_patch_FIXED_v1.ts --rollback
node --experimental-strip-types DROP8_refactor_024B_open_arena_lifecycle_host_migration_patch_FIXED_v1.ts --rollback
node --experimental-strip-types DROP8_refactor_024A_open_arena_foundation_patch_FIXED_v1.ts --rollback
```

전체를 되돌릴 때는 적용 역순인 `E → D → C → B → A`로 실행한다.

## 자동 검증

실제 적용 시 각 실행기는 다음 작업을 수행한다.

```text
프로젝트 루트 탐지
Refactor 023 및 직전 024 단계 확인
수동 AI 경로 핫픽스 마커 보호
정확한 원본 파일 해시 확인
전체 대상 파일 백업
dry-run
이미 적용됨 및 부분 적용 탐지
신규 파일 충돌 탐지
UTF-8 기록
TypeScript typecheck
ESLint
단계별 집중 테스트
Refactor 023 및 Room 회귀 테스트
전체 테스트
전체 빌드
git diff --check
실패 시 자동 롤백
```

## 실행 중 기준 코드 충돌이 나오는 경우

직전 패치 이후 `Drop8Room.ts`, `main.ts` 같은 대상 파일을 직접 수정했다는 뜻이다. 실행기는 그 수정을 덮어쓰지 않고 중단한다.

그 경우 다음 자료를 전달한다.

```text
현재 프로젝트 최신 ZIP
실패한 CMD 전체 출력
직전에 성공한 단계 번호
```

수동 밸런스 수정이 없다면 별도 자료 없이 024A부터 순서대로 실행하면 된다.

## 최초 플레이 확인 순서

```text
1. 기존 Battle Royale 방 생성 및 정상 시작
2. Open Arena 방 생성
3. 인간 최대 인원과 AI 수가 별도 표시되는지 확인
4. 자기장이 나오지 않는지 확인
5. 두 번째 브라우저가 진행 중 방에 난입 가능한지 확인
6. 방장이 나가면 남은 사람에게 방장이 넘어가는지 확인
7. 인간과 AI가 죽은 뒤 재투입되는지 확인
8. 무기와 오토바이가 시간이 지나 재생성되는지 확인
9. 킬·데스 및 연속 처치 점수판 확인
10. 마지막 인간이 나가면 방이 목록에서 사라지고 삭제되는지 확인
```
