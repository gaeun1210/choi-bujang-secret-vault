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

export async function runAttackChecks(config) {
  if (config.step === 1) return stepOneChecks(config);
  if (config.step === 2) return stepTwoChecks(config);
  throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
}
