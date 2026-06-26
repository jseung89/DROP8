# 네트워크 프로토콜

## 클라이언트 요청

- `ready`: 준비 상태 전환
- `settings`: AI 충원, AI 난이도, 자기장 속도
- `start`: 방장 경기 시작
- `input`: 이동 벡터, 정규화 전 조준 방향 `aimX`·`aimY`, 호환용 표시 각도, 입력 순번
- `jump`: 비행기 낙하
- `fire`: 현재 총기 발사 요청
- `melee`: 근접 공격 요청
- `reload`: 재장전
- `pickup`: 근처 아이템 획득
- `switch`: 장비 슬롯 전환
- `heal`: 회복 아이템 사용
- `chat`: 채팅
- `rematch`: 방장 로비 복귀

## 서버 메시지

- `chat`: 로비·근거리·관전자·시스템 메시지
- `killfeed`: 처치 로그
- `result`: 우승자와 순위
- `error`: 잘못된 경기 시작 등의 사용자 오류

## 동기화 상태

Room Schema에 플레이어, 총알, 아이템, 자기장, 비행기, 경기 단계와 순위를 저장합니다. 서버만 Schema를 변경합니다.

## 검증

숫자 입력은 유한값인지 확인하고 이동 입력은 -1~1로 제한합니다. 조준 벡터는 NaN·Infinity·0 길이를 거부하고 서버에서 다시 정규화한 뒤 최종 발사 각도로 변환합니다. 총알 생성 좌표, 퍼짐, 피해와 충돌 대상은 서버가 결정합니다. 닉네임과 채팅은 길이 제한, 제어문자 제거, 꺾쇠 제거를 적용합니다. 발사 간격과 탄약, 아이템 거리, 생존 및 경기 단계를 서버에서 검사합니다.

## Refactor 009 창문 넘기

### 클라이언트 → 서버

- `vaultWindow`: 착지한 플레이어가 가까운 창문을 넘도록 요청합니다. 클라이언트는 창문 ID나 착지 좌표를 확정하지 않으며 서버가 현재 위치, 건물 공간, 쿨타임과 반대편 안전 공간을 검사합니다.

### 동기화 상태

플레이어 상태에 `isVaulting`, `vaultWindowId`, `vaultProgress`가 추가됩니다. 실제 좌표와 `buildingId`는 서버가 갱신하며 진행률 50%에서 실내외 공간을 한 번만 전환합니다.

### 상호작용 검증

창문은 시야와 총알을 통과시키지만 아이템 획득과 오토바이 탑승은 허용하지 않습니다. 서버는 `buildingSpacesInteractable` 규칙으로 문과 창문의 상호작용을 구분합니다.

## Refactor 010 비차단 경고와 차량 파괴

### 서버 메시지

- `notice`: `{ type, message, duration? }` 형태의 비차단 게임 알림입니다. 브라우저 대화상자를 열지 않으며 클라이언트 HUD가 자동으로 표시하고 제거합니다.

### 오토바이 동기화 상태

오토바이 상태에 다음 서버 권위 필드가 추가됩니다.

- `hp`, `maxHp`: 현재 및 최대 내구도
- `critical`: 내구도 30% 이하 여부
- `exploding`, `explosionAt`: 폭발 대기 상태와 서버 시각
- `destroyed`, `destroyedAt`: 폭발 완료 및 제거 연출 시각
- `lastDamagedAt`, `lastDamagedBy`: 최근 피해 표시와 폭발 처치 귀속 정보
- `buildingId`: 차량의 현재 건물 공간

클라이언트는 차량 피해량, 파괴 여부, 폭발 시점 또는 킬 귀속을 전송하지 않습니다.

### 폭발 동기화 상태

Room Schema의 `explosions` 컬렉션은 폭발 ID, 중심 좌표, 반경, 시작 서버 시각, 표시 시간과 원본 차량 ID를 동기화합니다. 피해와 넉백은 서버에서 폭발이 생성되는 순간 한 번만 계산합니다.

### 창문 전투 검증

창문 시야는 고정 근거리 제한 대신 몸 중심과 좌우 표본점까지의 선분을 검사합니다. 총알은 `buildingId`가 다른 대상을 일괄 거부하지 않으며 서버의 총알 장애물 선분과 대상 충돌원의 실제 교차 순서로 명중을 결정합니다. 창문 너머 아이템과 차량 상호작용은 계속 `buildingSpacesInteractable` 규칙으로 차단합니다.

## Refactor 010A 사망 연출 이벤트

### 서버 → 클라이언트

- `characterDeath`: 서버가 사망을 즉시 확정한 뒤 클라이언트 연출에 필요한 마지막 상태를 한 번 전달합니다.

주요 필드:

- `entityId`, `entityType`: 사망한 플레이어 또는 AI 식별자
- `x`, `y`, `angle`, `buildingId`: 서버가 확정한 마지막 위치와 건물 공간
- `displayName`, `ai`, `equipped`: 사망 직전 외형 연출 정보
- `killerId`, `cause`: 처치자와 사망 원인
- `hitDirectionX`, `hitDirectionY`: 마지막 피해 방향
- `inBush`, `bushRevealed`: 사망 직전 은폐 상태
- `diedAt`: 서버 사망 시각

이 메시지는 사망 판정이나 아이템 드롭을 늦추지 않는 시각 연출 전용 이벤트입니다. 동일 엔티티의 실제 사망, 킬, 생존자 수, 승리 판정과 Loot 생성은 기존 Room 상태와 서버 로직에서 즉시 처리됩니다. 클라이언트는 `characterDeath`를 이용해 약 1초간 충돌 없는 잔상을 표시할 뿐 서버 상태를 변경하지 않습니다.

### 창문 국소 시야

창문 국소 시야는 별도의 네트워크 상태를 추가하지 않습니다. 창문 데이터와 shared의 결정적 포털 계산을 서버와 클라이언트가 함께 사용합니다. 일반 상태의 시야 깊이는 300px, 저격 스코프 상태는 480px이며, 총알과 상호작용 검증은 기존 서버 권위 규칙을 유지합니다.


### Refactor 011 오디오 이벤트

서버는 상태만으로 정확히 복원하기 어려운 순간 효과음을 `audioEvent` 메시지로 전송합니다.

- 공통 필드: `id`, `type`, `createdAt`, 선택적 `sourceId`, `targetId`, `x`, `y`, `buildingId`, `variant`, `sequence`
- 전역 월드 이벤트: `weapon_fire`, `impact_wall`, `impact_vehicle`, `impact_player`, `motorcycle_collision`, `motorcycle_hit`, `motorcycle_critical`
- 해당 플레이어 전용 이벤트: `weapon_dry_fire`, `reload_start`, `reload_complete`, `heal_start`, `heal_complete`, `hit_confirm`, `kill_confirm`

클라이언트는 최근 이벤트 ID를 제한된 캐시에 저장하여 로컬 예측음과 서버 확정음이 중복 재생되지 않게 합니다. 오토바이 엔진, 폭발, 자기장, 사망 등 지속 또는 상태 기반 사운드는 Room 상태에서 파생합니다.

## Refactor 012 투척무기 프로토콜

### 클라이언트 → 서버
- `switch { slot: 4 }`: 서버 소지 상태가 유효하면 단일 투척 슬롯을 장착합니다.
- `throwPrepare`: 투척 충전 시작을 요청합니다. 서버가 생존·착지·운전·창문 넘기·소지량을 검증합니다.
- `throwCancel`: 충전 상태를 취소합니다.
- `throw { aimX, aimY }`: 서버가 충전 시간과 정규화된 조준 벡터로 초기 속도를 만들고 수량을 한 개 차감합니다.
- 기존 `heal { kind:'auto' }` 메시지는 유지하며 입력키만 `4`에서 `Q`로 이동했습니다.

### Room Schema
- 플레이어: `throwableType`, `throwableCount`, `isPreparingThrow`, `throwCharge`, `previousEquipped`
- `thrownObjects`: 소유자, 종류, x/y/z, vx/vy/vz, 튕김 수, 상태, 생성·기폭 시각, 건물 공간
- `smokeFields`: 소유자, 중심, 현재·최대 반경, 시작·종료 시각, 건물 공간
- `fireFields`: 소유자, 중심, 반경, 시작·종료·틱 시각, 건물 공간
- Loot: `stackCount`
- Explosion: `ownerId`, `kind`

서버는 투척물 이동, 문·창문·벽 충돌, 폭발 차폐, 연막·화염 영역, 피해와 처치 귀속을 확정합니다. 클라이언트는 Schema를 렌더링하고 shared 계산으로 본인 가이드만 예측합니다.

### 오디오 이벤트
`throwable_select`, `throwable_prepare`, `throwable_throw`, `throwable_bounce`, `frag_explosion`, `smoke_deploy`, `fire_ignite`, `throwable_pickup`, `throwable_swap`을 기존 `audioEvent` 구조로 전송합니다.

## Refactor 012A 권한·시각·AI 이동 보강

<!-- DROP8_REFACTOR_012A_SMOKE_MOTORCYCLE_AI_NAV -->

- `throwPrepare`와 `throw`는 오토바이 탑승 자체를 거부하지 않습니다. 서버는 두 요청 시점 모두 `isDriving`, `vehicleId`, 차량 존재, `driverId`, 파괴·폭발 상태를 재검증합니다.
- 정상 운전자 투척은 차량의 서버 권위 `x`, `y`, `buildingId`에서 시작합니다. 차량 속도 벡터는 투척 초기속도에 더하지 않습니다.
- 탑승·하차·강제 하차·창문 넘기 시작 시 서버 투척 준비 상태를 취소합니다.
- `state.serverTime`, `SmokeFieldState.startedAt`, `expiresAt`과 연막 시야 함수의 현재 시각은 초 단위입니다. 연막 렌더링 성장·소멸 보간의 밀리초 인자는 별도로 유지합니다.
- AI 창문 출입은 새 클라이언트 메시지를 만들지 않습니다. 서버 내부 경로 행동이 인간 플레이어와 동일한 `vaultJobs` 및 `isVaulting`, `vaultProgress`, `vaultWindowId` 동기화 상태를 사용합니다.
- AI 경로·실패 창문·스턱 카운터는 서버 런타임 메모리이며 Room Schema에 추가하지 않습니다.
