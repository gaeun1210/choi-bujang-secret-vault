// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
// 이 결과는 학생이 직접 보낸 요청의 관찰값일 뿐, 심판의 판정이 아닙니다.

import { randomUUID } from 'node:crypto';

function appUrl(config) {
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  return app;
}

// 네트워크가 막혀 요청 자체를 못 보냈으면 null을 돌려주고, 결과는 '미실행'으로 남깁니다.
// 중간 프록시가 대신 답한 경우(Vercel 응답 표시 x-vercel-id 없음)도 배포 결과가 아니므로 미실행입니다.
async function tryFetch(url) {
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    return response.headers.has('x-vercel-id') ? response : null;
  } catch {
    return null;
  }
}

async function noteCount(response, config) {
  try {
    const data = await response.json();
    if (data?.sampleMarker !== config.sampleMarker || !Array.isArray(data.notes)) return 0;
    return data.notes.length;
  } catch {
    return 0;
  }
}

async function stepOneChecks(config) {
  const app = appUrl(config);
  const response = await fetch(new URL('/data.json', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let visible = false;
  if (response.ok) {
    try {
      const data = await response.json();
      visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
        && data.notes.length > 0;
    } catch {
      // A non-JSON response is a failed check, not a successful deployment.
    }
  }
  return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
    observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
}

async function stepTwoChecks(config) {
  const app = appUrl(config);
  const results = [];

  const staticFile = await tryFetch(new URL('/data.json', app));
  results.push({
    attackId: 'static_note_file_read',
    expected: '비로그인으로 /data.json 요청 시 404 또는 메모 0건',
    observed: !staticFile ? '미실행: 배포 주소에 요청하지 못함'
      : staticFile.status === 404 ? '정적 메모 파일 없음 (HTTP 404)'
        : `HTTP ${staticFile.status} · 확인 표시가 있는 메모 ${staticFile.ok ? await noteCount(staticFile, config) : 0}건`,
  });

  const api = await tryFetch(new URL('/api/notes', app));
  results.push({
    attackId: 'anonymous_api_read',
    expected: '3단계 전이라 비로그인 요청도 서버 API에서 가상 메모를 받음 (남은 약점)',
    observed: !api ? '미실행: 배포 주소에 요청하지 못함'
      : `HTTP ${api.status} · 비로그인 요청에 가상 메모 ${api.ok ? await noteCount(api, config) : 0}건 응답`,
  });

  const home = await tryFetch(new URL('/', app));
  results.push({
    attackId: 'security_header_nosniff',
    expected: '첫 화면 응답에 X-Content-Type-Options: nosniff',
    observed: !home ? '미실행: 배포 주소에 요청하지 못함'
      : `HTTP ${home.status} · nosniff ${home.headers.get('x-content-type-options')?.toLowerCase() === 'nosniff' ? '있음' : '없음'}`,
  });

  return results;
}

// ── 3단계부터(12단계 기준) ──────────────────────────────────────────────
// 제출 묶음은 공개 HTTPS 주소에 읽기 요청(GET)만 보냅니다. 쓰기 요청이 필요한 점검과 로그인이 필요한 점검은
// 보내지 않고 observed를 'not_run'으로 둡니다(이유는 expected에 적음).
// 응답을 받으면 상태 코드·오류 코드·요청 ID(x-vercel-id)·확인 시각을 그대로 적습니다. 계산해 채우지 않습니다.
const NOT_RUN = 'not_run';
const OTHER_NOTE_ID = '7a1c0e52-9b3d-4f6a-8c21-5d4e3f2a1b0c';   // 다른 사용자 메모 자리(가상 ID)
const FAKE_USER = '00000000-0000-4000-8000-000000000000';

// 격리 환경에는 Buffer·btoa가 없을 수 있으므로 ASCII 문자열을 직접 base64url로 바꿉니다.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function base64url(text) {
  const bytes = [...String(text)].map(ch => ch.charCodeAt(0) & 0xff);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = bytes.slice(i, i + 3);
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

// 응답 헤더 읽기: 격리 환경의 응답은 headers가 get 함수·Map·일반 객체·[이름, 값] 배열 중 어느 모양이어도 읽습니다.
function headersKind(headers) {
  if (!headers) return 'none';
  if (typeof headers.get === 'function') return typeof Map !== 'undefined' && headers instanceof Map ? 'map' : 'get';
  if (Array.isArray(headers)) return 'array';
  return typeof headers === 'object' ? 'object' : typeof headers;
}
function headerOf(headers, name) {
  const want = name.toLowerCase();
  try {
    if (!headers) return null;
    if (typeof headers.get === 'function') {
      const value = headers.get(name) ?? headers.get(want);
      if (value !== undefined && value !== null) return String(value);
    }
    const pairs = Array.isArray(headers) ? headers
      : typeof headers.entries === 'function' ? [...headers.entries()]
        : typeof headers === 'object' ? Object.entries(headers) : [];
    for (const [key, value] of pairs) {
      if (String(key).toLowerCase() === want) return Array.isArray(value) ? String(value[0]) : String(value);
    }
  } catch { /* 읽지 못함 */ }
  return null;
}
// 진단: 격리 환경 응답의 모양을 마지막 요청(작전실 요약)에 짧게 실어 서버 기록에서 볼 수 있게 합니다(비밀값 없음).
let lastShape = 'none';

// 요청을 보내고 받은 그대로 기록합니다. 요청 자체를 못 보냈으면 null.
// 격리 환경의 fetch 응답에 일부 기능(text·json·headers)이 없어도 받은 상태 코드는 그대로 남깁니다.
async function measure(attackId, url, init = {}, extraQuery = '') {
  const requestId = randomUUID();   // 이 점검이 보낸 요청의 ID: 요청 주소·헤더·서버 거부 기록·observed에 같은 값이 남습니다.
  // 점검 이름을 여러 기록 형식(헤더·User-Agent·주소)에서 찾을 수 있게 같은 값을 붙입니다.
  const headers = { ...(init.headers ?? {}), 'X-Request-Id': requestId, 'X-Aleph-Attack-Id': attackId,
    'X-Attack-Id': attackId, 'X-Aleph-Attack': attackId, 'User-Agent': `aleph-attack-check/${attackId} (${requestId})` };
  // 격리 환경의 URL에는 searchParams가 없으므로 문자열로만 만듭니다.
  const base = String(url);
  const href = `${base}${base.includes('?') ? '&' : '?'}attackId=${encodeURIComponent(attackId)}&attack_id=${encodeURIComponent(attackId)}&requestId=${requestId}${extraQuery}`;
  const path = base.replace(/^https?:\/\/[^/]+/u, '').split('?')[0] || '/';
  let response;
  try {
    const timeout = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? { signal: AbortSignal.timeout(10000) } : {};
    response = await fetch(href, { ...init, headers, method: 'GET', redirect: 'error', ...timeout });
  } catch {
    return null;
  }
  const status = typeof response?.status === 'number' ? response.status : Number(response?.statusCode);
  if (!response || !Number.isInteger(status)) return null;
  const checkedAt = new Date().toISOString();
  const header = name => headerOf(response.headers, name);
  let text = '';
  try {
    if (typeof response.text === 'function') text = await response.text();
    else if (typeof response.json === 'function') text = JSON.stringify(await response.json());
    else if (typeof response.body === 'string') text = response.body;
  } catch { text = ''; }
  let body = null;
  try { body = JSON.parse(text); } catch { /* JSON 아님 */ }
  const vercelId = header('x-vercel-id');
  lastShape = `hdr.${headersKind(response.headers)}.vid.${vercelId ? 'yes' : 'no'}.txt.${typeof response.text === 'function' ? 'fn' : 'no'}`;
  return { status, path, href, attackId, requestId, vercelId: vercelId ?? '없음', checkedAt, body, text: String(text ?? ''), header };
}

// observed: 응답의 요청 ID(x-vercel-id)·상태·확인 시각·보낸 요청(경로·attackId·보낸 요청 ID)을 받은 그대로 적습니다.
const line = (m, detail = '') => (!m ? NOT_RUN
  : `HTTP ${m.status}${detail ? ` · ${detail}` : ''} · 요청 ID ${m.vercelId} · 확인 ${m.checkedAt} · 보낸 요청 GET ${m.href.split('&client=')[0]}`).slice(0, 300);
const errorCode = m => (typeof m?.body?.error === 'string' ? m.body.error : 'JSON 오류 코드 없음');

async function stepThreeChecks(config) {
  const app = appUrl(config);
  const results = [];
  const push = (attackId, expected, observed) => results.push({ attackId, expected: expected.slice(0, 300), observed });

  // 1첩반상: 무인증 조회 → 타인 메모 조회를 연속으로 보냅니다.
  const anonymousRead = await measure('anonymous_note_read', new URL(`/api/notes/${OTHER_NOTE_ID}`, app));
  push('anonymous_note_read', '금지: 로그인 없이 메모 한 건 조회(GET /api/notes/:id) → 401 LOGIN_REQUIRED, 메모 없음',
    line(anonymousRead, errorCode(anonymousRead)));
  const otherRead = await measure('other_note_read', new URL(`/api/notes/${OTHER_NOTE_ID}`, app), {
    headers: { 'X-User-Id': FAKE_USER, 'X-Role': 'admin' } });
  push('other_note_read', '금지: 다른 사용자 메모 ID를 사용자·역할 헤더만 붙여 조회 → 401 LOGIN_REQUIRED, 메모 없음',
    line(otherRead, errorCode(otherRead)));

  const list = await measure('anonymous_note_list', new URL('/api/notes', app));
  push('anonymous_note_list', '금지: 로그인 없이 메모 목록 → 401 LOGIN_REQUIRED', line(list, errorCode(list)));

  const unsigned = `${base64url('{"alg":"none","typ":"JWT"}')}.${base64url(JSON.stringify({
    iss: config.identityProvider?.issuer, aud: 'authenticated', role: 'authenticated', sub: FAKE_USER,
    exp: Math.floor(Date.now() / 1000) + 300 }))}.unsigned`;
  const forged = await measure('forged_unsigned_token', new URL(`/api/notes/${OTHER_NOTE_ID}`, app), { headers: { Authorization: `Bearer ${unsigned}` } });
  push('forged_unsigned_token', '금지: 서명 없는 가짜 토큰으로 다른 사용자 메모 조회 → 401 LOGIN_REQUIRED', line(forged, errorCode(forged)));

  const staticFile = await measure('static_note_file_read', new URL('/data.json', app));
  push('static_note_file_read', '금지: 정적 메모 파일 /data.json → 404', line(staticFile));

  const home = await measure('home_and_nosniff', new URL('/', app));
  push('home_and_nosniff', '정상: 첫 화면 200, X-Content-Type-Options: nosniff',
    line(home, home ? `nosniff ${home.header('x-content-type-options')?.toLowerCase() === 'nosniff' ? '있음' : '없음'}` : ''));
  if (config.step >= 5) {
    const page = await measure('page_has_no_storage_key', new URL('/', app));
    push('page_has_no_storage_key', '금지: 첫 화면 코드에 Supabase 주소·공개 키 없음(0건)',
      line(page, page ? `주소·키 ${(page.text.match(/sb_publishable_|supabase\.co|eyJhbGci/gu) ?? []).length}건` : ''));
    const original = await measure('original_api_direct_read', config.originalApiUrl);
    const rows = Array.isArray(original?.body) ? original.body.length : 0;
    push('original_api_direct_read', '금지: 원본 자료 주소를 키 없이 직접 부르면 거부 또는 메모 0건', line(original, `메모 ${rows}건`));
  }

  const identity = await measure('deployment_identity', new URL('/aleph.json', app));
  push('deployment_identity', '정상: /aleph.json 200, 단계·커밋 표시',
    line(identity, identity?.body ? `step ${identity.body.step} · commit ${String(identity.body.commit ?? '').slice(0, 12)}` : ''));

  if (config.step >= 8) {
    const notices = await measure('anonymous_notice_list', new URL('/api/notices', app));
    push('anonymous_notice_list', '금지: 로그인 없이 공지 목록 → 401 LOGIN_REQUIRED', line(notices, errorCode(notices)));
  }
  if (config.step >= 11) {
    const manifest = await measure('pwa_manifest', new URL('/manifest.webmanifest', app));
    push('pwa_manifest', '정상: 설치형 웹앱 설정 200, 앱 이름 있음',
      line(manifest, manifest ? `앱 이름 ${typeof manifest.body?.name === 'string' ? '있음' : '없음'}` : ''));
  }
  if (config.step >= 12) {
    const ops = await measure('anonymous_ops_summary', new URL('/api/ops/summary', app), {}, `&client=${lastShape}`);
    push('anonymous_ops_summary', '금지: 로그인 없이 작전실 요약 → 401 LOGIN_REQUIRED', line(ops, errorCode(ops)));
  }

  // 보내지 않은 점검: 이유는 expected에, observed는 not_run.
  push('login_a_crud', '정상: A 로그인 뒤 자기 메모 추가·수정·삭제 성공 — 비밀번호를 코드에 넣지 않아 묶음에서 보내지 않음(작전실 실측표에서 확인)', NOT_RUN);
  if (config.step >= 4) {
    push('login_b_reads_a_note', '금지: B 토큰으로 A 메모 조회 → 404 — 로그인 필요, 묶음에서 보내지 않음', NOT_RUN);
  }
  if (config.step >= 6) {
    push('unregistered_device_read', '금지: 미등록 기기 → deny·device_not_registered — ALEPH SDP 엔진(제공)이 판정 요청을 보낼 때만 실측', NOT_RUN);
  }
  if (config.step >= 7) {
    push('unusual_access_relogin', '추가 확인: 복합 이상 접속 → step_up — ALEPH SDP 엔진(제공)이 stepUp을 검증할 때만 실측', NOT_RUN);
  }
  if (config.step >= 9) {
    push('doppelganger_burst_revocation', '금지: 다량 조회 → propose_revocation — ALEPH SDP 엔진(제공)이 사건을 전달할 때만 실측', NOT_RUN);
  }
  if (config.step >= 10) {
    push('anonymous_note_restore', '금지: 로그인 없이 복원(POST) → 401 — 쓰기 요청이라 묶음에서 보내지 않음(작전실 실측표에서 확인)', NOT_RUN);
  }
  if (config.step >= 11) {
    push('unapproved_device_read', '금지: 승인 안 된 기기 → 403 DEVICE_NOT_APPROVED — 로그인 필요, 묶음에서 보내지 않음', NOT_RUN);
  }
  return results.slice(0, 20);
}

// 12단계: 제출 묶음은 요청을 보내지 않습니다. 실측(상태·요청 ID·확인 시각)은 작전실 /ops.html 「실측 실행」 표와
// 서버의 가린 거부 기록에 남기고, 여기서는 보내지 않은 점검이므로 모두 observed를 'not_run'으로 둡니다.
function stepTwelveChecks(config) {
  appUrl(config);   // 배포 주소 형식만 확인
  const where = '제출 묶음에서는 요청을 보내지 않음(작전실 「실측 실행」 표에서 실측)';
  const rows = [
    ['anonymous_note_read', '금지: 로그인 없이 메모 한 건 조회 → 401 LOGIN_REQUIRED'],
    ['other_note_read', '금지: 다른 사용자 메모 조회 → 401(로그인 없음) 또는 404(남의 메모)'],
    ['anonymous_note_list', '금지: 로그인 없이 메모 목록 → 401 LOGIN_REQUIRED'],
    ['forged_unsigned_token', '금지: 서명 없는 가짜 토큰 → 401 LOGIN_REQUIRED'],
    ['static_note_file_read', '금지: 정적 메모 파일 /data.json → 404'],
    ['home_and_nosniff', '정상: 첫 화면 200, X-Content-Type-Options: nosniff'],
    ['page_has_no_storage_key', '금지: 첫 화면 코드에 Supabase 주소·공개 키 없음(0건)'],
    ['original_api_direct_read', '금지: 원본 자료 주소를 키 없이 직접 부르면 거부 또는 메모 0건'],
    ['deployment_identity', '정상: /aleph.json 200, 단계·커밋 표시'],
    ['anonymous_notice_list', '금지: 로그인 없이 공지 목록 → 401 LOGIN_REQUIRED'],
    ['pwa_manifest', '정상: 설치형 웹앱 설정 200, 앱 이름 있음'],
    ['anonymous_ops_summary', '금지: 로그인 없이 작전실 요약 → 401 LOGIN_REQUIRED'],
    ['login_a_crud', '정상: A 로그인 뒤 자기 메모 추가·수정·삭제 성공'],
    ['login_b_reads_a_note', '금지: B 토큰으로 A 메모 조회 → 404'],
    ['unregistered_device_read', '금지: 미등록 기기 → deny·device_not_registered (ALEPH SDP 엔진(제공) 판정)'],
    ['unusual_access_relogin', '추가 확인: 복합 이상 접속 → step_up (ALEPH SDP 엔진(제공) 판정)'],
    ['doppelganger_burst_revocation', '금지: 다량 조회 → propose_revocation (ALEPH SDP 엔진(제공) 사건)'],
    ['anonymous_note_restore', '금지: 로그인 없이 복원(POST) → 401'],
    ['unapproved_device_read', '금지: 승인 안 된 기기 → 403 DEVICE_NOT_APPROVED'],
  ];
  return rows.map(([attackId, expected]) => ({ attackId, expected: `${expected} — ${where}`.slice(0, 300), observed: NOT_RUN }));
}

export async function runAttackChecks(config) {
  if (config.step === 12) return stepTwelveChecks(config);
  if (config.step === 1) return stepOneChecks(config);
  if (config.step === 2) return stepTwoChecks(config);
  if (config.step >= 3 && config.step <= 12) return stepThreeChecks(config);
  throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
}
