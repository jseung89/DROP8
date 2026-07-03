# DROP 8 Refactor 024 — Open Arena Mode Super Patch Plan

문서 상태: 설계 초안 / 실제 패치 미생성  
작성 기준 소스: 사용자가 첨부한 최신 `DROP8_SOURCE.zip`  
분석 ZIP SHA256: `249aea52cdb24a2ea973a919410c2782673f31023f4b5747cf4f1fcf6cc95dad`  
권장 상위 패치명: **Refactor 024 — Open Arena Mode**  
권장 신규 모드명: **Open Arena / 상시 개방 전장**

---

## 핵심 결정 요약

이번 신규 모드는 기존 배틀로얄을 변경하거나 교체하지 않고, 같은 `Drop8Room` 서버 권위 구조 안에 별도 모드 전략으로 추가한다.

```text
Battle Royale
- 기존 로비와 준비 절차
- 비행기와 낙하
- 자기장
- 사망 후 탈락 및 관전
- 마지막 생존자 승리
- 경기 종료

Open Arena
- 방 생성 시 인간 정원과 AI 수를 각각 설정
- 시작 이후 자유 난입
- 인간과 AI 모두 반복 리스폰
- 자기장 없음
- 마지막 생존자 판정 없음
- 무기·아이템·차량 재생성
- 방장 퇴장 시 자동 승계
- 마지막 인간 퇴장 시 즉시 비공개
- 재접속 유예 후 방과 월드 완전 삭제
```

최신 소스 기준 핵심 기술 결론은 다음과 같다.

1. `Refactor 023`이 실제 적용돼 있다.
2. 현재 `fillAi()`는 인간과 AI를 합쳐 총 8명까지 채운다. Open Arena에서는 인간 정원과 AI 슬롯을 분리해야 한다.
3. 현재 `finishCheck()`는 생존자가 1명 이하가 되면 즉시 경기를 끝낸다. Open Arena에서는 호출을 완전히 우회해야 한다.
4. 현재 클라이언트 방 목록은 `LOBBY` 상태만 입장을 허용한다. Open Arena `ACTIVE` 상태의 중간 난입을 별도로 허용해야 한다.
5. `PlayerState`와 `Drop8State`가 각각 Colyseus Schema 필드 64개 한도에 이미 도달해 있다. 신규 모드 필드를 기존 Schema에 무리하게 추가하지 않는다.
6. 모드 설정·방 생명주기·리스폰 타이머·점수는 우선 서버 내부 상태, 방 메타데이터, 저빈도 사용자 메시지로 관리한다.
7. Open Arena의 인간 정원은 `maxClients`로 관리하고 AI는 서버 객체로 별도 관리한다. AI는 인간 접속 자리를 차지하지 않는다.
8. Open Arena에서는 `autoDispose=false`로 두되, 마지막 인간 퇴장 시 서버가 직접 `EMPTY_GRACE`와 최종 dispose를 관리한다.
9. Refactor 023의 AI 수색 코드는 자기장이 비활성화된 경우에도 장기 자유 수색 방향을 생성할 수 있다. Open Arena 초기 버전은 이를 재사용할 수 있다.
10. 이번 신규 모드는 단일 대형 패치로 적용하지 않고 `024A`부터 `024E`까지 단계적으로 적용한다.

---

# 1. 문서 목적

이 문서는 DROP 8에 처음 추가되는 신규 게임 모드인 Open Arena를 실제 최신 소스에 맞춰 설계하기 위한 상위 기획서다.

이번 문서의 목적은 다음과 같다.

- 현재 배틀로얄 규칙이 서버와 클라이언트 어디에 결합돼 있는지 확인한다.
- Open Arena가 기존 배틀로얄을 오염시키지 않도록 모드 경계를 정의한다.
- 인간 정원, AI 슬롯, 중간 난입, 리스폰, 방장 승계, 방 삭제를 서버 권위 상태로 설계한다.
- 자기장이 없는 장기 실행 방에서 아이템과 차량, 임시 객체가 무한히 쌓이지 않도록 한다.
- Colyseus Schema 한도와 네트워크 비용을 고려한 데이터 전달 구조를 확정한다.
- 기능을 안전하게 적용할 수 있도록 Refactor 024A~024E로 분할한다.
- 각 단계의 완료 조건, 수정 파일, 테스트, 회귀 위험과 롤백 전략을 명확히 한다.

이 문서는 실제 프로젝트 소스나 패치 실행기를 변경하지 않는다.

---

# 2. 최신 프로젝트 기준

## 2.1 확인된 최신 패치

최신 ZIP의 실제 소스와 패치 노트에서 다음 상태를 확인했다.

```text
Refactor 021 — AI Persona Dialogue
Refactor 022 — AI Navigation & Tactical Recovery
Refactor 023 — AI Safe-Zone Sweep & Live Spectator Dialogue
```

확인 지점:

```text
server/src/rooms/Drop8Room.ts
client/src/GameScene.ts
server/src/rooms/aiNavigation.ts
docs/PATCH_NOTES.md
server/tests/refactor023-*
```

`Drop8Room.ts` 상단에는 다음 마커가 존재한다.

```text
DROP8_REFACTOR_023_AI_SAFE_ZONE_SWEEP_LIVE_SPECTATOR_DIALOGUE
```

## 2.2 확인된 수동 핫픽스

실행 소스에는 다음 수동 핫픽스 마커도 남아 있다.

```text
DROP8_AI_PATROL_STABILITY_HOTFIX
DROP8_AI_LARGE_BUILDING_PERIMETER_HOTFIX
```

향후 패치 실행기는 현재 파일 전체를 기준으로 preimage를 검증하고, 해당 핫픽스를 보존해야 한다.

## 2.3 현재 주요 상수

```text
MAX_PLAYERS = 8
SERVER_TICK_RATE = 30
PATCH_RATE_MS = 50
```

현재 맵 크기와 권장 인원:

| 맵 | 월드 크기 | 현재 권장 인원 | 현재 최대 인원 |
|---|---:|---:|---:|
| 작은 맵 | 4096 | 2~4 | 8 |
| 큰 맵 | 6144 | 6~8 | 8 |
| 8번 부두 | 7168 | 6~8 | 8 |

Open Arena의 총원 16명은 기존 검증 범위를 넘으므로 단계별 부하 검증이 필요하다.

## 2.4 현재 소스 기준 파일 해시

패치 제작 시 최신 preimage 확인 참고용이다.

| 파일 | SHA256 |
|---|---|
| `server/src/rooms/Drop8Room.ts` | `ab87e98984ae2d41af21cac61db0177a099bb2488fb8b5666389637bc05f8f53` |
| `server/src/rooms/schema.ts` | `6b5036f6fc7eaafb451fec0f1cdbd0ad554d5741dfb339a673b991144965cada` |
| `server/src/roomRegistry.ts` | `4a13f4e3bbcef7e982d38ae0039d1b93597c8ed9cbded21f17c710f253ec9872` |
| `client/src/main.ts` | `a69ca04b4ba1705589db268ab13d1f65b1b233ed0e9159d8aa238e9596394bb2` |
| `client/src/network.ts` | `0ffa2feb51c587b1797cb2e7d245a14cd1e5ce3835d54d5d92b00b056b313f4b` |
| `client/src/GameScene.ts` | `68d9b6058d363ca83a9c96898c5a528625cf2469eed6e4188049680bd60d4c41` |
| `shared/src/index.ts` | `cc0452c18165bcbf9213d30818e54ea52269ff4599004708abbcac21832040b8` |
| `docs/PATCH_NOTES.md` | `7553566e71988bde7fb2a85d05784508fa8d9e7abb6c1dd4a5c0e26916e9ac10` |

해시는 분석 시점 참고값이며, 사용자가 이후 수동 수정했다면 새 실행기는 최신 파일을 다시 분석해야 한다.

## 2.5 Git 상태 주의

ZIP 안 Git 작업 트리는 과거 패치 백업과 진단 파일 등으로 깨끗하지 않을 수 있다.

따라서 앞으로의 패치 실행기는 다음 원칙을 지켜야 한다.

```text
현재 실행 파일 자체를 백업
→ 정확한 preimage 확인
→ 대상 파일만 수정
→ 실패 시 전용 백업으로 복구
```

`git checkout -- .` 같은 전체 복원 명령을 자동 롤백에 사용하면 안 된다.

---

# 3. 현재 배틀로얄 구조 분석

## 3.1 게임 모드 타입이 존재하지 않음

현재 shared, server, client에 공식 `GameMode` 타입이 없다.

방 생성 옵션은 대략 다음 값만 가진다.

```text
nickname
password
fillAi
difficulty
zoneSpeed
roomPassword
publicRoom
mapSizeMode
mapId
```

따라서 Open Arena를 추가하려면 가장 먼저 공유 모드 타입과 방 생성 옵션 정규화가 필요하다.

## 3.2 현재 인간 최대 인원

`Drop8Room`은 다음처럼 고정돼 있다.

```ts
maxClients = MAX_PLAYERS;
```

현재 `MAX_PLAYERS`는 8이다.

Colyseus의 `maxClients`는 실제 연결 클라이언트 수를 제한한다. AI는 `PlayerState`만 서버에 생성되므로 인간 클라이언트 좌석을 직접 점유하지 않는다.

하지만 현재 로직이 인간과 AI를 같은 `state.players.size`로 계산하기 때문에 사실상 총원 8명으로 운영된다.

## 3.3 현재 AI 생성

`fillAi()`는 다음 조건으로 AI를 채운다.

```ts
while (this.state.players.size < MAX_PLAYERS) {
  // AI 생성
}
```

즉 현재는:

```text
인간 1명 → AI 7명
인간 4명 → AI 4명
인간 8명 → AI 0명
```

이다.

Open Arena 요구는 다음과 다르다.

```text
인간 최대 8명
AI 설정 7명
→ 인간 8명 + AI 7명 가능
```

따라서 `fillAi()`를 Open Arena에서 재사용하면 안 된다.

## 3.4 현재 경기 시작

현재 시작 흐름:

```text
LOBBY
→ 모든 인간 준비
→ 방장 start
→ fillAi
→ beginMatch
→ PLANE
→ DROP
→ 전투
```

`beginMatch()`는 다음을 한꺼번에 초기화한다.

- 자기장
- 비행기
- 인벤토리
- 아이템
- 오토바이
- 늑대인간 시즌
- 플레이어 상태

Open Arena는 비행기와 낙하, 자기장이 필요하지 않으므로 별도 `beginOpenArena()` 또는 모드 전략 분기가 필요하다.

기존 `beginMatch()`를 조건문으로 과도하게 뒤섞기보다 다음 구조가 안전하다.

```ts
private startRoom(client: Client) {
  if (this.gameMode === 'openArena') {
    this.beginOpenArena();
    return;
  }
  this.beginBattleRoyale();
}
```

기존 함수 이름을 유지해야 한다면 내부에서 명확히 분기한다.

## 3.5 현재 경기 종료

서버 틱마다 `finishCheck()`가 실행된다.

현재 조건:

```text
생존자 1명 이하
+ 전체 플레이어 2명 이상
+ FINISHED가 아님
→ 즉시 FINISHED
```

Open Arena에서는 인간과 AI가 죽었다가 부활하므로 `finishCheck()`를 실행하면 첫 사망 이후 방이 종료될 수 있다.

Open Arena에서는 다음을 금지한다.

```text
placements 누적
winner 설정
result 브로드캐스트
FINISHED 전환
마지막 생존자 판정
```

권장 분기:

```ts
if (this.gameMode === 'battleRoyale') {
  this.finishCheck();
}
```

## 3.6 현재 사망 처리

현재 `damage()`에서 체력이 0이 되면:

```text
alive=false
phase=dead
aiState=DEAD
characterDeath 전송
AI 메모리·경로 제거
placements 앞에 이름 추가
공격자 kills 증가
killfeed 전송
전체 인벤토리 드롭
```

PlayerState 객체는 Schema에 남는다. 이는 리스폰 시 같은 객체를 재사용하기에 유리하다.

다만 Open Arena에서 현재 사망 처리를 그대로 사용하면:

- placements가 무한히 증가한다.
- 모든 인벤토리가 매 사망마다 바닥에 쌓인다.
- AI 프로필과 슬롯 연결 정보가 사라진다.
- 리스폰 타이머가 없다.

Open Arena 전용 사망 후처리가 필요하다.

## 3.7 현재 관전

죽은 인간은 `alive=false`, `phase=dead`로 Schema에 남고, 클라이언트는 관전 대상을 선택한다.

Refactor 023에서 관전 중 AI 대사 수신과 만료는 개선돼 있다.

Open Arena는 기존 관전을 리스폰 대기 화면으로 재사용할 수 있다.

필요한 추가 동작:

```text
사망
→ 관전 시작
→ respawnScheduled 메시지
→ 카운트다운
→ 서버 리스폰
→ 관전 인덱스 초기화
→ 카메라를 자기 캐릭터로 복귀
→ 입력 복구
```

## 3.8 현재 방 목록과 난입

서버 `onAuth()`는 현재 비밀번호만 검사한다.

즉 서버 자체에는 진행 중 입장을 명시적으로 막는 조건이 없다.

그러나 클라이언트 방 목록은 다음 조건에서 참가 버튼을 비활성화한다.

```text
locked
phase !== LOBBY
players >= maxPlayers
```

따라서 현재 중간 난입 제한은 대부분 클라이언트 UI에 의존한다.

Open Arena는 반드시 서버에서도 다음을 검증해야 한다.

```text
mode=openArena
lifecycle=active
humanCount < maxHumans
room not private/closed
```

클라이언트 버튼 활성화만으로 권한을 결정하면 안 된다.

## 3.9 현재 방장 승계

방장이 나가면 현재 `state.players`에서 처음 찾은 비-AI 플레이어에게 방장이 넘어간다.

```text
현재 MapSchema 순서상 먼저 들어온 플레이어일 가능성은 높음
하지만 명시적인 joinedAt 기준은 아님
```

Open Arena에서는 방장 승계를 예측 가능하게 만들기 위해 서버 내부 `joinedAt`을 관리해야 한다.

## 3.10 현재 방 자동 삭제

프로젝트가 사용하는 Colyseus Room의 `autoDispose` 기본값은 `true`다.

클라이언트와 예약 좌석이 모두 0이면 방이 자동 dispose될 수 있다.

Open Arena는 마지막 인간 퇴장 시 곧바로 공개 난입을 막되, 기존 연결의 짧은 재접속 유예를 제공해야 한다.

따라서 Open Arena에 한해:

```text
autoDispose = false
서버가 EMPTY_GRACE 직접 관리
유예 종료 후 disconnect/dispose
```

구조가 적합하다.

Battle Royale은 기존 자동 dispose 동작을 유지한다.

---

# 4. Open Arena 목표

Open Arena의 최종 경험은 다음과 같다.

```text
방 생성
→ 방장이 인간 최대 인원과 AI 수 선택
→ Open Arena 시작
→ AI가 설정 수만큼 등장
→ 자기장 없이 전투
→ 인간은 언제든 난입
→ 죽은 인간과 AI는 반복 리스폰
→ 무기와 차량은 일정 시간 뒤 재생성
→ 방장이 나가면 다음 인간에게 권한 승계
→ 마지막 인간이 나가면 방 비공개
→ 재접속 유예 종료 후 방 삭제
```

핵심 원칙:

1. 서버 권위다.
2. 기존 Battle Royale을 완전히 보존한다.
3. 인간 정원과 AI 슬롯은 서로 독립적이다.
4. Open Arena에는 자기장이 없다.
5. Open Arena에는 최종 우승자가 없다.
6. 사람이 한 명이라도 있으면 방은 계속 유지된다.
7. 사람이 0명이면 AI만으로 방을 영구 유지하지 않는다.
8. 모든 장기 실행 객체에는 생성·만료·정리 책임자가 있어야 한다.

---

# 5. 기존 배틀로얄과의 규칙 비교

| 항목 | Battle Royale | Open Arena |
|---|---|---|
| 방 생성 | 기존 방식 | 별도 모드 선택 |
| 인간 정원 | `MAX_PLAYERS` | 방장이 선택한 `maxHumans` |
| AI 수 | 총원 8명까지 채움 | 방장이 선택한 고정 슬롯 |
| 비행기 | 사용 | 사용 안 함 |
| 낙하 | 사용 | 사용 안 함 |
| 자기장 | 사용 | 완전 비활성화 |
| 진행 중 난입 | UI상 불가 | 인간 정원 내 허용 |
| 인간 사망 | 탈락·관전 | 관전 후 리스폰 |
| AI 사망 | 탈락 | 동일 슬롯 리스폰 |
| 마지막 생존자 | 승리 | 판정 없음 |
| 아이템 | 한 경기 일회성 | 슬롯 기반 재생성 |
| 차량 | 파괴 후 종료 | 일정 시간 뒤 재생성 |
| 방장 퇴장 | 다음 인간 승계 | 명시적 joinedAt 기준 승계 |
| 인간 0명 | 자동 dispose | 비공개 유예 후 dispose |
| 점수 | kills/result | 킬·데스·연속 처치 등 |

모드 분기 원칙:

```ts
switch (this.gameMode) {
  case 'battleRoyale':
    // 기존 코드 경로
    break;
  case 'openArena':
    // 신규 코드 경로
    break;
}
```

조건문을 여러 함수에 무분별하게 흩뿌리지 않고, 가능한 한 다음 책임으로 묶는다.

- 방 생성 및 설정
- 시작
- 틱
- 사망
- 리스폰
- 방 생명주기
- 아이템 및 차량 유지
- 결과 및 HUD

---

# 6. 방 생성 옵션

## 6.1 신규 공유 타입

권장 신규 파일:

```text
shared/src/gameModes.ts
```

설계 예시:

```ts
export type GameMode = 'battleRoyale' | 'openArena';

export type OpenArenaCreateOptions = {
  gameMode: 'openArena';
  maxHumans: number;
  aiCount: number;
  difficulty: Difficulty;
  mapId: MapId;
  publicRoom: boolean;
  roomPassword?: string;
};
```

실제 옵션은 기존 `JoinOptions`와 중복되지 않도록 통합 정규화 함수로 처리한다.

## 6.2 권장 초기 제한

```text
인간 최소: 1
인간 최대: 8
AI 최소: 0
AI 최대: 12
기본 AI: 7
절대 총 전투원 상한: 16
```

서버 검증:

```ts
maxHumans = clampInteger(maxHumans, 1, 8, 8);
aiCount = clampInteger(aiCount, 0, 12, 7);

if (maxHumans + aiCount > 16) {
  rejectRoomCreation();
}
```

클라이언트 UI는 유효하지 않은 조합을 미리 비활성화하되, 서버가 최종 검증한다.

## 6.3 맵별 권장 경고

초기에는 절대 상한만 서버에서 강제하고, 맵별 권장치는 UI 경고로 제공한다.

```text
작은 맵: 총원 8명 이하 권장
큰 맵: 총원 12명 이하 권장
8번 부두: 총원 16명 이하 권장
```

초기 성능 테스트 후 작은 맵 총원 제한을 하드 룰로 바꿀 수 있다.

## 6.4 방 생성 이후 변경

첫 버전에서는 다음 설정을 방 시작 후 변경하지 않는다.

```text
maxHumans
configuredAiCount
mapId
gameMode
```

이유:

- AI 즉시 증감으로 인한 중복 슬롯
- 현재 인간 수보다 maxHumans를 낮추는 문제
- 월드 중간 교체
- 방 목록 정보 불일치

AI 수 실시간 조절은 후속 패치로 분리한다.

---

# 7. 인간 정원과 AI 슬롯

## 7.1 분리된 인원 개념

서버는 다음 값을 명확히 구분한다.

```text
connectedHumanCount
maxHumans
configuredAiCount
aliveAiCount
respawningAiCount
totalCombatantCount
```

정의:

```text
connectedHumanCount = 현재 연결된 실제 인간 클라이언트 수
maxHumans = 방 생성 시 정한 인간 최대 입장 수
configuredAiCount = 방 생성 시 정한 고정 AI 슬롯 수
aliveAiCount = 현재 살아 있는 AI 수
respawningAiCount = 사망 후 리스폰 대기 중인 AI 수
totalCombatantCount = 연결된 인간 PlayerState + AI 슬롯 수
```

## 7.2 maxClients 사용

Open Arena에서는:

```ts
this.maxClients = openArenaConfig.maxHumans;
```

으로 설정한다.

AI는 Colyseus 클라이언트가 아니므로 `maxClients`를 차지하지 않는다.

Battle Royale은 기존 `MAX_PLAYERS`를 유지한다.

## 7.3 AI 고정 슬롯

권장 서버 내부 구조:

```ts
interface OpenArenaAiSlot {
  slotId: string;
  playerId: string;
  personaId: string;
  state: 'alive' | 'respawnWait';
  respawnAt: number;
  deaths: number;
}
```

고정 슬롯 원칙:

```text
AI가 죽어도 슬롯은 삭제되지 않음
PlayerState를 가능하면 같은 playerId로 재사용
같은 이름과 페르소나 유지
리스폰 대기만 상태 전환
```

AI 수를 맞추기 위해 매 틱 `while(count < configured)` 방식으로 생성하면 중복 위험이 있으므로 사용하지 않는다.

## 7.4 AI 프로필 보존과 초기화

유지:

- 슬롯 ID
- 이름
- 페르소나
- 외형
- 누적 킬·데스
- 난이도

초기화:

- 현재 대상
- 최근 적 위치
- 경로
- 수색 목표
- 아이템 예약
- 수영 탈출
- 정체·진동 기록
- 차량 계획
- 치료·재장전
- 임시 대사 응답 예약

---

# 8. 게임 진행 중 난입

## 8.1 서버 입장 조건

Open Arena 신규 인간 입장은 다음을 모두 만족해야 한다.

```text
gameMode === openArena
lifecycle === active
connectedHumanCount < maxHumans
room not terminating
password valid
not banned/kicked
```

Battle Royale의 기존 입장 정책은 유지한다.

## 8.2 onAuth 검증

현재 `onAuth()`는 비밀번호만 검사한다.

Open Arena에서는 서버가 다음을 추가 검증해야 한다.

```ts
if (this.gameMode === 'openArena') {
  if (this.lifecycle !== 'active') reject;
  if (this.connectedHumanCount() >= this.openArenaConfig.maxHumans) reject;
}
```

클라이언트 참가 버튼이 비활성화돼 있어도 직접 API 호출을 막기 위해 서버 검증이 필수다.

## 8.3 onJoin 분기

현재 `onJoin()`은 항상 로비 상태의 기본 PlayerState를 만든다.

Open Arena ACTIVE에 난입한 인간은 다음 초기화가 필요하다.

```text
PlayerState 생성
→ host 여부 결정
→ 안전 스폰 위치 계산
→ 살아 있는 전투 상태로 초기화
→ 기본 장비 지급
→ spawn protection 설정
→ roomConfig/arenaStatus 전송
```

진행 중 난입자가 기존 월드 초기화 함수를 호출하면 안 된다.

## 8.4 현재 월드 동기화

Colyseus Schema에 존재하는 현재 월드 객체는 신규 클라이언트에게 자동 동기화된다.

- 플레이어와 AI
- 아이템
- 차량
- 투사체
- 연막과 화염
- 보급 상자

다만 게임 모드와 Open Arena 설정은 Schema 한도 때문에 별도 메시지로 전달한다.

권장 메시지:

```text
roomConfig
arenaStatus
```

## 8.5 클라이언트 방 목록

현재 방 목록은 게임 중 방 참가를 막는다.

Open Arena에서는 다음 조건일 때 참가 버튼을 활성화한다.

```text
mode === openArena
lifecycle === active
humans < maxHumans
locked === false
```

방 목록에서 `players`가 아닌 `humans`를 인간 정원 판정에 사용한다.

---

# 9. 인간 리스폰

## 9.1 상태 흐름

```text
ALIVE
→ DEAD_SPECTATING
→ RESPAWN_WAIT
→ RESPAWNING
→ ALIVE
```

기존 `PlayerState.phase`를 재사용하되, 상세 리스폰 시간은 서버 내부 Map과 메시지로 관리한다.

## 9.2 권장 기본값

```text
리스폰 대기: 5초
스폰 보호: 최대 2초
기본 무기: 약한 권총 또는 현재 존재하는 저등급 기본 총기
기본 탄약: 최소 전투 가능량
기본 회복: 소형 회복 1개 여부는 밸런스 테스트 후 결정
```

## 9.3 서버 내부 상태

```ts
private humanRespawnAt = new Map<string, number>();
private spawnProtectionUntil = new Map<string, number>();
```

PlayerState에 새 Schema 필드를 추가하지 않는다.

## 9.4 사망 시

Open Arena 인간 사망:

```text
characterDeath 전송
킬·데스 기록
관전 상태 유지
Open Arena용 제한 드롭 또는 024C에서는 드롭 없음
respawnAt 등록
respawnScheduled 메시지 전송
```

현재 `placements.unshift()`는 Open Arena에서 호출하지 않는다.

## 9.5 리스폰 시

반드시 초기화할 값:

- hp
- alive
- phase
- x/y
- angle
- 이동 입력
- knockback
- 건물 및 방 정보
- 수풀 상태
- 차량 탑승
- 재장전
- 치료
- 투척 준비
- 스나이퍼 스코프
- 공격 쿨다운 필요 값
- 관전 말풍선 상태

클라이언트 메시지:

```text
respawned
spawnProtection
```

## 9.6 스폰 보호 해제

다음 행동이 서버에 도착하면 즉시 보호를 제거한다.

```text
fire
melee
throw
placeStripTrap
motorcycle mount
기타 공격적 상호작용
```

피격 처리의 가장 앞에서 보호 상태를 확인한다.

---

# 10. AI 고정 슬롯 및 리스폰

## 10.1 생성 시점

Open Arena 시작 시 방 설정의 `configuredAiCount`만큼 고정 슬롯을 한 번 생성한다.

024A에서는 초기 AI 생성과 인간 정원 분리를 먼저 검증한다.

024C에서 반복 리스폰을 추가한다.

## 10.2 AI 사망

Open Arena AI 사망 처리:

```text
alive=false
phase=dead
aiState=DEAD
characterDeath 전송
킬·데스 반영
임시 AI 상태 정리
슬롯 state=respawnWait
respawnAt 등록
PlayerState는 가능하면 유지
```

## 10.3 AI 리스폰

```text
respawnAt 도달
→ 안전 스폰 선택
→ 인벤토리 초기화
→ AI 프로필과 메모리 재생성
→ 슬롯 상태 alive
→ 기존 persona와 이름 유지
```

## 10.4 중복 방지

각 슬롯에는 리스폰 세대 또는 타이머 토큰을 둘 수 있다.

```ts
interface OpenArenaAiSlot {
  generation: number;
  respawnAt: number;
}
```

리스폰 예약 시 generation을 캡처하고, 실행 시 현재 세대가 다르면 취소한다.

방 dispose 시 모든 슬롯과 예약을 제거한다.

---

# 11. 안전 스폰

## 11.1 공통 평가기

신규 난입, 인간 리스폰, AI 리스폰은 같은 서버 권위 안전 스폰 평가기를 사용한다.

권장 신규 순수 함수 파일:

```text
server/src/rooms/openArenaRespawn.ts
```

## 11.2 후보 생성

기존 맵의 안전한 지점, 아이템 스폰, 차량 스폰, 건물 외부 자유 지점을 활용해 후보를 만든다.

무작위 좌표를 한 번 뽑아 바로 사용하지 않는다.

## 11.3 즉시 탈락 조건

- 맵 경계 밖
- 깊은 물 또는 강 중앙
- 충돌 장애물 내부
- 건물 벽 내부
- 불·연막 중심·폭발 위험 지대
- 오토바이와 겹침
- 다른 플레이어와 겹침
- 최근 같은 위치 사용

## 11.4 후보 점수

권장 초기 가중치:

| 기준 | 점수 |
|---|---:|
| 가장 가까운 적과 충분히 멂 | +40 |
| 적의 직접 사격선이 아님 | +30 |
| 최근 사망이 적은 구역 | +25 |
| 엄폐물이 가까움 | +15 |
| 기본 아이템 슬롯이 가까움 | +10 |
| 현재 교전 중심 | -40 |
| 최근 사용된 스폰 | -25 |
| 폭발·화염 위험 | 후보 탈락 |

정확한 수치는 실제 맵과 영상 테스트 후 CMD 핫픽스로 조절할 수 있도록 상수화한다.

## 11.5 스폰 실패 대안

모든 후보가 위험하면:

1. 가장 위험도가 낮은 유효 후보 선택
2. 보호 시간을 약간 늘리지 않고 기존 최대 2초 유지
3. 공격 즉시 보호 해제
4. 서버 로그에 fallback 기록

무적 시간을 과도하게 늘려 위험을 숨기지 않는다.

---

# 12. 자기장 비활성화

## 12.1 서버 틱

현재 매 틱 `updateZone(dt)`가 실행된다.

Open Arena에서는 호출하지 않는다.

```ts
if (this.gameMode === 'battleRoyale') {
  this.updateZone(dt);
}
```

## 12.2 Open Arena 상태값

기존 클라이언트가 자기장을 렌더링하지 않도록 Open Arena 시작 시 안정적인 비활성 상태를 유지한다.

```text
zoneActive=false
zoneState=DISABLED 또는 기존 비활성 호환값
zoneTimer=0
zoneProgress=0
zoneDamage 적용 안 함
```

Schema enum/문자열 호환성을 확인해 신규 `DISABLED`가 위험하면 기존 비활성 표현을 사용하고 클라이언트는 `roomConfig.gameMode`로 숨긴다.

## 12.3 자기장 UI와 오디오

Open Arena 클라이언트에서는:

- 자기장 타이머 숨김
- 자기장 경고 숨김
- 자기장 피해 화면 효과 없음
- 축소 알림 없음

Battle Royale은 기존 동작을 유지한다.

## 12.4 AI 수색

Refactor 023의 안전지대 수색 함수는 자기장이 활성화되지 않은 경우 자유 수색 목표를 생성하는 분기를 이미 갖고 있다.

따라서 Open Arena 초기 버전은 다음을 재사용할 수 있다.

```text
최근 적 위치
→ 자유 장거리 수색
→ 경로 근처 필요한 아이템
→ 적 발견 시 전투
```

024A에서는 이 기존 비활성 자기장 분기를 회귀 테스트한다.

총소리·관심 지점 기반 Arena 전용 수색은 별도 AI 개선 패치로 미룬다.

## 12.5 자기장 연동 시스템 주의

현재 보급 상자 일부는 자기장 단계와 연동돼 있다.

Open Arena에서 자기장을 끄면 해당 보급 이벤트도 발생하지 않을 수 있다.

첫 버전에서는 이를 정상으로 보고, 주기적 Arena 보급 이벤트는 후속 기능으로 분리한다.

늑대인간 시즌처럼 자기장 종료에 의존하는 시스템은 장시간 반복 여부를 별도 테스트한다.

---

# 13. 방장 승계

## 13.1 방장의 의미

방장은 Colyseus 서버 프로세스의 소유자가 아니다.

방장은 방 설정 권한을 가진 연결 플레이어다.

방장 브라우저가 종료돼도 서버가 살아 있으면 방은 유지된다.

## 13.2 joinedAt 기준

권장 서버 내부 상태:

```ts
private humanJoinedAt = new Map<string, number>();
```

방장 퇴장 시:

```text
현재 연결된 인간 중 joinedAt이 가장 빠른 사람
→ 새 hostSessionId
→ PlayerState.host 갱신
→ hostChanged 메시지
→ 방 메타데이터 갱신
```

죽어서 리스폰 대기 중이어도 연결돼 있으면 후보에 포함한다.

## 13.3 재입장

기존 방장이 나갔다가 다시 들어와도 자동으로 권한을 되찾지 않는다.

재입장 시 새로운 joinedAt을 받는다.

## 13.4 초기 권한 범위

첫 Open Arena 버전에서 방장 권한은 최소화한다.

권장 포함:

- 강퇴
- 방 잠금 여부 확인 또는 변경
- 현재 설정 확인

권장 제외:

- 전투 중 AI 수 즉시 변경
- 맵 즉시 변경
- 전체 월드 초기화
- 단일 클릭 방 강제 종료

명시적인 방 종료 기능은 사용자 실수 위험 때문에 후속 UX 패치에서 이중 확인과 함께 검토한다.

---

# 14. 방 생명주기

## 14.1 상태

```ts
type OpenArenaLifecycle =
  | 'active'
  | 'emptyGrace'
  | 'disposed';
```

서버 내부 전용 상태로 먼저 관리한다.

방 목록에는 문자열 메타데이터로 필요한 값만 노출한다.

## 14.2 ACTIVE

조건:

```text
연결된 인간 1명 이상
```

동작:

- 난입 허용
- 인간 및 AI 리스폰 진행
- 아이템 및 차량 재생성 진행
- 서버 틱 정상 진행
- 공개 방 목록 노출

## 14.3 EMPTY_GRACE

마지막 인간 퇴장 또는 예상치 못한 연결 끊김:

```text
lifecycle=emptyGrace
방 목록에서 즉시 숨김
onAuth 신규 입장 거부
기존 예약 재연결만 허용
AI 행동과 리스폰 정지
아이템·차량 타이머 정지 또는 갱신 보류
10초 유예
```

권장 유예 기본값:

```text
10초
```

현재 비정상 종료 시 `allowReconnection(client, 15)`가 있으므로, 실제 유예 시간은 재접속 예약과 충돌하지 않도록 통합해야 한다.

권장 방향:

```text
Open Arena 재연결 허용 10초
EMPTY_GRACE 10초
```

또는 한 개의 서버 타이머를 기준으로 통일한다.

## 14.4 ACTIVE 복귀

기존 연결의 재연결이 성공하면:

```text
empty grace timer 취소
lifecycle=active
방 목록 재노출
AI와 월드 타이머 재개
host 유지 또는 재선정
```

## 14.5 DISPOSED

유예 종료 후 인간이 0명이면:

- 인간 리스폰 예약 취소
- AI 리스폰 예약 취소
- 아이템 재생성 예약 취소
- 차량 재생성 예약 취소
- 대사 응답 예약 제거
- 투사체와 효과 제거
- AI 슬롯 제거
- presence room code 삭제
- 방 목록 제거
- `disconnect()` 또는 안전한 Room 종료 호출

## 14.6 autoDispose

권장:

```text
Battle Royale: 기존 기본 autoDispose 유지
Open Arena: autoDispose=false
```

Open Arena는 명시적 생명주기 관리가 완료되기 전에는 `autoDispose=false`를 먼저 켜면 안 된다.

024B에서 두 기능을 같은 패치로 적용한다.

## 14.7 lock 사용 주의

EMPTY_GRACE에서 신규 난입을 막기 위해 `lock()`을 사용할 수 있지만 재연결 좌석과 충돌 여부를 실제 Colyseus 버전에서 테스트해야 한다.

초기 권장:

```text
setMatchmaking(private=true, unlisted=true)
+ onAuth lifecycle 검증
```

으로 신규 입장을 차단하고, `lock()`은 테스트 후 결정한다.

---

# 15. 아이템 재생성

## 15.1 현재 구조

현재 `spawnLoot()`는 맵의 스폰 지점에서 아이템을 한 번 생성한다.

아이템을 획득하면 `state.loot`에서 삭제되고, 원래 스폰 슬롯 정보는 LootState에 남지 않는다.

따라서 현재 구조만으로는 일정 시간 후 같은 슬롯 재생성이 어렵다.

## 15.2 권장 서버 내부 슬롯

```ts
interface ArenaLootSlot {
  slotId: string;
  x: number;
  y: number;
  category: 'ammo' | 'heal' | 'weapon' | 'throwable' | 'special';
  currentLootId: string;
  respawnAt: number;
  generation: number;
}
```

LootState에 새 필드를 추가하지 않고 서버 내부 Map으로 연결한다.

```text
lootId → slotId
slotId → ArenaLootSlot
```

## 15.3 재생성 흐름

```text
슬롯 아이템 획득
→ currentLootId 비움
→ 종류별 respawnAt 설정
→ 시간이 지나고 슬롯 주변이 비어 있으면 생성
→ currentLootId 기록
```

## 15.4 초기 재생성 시간 후보

| 종류 | 초기 후보 |
|---|---:|
| 탄약 | 20초 |
| 일반 회복 | 25초 |
| 일반 무기 | 40초 |
| 고급 무기 | 75초 |
| 투척물 | 45초 |
| 특수 무기 | 보급 전용 또는 180초 이상 |

실제 테스트 후 상수만 CMD 핫픽스로 조절할 수 있게 한다.

## 15.5 중복 방지

- currentLootId가 실제 존재하면 생성 금지
- 해당 위치에 다른 loot이 겹치면 짧게 재시도
- generation이 바뀐 오래된 타이머는 무시
- 방 dispose 후 재생성 금지

---

# 16. 차량 재생성

## 16.1 현재 구조

오토바이는 맵의 고정 스폰 설정으로 생성된다.

파괴된 오토바이는 효과가 끝난 뒤 Schema에서 제거되며 자동 재생성되지 않는다.

## 16.2 권장 차량 슬롯

```ts
interface ArenaVehicleSlot {
  slotId: string;
  spawnId: string;
  x: number;
  y: number;
  angle: number;
  currentVehicleId: string;
  respawnAt: number;
}
```

## 16.3 재생성 조건

```text
차량 완전 파괴 및 제거
→ 일정 시간 대기
→ 원래 스폰 위치 충돌 확인
→ 비어 있으면 생성
→ 막혀 있으면 짧게 재시도
```

탑승 중이거나 아직 잔해 처리 중이면 재생성하지 않는다.

권장 초기 시간:

```text
파괴 후 60~90초
```

방치 차량 강제 재배치는 첫 버전에서 제외한다.

---

# 17. 월드 정리

## 17.1 현재 자동 정리가 있는 객체

현 소스에서 다음 객체는 자체 수명 또는 처리 후 삭제 흐름이 있다.

- 총알
- 로켓
- 폭발
- 연막
- 화염
- 화염방사기 제트
- 점착 제트
- 투척물
- 스트립 트랩
- 열린 보급 상자 일부

## 17.2 장기 실행 위험 객체

Open Arena에서 특히 위험한 항목:

- 사망 시 전체 인벤토리 드롭
- 차량 파괴 후 재생성 상태
- 인간 리스폰 타이머
- AI 리스폰 타이머
- 아이템 재생성 타이머
- AI 예약 및 목표 Map
- 연결 종료 플레이어의 런타임 Map
- 오래된 채팅·대사 예약

## 17.3 사망 드롭 정책

024C에서는 Open Arena 사망 시 현재 전체 `dropInventory()`를 호출하지 않는 것이 안전하다.

024D에서 제한 드롭을 도입한다.

권장 드롭:

```text
현재 장착 주무기 1개
해당 탄약 일부
회복 아이템 최대 1개
```

드롭 수명:

```text
60초
```

서버 내부:

```ts
private arenaDropExpiresAt = new Map<string, number>();
```

## 17.4 월드 상한

권장 보호 장치:

- Arena 사망 드롭 최대 수
- 전체 loot 최대 수
- 전체 투사체 비정상 상한
- 차량 슬롯당 1대
- 슬롯당 활성 재생성 예약 1개

상한 도달 시 가장 오래된 Arena 임시 드롭부터 제거한다.

## 17.5 주기적 청소

매 틱 전체 컬렉션을 스캔하지 않는다.

```text
1~2초 간격 가벼운 정리
또는 만료 시각 우선 큐
```

기존 30Hz 시뮬레이션 틱의 부담을 최소화한다.

---

# 18. 점수 및 UI

## 18.1 첫 버전 최소 점수

024E 첫 버전:

- 킬
- 데스
- K/D
- 현재 연속 처치
- 최고 연속 처치
- 인간 처치
- AI 처치

최근 10분 순위와 장기 전적 저장은 후속으로 미룰 수 있다.

## 18.2 Schema에 직접 추가하지 않음

`PlayerState`가 64필드 한도에 도달해 있어 점수 필드를 추가하지 않는다.

기존 `kills`, `damageDone`처럼 이미 있는 필드는 재사용하되, 데스·연속 처치 등 신규 값은 서버 내부 Map으로 관리한다.

권장 메시지:

```text
arenaScoreboard
```

1초 또는 점수 변경 시에만 저빈도로 전송한다.

## 18.3 Open Arena HUD

표시 후보:

```text
상시 개방 전장
인간 4/8
AI 7
리스폰 3.2초
킬 5 / 데스 3 / 연속 2
방장 이름
```

숨길 것:

- 자기장 타이머
- 최종 생존자 목적 문구
- 배틀로얄 순위 확정 UI

## 18.4 방 목록

Open Arena 방 표시:

```text
승이형의 전장
상시 개방 전장
인간 4/8
AI 7
총 전투원 11
난입 가능
자기장 없음
```

`players/maxPlayers` 대신 인간과 AI를 분리해서 표시한다.

---

# 19. 서버·클라이언트·Shared 변경 설계

## 19.1 Shared

권장 신규 파일:

```text
shared/src/gameModes.ts
```

책임:

- `GameMode`
- Open Arena 생성 옵션 타입
- 숫자 제한 상수
- 모드 표시명
- 클라이언트와 서버가 공유하는 메시지 payload 타입

`shared/src/index.ts`에서 export한다.

## 19.2 Server

`Drop8Room`에 다음 서버 내부 상태를 추가하는 방향을 권장한다.

```ts
private gameMode: GameMode = 'battleRoyale';
private openArenaConfig?: OpenArenaConfig;
private openArenaLifecycle: OpenArenaLifecycle = 'active';
private humanJoinedAt = new Map<string, number>();
private humanRespawnAt = new Map<string, number>();
private spawnProtectionUntil = new Map<string, number>();
private openArenaAiSlots = new Map<string, OpenArenaAiSlot>();
```

다만 `Drop8Room.ts`가 이미 매우 크므로 순수 계산과 상태 보조 함수는 별도 파일로 분리한다.

권장 신규 파일:

```text
server/src/rooms/openArenaConfig.ts
server/src/rooms/openArenaRespawn.ts
server/src/rooms/openArenaWorld.ts
```

모든 파일을 024A에서 한꺼번에 만들 필요는 없다.

## 19.3 Client Network

`network.ts`는 Schema 외 메시지로 받은 다음 상태를 로컬에 보관한다.

```text
roomConfig
arenaStatus
respawnScheduled
spawnProtection
hostChanged
arenaScoreboard
```

Open Arena 여부를 추측하지 않고 서버 메시지를 기준으로 렌더링한다.

## 19.4 Client Lobby/Main

변경:

- 게임 모드 선택
- Open Arena 설정 UI
- 유효 조합 제한
- Open Arena ACTIVE 방 참가 버튼 활성화
- 인간/AI 인원 분리 표시
- 모드별 나가기 안내
- 방장 변경 알림

## 19.5 GameScene

024C 이후 변경:

- 리스폰 카운트다운 표시 연동
- 리스폰 후 카메라 자기 캐릭터 복귀
- 기존 관전 상태 초기화
- 스폰 보호 표현
- Open Arena 자기장 시각 요소 숨김

---

# 20. Colyseus Schema 변경 여부

## 20.1 확인 결과

현재 최신 소스에서:

```text
PlayerState: @type 필드 64개
Drop8State: @type 필드 64개
```

기존 테스트도 64개 이하를 강제한다.

따라서 다음 필드를 기존 클래스에 추가하면 안 된다.

```text
gameMode
lifecycle
maxHumans
configuredAiCount
respawnAt
deaths
killStreak
spawnProtected
```

## 20.2 권장 전달 경로

### 방 목록에 필요한 정적·저빈도 정보

Colyseus Room metadata:

```text
gameMode
maxHumans
configuredAiCount
lifecycle
joinInProgress
```

### 방에 입장한 클라이언트의 모드 설정

custom message:

```text
roomConfig
```

### 리스폰과 보호

custom message:

```text
respawnScheduled
respawned
spawnProtection
```

### 점수

custom message:

```text
arenaScoreboard
```

## 20.3 장기 개선안

향후 Schema를 재구성해 중첩 설정 객체로 묶을 수 있으나, 이는 별도 Schema 마이그레이션 패치로 진행해야 한다.

Open Arena 첫 도입과 동시에 Schema 대수술을 하지 않는다.

---

# 21. 성능 예산

## 21.1 현재 서버 주기

```text
시뮬레이션: 30Hz
Schema patch: 50ms, 약 20Hz
```

## 21.2 주요 비용

인원이 늘수록 다음 비용이 커진다.

- AI별 적 탐색: AI × 전투원
- AI별 아이템 탐색: AI × loot
- 플레이어 겹침 해소: 전투원 간 후보
- 시야와 사격선
- 총알·폭발·화염 충돌
- 오토바이 충돌
- 모든 플레이어 Schema 동기화
- AI 대사와 채팅 이벤트

## 21.3 초기 하드 상한

```text
maxHumans = 8
maxAi = 12
maxTotalCombatants = 16
```

이는 목표값이지 현재 성능이 보장됐다는 뜻은 아니다.

## 21.4 단계별 검증

```text
1단계: 총원 8명
2단계: 총원 12명
3단계: 총원 16명
```

각 단계에서 최소 10~20분 장기 전투를 측정한다.

## 21.5 권장 서버 틱 기준

초기 승인 기준 후보:

| 지표 | 목표 |
|---|---:|
| 평균 서버 틱 | 12ms 이하 |
| p95 서버 틱 | 22ms 이하 |
| 지속 최대 | 33ms 이상 장기 지속 금지 |
| AI 계산 p95 | 총원 16 기준 8ms 안팎 이하 목표 |

실제 수치는 테스트 결과로 조정한다.

## 21.6 성능 최적화 후보

성능이 부족할 때 순서:

1. AI 타깃·아이템 후보 거리 제한
2. 공간 버킷 재사용
3. Open Arena AI 판단 주기 조절
4. 화면과 거리가 먼 임시 객체 갱신 빈도 조절
5. 점수 메시지 저빈도화
6. 총원 하드 상한 하향

게임 규칙 완성 전에 성급한 전면 최적화를 하지 않는다.

---

# 22. 패치 단계 분할

## Refactor 024A — Open Arena Mode Foundation

목표:

```text
신규 모드가 별도로 생성되고,
인간 정원과 AI 수가 분리되며,
자기장과 최종 승리 판정 없이 전투를 시작할 수 있음
```

포함:

- `GameMode` 공유 타입
- Open Arena 생성 옵션
- 서버 옵션 정규화와 검증
- `maxHumans`와 `configuredAiCount` 분리
- 방 목록 metadata 확장
- Open Arena 생성 UI
- Open Arena 전용 시작 경로
- 비행기·낙하 없이 안전 스폰 시작
- 자기장 완전 비활성화
- `finishCheck()` 우회
- 설정된 AI 수 초기 생성
- 기존 Battle Royale 완전 보존

제외:

- 게임 중 인간 난입 완성
- 방장 승계 개선
- 인간·AI 반복 리스폰
- 아이템·차량 재생성
- 점수판

024A에서 Open Arena AI는 죽으면 일단 사망 상태로 남아도 된다. 반복 리스폰은 024C에서 추가한다.

완료 기준:

- Open Arena 방을 만들 수 있음
- 인간 정원과 AI 수 조합 검증
- AI가 인간 자리를 점유하지 않음
- Open Arena에 자기장이 나타나지 않음
- 한 명만 살아 있어도 방이 FINISHED로 바뀌지 않음
- 기존 Battle Royale 전체 흐름 정상

## Refactor 024B — Lifecycle, Join-in-Progress & Host Migration

목표:

```text
Open Arena가 진행 중이어도 인간이 난입하고,
방장이 나가도 방이 유지되며,
마지막 인간이 나가면 안전하게 삭제됨
```

포함:

- Open Arena ACTIVE 중 난입
- 서버 onAuth 수용 조건
- 진행 중 onJoin 초기화
- joinedAt 기반 방장 승계
- hostChanged 메시지
- Open Arena `autoDispose=false`
- ACTIVE / EMPTY_GRACE / DISPOSED
- 방 목록 즉시 숨김
- 신규 난입 차단
- 재접속 유예
- 최종 dispose와 타이머 정리

## Refactor 024C — Human & AI Respawn

목표:

```text
인간과 설정된 AI가 사망 후 안전하게 반복 리스폰함
```

포함:

- 인간 리스폰 대기
- 대기 중 관전
- 안전 스폰 평가기
- 카메라 및 입력 복귀
- 기본 장비
- 스폰 보호와 공격 시 해제
- AI 고정 슬롯
- 동일 이름·페르소나 AI 리스폰
- AI 런타임 상태 정리
- 중복 타이머·슬롯 방지
- 024C 단계에서는 Open Arena 사망 시 전체 인벤토리 드롭 금지

## Refactor 024D — Persistent Loot, Vehicle Respawn & World Cleanup

목표:

```text
방이 오래 유지돼도 아이템·차량·임시 객체가 고갈되거나 무한 증식하지 않음
```

포함:

- 아이템 생성 슬롯
- 종류별 재생성 시간
- 제한된 사망 드롭
- 사망 드롭 TTL
- loot 상한
- 오토바이 슬롯과 재생성
- 고아 타이머 정리
- 월드 객체 장기 안정성 테스트

## Refactor 024E — Open Arena Scoreboard & UX

목표:

```text
플레이어가 Open Arena의 상태, 점수, 리스폰, 방장, 인원을 명확히 이해함
```

포함:

- 킬·데스·K/D
- 연속 처치
- 인간/AI 처치 구분
- 리스폰 카운트다운
- 스폰 보호 표시
- 방장 변경 알림
- 현재 인간/AI 인원
- Open Arena 전용 HUD
- 방 목록 UX 완성
- 모드별 나가기 안내

---

# 23. 단계별 수정 예정 파일

실제 패치 제작 전에 최신 ZIP을 다시 확인한다.

## 024A 예상 파일

```text
shared/src/gameModes.ts                         신규
shared/src/index.ts
server/src/rooms/Drop8Room.ts
server/src/roomRegistry.ts
client/index.html
client/src/main.ts
client/src/network.ts
client/src/style.css
server/tests/refactor024a-open-arena-foundation.test.ts    신규
server/tests/refactor024a-room-registry.test.ts            신규
docs/PATCH_NOTES.md
```

수정 이유:

- shared: 모드와 옵션 계약
- room: 생성·시작·자기장·종료 분기
- registry: 인간/AI/모드 메타데이터
- client: 생성 UI와 방 목록
- tests: 모드 분리와 BR 회귀

## 024B 예상 파일

```text
server/src/rooms/Drop8Room.ts
server/src/roomRegistry.ts
client/src/main.ts
client/src/network.ts
server/tests/refactor024b-open-arena-lifecycle.test.ts      신규
server/tests/refactor024b-host-migration.test.ts            신규
server/tests/refactor024b-join-in-progress.test.ts          신규
docs/PATCH_NOTES.md
```

## 024C 예상 파일

```text
server/src/rooms/openArenaRespawn.ts             신규
server/src/rooms/Drop8Room.ts
client/src/GameScene.ts
client/src/main.ts
client/src/network.ts
client/src/style.css
server/tests/refactor024c-open-arena-respawn.test.ts        신규
server/tests/refactor024c-safe-spawn.test.ts                 신규
server/tests/refactor024c-ai-slot-respawn.test.ts            신규
docs/PATCH_NOTES.md
```

## 024D 예상 파일

```text
server/src/rooms/openArenaWorld.ts               신규
server/src/rooms/Drop8Room.ts
server/tests/refactor024d-arena-loot.test.ts                 신규
server/tests/refactor024d-arena-vehicle.test.ts              신규
server/tests/refactor024d-world-cleanup.test.ts               신규
docs/PATCH_NOTES.md
```

## 024E 예상 파일

```text
server/src/rooms/Drop8Room.ts
client/index.html
client/src/main.ts
client/src/network.ts
client/src/GameScene.ts
client/src/style.css
server/tests/refactor024e-arena-scoreboard.test.ts           신규
server/tests/refactor024e-arena-ux-source.test.ts             신규
docs/PATCH_NOTES.md
```

---

# 24. 단계별 테스트 계획

## 24.1 024A 테스트

### 설정과 검증

- 기본값으로 Open Arena 생성
- 인간 8 + AI 7 허용
- 인간 8 + AI 12는 총원 20이므로 거부
- AI 음수, NaN, 문자열 입력 정규화
- 지원되지 않는 gameMode 거부 또는 Battle Royale 기본 처리 정책 확인

### 인간과 AI 정원

- `maxClients === maxHumans`
- AI 생성 후 인간 자리가 감소하지 않음
- `configuredAiCount`만큼 AI 생성
- Battle Royale `fillAi()`는 기존 총원 8 유지

### Open Arena 시작

- 비행기 사용 안 함
- 인간과 AI가 월드에서 바로 살아 있음
- 자기장 비활성
- zone damage 없음
- 생존자 1명이어도 FINISHED 아님
- 기존 BR 시작·비행기·자기장·승리 정상

### 메타데이터와 UI

- room list에 mode/maxHumans/aiCount 표시
- Open Arena 생성 조합 UI 검증
- Battle Royale 생성 UI 기존 기능 정상

## 24.2 024B 테스트

### 난입

- ACTIVE Open Arena에 신규 인간 입장
- 기존 월드 초기화 없음
- 현재 Schema 정상 수신
- 안전 위치에 생성
- 인간 정원 가득 차면 서버 거부
- Battle Royale 진행 중 입장 정책 기존 유지

### 방장 승계

- 방장 퇴장 후 가장 오래 접속한 인간 승계
- 죽은 인간도 연결 중이면 후보
- AI는 후보 제외
- 기존 방장 재입장 시 자동 복귀 안 함
- AI 수와 방 설정 유지

### 생명주기

- 인간 1명 이상이면 ACTIVE
- 마지막 인간 퇴장 즉시 unlisted/private
- 신규 onAuth 거부
- 기존 연결 재접속 시 ACTIVE 복귀
- 유예 종료 후 dispose
- 모든 Open Arena 런타임 타이머 제거

## 24.3 024C 테스트

### 인간 리스폰

- 사망 후 5초 대기
- 관전 동작
- 카운트다운 수신
- 안전 스폰
- hp/alive/phase 복구
- 카메라와 입력 복구
- 스폰 보호 적용
- 공격 시 즉시 해제
- 재사망 후 타이머 중복 없음

### AI 슬롯

- 설정된 슬롯 수 고정
- AI 사망 후 같은 슬롯·이름·페르소나
- 여러 AI 동시 사망
- 중복 생성 없음
- 방 dispose 후 리스폰 없음
- Refactor 021~023 AI 대사·수색 회귀 없음

### 안전 스폰

- 물·벽·불·차량 겹침 제외
- 적 직선 사격선 회피
- 최근 스폰 반복 감소
- 모든 후보 위험 시 fallback

## 24.4 024D 테스트

### 아이템

- 획득 후 타이머
- 같은 슬롯 중복 없음
- 종류별 시간
- 방 dispose 후 재생성 없음
- 사망 드롭 60초 후 삭제
- 전체 loot 상한 유지

### 차량

- 파괴 후 제거
- 일정 시간 뒤 같은 슬롯 재생성
- 스폰 위치 점유 시 연기
- 슬롯당 1대
- 기존 BR 차량 회귀 없음

### 장기 실행

- 30분 이상 시뮬레이션
- 객체 수가 무한 증가하지 않음
- 고아 타이머 없음
- 서버 틱 지연 추세 없음

## 24.5 024E 테스트

- 킬·데스 갱신
- 자살과 환경 사망 처리
- 인간/AI 처치 구분
- 연속 처치 초기화
- 리스폰 HUD
- 방장 변경 알림
- 현재 인간/AI 인원
- 자기장 UI 미표시
- BR HUD 정상

---

# 25. 기존 배틀로얄 회귀 테스트

각 단계에서 다음을 반드시 다시 실행한다.

```text
기존 Battle Royale 방 생성
기존 공개·비공개 방
비밀번호 입장
기존 준비 상태
기존 fillAi
기존 AI 난이도
기존 맵 변경
비행기
낙하
자기장 생성·축소·피해
보급 상자
인간 사망·관전
AI 사망
마지막 생존자 승리
결과 화면
재대결과 로비 초기화
오토바이
전리품
현장 채팅
AI 페르소나 대사
Refactor 022 경로와 수영 탈출
Refactor 023 수색과 관전 대사
늑대인간 시즌
```

특히 Open Arena 분기가 `tick()`, `damage()`, `finishCheck()`, `onJoin()`, `onLeave()`에 들어가므로 이 다섯 경로의 BR 회귀 테스트를 별도로 강화한다.

---

# 26. 위험 요소와 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| Battle Royale 코드가 Open Arena 조건에 오염 | 기존 게임 고장 | 모드 경계 함수와 BR 회귀 테스트 |
| 진행 중 난입자가 월드를 초기화 | 전원 상태 손실 | onJoin은 개인 초기화만 수행 |
| AI 슬롯 중복 | AI 수 폭증 | 고정 슬롯·generation 토큰 |
| 리스폰 타이머 중복 | 한 캐릭터 여러 번 부활 | Map 단일 예약·세대 검증 |
| 리스폰 후 입력 불가 | 플레이 불능 | 서버 상태와 클라이언트 카메라 회귀 테스트 |
| 관전 카메라 잔류 | 자기 캐릭터를 못 봄 | respawned 이벤트에서 관전 상태 초기화 |
| 스폰킬 | 반복 사망 | 후보 점수·사격선·2초 보호 |
| 보호 악용 | 무적 공격 | 공격적 입력 즉시 보호 해제 |
| 방장 승계 실패 | 설정 권한 없음 | joinedAt 명시 관리 |
| 마지막 인간이 나갔는데 방 유지 | 고아 방·서버 자원 낭비 | EMPTY_GRACE 후 명시 dispose |
| EMPTY_GRACE 신규 난입 | 삭제 직전 방 입장 | onAuth lifecycle 검사 |
| 삭제 방 코드 재사용 | 잘못된 방 연결 | presence 제거·새 코드 생성 검사 |
| 아이템 무한 증식 | 메모리·성능 저하 | 슬롯·TTL·상한 |
| 오토바이 중복 | 충돌·Schema 증가 | 차량 슬롯당 1대 |
| 고아 임시 객체 | 장기 서버 저하 | 주기적 정리와 onDispose 정리 |
| AI와 인간 정원 혼합 | 인간 난입 불가 | maxClients=maxHumans, 메타데이터 분리 |
| 총원 증가 서버 틱 지연 | 랙 | 8→12→16 단계 검증 |
| Schema 필드 초과 | 런타임/직렬화 오류 | 기존 Schema 신규 필드 금지 |
| 과도한 custom message | 네트워크 증가 | 이벤트·저빈도 전송 |
| no-zone AI 정체 | AI가 의미 없이 배회 | Ref023 free sweep 회귀 확인 |
| no-zone 보급 미발생 | 콘텐츠 감소 | 초기 정상 처리, 후속 Arena 이벤트 |
| 사망 전체 드롭 폭증 | loot 폭증 | 024C에서 비활성, 024D 제한 드롭 |
| 늑대 시즌 무한 반복 | 예기치 않은 상태 | Open Arena 장기 테스트 |
| 수동 핫픽스 손실 | 기존 개선 회귀 | 현재 파일 preimage와 전용 백업 |

---

# 27. 적용 및 롤백 전략

각 단계는 독립된 TypeScript 패치 실행기로 만든다.

## 27.1 적용 순서

```text
Refactor 024A 적용
→ 실제 플레이 및 BR 회귀 검증
→ Git 커밋

Refactor 024B 적용
→ 난입·방장 승계·방 삭제 검증
→ Git 커밋

Refactor 024C 적용
→ 인간·AI 반복 리스폰 검증
→ Git 커밋

Refactor 024D 적용
→ 30분 이상 장기 실행 검증
→ Git 커밋

Refactor 024E 적용
→ HUD와 점수 UX 검증
→ Git 커밋
```

중간 단계를 건너뛰지 않는다.

## 27.2 실행기 필수 기능

- 프로젝트 루트 자동 탐지
- Refactor 023 확인
- 직전 024 단계 확인
- 정확한 원본 문맥 검사
- 예상 치환 횟수 검사
- 전체 대상 파일 백업
- dry-run
- 이미 적용됨 탐지
- 부분 적용 탐지
- 신규 파일 충돌 탐지
- UTF-8 보존
- 실패 시 자동 롤백
- `--rollback`
- typecheck
- lint
- 집중 테스트
- BR 회귀 테스트
- 전체 테스트
- build
- `git diff --check`

## 27.3 Windows 실행 방식

```cmd
node --experimental-strip-types PATCH_FILE.ts --dry-run
node --experimental-strip-types PATCH_FILE.ts
node --experimental-strip-types PATCH_FILE.ts --rollback
```

## 27.4 단계별 마커

권장 마커:

```text
DROP8_REFACTOR_024A_OPEN_ARENA_FOUNDATION
DROP8_REFACTOR_024B_OPEN_ARENA_LIFECYCLE_HOST_MIGRATION
DROP8_REFACTOR_024C_OPEN_ARENA_RESPAWN
DROP8_REFACTOR_024D_OPEN_ARENA_PERSISTENT_WORLD
DROP8_REFACTOR_024E_OPEN_ARENA_SCOREBOARD_UX
```

상위 문서 마커:

```text
DROP8_REFACTOR_024_OPEN_ARENA_MODE_PLAN
```

---

# 28. 권장 최종 패치 번호

최신 소스에는 Refactor 023이 실제 적용돼 있다.

따라서 신규 모드 상위 번호는 다음이 적절하다.

```text
Refactor 024 — Open Arena Mode
```

단계 번호:

```text
Refactor 024A — Open Arena Mode Foundation
Refactor 024B — Lifecycle, Join-in-Progress & Host Migration
Refactor 024C — Human & AI Respawn
Refactor 024D — Persistent Loot, Vehicle Respawn & World Cleanup
Refactor 024E — Open Arena Scoreboard & UX
```

이번 기능은 DROP 8 최초 신규 모드이므로 단일 패치로 합치지 않는다.

가장 먼저 제작할 실행기는 `024A`다.

---

# 29. 사용자 승인 요청

최신 소스 기준으로 신규 모드는 기존 배틀로얄과 분리된 **Refactor 024 — Open Arena Mode**로 설계하는 것이 적절하다.

## 상위 범위

- 방장이 인간 최대 인원과 AI 숫자 설정
- 인간 정원과 AI 슬롯 분리
- 진행 중 자유 난입
- 인간 및 AI 사망 후 리스폰
- 자기장 완전 비활성화
- 방장 자동 승계
- 마지막 인간 퇴장 시 비공개 및 삭제
- 무기·아이템·차량 재생성
- 월드 오브젝트 자동 정리
- Open Arena 전용 점수와 UI
- 기존 Battle Royale 완전 보존

## 권장 분할

- Refactor 024A: Open Arena Foundation
- Refactor 024B: Lifecycle & Host Migration
- Refactor 024C: Human & AI Respawn
- Refactor 024D: Persistent Loot & Cleanup
- Refactor 024E: Scoreboard & UX

## 먼저 승인받을 024A 정확한 범위

```text
GameMode에 openArena 추가
Open Arena 방 생성 UI
인간 최대 인원 설정
AI 인원 설정
인간 정원과 AI 수 분리
총 전투원 최대 16명 검증
방 목록 모드·인간·AI 표시
Open Arena 전용 시작 경로
비행기와 자기장 비활성화
마지막 생존자 종료 판정 비활성화
설정된 AI 수 초기 생성
기존 Battle Royale 전체 보존
관련 신규·회귀 테스트
```

**이 설계와 분할을 승인하고, 다음 단계로 Refactor 024A TypeScript 패치 실행기 제작을 진행할 것인지 사용자 확인이 필요하다.**

---

# 부록 A. 권장 서버 런타임 구조

아래는 설계 예시이며 이번 문서 단계에서 실제 소스에 추가하지 않는다.

```ts
type GameMode = 'battleRoyale' | 'openArena';
type OpenArenaLifecycle = 'active' | 'emptyGrace' | 'disposed';

interface OpenArenaConfig {
  maxHumans: number;
  configuredAiCount: number;
  maxTotalCombatants: number;
  respawnDelayMs: number;
  spawnProtectionMs: number;
  emptyGraceMs: number;
}

interface OpenArenaAiSlot {
  slotId: string;
  playerId: string;
  personaId: string;
  state: 'alive' | 'respawnWait';
  respawnAt: number;
  generation: number;
}
```

권장 Room 내부 상태:

```ts
private gameMode: GameMode = 'battleRoyale';
private openArenaConfig?: OpenArenaConfig;
private openArenaLifecycle: OpenArenaLifecycle = 'active';
private humanJoinedAt = new Map<string, number>();
private humanRespawnAt = new Map<string, number>();
private spawnProtectionUntil = new Map<string, number>();
private openArenaAiSlots = new Map<string, OpenArenaAiSlot>();
```

---

# 부록 B. 권장 사용자 메시지 계약

Schema 필드 한도를 우회하기 위한 저빈도 메시지 후보:

```text
roomConfig
- gameMode
- maxHumans
- configuredAiCount
- maxTotalCombatants
- mapId

arenaStatus
- lifecycle
- humans
- aliveAi
- respawningAi
- hostId

hostChanged
- hostId
- hostName

respawnScheduled
- playerId
- respawnAt

respawned
- playerId
- x
- y

spawnProtection
- playerId
- protectedUntil

arenaScoreboard
- generatedAt
- rows[]
```

보안 원칙:

```text
클라이언트는 표시만 수행
리스폰 시각·보호·점수·방장 결정은 서버가 결정
```

---

# 부록 C. 상태 전환 다이어그램

## 방

```text
LOBBY
  │ 방장 시작
  ▼
ACTIVE
  │ 마지막 인간 퇴장
  ▼
EMPTY_GRACE
  ├─ 기존 인간 재접속 ─→ ACTIVE
  └─ 유예 종료 ───────→ DISPOSED
```

## 인간

```text
JOIN
  ▼
ALIVE
  │ 사망
  ▼
DEAD_SPECTATING
  │ 대기 종료
  ▼
RESPAWNING
  │ 서버 초기화 완료
  ▼
ALIVE
```

## AI 슬롯

```text
ALIVE
  │ 사망
  ▼
RESPAWN_WAIT
  │ respawnAt
  ▼
ALIVE
```

---

# 부록 D. 024A 수용 기준 체크리스트

```text
[ ] Refactor 023 마커 확인
[ ] 수동 AI 핫픽스 보존
[ ] GameMode 공유 타입 추가
[ ] Battle Royale 기본값 유지
[ ] Open Arena 옵션 서버 정규화
[ ] maxHumans와 aiCount 별도 검증
[ ] 총 전투원 16 초과 거부
[ ] maxClients=maxHumans
[ ] 설정 AI 수 초기 생성
[ ] Open Arena 비행기 미사용
[ ] Open Arena 자기장 미사용
[ ] Open Arena finishCheck 미사용
[ ] Open Arena 방 목록 정보 표시
[ ] 기존 Battle Royale 전체 회귀 통과
[ ] typecheck
[ ] lint
[ ] 집중 테스트
[ ] 전체 테스트
[ ] build
[ ] git diff --check
```

---

# 부록 E. 이번 단계에서 만들지 않은 것

이 문서는 설계 MD만 작성한다.

다음 항목은 생성하지 않았다.

```text
프로젝트 소스 수정
Refactor 024A 패치 실행기
신규 TypeScript 소스 파일
신규 테스트 파일
Schema 변경
UI 변경
```

실제 패치 작업은 사용자가 Refactor 024A 번호와 범위를 승인한 뒤 시작한다.
