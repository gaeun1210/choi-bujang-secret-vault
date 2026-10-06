# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 자료실의 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 단계 기록

| 단계 | 커밋 | 한 일 |
| --- | --- | --- |
| 1단계 | `0ff36ed` Initial commit | Vercel 시작 틀 배포. `/data.json`과 공개 저장소의 `data.json`에 가상 메모 네 건이 그대로 공개된 상태를 확인 |
| 2단계 | 「2단계 저장점」 | 메모를 정적 파일·코드에서 빼서 학습용 Supabase 테이블로 옮기고, 서버 함수 `/api/notes`가 읽게 바꿈 |

## 현재 작동하는 기능 (2단계)

1. `/` 화면은 `/api/notes`를 불러 가상 메모 네 장을 카드로 보여 줍니다.
2. `api/notes.js`는 Vercel 환경변수 `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`로 `public.vault_notes` 테이블을 읽습니다. 키는 서버에서만 쓰고, 브라우저 파일·응답·로그에 넣지 않습니다.
3. `public/data.json`과 루트 `data.json`은 지웠습니다. 빌드는 메모를 복사하지 않고, `public/data.json`이 다시 생기면 빌드를 멈춥니다. `/aleph.json`은 계속 빌드 때 자동으로 만들어집니다.
4. `vercel.json`이 모든 응답에 `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`를 붙입니다.
5. 테이블은 RLS가 켜져 있고 정책이 없으며, `anon`·`authenticated`의 테이블 권한을 회수했습니다. 공개 키로는 행을 읽을 수 없습니다. `owner_id uuid` 칸은 3단계 로그인 연결용 자리이며 `auth.users` 외래키는 걸지 않았습니다.

## 다시 실행하는 방법

1. **DB 준비 (한 번):** 메모를 넣는 SQL(`supabase/step2-notes.local.sql`)은 가상 메모 문장이 들어 있어 `.gitignore`로 Git에서 뺐습니다. 이 파일을 Supabase 대시보드 → SQL Editor에 붙여 넣고 Run 합니다. 마지막 확인 조회에서 `owner_id`가 `uuid`, `rls_enabled`가 `true`, `anon_select`·`authenticated_select`가 `false`, 메모 건수가 4인지 봅니다.
2. **환경변수 (한 번):** Vercel 프로젝트 → Settings → Environment Variables에 `SUPABASE_URL`(Supabase 프로젝트 주소)과 `SUPABASE_SECRET_KEY`(Supabase → Project Settings → API Keys의 Secret key)를 직접 넣습니다. 값은 코드·Git·채팅에 붙여 넣지 않습니다. 넣은 뒤 Redeploy 합니다.
3. **로컬 빌드 확인:** `npm run build -- --local` (정적 결과물에 메모 파일이 없는지만 확인합니다. 배포나 심판 접수를 증명하지 않습니다.)
4. **제출 묶음:** `npm run bundle` (커밋된 상태에서만 동작하며 `bundle-notes.json`이 필요합니다. 두 파일 `bundle-notes.json`, `artifacts/submission.json`은 커밋하지 않습니다.)

## 남은 약점: 서버 API가 아직 공개 주소입니다

`/api/notes`는 로그인 확인이 없어서, 주소만 알면 누구나 브라우저나 `curl`로 불러 가상 메모 네 건을 받을 수 있습니다. 2단계에서 막은 것은 "정적 파일과 저장소에 메모가 그대로 실려 나가는 길"과 "공개 키로 DB를 직접 읽는 길"뿐입니다. 그래서 테이블에는 계속 가상 메모만 둡니다. 3단계에서 로그인 확인과 허용 경로를 붙여 이 API를 막아야 합니다.

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
3. **공개 API의 남은 약점 (따로 기록):** `curl -s $APP/api/notes | grep -cE "$PATTERN"` → 지금은 메모가 나옵니다. 이것은 숨긴 것이 아니라 3단계에서 막을 약점입니다.

### 확인 기록

| 확인 | 결과 |
| --- | --- |
| 저장점 커밋 대상 파일(`git grep`) | 메모 문장 0건. SQL 파일은 `.gitignore`로 제외 |
| 로컬 빌드 결과물 `public/` | `data.json` 없음, 메모 문장 0건 |
| 배포 주소 `/data.json`·첫 화면·`/aleph.json`·보안 헤더 | 푸시 후 새 배포에서 위 2번 절차로 확인해 제출 화면에 기록 |
| 공개 API `/api/notes` | 비로그인으로 가상 메모가 응답됨 → 남은 약점 (3단계에서 막음) |

## 과거 노출은 해소되지 않았습니다

최신 파일에서 메모를 지워도 지난 기록은 그대로 남아 있습니다. 2단계는 "앞으로 새로 공개되는 것"을 막았을 뿐, 이미 공개된 것을 되돌리지 못했습니다.

- **옛 공개 커밋:** 1단계 커밋 `0ff36ed`에는 `data.json`과 `public/data.json`이 그대로 있습니다. `git log --oneline -- data.json public/data.json`이나 GitHub의 커밋 화면에서 누구나 볼 수 있고, 이미 복제(clone·fork)한 사람에게서는 지울 방법이 없습니다.
- **옛 배포:** Vercel은 배포마다 고유 주소를 남깁니다. 1단계 배포의 고유 주소에서는 `/data.json`이 계속 열릴 수 있습니다. Vercel → Deployments에서 옛 배포를 지우지 않는 한 남습니다.
- 그래서 이 자료실에는 처음부터 가상 메모만 넣었습니다. 실제 비밀이 이렇게 올라갔다면 기록 삭제보다 **키 교체·폐기**가 먼저입니다(도요타 T커넥트 사고처럼 공개 저장소에 올라간 키는 이미 노출된 것으로 봐야 합니다).

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포하고, `api/` 폴더의 파일은 Vercel 서버 함수로 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이 저장소와 실제 배포 주소로 맞췄습니다. `src/attack-check.mjs`는 `npm run bundle`이 실행하는 학생의 자기 점검이며, 실제로 보낸 요청의 결과만 기록합니다(요청을 보내지 못하면 "미실행"). 심판의 판정이 아닙니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 있습니다.
