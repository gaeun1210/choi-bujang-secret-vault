// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
// 이 결과는 학생이 직접 보낸 요청의 관찰값일 뿐, 심판의 판정이 아닙니다.

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

async function errorJson(response) {
  try {
    const data = await response.json();
    return typeof data?.error === 'string' ? data.error : null;
  } catch {
    return null;
  }
}

function denial(response) {
  return async () => {
    if (!response) return '미실행: 배포 주소에 요청하지 못함';
    const code = [401, 403].includes(response.status) ? await errorJson(response) : null;
    return `HTTP ${response.status} · ${code ? `JSON 오류 ${code}` : 'JSON 오류 문구 없음'}`;
  };
}

async function stepThreeChecks(config) {
  const app = appUrl(config);
  const fakeUser = '00000000-0000-4000-8000-000000000000';
  const results = [];

  const anonymous = await tryFetch(new URL('/api/notes', app));
  results.push({ attackId: 'anonymous_note_list', expected: '로그인 없이 메모 목록 요청 시 401/403 JSON 오류',
    observed: await denial(anonymous)() });

  let forgedId = null;
  try {
    const response = await fetch(new URL(`/api/notes?userId=${fakeUser}&role=admin`, app), {
      headers: { 'X-User-Id': fakeUser, 'X-Role': 'admin' }, redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    forgedId = response.headers.has('x-vercel-id') ? response : null;
  } catch { /* 미실행 */ }
  results.push({ attackId: 'forged_user_id_no_token', expected: '토큰 없이 userId·role만 보내면 401/403 거부',
    observed: await denial(forgedId)() });

  let forgedToken = null;
  try {
    const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({
      iss: config.identityProvider?.issuer, aud: 'authenticated', role: 'authenticated', sub: fakeUser,
      exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url')}.unsigned`;
    const response = await fetch(new URL('/api/notes', app), {
      headers: { Authorization: `Bearer ${unsigned}` }, redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    forgedToken = response.headers.has('x-vercel-id') ? response : null;
  } catch { /* 미실행 */ }
  results.push({ attackId: 'forged_unsigned_token', expected: '서명 없는 가짜 토큰은 401/403 거부',
    observed: await denial(forgedToken)() });

  let anonymousWrite = null;
  try {
    const response = await fetch(new URL('/api/notes', app), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '무로그인 시도', body: '거부되어야 함' }),
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    anonymousWrite = response.headers.has('x-vercel-id') ? response : null;
  } catch { /* 미실행 */ }
  results.push({ attackId: 'anonymous_note_create', expected: '로그인 없이 메모 추가 시 401/403 거부',
    observed: await denial(anonymousWrite)() });

  const staticFile = await tryFetch(new URL('/data.json', app));
  results.push({ attackId: 'static_note_file_read', expected: '/data.json 요청 시 404',
    observed: !staticFile ? '미실행: 배포 주소에 요청하지 못함' : `HTTP ${staticFile.status}` });

  const home = await tryFetch(new URL('/', app));
  const homeText = home && config.step >= 5 ? await home.clone().text().catch(() => null) : null;
  results.push({ attackId: 'security_header_nosniff', expected: '첫 화면 응답에 X-Content-Type-Options: nosniff',
    observed: !home ? '미실행: 배포 주소에 요청하지 못함'
      : `HTTP ${home.status} · nosniff ${home.headers.get('x-content-type-options')?.toLowerCase() === 'nosniff' ? '있음' : '없음'}` });

  if (config.step >= 5) {
    results.push({ attackId: 'page_has_no_storage_key', expected: '첫 화면 코드에 Supabase 주소·공개 키 없음',
      observed: homeText === null ? '미실행: 배포 주소에 요청하지 못함'
        : /sb_publishable_|supabase\.co|eyJhbGci/u.test(homeText) ? '첫 화면 코드에 저장소 주소 또는 키가 보임' : '첫 화면 코드에 저장소 주소·키 없음' });

    // 원본 자료 주소를 키 없이 직접 부르기 (공개 키로 부르는 확인은 심판이 함)
    let original = null;
    try {
      const response = await fetch(config.originalApiUrl, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      original = response.headers.has('x-deny-reason') ? null : response;
    } catch { /* 미실행 */ }
    let rows = null;
    if (original?.ok) rows = await original.json().then(data => (Array.isArray(data) ? data.length : 0), () => 0);
    results.push({ attackId: 'original_api_direct_read', expected: '원본 자료 주소를 직접 부르면 거부되거나 메모 0건',
      observed: !original ? '미실행: 원본 자료 주소에 요청하지 못함'
        : `HTTP ${original.status} · 메모 ${rows ?? 0}건` });
  }

  if (config.step >= 6) {
    results.push({ attackId: 'unregistered_device_read', expected: '미등록 기기 요청은 판정기가 deny·device_not_registered',
      observed: '미실행: 미등록 기기 공격은 심판이 반 엔진으로 보냄 (로컬 연습은 npm run decider:test)' });
  }

  // 로그인이 필요한 점검은 비밀번호를 코드에 넣지 않기 위해 자동으로 보내지 않습니다.
  results.push({ attackId: 'login_a_crud', expected: '정상 A 로그인 뒤 자기 가상 메모 추가·수정·삭제 성공',
    observed: '미실행: 비밀번호를 코드에 넣지 않으므로 학생이 화면에서 직접 확인' });
  if (config.step >= 4) {
    results.push({ attackId: 'login_b_reads_a_note', expected: 'B 토큰으로 A 메모 id 읽기·수정·삭제 시 404 거부',
      observed: '미실행: 비밀번호를 코드에 넣지 않으므로 학생이 B 창에서 직접 확인' });
    results.push({ attackId: 'owner_change_on_update', expected: '수정 본문에 다른 owner_id를 넣으면 403 거부',
      observed: '미실행: 비밀번호를 코드에 넣지 않으므로 학생이 직접 확인' });
  } else {
    results.push({ attackId: 'login_b_reads_a_note', expected: '4단계에서 기록 (아직 소유자 검사 없음)',
      observed: '미실행: 4단계에서 B 계정으로 점검 예정' });
  }
  return results;
}

export async function runAttackChecks(config) {
  if (config.step === 1) return stepOneChecks(config);
  if (config.step === 2) return stepTwoChecks(config);
  if (config.step >= 3 && config.step <= 6) return stepThreeChecks(config);
  throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
}
