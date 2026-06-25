# 패치 노트

## 0.2.0 소스 전용 배포

- `.cmd`, `.bat`, `.ps1`, 사전 빌드 JavaScript 제거
- `npm run dev` 단일 포트 개발 실행
- `npm run dev:lan` LAN 주소 자동 표시
- Vite 8, Vitest 4 기반으로 갱신
- 전체 npm 보안 감사 취약점 0개
- Vitest 기반 Colyseus 통합 테스트
- 소스 ZIP 금지 확장자 검사 추가

## 후속 우선순위

1. AI 경로 탐색과 엄폐 개선
2. 클라이언트 예측·서버 재조정 고도화
3. 실제 인벤토리 드롭 UI
4. 효과음과 애니메이션
5. 공개 인터넷 서버 배포 검증


## refactor_001 - 렌더링·건물·아이템·전투 표현 개선
- 정적 맵 1회 렌더링, 동적 객체 화면 컬링, 좌표 보간, 미니맵 10Hz 갱신
- 건물 벽을 문이 있는 4면 충돌 구조로 변경
- 아이템별 선·점·도형 아이콘 및 근처 E 획득 안내 추가
- 주먹 양팔/펀치 애니메이션 및 총기별 실루엣 추가
- 근접무기 데이터와 서버 판정 오류 수정
- AI 판단 주기 완화 및 아이템 벽 겹침 방지

## refactor_002 — AI 지속 이동, 피격감, 넉백, 클라이언트 부드러움

- AI 판단 주기와 실제 이동 주기를 분리해 매 서버 틱마다 이동하도록 변경
- AI 벽 충돌 시 좌우 우회와 막힘 감지 추가
- 주먹·근접무기·총기별 서버 권위 넉백 추가
- hitSeq, lastHitAngle, lastHitDamage 상태 추가
- 피격 시 캐릭터 점멸, 충격 링, 카메라 흔들림, 화면 붉은 오버레이 추가
- 내 캐릭터 로컬 이동 예측과 서버 위치 완만 보정 추가
- 자기장·아이템을 10Hz 느린 레이어로 분리
- FPS 텍스트를 2Hz로 제한하고 만료 총알 표시 캐시 제거
- AI 이동 및 주먹 넉백 통합 테스트 추가

## refactor_003 — 회복, AI 장비 판단, 인게임 방 코드

- 4번 키를 자동 회복으로 변경하고 붕대/구급상자를 체력 손실에 따라 선택
- 회복 아이템은 완료 시점에만 차감하며 이동·공격·피격·무기 교체 시 취소
- 회복 종류와 진행률을 서버 상태 및 HUD에 표시
- 총기별 탄창을 분리해 무기 교체 후 탄창이 섞이는 문제 수정
- AI가 거리·탄약·탄창을 고려해 무기를 선택하고 빈 탄창을 재장전
- AI가 체력이 낮고 안전할 때 회복약 사용
- AI 파밍을 무기 업그레이드, 필요한 탄약, 방어구, 회복약 점수제로 변경
- 최근 총소리 조사, 마지막 목격 위치 기억, 저체력 후퇴 추가
- 건물 안팎 목표에 문 바깥/안쪽 경유점을 사용하는 이동 경로 추가
- 게임 중 상단 HUD에 방 코드를 항상 표시하고 클릭 시 초대 링크 복사
- 회복, 총기별 탄창, AI 무기 선택, AI 회복 통합 테스트 추가

## refactor_003 hotfix — AI weapon test and building navigation

- Fixed a false-negative AI weapon test that checked the equipped weapon after the rifle magazine had already been emptied and the AI had correctly switched to a pistol.
- Added deterministic isolation for AI combat tests.
- Added stable AI destination routes that are recalculated only when the goal changes or the AI is actually stuck.
- Added lightweight visibility-graph routing around relevant building corners and door points.
- Added sub-stepped collision movement to reduce corner tunneling and wall wedging.
- Added emergency relocation when an AI is already overlapping a wall.
- Added a building-door integration test that verifies an AI can route from the opposite side of a building, enter through its door, and pick up a weapon.

## Refactor 004A

- AI 착지 직후 파밍 우선 및 전투 준비도 적용
- 맨손 AI의 도주·비상 방어 행동 추가
- 서버 전용 AI 아이템 예약과 만료/해제 처리
- 아이템 스폰 간격, 문·벽 이격, 사망 드롭 분산
- 폐공장·주택가·병원·창고·군사시설·숲 캠프별 loot table
- 하단 슬롯형 인벤토리 HUD 및 Tab 상세 인벤토리
- 바닥 아이템과 현재 장비의 화력·사거리·연사력 비교 표시

### 알려진 제한

- 부쉬 및 지역별 장식은 Refactor 004B 범위
- 병원 치료대 등 지역 고유 상호작용 미구현
- AI 경로 탐색은 건물 문·모서리 경유 기반이며 전체 격자 A*는 아님
- 인벤토리 드래그 앤 드롭과 버리기 UI 미구현


## Refactor 004B — 지역 개성 및 부쉬 은폐

- 여섯 지역에 고유 바닥·벽·건물 색상과 지역 설명을 적용했습니다.
- 폐공장 기계·컨테이너, 주택가 마당·울타리, 병원 의료 표식·병상·구급차, 창고 상자·지게차, 군사시설 모래주머니·헬리패드, 숲 캠프 텐트·모닥불·통나무를 추가했습니다.
- 숲 캠프 중심으로 부쉬를 배치하고 다른 지역에도 소량 배치했습니다.
- 부쉬는 이동을 막지 않으며, 먼 거리에서는 안에 숨은 상대가 보이지 않습니다.
- 부쉬 안에서 사격하면 1.25초, 피격되면 0.8초 동안 위치가 노출됩니다.
- AI도 같은 은폐 규칙을 사용하며 총소리가 난 부쉬는 기존 소음 조사 로직으로 확인합니다.
- 현재 지역과 파밍 특성을 게임 화면에 표시합니다.

알려진 제한:

- 부쉬는 완전한 투사체 방어물이 아니며, 위치를 예상해 발사한 탄환은 적중할 수 있습니다.
- 장식물은 이번 버전에서 시각 요소이며 충돌 장애물로 사용하지 않습니다.
- 필드 채팅 고정 표시, 재장전 연출, 건물 끼임 추가 안정화는 Refactor 004C 범위입니다.
