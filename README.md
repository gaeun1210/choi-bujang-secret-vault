# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 자료실의 메모는 모두 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 단계 기록

| 단계 | 커밋 | 한 일 |
| --- | --- | --- |
| 1단계 | `0ff36ed` Initial commit | Vercel 시작 틀 배포. `/data.json`과 공개 저장소의 `data.json`에 가상 메모 네 건이 그대로 공개된 상태를 확인 |
| 2단계 | `a9cd08a` 「2단계 저장점」 | 메모를 정적 파일·코드에서 빼서 학습용 Supabase 테이블로 옮기고, 서버 함수 `/api/notes`가 읽게 바꿈 |
| 3단계 | 「3단계 저장점」 | Supabase Auth 이메일·비밀번호 로그인·로그아웃, 서버의 토큰 검사(`src/verify-login.mjs`), 로그인 사용자의 가상 메모 추가·수정·삭제 API |

## 현재 작동하는 기능 (3단계)

1. `/` 화면에서 Supabase Auth 공식 SDK(`signInWithPassword`, `signOut`)로 이메일·비밀번호 로그인·로그아웃을 합니다. 로그인 실패는 화면에 이유를 보여 줍니다. 화면 코드에는 공개용 Project URL과 publishable key만 있습니다.
2. 자료 API는 요청의 `Authorization: Bearer <토큰>`을 틀의 `src/verify-login.mjs`로 검사합니다(도우미는 고치지 않음). 토큰이 없거나 검사에 실패하면 자료 없이 **401 JSON 오류**(`LOGIN_REQUIRED`)를 돌려줍니다. 브라우저가 보낸 `userId`·`role`·`owner_id`는 쓰지 않고, 검사로 확인된 사용자 ID만 씁니다.
3. 로그인한 사용자는 가상 메모를 추가·수정·삭제할 수 있습니다. 추가할 때 `owner_id`는 서버가 확인한 사용자 ID로 저장합니다. 메모 번호는 순서 번호가 아닌 UUID입니다.
4. `/data.json`은 404, `/aleph.json`은 빌드 때 자동 생성, 모든 응답에 `X-Content-Type-Options: nosniff` 등 보안 헤더가 붙습니다(2단계와 같음).
5. 서버 전용 키(`SUPABASE_SECRET_KEY`)는 Vercel 환경변수에만 있고 화면 코드·응답·로그·Git에 없습니다. 테이블은 RLS가 켜져 있고 `anon`·`authenticated` 권한이 없습니다.

### 자료 API (`aleph.config.json`의 `allowedRoutes`)

| 경로 | 하는 일 | 응답 |
| --- | --- | --- |
| `GET /api/notes` | 로그인 사용자의 메모 목록 | `200 [{id,title,body}, …]` |
| `POST /api/notes` | `{id?,title,body}` 추가 (id는 UUID, 없으면 서버가 만듦) | `201 {id}` · 같은 id면 `409` |
| `GET /api/notes/:id` | 한 건 읽기 | `200 {id,title,body}` · 없거나 지웠으면 `404` |
| `PUT /api/notes/:id` | `{title?,body?}` 수정 | `200 {id,title,body}` · 없으면 `404` |
| `DELETE /api/notes/:id` | 삭제 | `200 {id,deleted:true}` · 없으면 `404` |

모든 경로는 로그인 토큰이 없거나 틀리면 `401 {"error":"LOGIN_REQUIRED","message":…}`입니다. 검사에 쓴 발급자 정보(비밀 키 제외)는 `aleph.config.json`의 `identityProvider`에 있습니다.

## 다시 실행하는 방법

1. **DB 준비 (2단계, 한 번):** `supabase/step2-notes.local.sql`(가상 메모 문장이 있어 Git 제외)을 Supabase SQL Editor에서 Run.
2. **계정 만들기 (3단계, 한 번):** Supabase → Authentication → Users → Add user → Create new user로 A·B 계정을 만듭니다(Auto Confirm User 체크). 비밀번호는 코드·Git·채팅에 적지 않습니다.
3. **DB 보강 (3단계, 한 번):** `supabase/step3-auth.sql`에서 A 계정 이메일 자리를 바꾼 뒤 SQL Editor에서 Run. 메모 UUID 칸(`note_id`)을 만들고 기존 가상 메모 4건을 A 계정 것으로 표시합니다.
4. **환경변수 (2단계에서 넣은 그대로):** Vercel의 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. 값은 Vercel 설정 화면에만 넣습니다.
5. **로컬 빌드 확인:** `npm run build -- --local`
6. **제출 묶음:** `npm run bundle` (커밋된 상태에서만 동작, `bundle-notes.json` 필요. `bundle-notes.json`, `artifacts/submission.json`은 커밋하지 않음)

## 남은 약점: 로그인은 했지만 소유자 검사는 아직 없습니다

3단계는 "누구인지"만 확인합니다. `GET·PUT·DELETE /api/notes/:id`는 로그인만 되어 있으면 메모 주인이 누구인지 보지 않습니다. 그래서 로그인한 B가 A 메모의 id를 알면 읽고, 고치고, 지울 수 있습니다(목록 `GET /api/notes`는 자기 메모만 보여 주지만, 한 건 경로는 막지 않음). 이 허점은 4단계에서 `owner_id`와 확인된 사용자 ID를 비교해 막고, B의 타인 메모 접근 결과도 4단계에서 기록합니다.

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
4. **로그인 확인 (3단계):** 시크릿 창에서 `$APP`을 열면 로그인 칸만 보이고 메모가 없어야 합니다. A로 로그인하면 메모가 보이고 추가·수정·삭제가 되며, 로그아웃하면 다시 로그인 칸만 보입니다.
5. **브라우저에 서버 전용 키가 없는지:** `curl -s $APP/ | grep -c sb_secret_` → `0` (`sb_publishable_` 공개 키는 있어도 됩니다).

### 확인 기록

| 확인 | 결과 |
| --- | --- |
| 저장점 커밋 대상 파일(`git grep`) | 메모 문장 0건. SQL 파일은 `.gitignore`로 제외 |
| 로컬 빌드 결과물 `public/` | `data.json` 없음, 메모 문장 0건 |
| 배포 주소 `/data.json`·첫 화면·`/aleph.json`·보안 헤더 | 푸시 후 새 배포에서 위 2번 절차로 확인해 제출 화면에 기록 |
| 공개 API `/api/notes` (2단계) | 비로그인으로 가상 메모가 응답됨 → 3단계에서 막음 |
| 무로그인 `/api/notes` (3단계) | 401 JSON 오류 (배포 후 위 3번 절차로 확인) |
| B가 A 메모 id로 접근 (3단계) | 아직 막지 않음 → 4단계에서 기록·차단 |

## 과거 노출은 해소되지 않았습니다

최신 파일에서 메모를 지워도 지난 기록은 그대로 남아 있습니다. 2단계는 "앞으로 새로 공개되는 것"을 막았을 뿐, 이미 공개된 것을 되돌리지 못했습니다.

- **옛 공개 커밋:** 1단계 커밋 `0ff36ed`에는 `data.json`과 `public/data.json`이 그대로 있습니다. `git log --oneline -- data.json public/data.json`이나 GitHub의 커밋 화면에서 누구나 볼 수 있고, 이미 복제(clone·fork)한 사람에게서는 지울 방법이 없습니다.
- **옛 배포:** Vercel은 배포마다 고유 주소를 남깁니다. 1단계 배포의 고유 주소에서는 `/data.json`이 계속 열릴 수 있습니다. Vercel → Deployments에서 옛 배포를 지우지 않는 한 남습니다.
- 그래서 이 자료실에는 처음부터 가상 메모만 넣었습니다. 실제 비밀이 이렇게 올라갔다면 기록 삭제보다 **키 교체·폐기**가 먼저입니다(도요타 T커넥트 사고처럼 공개 저장소에 올라간 키는 이미 노출된 것으로 봐야 합니다).

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포하고, `api/` 폴더의 파일은 Vercel 서버 함수로 배포합니다(서버 함수가 `aleph.config.json`을 읽도록 `includeFiles`로 포함). 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이 저장소와 실제 배포 주소로 맞췄습니다. `src/attack-check.mjs`는 `npm run bundle`이 실행하는 학생의 자기 점검이며, 실제로 보낸 요청의 결과만 기록합니다(요청을 보내지 못하면 "미실행"). 심판의 판정이 아닙니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 4단계 이후의 소유자 검사, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 있습니다.
