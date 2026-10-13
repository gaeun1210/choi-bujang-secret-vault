# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 자료실의 메모는 모두 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

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
| 8단계 | 「8단계 저장점」 | 자원 구역 나누기: 메모(`note:`)·강사 공지(`notice:`) 자원 ID, 판정기 구역 규칙(정확한 메서드·경로 허용 목록), 자료 API의 소유자·DB 강사 권한 재확인, 공지 테이블 SQL |

## 판정기 (6~8단계)

`src/decider.mjs`의 `decide(request)`는 반 엔진이 신원·기기·경로를 확인한 뒤 보낸 요청만 받습니다(계약: `docs/DECIDER_REQUEST.md`). 규칙 이름은 같은 파일의 `RULE_IDS`에 있습니다. 위에서부터 차례로 봅니다.

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
3. 이 명령들은 가상 요청 연습이며 심판 판정이 아닙니다. 다시 로그인 전 자료 차단과 새 요청 허용의 실측은 재로그인 계약(`stepUp`)을 검증하는 반 엔진이 있는 환경에서 심판이 합니다(이 저장소의 자기 점검에는 미실행으로 기록).
4. 이번 과정에는 따로 설치할 접속 프로그램이 없습니다. 인증서·CA·키는 만들지 않았고, 자료실 화면(`/`)과 `/api/notes…`는 바뀌지 않았습니다.

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
2. 로그인 서버 함수는 공식 SDK(`supabase-js`의 `signInWithPassword`)로 Supabase Auth를 부르고 access token만 돌려줍니다(refresh token은 주지 않음, 만료되면 다시 로그인). 실패 이유는 화면에 보여 줍니다. 토큰은 그 탭의 `sessionStorage`에만 둡니다.
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
- **남은 한계:** 서버 전용 키가 새면 모든 방어를 우회하므로 키는 Vercel 환경변수에만 둡니다. 로그인 시도 횟수 제한은 Supabase Auth 기본 제한에 맡깁니다. access token은 탭의 `sessionStorage`에 있으므로 화면에 스크립트 삽입(XSS)이 생기면 토큰이 샐 수 있습니다(화면은 `textContent`만 써서 막아 둠).

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

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 있습니다.
