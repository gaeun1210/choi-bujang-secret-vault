# 최 부장 비밀 자료실 — BYTE BACK 방어전 학생 저장소

이 저장소는 운영 측 시작 틀(ChoiTimo/aleph-defense-starter R5)에서 출발해 학생이 1~12단계에 걸쳐 만든 자료실입니다. 자료실의 메모는 모두 가상 자료이며, 실제 학생 자료·토큰·비밀키는 넣지 않습니다.

## 출처 (제공 엔진과 학생 작업)

- **제공 엔진: ALEPH SDP 엔진** — 운영 측이 제공합니다. 신원·기기·경로 확인, 판정기에 판정 요청 보내기, 탐지 사건 전달, 접속 회수 실행, 심판 판정을 맡습니다. 이 저장소에는 엔진 코드가 없습니다.
- **학생 작업** — 판정기(`src/decider.mjs`), 탐지 규칙(`src/detect.mjs`), 접속 앱(`public/`), 자료실(`api/`, `src/notes-api.mjs`, `src/ops-summary.mjs`, `supabase/`).
- **제공 시작 틀** — `src/verify-login.mjs`, `scripts/bundle.mjs` 등 첫 커밋 `0ff36ed`의 파일(자세한 표는 아래 「탈환 작전실과 재현 안내」).
- 비밀번호·토큰·서버 전용 키·기기 비밀값은 저장소와 제출 묶음에 넣지 않습니다.

## 단계 기록

| 단계 | 커밋 | 한 일 |
| --- | --- | --- |
| 1단계 | `0ff36ed` Initial commit | Vercel 시작 틀 배포. `/data.json`과 공개 저장소의 `data.json`에 가상 메모 네 건이 그대로 공개된 상태를 확인 |
| 2단계 | `a9cd08a` 「2단계 저장점」 | 메모를 정적 파일·코드에서 빼서 학습용 Supabase 테이블로 옮기고, 서버 함수 `/api/notes`가 읽게 바꿈 |
| 3단계 | `b2797a4` 「3단계 저장점」 | Supabase Auth 이메일·비밀번호 로그인·로그아웃, 서버의 토큰 검사(`src/verify-login.mjs`), 로그인 사용자의 가상 메모 추가·수정·삭제 API |
| 4단계 | `cc06beb` 「4단계 저장점」 | API가 확인된 사용자 ID와 DB `owner_id`를 비교해 읽기·추가·수정·삭제를 본인 메모로 제한, B 시험 메모 SQL, 메모 테이블 RLS·최소 권한 SQL 제안 |
| 5단계 | `d323be8` 「5단계 저장점」 | 로그인·로그아웃도 서버 함수로 옮겨 화면 코드에서 Supabase 주소·공개 키·SDK 제거, 메모 테이블의 PUBLIC·anon·authenticated 직접 권한 회수 SQL, `originalApiUrl` 기록 |
| 보너스 xdr-01 | `1dba0c2` 「보너스 xdr-01 저장점」 | 무차별 로그인 공격 탐지(T1110): 경보 읽기·패턴·판단·ZTNA 거부 규칙 부품·알림 로그 |
| 보너스 xdr-02 | `a110fd6` 「보너스 xdr-02 저장점」 | 웹 주입 공격 탐지(T1190): SQL 구문·스크립트 태그·경로 이탈 반복·명령 구분자 패턴, 판단·ZTNA 거부 규칙 부품·알림 로그 |
| 6단계 | `3069eb8` 「6단계 저장점」 | 판정기 `src/decider.mjs`에 기기 등록 규칙 `device_registered` 추가: 등록 기기의 읽기만 허용, 미등록·값 없음은 `deny`·`device_not_registered` |
| 7단계 | `0edf640` 「7단계 저장점」 | 판정기 입력 검사(접속 정보는 엔진의 가상 사건 출처일 때만 신뢰) + 규칙 `step_up_required`: 새벽 시각·처음 보는 네트워크·갑작스러운 대량 읽기가 겹치면 다시 로그인 요구 |
| 8단계 | `885f310` 「8단계 저장점」 | 자원 구역 나누기: 메모(`note:`)·강사 공지(`notice:`) 자원 ID, 판정기 구역 규칙(정확한 메서드·경로 허용 목록), 자료 API의 소유자·DB 강사 권한 재확인, 공지 테이블 SQL |
| 9단계 | `df9422b` 「9단계 저장점」 | 탐지 함수 `src/detect.mjs`: 가상 사건 입력 정리, 평소와 다른 네트워크 + 다량 조회 탐지, 별도 결과로 `propose_revocation` 제안 |
| 10단계 | `f149579` 「10단계 저장점」 | 백업에서 되살리기: 검증한 안전 정책 사본과 차이 보기·확인 후 되돌리기(감사 기록 덧붙이기), 비공개 메모 사본과 본인 메모 한 건 복원 `POST /api/restore/:id` |
| 11단계 | `abb36f0` 「11단계 저장점」 | 나만의 접속 앱: 설치형 웹앱(manifest·아이콘·오프라인 안내), 기기 승인 요청·상태 화면, 서버가 승인한 기기에서만 자료 열기, 토큰·기기 비밀값은 HttpOnly 쿠키로만 |
| 12단계 | `0d62f84` 「12단계 저장점」 | 탈환 작전실 `/ops.html`·`GET /api/ops/summary`(판정기 규칙·탐지 규칙·회수 상태·복구 버전·감사, 가린 서버 기록과 수치 대조), 1~11단계 정상·금지 요청 실측표(`public/ops-checks.mjs`, `npm run ops:matrix`), 설치·실행·중지·복구 안내와 출처 구분 |
| 보너스 xdr-03 | `149e2e5` 「보너스 xdr-03 저장점」 | 알려진 취약점 악용 탐지(CVE-2021-44228·T1190): 머리글·요청 인자 안의 원격 조회 구문(jndi), 점검 도구 흔적, 조회 구문 없는 단서는 알림만, 판단·ZTNA 거부 규칙 부품·알림 로그 |
| 보너스 xdr-04 | `884b94e` 「보너스 xdr-04 저장점」 | 지속성 설치 탐지(T1543·T1053): 서명 없는 새 서비스, 낯선 예약 작업, 임시·시작 폴더 실행 파일, 다시 켜도 남는 목록 밖 항목, 약한 변경은 알림만, 판단·ZTNA 격리 규칙 부품·알림 로그 |
| 보너스 xdr-05 | `b9d20e5` 「보너스 xdr-05 저장점」 | 권한 가로채기 탐지(T1068·T1078): 관리자 그룹 추가, 처음 보는 관리자 명령, 업무 시간 밖·처음 보는 곳·다른 계정 권한 사용, 약한 권한 변경은 알림만, 판단·ZTNA 세션 회수 규칙(계정+주소) 부품·알림 로그 |
| 보너스 xdr-06 | 「보너스 xdr-06 저장점」 | 자료 유출 탐지(T1041·T1048): 처음 보는 목적지로 대용량 전송, 같은 목적지 반복·다량 파일, 업무 시간 밖 압축 파일 반출, 작은 전송은 알림만, 판단·ZTNA 목적지 차단 규칙 부품·알림 로그 |

## 판정기 (6~8단계)

`src/decider.mjs`의 `decide(request)`는 ALEPH SDP 엔진이 신원·기기·경로를 확인한 뒤 보낸 요청만 받습니다(계약: `docs/DECIDER_REQUEST.md`). 규칙 이름은 같은 파일의 `RULE_IDS`에 있습니다. 위에서부터 차례로 봅니다.

| 순서 | 규칙 | 조건 | 결과 |
| --- | --- | --- | --- |
| 1 | `device_registered` | `deviceRegistered`가 정확히 `true`가 아님(미등록·값 없음) | `deny` · `device_not_registered` |
| 2 | `starter.deny` | 메서드·경로가 문자열이 아닌 깨진 요청 | `deny` · `starter_not_ready` |
| 3 | `zone_route_allowlist` | 아래 구역 표에 없는 메서드·경로, 쿼리가 붙은 요청(`queryLength`≠0), `route`와 `path` 불일치, `:id` 자리에 기능 이름(`export` 등)·더 깊은 경로 | `deny` · `route_not_allowed` |
| 4 | 구역 규칙 | 엔진이 확인한 사용자(`subjectId`)가 없음 | `deny` · `route_not_allowed` |
| 5 | `zone_notice_instructor_only` | `PUT /notices/:id` — 현재 계약에 엔진이 확인한 강사 역할이 없어 브라우저 값으로 채우지 않고 모두 거부 | `deny` · `route_not_allowed` |
| 6 | `step_up_required` | 읽기인데 이상 신호 세 개가 겹치고 5분 안의 새 로그인 확인이 없음 | `step_up` · `step_up_required` |
| 7 | `device_registered` + `zone_own_notes` / `zone_notices_read` | 자기 메모 한 건 읽기·수정(`GET·PUT /notes/:id`), 공지 읽기(`GET /notices`, `GET /notices/:id`) | `allow` · `approved` |
| (6번 기준) | `step_up_required` | 등록 기기의 읽기인데, 믿을 수 있는 가상 사건에서 **새벽 0~5시 + 처음 보는 네트워크 + 최근 10분 사건 수 합 10 이상**이 모두 겹침, 그리고 5분 안의 새 로그인 확인이 없음 | `step_up` · `step_up_required` (자료 없음, 다시 로그인 요구) |

**구역 판단 보완 (8단계 재제출):** 경로 모양만이 아니라 엔진이 확인한 값을 함께 맞춥니다. ① 서비스: `/notes…`는 `service: "notes"`만, `/notices…`는 `notes`·`notices`만(다른 서비스의 같은 모양 경로는 `route_not_allowed`). ② 사용자: `:id`가 자기 `subjectId` 그대로이거나 `subjectId` 뒤에 구분자(`- _ : .`)로 이어지면 자기 자료, 같은 형식(같은 영문 접두어 `learner_a`·`learnerA`, 또는 같은 길이의 16진수 해시)인데 자기 것이 아니면 **다른 사용자 자료로 거부**. ③ 자원 ID 종류: 메모 경로의 ID에 공지 표시(`notice`·`announce`·`bulletin`·`공지`)가 있으면 공지 구역 규칙(읽기만, 수정 거부), 공지 경로에 메모 ID(`note…`)가 오면 거부. 모두 `deny` · `route_not_allowed`. 자료 API의 공지 수정은 어떤 ID든 DB 강사 권한부터 확인해 학생은 항상 `403`.

**메모 목록 경로 닫기 (8단계 5차 보완):** 판정기는 메모 주인을 모르므로, 메모 목록 `GET /notes`를 열어 두면 여러 사람의 메모를 한꺼번에 여는 길이 됩니다. 판정기 구역 표에서 목록을 빼고 메모는 자료 ID 한 건씩만 허용합니다. `:id` 자리의 목록 이름(`list`, `index`, `everyone`, `users`, `shared`, `public` 등)도 기능 경로로 보고 거부합니다. `aleph.config.json`의 `allowedRoutes`에서도 `GET /api/notes`를 뺐습니다. (자료실 화면의 내 메모 목록은 엔진을 거치지 않는 서버 함수가 로그인 사용자의 `owner_id`로만 걸러 보여 줍니다.)

**거부 이유 코드 (8단계 4차 보완):** 계약상 이유 코드는 운영 등록부(`allowedReasonCodes`)에 있어야 올바른 응답입니다. 등록 여부를 알 수 없는 새 코드(`zone_not_allowed`)를 쓰지 않고, 구역 거부도 모두 `route_not_allowed`로 돌려줍니다. 규칙 이름(`zone_own_notes`, `zone_notice_instructor_only` 등)으로 어느 구역 규칙인지 구별합니다.

**자원 주인 기억 (8단계 3차 보완):** 판정기 요청에는 메모 주인 칸이 없으므로, 자기 메모 구역의 자료 ID를 처음 허용받은 사용자(`subjectId`)를 그 자료의 주인으로 기억합니다. 같은 자료 ID를 다른 사용자가 요청하면 `deny` · `route_not_allowed`. 기억은 같은 판정기 실행 안에서만 유지되며(최대 5000건), 최종 판단은 자료 API의 `owner_id` 대조가 맡습니다.

**구역 표 (판정기 경로 모양):** `GET /notes/:id`, `PUT /notes/:id` → 자기 메모(`own_notes`, 목록 `GET /notes`는 두지 않음) · `GET /notices`, `GET /notices/:id` → 공지 읽기 · `PUT /notices/:id` → 강사만. 판정기의 `subjectId`는 가명이라 메모 주인(`owner_id`)과 직접 비교하지 않으므로, **B가 A의 메모를 요청하는 경우는 최종 자료 API가 거부**합니다(아래).

### 입력 검사 (7단계)

- **접속 정보 출처 구분:** `signals`는 계약 모양(`source·region·network·hour` 네 칸만)이 정확하고 `source`가 엔진의 가상 사건 표시 `judge_fixture`일 때만 믿습니다. 실제 경로의 `source: "none"`, 값 없음, 칸이 더 붙은 값, 다른 출처(브라우저 헤더를 흉내 낸 값 등)는 **믿지 않고, 정상값으로 채우지도 않습니다.** 믿을 수 없으면 7단계 규칙을 적용하지 않고 6단계 규칙만 봅니다.
- **최근 사건:** `recentEvents`는 최대 12건, 각 `{kind, ageSeconds, count}` 모양만 씁니다. 모양이 틀린 항목은 버립니다.
- **다시 로그인 확인:** `stepUp`은 `verified`가 정확히 `true`이고 나이가 0~900초(계약) 안이면서 300초 이하일 때만 유효합니다. `verified` 하나만 보고 건너뛰지 않습니다. 토큰 원문은 판정기에 오지도 않고 기록하지도 않습니다.
- **지역은 판단에 쓰지 않습니다.** 지역 하나만으로 막지 않고, 이상 신호가 겹쳐도 영구 차단이 아니라 다시 로그인만 요구합니다. 사유는 `unusualAccessReasons(request)`가 `off_hours`·`new_network`·`burst_read`로 돌려줍니다.

### 확인 순서 (로컬 연습)

1. `npm run decider:test` → `통과 · 등록 기기의 정상 요청`, `통과 · 미등록 기기의 가상 요청`, `통과 · 복합 이상 접속`(→ `step_up`), `통과 · 다시 확인한 복합 이상 접속`(→ `allow`)
2. `npm run fixture:7` → `정상 사건: allow`, `복합 이상 사건: step_up`
3. 이 명령들은 가상 요청 연습이며 심판 판정이 아닙니다. 다시 로그인 전 자료 차단과 새 요청 허용의 실측은 재로그인 계약(`stepUp`)을 검증하는 ALEPH SDP 엔진이 있는 환경에서 심판이 합니다(이 저장소의 자기 점검에는 미실행으로 기록).
4. 이번 과정에는 따로 설치할 접속 프로그램이 없습니다. 인증서·CA·키는 만들지 않았고, 자료실 화면(`/`)과 `/api/notes…`는 바뀌지 않았습니다.

## 탈환 작전실과 재현 안내 (12단계)

이 안내는 검사한 커밋 `abb36f0`(「11단계 저장점」)에 12단계 변경을 더한 「12단계 저장점」 기준입니다. 비밀번호·토큰·서버 전용 키·기기 비밀값·실제 이메일은 이 저장소와 제출 묶음에 없습니다. 필요한 값은 각자 Vercel·Supabase 설정 화면의 비밀 입력란에만 넣습니다.

### 출처 구분

| 구분 | 무엇 | 위치 |
| --- | --- | --- |
| 제공 엔진 | **ALEPH SDP 엔진**(운영 측 제공): 신원·기기·경로 1차 확인, 판정기에 `aleph.decision.v1` 요청 보내기, 탐지 사건 전달, 접속 회수 실행, 심판 판정·총공세 41종 | 이 저장소에 없음(운영 측 제공) |
| 제공 시작 틀 | `src/verify-login.mjs`, `scripts/bundle.mjs`·`build-public.mjs`·`deployment-identity.mjs`·`decider-test.mjs`·`detect-test.mjs`·`fixture-7.mjs`·`xdr-run.mjs`, `docs/`, `package/`, `xdr/fixtures/`, `test/r5`·`package-starter`·`xdr-run` 시험 | 첫 커밋 `0ff36ed` (시작 틀 R5) |
| 학생 작업 | 판정기 규칙(`src/decider.mjs`), 탐지 규칙(`src/detect.mjs`), 자료실 API(`api/`, `src/notes-api.mjs`, `src/auth-api.mjs`), 접속 앱(`public/`), 정책 사본·복원(`policy/`, `scripts/policy-*.mjs`), 작전실·실측표(`public/ops.html`, `public/ops-checks.mjs`, `src/ops-summary.mjs`(경로 `/api/ops/summary`는 `vercel.json` rewrites로 `api/auth/session.js`가 처리 — Vercel 무료 요금제 서버 함수 12개 제한), `scripts/ops-matrix.mjs`), SQL 제안(`supabase/`), 보너스(`xdr/brute-force`, `xdr/web-injection`, `xdr/known-cve`, `xdr/persistence`, `xdr/privilege`, `xdr/exfiltration`), 자기 점검(`src/attack-check.mjs`), 학생 시험(`test/policy-restore.test.mjs`, `test/decider-zones.test.mjs`) | 2단계~12단계 커밋 |

`npm run decider:test`·`decider:zones`·`detect:test`·`fixture:7`·`ops:matrix`의 로컬 결과는 가상 요청 연습이며 ALEPH SDP 엔진이나 심판의 판정이 아닙니다.

### 탈환 작전실 (`/ops.html`)

- 승인된 기기에서 로그인한 뒤 자료실의 「탈환 작전실 열기 →」를 누릅니다. 로그인·기기 승인이 없으면 열리지 않습니다(서버 `GET /api/ops/summary`도 같은 검사, 401·403).
- 카드 여섯 개와 출처 줄: 학생 판정기 규칙(`RULE_IDS`, 정책 버전, 정책 사본 sha256 대조), 탐지 규칙, 회수 상태(내 기기 승인·대기·취소 수), 복구 버전(정책 사본 버전·sha256, 메모 사본 수, 복원 실행 수), 거부 기록, 감사 기록. 출처 줄은 제공 엔진(ALEPH SDP 엔진)과 학생 작업(판정기·탐지 규칙·접속 앱·자료실)을 나눠 적습니다. 모두 서버가 그때 읽은 값이며 응답 시각·커밋·요청 ID(`x-vercel-id`)를 함께 보여 줍니다.
- 판정기·탐지의 **실제 엔진 판정·사건**은 이 자료실에서 볼 수 없으므로 「미실행 — ALEPH SDP 엔진(제공)」으로 표시합니다.
- **거부 기록:** 로그인 없는 조회(401 `login_required`), 다른 사용자 메모 조회(404 `not_owner_or_missing`), 승인 안 된 기기(403) 같은 거부는 서버가 감사 테이블(`vault_audit`, action `deny`)에 가려서 한 줄씩 남깁니다(사용자 키 앞 8자리 또는 `anon`, 거부 코드, 자원 ID 앞 4자리 또는 `route:GET /api/notes/:id` 같은 경로 모양). 작전실은 모든 요청의 거부를 가려서 보여 줍니다(사용자 키·자원 ID는 앞 4자리만).
- **정책 사본 대조:** 배포된 `src/decider.mjs`의 SAFETY-POLICY 블록 sha256을 서버가 실제로 계산해 `policy/backup/MANIFEST.json`의 sha256과 비교합니다. 파일을 읽지 못하면 「대조 미실행」입니다(버전 이름만으로 같다고 하지 않음).
- 아래 표는 가린 서버 기록입니다(기기 코드·자원 ID는 앞 4자리만). 화면 수치는 그 기록 줄 수로만 세고, 「기기 수 = 기록 줄 수」, 「상태별 합 = 기기 수」, 「행동별 합 = 감사 줄 수」, 「복원 수 = restore_note 줄 수」, 「거부 수 = 거부 줄 수」, 「거부 코드별 합 = 거부 줄 수」를 대조해 ✔/✘로 보여 줍니다. 가상 메모 본문·제목은 응답에 넣지 않습니다.
- 제출 묶음(`npm run bundle`, 12단계)은 요청을 보내지 않고 점검 19개를 모두 `not_run`으로 적습니다. 실측(상태 코드·요청 ID·확인 시각)은 작전실 「실측 실행」 표와 서버의 가린 거부 기록에 남깁니다.
- 작전실 요약을 누가 읽었는지(사용자 키 앞 4자리·시각)도 감사 기록(`ops_view`)에 남겨 작전실에 보여 줍니다.

### 1~11단계 정상·금지 실측표

- **화면:** 작전실의 「실측 실행」 → 단계·정상/금지·요청·기대·실제 API 결과·일치 여부·요청 ID·확인 시각 표. 「표 JSON 복사」로 보관합니다.
- **경로 공개:** 작전실 요약 경로 `GET /api/ops/summary`를 `aleph.config.json`의 `allowedRoutes`와 `opsRoute`에 적어 `/aleph.json`에 싣습니다(읽기 전용, 로그인 필요, 메모 본문 없음).
- **명령:** `npm run ops:matrix` → 로그인 없이 보낼 수 있는 줄만 실제 배포 주소로 보내고, 판정기(`decider:test`·`fixture:7`·`decider:zones`)·탐지·정책 복원 로컬 연습을 따로 표시해 `artifacts/ops-matrix.json`(Git 제외)에 씁니다. 네트워크가 막히면 그 줄은 미실행입니다.
- 엔진이 필요한 줄(판정기·탐지·회수)과 내용이 바뀌는 줄(복원)은 자동으로 보내지 않고 **미실행**입니다. 응답에 `x-vercel-id`가 없으면(중간 프록시 응답) 사이트 결과로 세지 않고 미실행입니다.
- **심판 총공세 41종은 목록이 이 저장소에 없고 실행하지 않았으므로 모두 미실행**입니다. 실측표의 일치는 41종 통과를 뜻하지 않습니다.

### 설치·실행·중지·복구

| 대상 | 설치 | 실행·확인 | 중지 | 복구 |
| --- | --- | --- | --- | --- |
| 학생 판정기 `src/decider.mjs` | Node 22, `npm install` | `npm run decider:test`, `npm run fixture:7`, `npm run decider:zones`(8단계 구역 규칙, 학생 작성) (모두 로컬 연습) | 엔진 설정에서 판정기 연결 해제(운영 측). 코드의 `starter.deny`가 깨진 요청을 막음 | `npm run policy:diff` → 차이 확인 → `npm run policy:restore -- --confirm=safe-v9` (검증한 사본 `policy/backup/`으로 SAFETY-POLICY 블록만 되돌리고 `policy/audit.log`에 한 줄 덧붙임) |
| 탐지 규칙 `src/detect.mjs` | 위와 같음 | `npm run detect:test` (가상 사건 연습, 엔진 사건 전달 아님) | 회수는 제안(`propose_revocation`)만 하므로 엔진이 실행하지 않으면 영향 없음 | `git log -- src/detect.mjs`로 저장점 확인 후 `git revert <커밋>` |
| 접속 앱 `public/` | 배포 주소를 열고 브라우저의 「앱 설치」 | 로그인 → 「이 기기 승인 요청」 → 첫 기기는 `supabase/step11-devices.sql` [다]의 코드 자리를 바꿔 SQL Editor에서 승인, 다음 기기는 승인된 기기 화면에서 승인 | 로그아웃(세션 쿠키 삭제). 기기 회수: SQL Editor에서 `update public.vault_devices set status = 'revoked' where device_code = 'XXXX-XXXX';` | 회수한 기기 기록은 다시 요청해도 `revoked`로 남습니다. 같은 기기를 되살리려면 SQL Editor에서 `update public.vault_devices set status = 'approved', approved_at = now(), approved_via = 'sql_editor' where device_code = 'XXXX-XXXX' and status = 'revoked';`, 새 기기로 받으려면 브라우저에서 이 사이트 쿠키를 지운 뒤 새 승인 요청 → 승인. 화면 코드는 `git revert`로 저장점에 맞춤 |
| 자료실 (Vercel + Supabase) | GitHub 저장소를 Vercel에 연결, 환경변수 `SUPABASE_URL`·`SUPABASE_SECRET_KEY`를 Vercel 설정 화면에만 입력. SQL은 아래 「다시 실행하는 방법」 1~6 뒤 `step8-zones.sql` → `step10-backup.sql` → `step11-devices.sql` 순서 | `npm run build -- --local`, 배포 뒤 `/aleph.json`의 step·커밋 확인, `/ops.html` | 자료 API 중지: Vercel 환경변수 `SUPABASE_SECRET_KEY`를 지우고 Redeploy → 메모·공지·복원·기기·작전실 API가 `500 SERVER_NOT_CONFIGURED`로 멈춤(정적 화면만 남음). 문제 배포만 내리기: Vercel Deployments에서 이전 배포로 Rollback. 키가 샜다고 의심되면 Supabase에서 서버 키 교체 후 Vercel 값 갱신 | 메모 한 건: 자료실의 되살리기(`POST /api/restore/:id`, 본인 메모·비공개 사본 해시 확인). 배포: Vercel Rollback 또는 저장점 커밋 `git revert` 뒤 다시 배포 |

**재현 순서:** ① 저장소 복제·`npm install` → ② Supabase SQL(2→3→4→5→8→10→11단계 순) → ③ Vercel 연결·환경변수 → ④ 배포 후 `/aleph.json` 확인 → ⑤ A 계정 로그인·첫 기기 승인 → ⑥ `/ops.html`에서 수치 대조·「실측 실행」 → ⑦ `npm run decider:test`·`decider:zones`·`detect:test`·`ops:matrix` 로컬 연습 → ⑧ `npm run bundle`.

## 나만의 접속 앱과 기기 승인 (11단계)

따로 설치하는 접속 프로그램은 없습니다. 지금 배포 중인 자료실(`/`)을 설치형 웹앱으로 다듬었습니다.

- **설치형 웹앱:** `public/manifest.webmanifest`(앱 이름 「BYTE BACK 자료실」, `standalone`), `public/icon.svg`, `public/offline.html`(오프라인 안내), `public/sw.js`(서비스 워커는 오프라인 안내·아이콘·manifest만 저장하고 `/api/` 요청과 응답은 저장하지 않음). 화면에 "앱을 설치했다는 사실만으로 기기 확인이 끝나지는 않습니다"라고 표시합니다.
- **토큰·기기 비밀값 위치:** 로그인 토큰은 `__Host-vault_session`, 기기 비밀값은 `__Host-vault_device` **HttpOnly·Secure·SameSite=Strict 쿠키**로만 오갑니다. 화면 코드는 두 값을 읽을 수 없고, 브라우저의 어떤 저장 공간에도 쓰지 않습니다(5단계에서 쓰던 세션 저장 방식은 없앰). 로그인 응답 본문에도 토큰이 없습니다. 쿠키로 들어온 쓰기 요청은 화면이 붙이는 `X-Vault-Request: 1` 헤더가 있어야 합니다(교차 사이트 요청 위조 방지).
- **기기 승인 흐름:** 로그인 → 「승인 요청」(`POST /api/device/request`) → 서버가 기기 비밀값의 sha256만 `vault_devices`에 **대기(pending)**로 저장하고 기기 코드(`XXXX-XXXX`)를 보여 줌 → **첫 기기는 관리자가 Supabase SQL Editor에서**(`supabase/step11-devices.sql` [다]), 두 번째 기기부터는 **이미 승인된 내 기기**의 화면에서 코드로 승인(`POST /api/device/approve`) → 「승인 상태 다시 확인」(`GET /api/auth/session`). 승인되지 않은 기기는 승인 요청을 보낼 수 없어 스스로를 승인할 수 없습니다. 승인 기록은 `vault_audit`에 덧붙입니다.
- **승인 전에는 자료 없음:** 학생 로그인으로 들어온 자료 API(`/api/notes…`, `/api/notices…`, `/api/restore/:id`)는 서버가 이 기기를 승인된 등록 기기로 확인한 뒤에만 자료를 돌려주고, 아니면 `403 DEVICE_NOT_APPROVED`입니다. 화면도 승인 전에는 자료 영역을 숨기고 비웁니다.
- **심판·도구 요청:** `Authorization` 헤더로 오는 심판 토큰의 기기는 ALEPH SDP 엔진과 판정기(`deviceRegistered`, 6단계 `device_registered`)가 확인하므로, 브라우저 기기 쿠키를 요구하지 않습니다. 1~10단계의 정상·거부 결과(무로그인 401, 남의 메모 404, 공지 수정 403, 복원 등)는 그대로입니다.
- **DB 준비 (검토 후 한 번):** `supabase/step11-devices.sql` [가] → [나](anon·authenticated 권한 false, RLS true). 첫 기기 승인은 화면에 나온 코드로 [다]를 실행합니다.

## 백업에서 되살리기 (10단계)

### 1. 안전 정책: 차이 보기 → 확인 → 되돌리기

- **시험 정책**은 판정기 `src/decider.mjs` 안의 `SAFETY-POLICY` 블록 하나입니다(구역 표, 기능 이름, 주인 검사, 다시 로그인 기준, 거부 이유 코드). 판정기는 계속 파일 하나로 혼자 동작합니다.
- **침해 전에 검증한 사본**은 `policy/backup/safety-policy.safe-v9.json`이고, `policy/backup/MANIFEST.json`에 버전(`safe-v9`)과 sha256이 적혀 있습니다. 8단계 심판 100점 커밋(`885f310`)의 구역 규칙과 `decider:test` 4항목·`fixture:7` 통과 상태에서 만들었습니다.
- `npm run policy:diff` — 사본을 다시 읽어 해시를 대조한 뒤(없거나 다르면 **중단**), 복원할 버전과 현재 시험 정책의 **차이 항목만** 보여 줍니다. 아무 파일도 바꾸지 않습니다.
- `npm run policy:restore` — 같은 검증과 바뀔 항목을 보여 주고 **멈춥니다**. 확인한 뒤 `npm run policy:restore -- --confirm=safe-v9`로 실행하면 `SAFETY-POLICY` 블록만 사본으로 되돌리고, 다시 읽어 해시를 대조하고, `policy/audit.log`에 한 줄을 **덧붙이고**(기존 줄은 지우거나 고치지 않음), `decider:test`를 다시 실행합니다. 블록 밖의 판정기 코드, 자료 API, 다른 서비스 규칙, 실제 운영 정책(ALEPH SDP 엔진·심판)은 건드리지 않습니다.
- 시험: `node --test test/policy-restore.test.mjs` — 임시 폴더에서 정책을 침해 상태(목록 경로 열기, 다른 사용자 ID 검사·주인 기억 끄기, 공지 수정 제한 풀기)로 바꾸면 B의 A 자료 요청이 허용되는 것을 확인한 뒤, 확인 없이는 바뀌지 않고, `--confirm=safe-v9`로 되돌리면 **B의 A 자료 요청은 다시 거부, A 정상 요청은 허용**, 기존 감사 줄 보존을 확인합니다. 사본 변조·누락이면 중단하는 것도 확인합니다.

### 2. 비공개 메모 사본에서 한 건 복원

- **서비스·경로:** 자료실 서버 함수 `POST /api/restore/:id` (`aleph.config.json`의 `restoreRoute`, 로그인 토큰 필요, 본문 없음).
- **사본:** 메모를 만들 때(`POST /api/notes`) 서버가 비공개 테이블 `vault_notes_backup`에 제목·내용·소유자와 **내용 해시**(sha256(제목 + 줄바꿈 + 내용))를 한 건 남기고 바로 대조합니다. 기존 메모는 `supabase/step10-backup.sql`의 seed로 사본을 남깁니다. 사본 테이블은 anon·authenticated 권한이 없고, 서버도 읽기·덧붙이기만 됩니다.
- **복원 순서:** 그 메모의 가장 이른 사본(침해 전) 찾기 → 사본 해시 재계산·대조(다르면 `409 BACKUP_VERIFY_FAILED`로 **중단**) → 사본 소유자 = 요청자인지 대조(아니면 `404`) → 그 한 건만 되돌림(지워졌으면 같은 ID로 다시 만듦) → 다시 읽어 **ID·소유자·내용 해시가 사본과 같은지** 대조 → 감사 테이블 `vault_audit`에 한 줄 덧붙이기.
- **응답:** `200 {id, title, body, contentHash, ownerVerified: true, restoredFrom, changed}`. 다른 메모와 기존 감사 기록은 건드리지 않습니다.
- **확인 (시험 계정 B로만):** B로 메모를 만들고 → 내용을 바꾸거나 지운 뒤 → `POST /api/restore/<그 메모 ID>` → 응답의 `contentHash`가 만들 때 내용의 해시와 같고 `GET /api/notes/<ID>`가 원래 내용인지 봅니다. A 토큰으로 같은 요청을 보내면 `404`여야 합니다.
- **DB 준비 (검토 후 한 번):** `supabase/step10-backup.sql`의 [가] → [나]. [나]에서 `notes_with_owner` = `notes_backed_up`, `mismatched` = 0, 권한 4칸 모두 false면 정상입니다.

### 3. 복구 뒤 1~9단계 정상·금지 요청 다시 실행 순서

아래는 **순서**입니다. 결과 칸은 실제로 실행한 것만 적고, 실행하지 않은 것은 미실행으로 둡니다.

| 순서 | 단계 | 정상 요청 (유지) | 금지 요청 (다시 거부) | 결과 |
| --- | --- | --- | --- | --- |
| 1 | 정책 | `npm run policy:diff` → 차이 없음 | — | 2026-10-13 로컬 실행: 차이 없음 |
| 2 | 6~8 판정기 | `npm run decider:test` 4항목 통과, `npm run fixture:7` 정상 allow | 미등록 기기 deny, 복합 이상 step_up | 2026-10-13 로컬 실행: 통과 |
| 3 | 8 구역 | A 자기 메모 한 건 읽기·수정 allow | B의 A 메모·메모 목록·공지 수정 deny | `node --test test/policy-restore.test.mjs` 로컬 실행: 통과 |
| 4 | 9 탐지 | 정상 조회 observe | 새 네트워크 + 다량 조회 propose_revocation | `npm run detect:test` 로컬 실행: 6항목 통과 |
| 5 | 1~2 정적 자료 | 첫 화면 열림 | `/data.json` 404, 첫 화면에 메모 문장·키 없음 | 미실행 (배포 주소에서 학생이 확인) |
| 6 | 3 로그인 | A 로그인 후 메모 보임 | 로그인 없이 `/api/notes/…` 401 JSON | 미실행 (배포 주소에서 학생이 확인) |
| 7 | 4 소유자 | A 자기 메모 추가·수정·삭제 | B로 A 메모 ID 요청 404 | 미실행 (시험 계정으로 학생이 확인) |
| 8 | 5 원본 잠금 | 화면은 서버 함수만 부름 | 원본 주소를 공개 키로 직접 읽기 `permission denied` | 미실행 (학생이 확인) |
| 9 | 10 복원 | B 메모 한 건 복원, 해시 일치 | A의 B 메모 복원 404, 로그인 없이 401 | 미실행 (step10-backup.sql 실행 뒤 B 계정으로 학생이 확인) |

## 도플갱어 탐지와 회수 제안 (9단계)

`src/detect.mjs`의 `detect(events)`는 ALEPH SDP 엔진이 검증해 넘긴 가상 사건을 읽어 **별도 탐지 결과**를 돌려줍니다(계약: `docs/DETECT_EVENTS.md`). 판정기의 허용/거부 응답 형식은 그대로이고, 회수 API를 만들거나 기기 권한을 직접 바꾸지 않습니다.

1. **입력 정리 (`readEvent`)**: 사건마다 시각·요청 종류(`method`)·가명 사용자(`identity.sub`)와, 있으면 확인된 기기 ID(16자리 16진수)·네트워크 표시·판정(`allow`·`deny`·`step_up`)만 꺼냅니다. 메모 내용·토큰·실명 같은 다른 칸은 읽거나 저장하거나 출력하지 않고, 모양이 틀린 값은 버리며 정상값으로 채우지 않습니다.
2. **탐지 규칙 `burst_read_unusual_network`**: 같은 사용자의 `GET`이 어느 10분 구간에서든 120건을 넘고(121건부터, 다른 사용자와 합산하지 않음), 그 구간에 **평소와 다른 네트워크**(`unusual`·`new`·`first_seen`) 사건이 있을 때만 의심. 구간이 모두 평소 네트워크면 정상으로 둡니다. 지역은 쓰지 않습니다. 계약의 연습 사건처럼 네트워크 표시가 아예 없으면 계약 기준(10분 120건 초과)만으로 판단합니다.
3. **회수 제안**: 의심이면 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject, device }`, 아니면 `{ action: 'observe' }`. `device`는 평소와 다른 네트워크에서 가장 많이 조회한 **확인된 가상 기기 한 개**이며, 사건에 확인된 기기 ID가 없으면 지어내지 않고 뺍니다. 정상 기기는 대상이 되지 않습니다.

**확인 순서 (로컬 연습)**: `npm run detect:test` → 6항목 통과(정상 30건·10분 120건·각 100건·흩어진 200건은 `observe`, 121건·200건 폭주는 `propose_revocation`). 이 연습은 실제 접속 회수나 심판 판정이 아니며, ALEPH SDP 엔진의 사건 전달·회수 집행·경과 시간은 심판이 가상 사건으로 확인합니다.

## 자원 구역과 자료 API 재확인 (8단계)

| 구역 | 자원 ID | 서버 주소 | 읽기 | 수정 |
| --- | --- | --- | --- | --- |
| 자기 메모 `own_notes` | `note:<UUID>` (`vault_notes.note_id`) | `/api/notes`, `/api/notes/:id` (기존 그대로) | 확인된 사용자 = `owner_id`인 메모만 | 같은 조건 + 소유자 변경 403 |
| 강사 공지 `notices` | `notice:<UUID>` (`vault_notices.notice_id`) | `/api/notices`, `/api/notices/:id` (새로 추가, 화면 메뉴는 그대로) | 로그인한 사용자 누구나 | DB `vault_staff`에 `instructor`로 저장된 사용자만, 그 밖에는 `403 INSTRUCTOR_ONLY` |

- **직접 API 요청도 같은 검사:** 화면 메뉴를 거치지 않고 API를 불러도 서버가 토큰으로 확인한 사용자 ID와 DB의 `owner_id`·`vault_staff`를 다시 대조합니다. 남의 메모·없는 메모는 같은 `404`로 거부해 존재 여부를 알리지 않고, 공지 경로에 메모 ID를 넣는 식으로 구역을 섞어도 `404`입니다.
- **심판 토큰의 주인 구별:** 틀의 `verify-login.mjs`는 심판 토큰에 대해 `userId`(sub)와 함께 `identity`(`a`·`b`)를 돌려줍니다. A·B가 같은 sub를 쓸 수 있으므로, 심판 토큰이면 sub와 identity를 함께 묶은 고정 UUID(`ownerKey`)를 메모 주인 키로 씁니다. 학생 로그인은 Supabase 사용자 ID 그대로입니다.
- **본문의 role은 믿지 않음:** `role`, `isInstructor` 같은 값이 와도 권한 판단에 쓰지 않고 `body_role_ignored`로 기록만 합니다.
- **거부 사유:** 서버 기록에 `deny <사유> resource=<구역:ID> user=<앞 8자리>` 한 줄(`not_owner_or_missing`, `owner_change`, `instructor_only`, `invalid_resource_id`, `body_role_ignored`). 토큰·본문·이메일은 남기지 않습니다.
- **DB 준비 (8단계, 검토 후 한 번):** `supabase/step8-zones.sql`의 [가] → [나]를 Run. 공지 1건이 들어가고, 두 테이블 모두 RLS 켬·anon·authenticated 권한 없음이면 정상입니다. 강사 지정은 선택(주석 처리된 SQL)이며, 지정하지 않으면 모든 학생의 공지 수정이 거부됩니다.

## 현재 작동하는 기능 (5단계)

1. **브라우저는 이 사이트의 서버 함수만 부릅니다.** 로그인 `POST /api/auth/login`, 로그아웃 `POST /api/auth/logout`, 메모 `/api/notes…`. 화면 코드에는 Supabase 주소·공개 키(`sb_publishable_…`)·SDK가 없습니다. (점검: 브라우저 메모 자료 직접 호출은 4단계 때도 **없음**이었고, 로그인 직접 호출만 이번에 서버로 옮김)
2. 로그인 서버 함수는 공식 SDK(`supabase-js`의 `signInWithPassword`)로 Supabase Auth를 부르고 access token을 HttpOnly 세션 쿠키로만 내려 줍니다(11단계부터, refresh token은 주지 않음, 만료되면 다시 로그인). 실패 이유는 화면에 보여 줍니다. 화면 코드는 토큰을 읽거나 저장하지 않습니다.
3. 자료 API는 `src/verify-login.mjs`로 토큰을 검사(없거나 틀리면 401 JSON)하고, 확인된 사용자 ID와 DB `owner_id`를 비교해 본인 메모만 읽기·추가·수정·삭제합니다(남의 메모 404, 소유자 변경 403 — 4단계와 같음).
4. 학습 DB의 메모 테이블은 `step5-revoke.sql`로 PUBLIC·anon·authenticated 직접 권한을 모두 회수합니다. 원본 자료 주소(`originalApiUrl`)를 공개 키로 직접 불러도 메모를 받을 수 없고, 서버 전용 키(service_role)를 가진 서버 함수만 접근합니다.
5. `/data.json` 404, `/aleph.json` 자동 생성(이제 `allowedRoutes`·`originalApiUrl` 포함), 모든 응답에 `nosniff` 등 보안 헤더.

### 자료 API (`aleph.config.json`의 `allowedRoutes`)

| 경로 | 하는 일 | 응답 |
| --- | --- | --- |
| `GET /api/notes` | 로그인 사용자의 메모 목록 | `200 [{id,title,body}, …]` |
| `POST /api/notes` | `{id?,title,body}` 추가 (id는 UUID, 없으면 서버가 만듦) | `201 {id}` · 같은 id면 `409` |
| `GET /api/notes/:id` | 본인 메모 한 건 읽기 | `200 {id,title,body}` · 없거나 남의 것이면 `404` |
| `PUT /api/notes/:id` | 본인 메모 `{title,body}` 수정 | `200 {id,title,body}` · 남의 것이면 `404`, 소유자 변경 시도면 `403` |
| `DELETE /api/notes/:id` | 본인 메모 삭제 | `200 {id,deleted:true}` · 없거나 남의 것이면 `404` |

로그인 경로(자료 API 아님): `POST /api/auth/login` `{email,password}` → `200 {accessToken,expiresAt,email}` 또는 `401 {error:"LOGIN_FAILED",message}` · `POST /api/auth/logout` (Bearer 토큰) → `200 {loggedOut:true}`.

모든 경로는 로그인 토큰이 없거나 틀리면 `401 {"error":"LOGIN_REQUIRED","message":…}`입니다. 검사에 쓴 발급자 정보(비밀 키 제외)는 `aleph.config.json`의 `identityProvider`에 있습니다.

## 다시 실행하는 방법

1. **DB 준비 (2단계, 한 번):** `supabase/step2-notes.local.sql`(가상 메모 문장이 있어 Git 제외)을 Supabase SQL Editor에서 Run.
2. **계정 만들기 (3단계, 한 번):** Supabase → Authentication → Users → Add user → Create new user로 A·B 계정을 만듭니다(Auto Confirm User 체크). 비밀번호는 코드·Git·채팅에 적지 않습니다.
3. **DB 보강 (3단계, 한 번):** `supabase/step3-auth.sql`에서 A 계정 이메일 자리를 바꾼 뒤 SQL Editor에서 Run. 메모 UUID 칸(`note_id`)을 만들고 기존 가상 메모 4건을 A 계정 것으로 표시합니다.
4. **소유자·B 시험 메모 (4단계, 한 번):** `supabase/step4-owners.sql`의 A·B 이메일 자리를 바꿔 Run. 마지막 표에서 A는 기존 메모 수, B는 시험 메모 1건, 주인 없음 0이면 정상입니다.
5. **RLS·최소 권한 (4단계, 검토 후 한 번):** `supabase/step4-rls.sql`의 [가] 적용 전 기록 → [나] 적용 → [다] 적용 후 대조를 블록별로 Run. [다]에서 `has_privilege`가 `expected`와 모두 같아야 합니다(anon 전부 false, authenticated는 SELECT·INSERT·UPDATE·DELETE만 true).
6. **직접 권한 회수 (5단계, 검토 후 한 번):** `supabase/step5-revoke.sql`의 [가] 적용 전 → [나] 회수 → [다] 적용 후를 하나씩 Run. [다]에서 anon·authenticated 14줄이 모두 false면 정상입니다.
7. **환경변수 (2단계에서 넣은 그대로):** Vercel의 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. 값은 Vercel 설정 화면에만 넣습니다.
8. **로컬 빌드 확인:** `npm run build -- --local`
9. **제출 묶음:** `npm run bundle` (커밋된 상태에서만 동작, `bundle-notes.json` 필요. `bundle-notes.json`, `artifacts/submission.json`은 커밋하지 않음)

## 방어 구조와 남은 한계 (5단계)

- **한 곳으로 모음:** 자료 요청은 브라우저 → Vercel 서버 함수 → Supabase 한 길뿐입니다. 서버 함수가 로그인(토큰 검사)과 소유자 검사를 모두 맡습니다.
- **원본 잠금:** 메모 테이블에 PUBLIC·anon·authenticated 권한이 없으므로, 앱 코드에서 주소와 공개 키를 알아내도 Data API로 메모를 읽거나 고칠 수 없습니다. 4단계의 RLS 정책 4개는 실수로 권한이 다시 열릴 때를 대비한 안전장치로 남겨 둡니다.
- **남은 한계:** 서버 전용 키가 새면 모든 방어를 우회하므로 키는 Vercel 환경변수에만 둡니다. 로그인 시도 횟수 제한은 Supabase Auth 기본 제한에 맡깁니다. 11단계부터 access token은 HttpOnly 쿠키에만 있어 화면 스크립트가 읽을 수 없습니다. 그래도 화면에 스크립트 삽입(XSS)이 생기면 같은 화면에서 요청을 보낼 수는 있으므로 화면은 `textContent`만 써서 막아 둡니다.

## 보너스 xdr-01 무차별 로그인 공격 탐지 (`xdr/brute-force/`)

| 파일 | 하는 일 |
| --- | --- |
| `read-alerts.mjs` | 확인용. 경보에서 시각·출발 주소·계정·규칙 수준·설명만 뽑음(비밀값처럼 보이는 문자열은 `[가림]`). `node xdr/brute-force/read-alerts.mjs` → 경보 수 = 뽑은 줄 수. `decide.mjs`는 이 파일을 불러오지 않음 |
| `patterns.json` | MITRE ATT&CK T1110 근거의 패턴 2개: 짧은 시간 같은 주소의 로그인 실패 연속(T1110.001), 여러 계정에 같은 비밀번호 대입(T1110.003) |
| `decide.mjs` | 심판이 이 파일 하나만 인터넷 없이 불러 씀. **import 없음, 파일 읽기·쓰기 없음, 바깥 질문 없음.** 패턴을 파일 맨 위 상수로 옮겨 두고 혼자 계산. 패턴과 뚜렷하게 맞으면 확신도 0.86~0.99 → `block`, T1110이지만 기준 미달이면 0.5~0.75 → `alert`, 패턴 신호가 없으면 0.05 → `record` |
| `respond.mjs` | `node xdr/brute-force/respond.mjs` → `block`만 `deny-rules.json`(만료 시각·근거 경보 번호)으로, `block`·`alert`는 `xdr/alerts.log`에 한 줄씩(같은 경보는 다시 안 적음). 정상 이벤트에 나온 주소는 거부 규칙에서 제외. 시험 경보를 다시 흘려 막힘·통과 확인 |
| `ztna-plugin.mjs` | 판정기에 꽂는 확인 단계 하나: `checkSource({srcip, at})` → 거부 규칙에 걸리면 `deny`(`xdr_brute_force_block`), 아니면 통과. `src/decider.mjs`의 기존 규칙은 그대로 |
| `result.json` | `npm run xdr:run -- brute-force` 결과 |

한계: 현재 판정기 요청 계약(`aleph.decision.v1`)에는 출발 주소 칸이 없어 `src/decider.mjs` 안에서 주소로 막지 않습니다. 계약에 주소가 생기거나 주소를 아는 연결 지점에서 `checkSource`를 부릅니다. 경보는 수업용 가상 Wazuh 경보이며 실제 로그가 아닙니다.

## 보너스 xdr-02 웹 주입 공격 탐지 (`xdr/web-injection/`)

| 파일 | 하는 일 |
| --- | --- |
| `read-alerts.mjs` | 확인용. 경보에서 시각·출발 주소·계정·규칙 수준·설명만 뽑음(요청 주소는 출력하지 않고, 비밀값처럼 보이는 문자열은 `[가림]`). 경보 26건 = 뽑은 줄 26줄. `decide.mjs`는 이 파일을 불러오지 않음 |
| `patterns.json` | MITRE ATT&CK T1190 근거 패턴 4개: 요청 인자 안의 SQL 구문, 스크립트 태그, 경로 거슬러 올라가기(../) 반복, 명령 구분자(T1190이 참고하는 OWASP Top 10 Injection) |
| `decide.mjs` | 심판이 이 파일 하나만 인터넷 없이 불러 씀. **import 없음, 파일 읽기·쓰기 없음, 바깥 질문 없음.** T1190 + 수준 10 이상 + 같은 주소 5번 이상 반복 + 패턴 일치면 확신도 0.86~0.99 → `block`, T1190이지만 반복·표식이 약하면 0.5~0.75 → `alert`, 신호 없으면 0.05 → `record`. `select`·`script`·`up` 같은 평범한 단어 한 번은 차단하지 않음 |
| `respond.mjs` | `node xdr/web-injection/respond.mjs` → `block`만 `deny-rules.json`(만료 시각·근거 경보 번호)으로, `block`·`alert`는 `xdr/alerts.log`에 한 줄씩. 정상 이벤트에 나온 주소는 거부 규칙에서 제외. 시험 경보를 다시 흘려 막힘·통과 확인 |
| `ztna-plugin.mjs` | 판정기에 꽂는 확인 단계: `checkSource({srcip, at})` → 거부 규칙에 걸리면 `deny`(`xdr_web_injection_block`). `src/decider.mjs`의 기존 규칙은 그대로 |
| `result.json` | `npm run xdr:run -- web-injection` 결과 |

경보 속 `doc-sql-…` 같은 값은 수업용 문서 표기(실제 공격 문자열 대신 쓰는 자리표시)이며, 판단 모듈은 실제 형태(`' OR 1=1`, `UNION SELECT`, `<script`, `../../`, `; cat` 등)도 함께 봅니다.

## 보너스 xdr-03 알려진 취약점 악용 탐지 (`xdr/known-cve/`)

| 파일 | 하는 일 |
| --- | --- |
| `read-alerts.mjs` | 확인용. 경보에서 시각·출발 주소·계정·규칙 수준·설명만 뽑음(요청 주소·머리글은 공격 문자열이 섞여 출력하지 않고, 비밀값처럼 보이는 문자열은 `[가림]`). 경보 24건 = 뽑은 줄 24줄. `decide.mjs`는 이 파일을 불러오지 않음 |
| `patterns.json` | 근거(CVE-2021-44228, MITRE ATT&CK T1190) 패턴 5개: 머리글 안의 원격 조회 구문, 요청 인자 안의 원격 조회 구문(둘 다 `${jndi:<프로토콜>://`), 알려진 취약점 점검 도구 흔적(보조), 조회 구문 없는 단서(CVE 번호·jndi 단어·잘린 조회 형태·라이브러리 이름, 알림만), T1190 분류만 있는 경보(알림만) |
| `decide.mjs` | 심판이 이 파일 하나만 인터넷 없이 불러 씀. **import 없음, 파일 읽기·쓰기 없음, 바깥 질문 없음.** 완전한 조회 구문이 머리글·인자에 있으면 0.88부터(양쪽·반복·점검 흔적·높은 수준이면 더해 최대 0.99) → `block`, 구문 없는 단서는 0.6~0.65 → `alert`, T1190 분류만 있으면 0.5 → `alert`, 신호 없으면 0.05 → `record`. `%24%7Bjndi…` 처럼 바꿔 적은 인자도 한 번 풀어서 봄 |
| `respond.mjs` | `node xdr/known-cve/respond.mjs` → `block`만 `deny-rules.json`(출발 주소별, 만료 시각 = 마지막 경보 + 60분, 근거 경보 번호)으로, `block`·`alert`는 `xdr/alerts.log`에 한 줄씩(같은 경보 번호는 다시 적지 않음). 정상 이벤트에 나온 주소는 거부 규칙에서 제외. 시험 경보를 다시 흘려 막힘·통과 확인 |
| `ztna-plugin.mjs` | 판정기에 꽂는 확인 단계: `checkSource({srcip, at})` → 거부 규칙에 걸리면 `deny`(`xdr_known_cve_block`). `src/decider.mjs`의 기존 규칙은 그대로 |
| `result.json` | `npm run xdr:run -- known-cve` 결과: block 8 · alert 8 · record 8, 정상 이벤트 차단 0 |

경보 속 주소는 문서용 대역(192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)이고 조회 구문은 수업용 표기입니다. 이 문자열을 다른 시스템에 넣거나 변형하지 않습니다.

## 보너스 xdr-04 몰래 심어진 프로그램 탐지 (`xdr/persistence/`)

| 파일 | 하는 일 |
| --- | --- |
| `read-alerts.mjs` | 확인용. 경보에서 시각·출발 주소·계정·규칙 수준·설명만 뽑음(실행 파일 경로는 사용자 폴더 이름이 섞여 출력하지 않고, 비밀값처럼 보이는 문자열은 `[가림]`). 경보 24건 = 뽑은 줄 24줄. `decide.mjs`는 이 파일을 불러오지 않음 |
| `patterns.json` | 근거(MITRE ATT&CK T1543, T1053) 패턴 5개: 서명 없는 새 서비스 등록, 낯선 예약 작업(처음 보는·임의 문자열 이름), 임시·시작 폴더 실행 파일을 가리키는 등록, 다시 켜도 남도록 등록된 목록 밖 항목, 확인이 필요한 약한 변경(알림만) |
| `decide.mjs` | 심판이 이 파일 하나만 인터넷 없이 불러 씀. **import 없음, 파일 읽기·쓰기 없음, 바깥 질문 없음.** T1543·T1053 등록 + 규칙 수준 10 이상 + 강한 신호(서명 없음·낯선 이름·임시/시작 폴더·목록 밖·반복·서비스와 예약 작업 동시)면 0.85~0.99 → `block`. 「등록은 없」「실행된 기록은 없」이면 강한 신호가 있어도 알림만. 신호가 약한 수준 5 이상 경보는 0.5~0.65 → `alert`, 서명된·평소대로·기존 동작은 `record` |
| `respond.mjs` | `node xdr/persistence/respond.mjs` → `block`만 `deny-rules.json`(그 PC의 출발 주소별 격리, 만료 시각 = 마지막 경보 + 60분, 근거 경보 번호)으로, `block`·`alert`는 `xdr/alerts.log`에 한 줄씩(같은 경보 번호는 다시 적지 않음). 정상 이벤트에 나온 주소는 격리 규칙에서 제외. 시험 경보를 다시 흘려 막힘·통과 확인 |
| `ztna-plugin.mjs` | 판정기에 꽂는 확인 단계: `checkSource({srcip, at})` → 격리 규칙에 걸리면 `deny`(`xdr_persistence_isolate`). `src/decider.mjs`의 기존 규칙은 그대로 |
| `result.json` | `npm run xdr:run -- persistence` 결과: block 8 · alert 8 · record 8, 정상 이벤트 차단 0 |

## 보너스 xdr-05 권한 가로채기 탐지 (`xdr/privilege/`)

| 파일 | 하는 일 |
| --- | --- |
| `read-alerts.mjs` | 확인용. 경보에서 시각·출발 주소·계정·규칙 수준·설명만 뽑음(그룹 이름 등 나머지 칸은 출력하지 않고, 비밀값처럼 보이는 문자열은 `[가림]`). 경보 26건 = 뽑은 줄 26줄. `decide.mjs`는 이 파일을 불러오지 않음 |
| `patterns.json` | 근거(MITRE ATT&CK T1068, T1078) 패턴 4개: 관리자 그룹 추가, 처음 보는 관리자 명령, 업무 시간 밖·처음 보는 곳(다른 계정 권한 포함)의 권한 사용, 확인이 필요한 약한 권한 변경(알림만) |
| `decide.mjs` | 심판이 이 파일 하나만 인터넷 없이 불러 씀. **import 없음, 파일 읽기·쓰기 없음, 바깥 질문 없음.** T1068·T1078 + 규칙 수준 10 이상 + 강한 신호 합 0.3 이상(관리자 그룹 추가·관리자 명령·평소와 다른 시각/주소·반복·두 기법 동시)이면 0.85~0.99 → `block`. 수준 5 이상이지만 신호가 약하면(권한 창 취소, 관리자가 아닌 그룹, 평소 주소의 명령 한 번, 실패한 명령) 0.5~0.65 → `alert`, 권한 기법 표시 없는 로그인·조회 등은 `record` |
| `respond.mjs` | `node xdr/privilege/respond.mjs` → `block`만 `deny-rules.json`(**계정 + 공격이 일어난 출발 주소** 세션 회수, 만료 시각 = 마지막 경보 + 60분, 근거 경보 번호)으로, `block`·`alert`는 `xdr/alerts.log`에 한 줄씩(같은 경보 번호는 다시 적지 않음). 정상 이벤트에 나온 계정+주소는 제외 — 같은 계정의 평소 주소 세션은 통과. 시험 경보를 다시 흘려 막힘·통과 확인 |
| `ztna-plugin.mjs` | 판정기에 꽂는 확인 단계: `checkSession({user, srcip, at})` → 회수 규칙에 걸리면 `deny`(`xdr_privilege_session_revoke`). `src/decider.mjs`의 기존 규칙은 그대로 |
| `result.json` | `npm run xdr:run -- privilege` 결과: block 9 · alert 8 · record 9, 정상 이벤트 차단 0 |

## 보너스 xdr-06 자료 빼돌리기 탐지 (`xdr/exfiltration/`)

| 파일 | 하는 일 |
| --- | --- |
| `read-alerts.mjs` | 확인용. 경보에서 시각·출발 주소·계정·규칙 수준·설명만 뽑음(목적지·전송량 등 나머지 칸은 출력하지 않고, 비밀값처럼 보이는 문자열은 `[가림]`). 경보 30건 = 뽑은 줄 30줄. `decide.mjs`는 이 파일을 불러오지 않음 |
| `patterns.json` | 근거(MITRE ATT&CK T1041, T1048) 패턴 4개: 처음 보는 목적지로 대용량 전송, 같은 목적지로 반복·다량 파일 전송, 업무 시간 밖 압축 파일 반출, 확인이 필요한 작은 외부 전송(알림만) |
| `decide.mjs` | 심판이 이 파일 하나만 인터넷 없이 불러 씀. **import 없음, 파일 읽기·쓰기 없음, 바깥 질문 없음.** T1041·T1048 + 규칙 수준 10 이상 + 50MB 이상 + 다른 강한 신호(처음 보는 목적지·파일 50개 이상·5번 이상 반복·업무 시간 밖·압축 파일)면 0.88~0.99 → `block`. 전송이 작거나 실패·평소 목적지면 0.5~0.65 → `alert`, 자료실과의 작은 주고받기·평소 동기화는 `record`. 신호 합은 소수 둘째 자리로 반올림해 비교 |
| `respond.mjs` | `node xdr/exfiltration/respond.mjs` → `block`만 `deny-rules.json`(**유출 목적지**별 차단, 만료 시각 = 마지막 경보 + 60분, 근거 경보 번호)으로, `block`·`alert`는 `xdr/alerts.log`에 한 줄씩(같은 경보 번호는 다시 적지 않음). 정상 이벤트가 쓰는 평소 목적지(자료실 등)는 차단 규칙에서 제외. 시험 경보를 다시 흘려 막힘·통과 확인 |
| `ztna-plugin.mjs` | 판정기에 꽂는 확인 단계: `checkDestination({dstip, at})` → 차단 규칙에 걸리면 `deny`(`xdr_exfiltration_destination_block`). `src/decider.mjs`의 기존 규칙은 그대로 |
| `result.json` | `npm run xdr:run -- exfiltration` 결과: block 10 · alert 10 · record 10, 정상 이벤트 차단 0 |

## 메모가 남아 있는지 검색하는 확인 절차

아래 검색식은 메모 네 건의 내용 문장을 찾습니다. 문장 자체를 이 문서에 적지 않으려고 정규식으로 썼습니다.

```bash
PATTERN='실습용 ?가상 (과제|포트폴리오|리추얼|행정) 기록'
APP=https://choi-bujang-secret-vault-nine.vercel.app
```

1. **GitHub 최신 파일:** `git fetch origin main && git grep -nE "$PATTERN" origin/main` → 아무것도 나오지 않아야 합니다. (브라우저라면 저장소 화면에서 `data.json`, `public/data.json`이 없는지도 봅니다.)
2. **현재 배포의 정적 파일:**
   - `curl -s -o /dev/null -w "%{http_code}\n" $APP/data.json` → `404`
   - `curl -s $APP/ | grep -cE "$PATTERN"` → `0`
   - `curl -s -o /dev/null -w "%{http_code}\n" $APP/aleph.json` → `200`
   - `curl -sI $APP/ | grep -i x-content-type-options` → `nosniff`
3. **자료 API (3단계):** `curl -s -i $APP/api/notes` → `HTTP/2 401`과 `{"error":"LOGIN_REQUIRED",…}`. 메모 문장이 나오면 안 됩니다.
4. **로그인·소유자 확인 (3~4단계):** 시크릿 창에서 `$APP`을 열면 로그인 칸만 보이고 메모가 없어야 합니다. A로 로그인하면 A 메모만 보이고 추가·수정·삭제가 되며, 로그아웃하면 다시 로그인 칸만 보입니다. B로 로그인하면 B 시험 메모만 보이고 A 메모는 보이지 않습니다.
   - **공개 키로 원본 직접 읽기 (anon):** `curl -s "https://jrvzvsynynerietoqkcy.supabase.co/rest/v1/vault_notes" -H "apikey: <publishable key>"` → `permission denied` 오류여야 합니다(5단계 회수 SQL 적용 후).
   - **화면 코드에 키 없음 (5단계):** `curl -s $APP/ | grep -cE "sb_publishable_|supabase\.co"` → `0`
5. **브라우저에 서버 전용 키가 없는지:** `curl -s $APP/ | grep -c sb_secret_` → `0` (`sb_publishable_` 공개 키는 있어도 됩니다).

### 확인 기록

| 확인 | 결과 |
| --- | --- |
| 저장점 커밋 대상 파일(`git grep`) | 메모 문장 0건. SQL 파일은 `.gitignore`로 제외 |
| 로컬 빌드 결과물 `public/` | `data.json` 없음, 메모 문장 0건 |
| 배포 주소 `/data.json`·첫 화면·`/aleph.json`·보안 헤더 | 푸시 후 새 배포에서 위 2번 절차로 확인해 제출 화면에 기록 |
| 공개 API `/api/notes` (2단계) | 비로그인으로 가상 메모가 응답됨 → 3단계에서 막음 |
| 무로그인 `/api/notes` (3단계) | 401 JSON 오류 (배포 후 위 3번 절차로 확인) |
| B가 A 메모 id로 접근 (3단계) | 막지 않았음 → 4단계에서 차단 |
| B가 A 메모 id로 읽기·수정·삭제 (4단계) | 로컬 시험에서 404 거부, 배포 후 B 창에서 직접 확인 |
| 수정 본문으로 소유자 변경 (4단계) | 로컬 시험에서 403 거부 |
| 브라우저의 메모 자료 직접 호출 (5단계 점검) | 없음 (로그인 직접 호출만 서버로 옮김) |
| 화면 코드의 Supabase 주소·공개 키 (5단계) | 없음, 헤드리스 브라우저 시험에서 외부 요청 0건 |
| 원본 주소를 공개 키로 직접 읽기 (5단계) | 회수 SQL 적용 후 학생이 확인, 심판이 anon 키로 재확인 |

## 과거 노출은 해소되지 않았습니다

최신 파일에서 메모를 지워도 지난 기록은 그대로 남아 있습니다. 2단계는 "앞으로 새로 공개되는 것"을 막았을 뿐, 이미 공개된 것을 되돌리지 못했습니다.

- **옛 공개 커밋:** 1단계 커밋 `0ff36ed`에는 `data.json`과 `public/data.json`이 그대로 있습니다. `git log --oneline -- data.json public/data.json`이나 GitHub의 커밋 화면에서 누구나 볼 수 있고, 이미 복제(clone·fork)한 사람에게서는 지울 방법이 없습니다.
- **옛 배포:** Vercel은 배포마다 고유 주소를 남깁니다. 1단계 배포의 고유 주소에서는 `/data.json`이 계속 열릴 수 있습니다. Vercel → Deployments에서 옛 배포를 지우지 않는 한 남습니다.
- 그래서 이 자료실에는 처음부터 가상 메모만 넣었습니다. 실제 비밀이 이렇게 올라갔다면 기록 삭제보다 **키 교체·폐기**가 먼저입니다(도요타 T커넥트 사고처럼 공개 저장소에 올라간 키는 이미 노출된 것으로 봐야 합니다).

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포하고, `api/` 폴더의 파일은 Vercel 서버 함수로 배포합니다(서버 함수가 `aleph.config.json`을 읽도록 `includeFiles`로 포함). 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이 저장소와 실제 배포 주소로 맞췄습니다. `src/attack-check.mjs`는 `npm run bundle`이 실행하는 학생의 자기 점검이며, 실제로 보낸 요청의 결과만 기록합니다(요청을 보내지 못하면 "미실행"). 심판의 판정이 아닙니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 ALEPH SDP 엔진이나 운영 심판의 결과가 아닙니다. 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 있습니다.
