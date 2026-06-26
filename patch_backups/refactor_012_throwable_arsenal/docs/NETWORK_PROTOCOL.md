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
