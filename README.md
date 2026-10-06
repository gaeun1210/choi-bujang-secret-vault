# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 자료실의 메모는 모두 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 단계 기록

| 단계 | 커밋 | 한 일 |
| --- | --- | --- |
| 1단계 | `0ff36ed` Initial commit | Vercel 시작 틀 배포. `/data.json`과 공개 저장소의 `data.json`에 가상 메모 네 건이 그대로 공개된 상태를 확인 |
| 2단계 | `a9cd08a` 「2단계 저장점」 | 메모를 정적 파일·코드에서 빼서 학습용 Supabase 테이블로 옮기고, 서버 함수 `/api/notes`가 읽게 바꿈 |
| 3단계 | `b2797a4` 「3단계 저장점」 | Supabase Auth 이메일·비밀번호 로그인·로그아웃, 서버의 토큰 검사(`src/verify-login.mjs`), 로그인 사용자의 가상 메모 추가·수정·삭제 API |
| 4단계 | 「4단계 저장점」 | API가 확인된 사용자 ID와 DB `owner_id`를 비교해 읽기·추가·수정·삭제를 본인 메모로 제한, B 시험 메모 SQL, 메모 테이블 RLS·최소 권한 SQL 제안 |

## 현재 작동하는 기능 (4단계)

1. `/` 화면에서 Supabase Auth 공식 SDK로 이메일·비밀번호 로그인·로그아웃을 합니다(3단계와 같음). 화면 코드에는 공개용 Project URL과 publishable key만 있습니다.
2. 자료 API는 `src/verify-login.mjs`로 토큰을 검사해, 없거나 틀리면 **401 JSON 오류**(`LOGIN_REQUIRED`)를 돌려줍니다.
3. **소유자 검사:** 모든 DB 요청에 `owner_id = 확인된 사용자 ID` 조건을 붙이고, 돌려받은 행의 주인도 다시 확인합니다. 남의 메모 id로 읽기·수정·삭제하면 존재 여부를 알리지 않도록 `404 NOT_FOUND`로 거부합니다.
4. URL·본문의 `owner_id`·`userId`는 믿지 않습니다. 추가할 때는 확인된 ID로 저장하고, 본문에 다른 소유자를 넣으면 추가는 `403 OWNER_MISMATCH`, 수정은 `403 OWNER_CHANGE_FORBIDDEN`으로 거부합니다. 수정은 소유자 칸을 아예 바꾸지 않아 기존 행·새 행 모두 본인 소유입니다.
5. `/data.json` 404, `/aleph.json` 자동 생성, `nosniff` 등 보안 헤더, 서버 전용 키는 Vercel 환경변수에만 있음(앞 단계와 같음).

### 자료 API (`aleph.config.json`의 `allowedRoutes`)

| 경로 | 하는 일 | 응답 |
| --- | --- | --- |
| `GET /api/notes` | 로그인 사용자의 메모 목록 | `200 [{id,title,body}, …]` |
| `POST /api/notes` | `{id?,title,body}` 추가 (id는 UUID, 없으면 서버가 만듦) | `201 {id}` · 같은 id면 `409` |
| `GET /api/notes/:id` | 본인 메모 한 건 읽기 | `200 {id,title,body}` · 없거나 남의 것이면 `404` |
| `PUT /api/notes/:id` | 본인 메모 `{title,body}` 수정 | `200 {id,title,body}` · 남의 것이면 `404`, 소유자 변경 시도면 `403` |
| `DELETE /api/notes/:id` | 본인 메모 삭제 | `200 {id,deleted:true}` · 없거나 남의 것이면 `404` |

모든 경로는 로그인 토큰이 없거나 틀리면 `401 {"error":"LOGIN_REQUIRED","message":…}`입니다. 검사에 쓴 발급자 정보(비밀 키 제외)는 `aleph.config.json`의 `identityProvider`에 있습니다.

## 다시 실행하는 방법

1. **DB 준비 (2단계, 한 번):** `supabase/step2-notes.local.sql`(가상 메모 문장이 있어 Git 제외)을 Supabase SQL Editor에서 Run.
2. **계정 만들기 (3단계, 한 번):** Supabase → Authentication → Users → Add user → Create new user로 A·B 계정을 만듭니다(Auto Confirm User 체크). 비밀번호는 코드·Git·채팅에 적지 않습니다.
3. **DB 보강 (3단계, 한 번):** `supabase/step3-auth.sql`에서 A 계정 이메일 자리를 바꾼 뒤 SQL Editor에서 Run. 메모 UUID 칸(`note_id`)을 만들고 기존 가상 메모 4건을 A 계정 것으로 표시합니다.
4. **소유자·B 시험 메모 (4단계, 한 번):** `supabase/step4-owners.sql`의 A·B 이메일 자리를 바꿔 Run. 마지막 표에서 A는 기존 메모 수, B는 시험 메모 1건, 주인 없음 0이면 정상입니다.
5. **RLS·최소 권한 (4단계, 검토 후 한 번):** `supabase/step4-rls.sql`의 [가] 적용 전 기록 → [나] 적용 → [다] 적용 후 대조를 블록별로 Run. [다]에서 `has_privilege`가 `expected`와 모두 같아야 합니다(anon 전부 false, authenticated는 SELECT·INSERT·UPDATE·DELETE만 true).
6. **환경변수 (2단계에서 넣은 그대로):** Vercel의 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. 값은 Vercel 설정 화면에만 넣습니다.
7. **로컬 빌드 확인:** `npm run build -- --local`
8. **제출 묶음:** `npm run bundle` (커밋된 상태에서만 동작, `bundle-notes.json` 필요. `bundle-notes.json`, `artifacts/submission.json`은 커밋하지 않음)

## 방어 구조와 남은 한계 (4단계)

- **1차 방어 — 앱 API:** 서버 함수는 서버 전용 키(service_role)로 DB에 접근하므로 RLS를 거치지 않습니다. 그래서 소유자 검사는 API 코드가 책임집니다(위 3·4번).
- **2차 방어 — DB의 RLS·GRANT:** `step4-rls.sql`은 `anon` 권한을 모두 회수하고, `authenticated`에는 네 권한만 주되 SELECT·DELETE는 `USING`, INSERT는 `WITH CHECK`, UPDATE는 `USING`+`WITH CHECK`로 모두 `auth.uid() = owner_id`일 때만 허용합니다. Data API를 직접 부르는 경로에 대한 대비이며, 심판은 anon 키 직접 접근만 확인합니다.
- **남은 한계:** 서버 전용 키가 새면 RLS를 우회할 수 있으므로 키는 Vercel 환경변수에만 둡니다. 심판 계정(A/B)의 사용자 ID는 Supabase `auth.users`에 없을 수 있어 `owner_id`에 외래키를 걸지 않았습니다.

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
   - **공개 키로 DB 직접 읽기 (anon):** `curl -s "https://jrvzvsynynerietoqkcy.supabase.co/rest/v1/vault_notes?select=*" -H "apikey: <publishable key>"` → 권한 오류(`permission denied`) 또는 빈 배열이어야 합니다.
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
