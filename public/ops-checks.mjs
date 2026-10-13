// 12단계 탈환 작전실 실측 시험 목록 — 브라우저(ops.html)와 터미널(npm run ops:matrix)이 함께 씁니다.
// 실제로 보낸 요청의 응답만 기록합니다. 보내지 못했거나 로그인·엔진이 필요한데 없으면 "미실행"입니다.
// 메모 본문·토큰은 결과에 넣지 않습니다(상태 코드·오류 코드·개수만).
const ZERO = '00000000-0000-4000-8000-000000000000';
const randomId = () => (globalThis.crypto?.randomUUID?.() ?? ZERO);
const json = async response => response.json().catch(() => null);
const forged = () => {
  const b64 = value => btoa(JSON.stringify(value)).replace(/=+$/u, '').replace(/\+/gu, '-').replace(/\//gu, '_');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: ZERO, role: 'authenticated', exp: 9999999999 })}.unsigned`;
};

// kind: 정상(허용되어야 함) · 금지(거부되어야 함). auth: 'none'(로그인 없이) · 'session'(로그인·승인된 기기). engine: ALEPH SDP 엔진 필요.
export const CHECKS = [
  { id: 's1-home', step: 1, kind: '정상', name: '첫 화면 열기', expected: '200', auth: 'none',
    run: async f => { const r = await f('/'); return { r, ok: r.status === 200 }; } },
  { id: 's1-nosniff', step: 1, kind: '정상', name: '첫 화면 보안 헤더', expected: 'nosniff 있음', auth: 'none',
    run: async f => { const r = await f('/'); const v = r.headers.get('x-content-type-options'); return { r, ok: v === 'nosniff', note: `nosniff ${v === 'nosniff' ? '있음' : '없음'}` }; } },
  { id: 's2-data-json', step: 2, kind: '금지', name: '정적 메모 파일 /data.json', expected: '404', auth: 'none',
    run: async f => { const r = await f('/data.json'); return { r, ok: r.status === 404 }; } },
  { id: 's2-aleph', step: 2, kind: '정상', name: '/aleph.json 열림', expected: '200', auth: 'none',
    run: async f => { const r = await f('/aleph.json'); return { r, ok: r.status === 200 }; } },
  { id: 's3-anon-note', step: 3, kind: '금지', name: '로그인 없이 메모 한 건', expected: '401 LOGIN_REQUIRED', auth: 'none',
    run: async f => { const r = await f(`/api/notes/${ZERO}`); const d = await json(r); return { r, code: d?.error, ok: r.status === 401 && d?.error === 'LOGIN_REQUIRED' }; } },
  { id: 's3-anon-list', step: 3, kind: '금지', name: '로그인 없이 메모 목록', expected: '401 LOGIN_REQUIRED', auth: 'none',
    run: async f => { const r = await f('/api/notes'); const d = await json(r); return { r, code: d?.error, ok: r.status === 401 && d?.error === 'LOGIN_REQUIRED' }; } },
  { id: 's3-forged-token', step: 3, kind: '금지', name: '서명 없는 가짜 토큰', expected: '401 LOGIN_REQUIRED', auth: 'none',
    run: async f => { const r = await f(`/api/notes/${ZERO}`, { headers: { Authorization: `Bearer ${forged()}` } }); const d = await json(r); return { r, code: d?.error, ok: r.status === 401 }; } },
  { id: 's4-own-list', step: 4, kind: '정상', name: '내 메모 목록', expected: '200 (개수만 표시)', auth: 'session',
    run: async f => { const r = await f('/api/notes'); const d = await json(r); return { r, ok: r.status === 200 && Array.isArray(d), note: Array.isArray(d) ? `${d.length}건` : '', ownId: Array.isArray(d) ? d[0]?.id : undefined }; } },
  { id: 's4-other-note', step: 4, kind: '금지', name: '남의(없는) 메모 ID 읽기', expected: '404 NOT_FOUND', auth: 'session',
    run: async f => { const r = await f(`/api/notes/${randomId()}`); const d = await json(r); return { r, code: d?.error, ok: r.status === 404 }; } },
  { id: 's4-owner-change', step: 4, kind: '금지', name: '내 메모 소유자 바꾸기', expected: '403 OWNER_CHANGE_FORBIDDEN', auth: 'session', needsOwnId: true,
    run: async (f, ctx) => { const r = await f(`/api/notes/${ctx.ownId}`, { method: 'PUT', body: JSON.stringify({ owner_id: ZERO }) }); const d = await json(r); return { r, code: d?.error, ok: r.status === 403 && d?.error === 'OWNER_CHANGE_FORBIDDEN' }; } },
  { id: 's5-no-key', step: 5, kind: '금지', name: '화면 코드의 저장소 주소·공개 키', expected: '0건', auth: 'none',
    run: async f => { const r = await f('/'); const t = await r.text(); const n = (t.match(/sb_publishable_|supabase\.co/gu) ?? []).length; return { r, ok: n === 0, note: `${n}건` }; } },
  { id: 's5-original-anon', step: 5, kind: '금지', name: '원본 주소를 공개 키로 직접 읽기', expected: 'permission denied', auth: 'manual',
    note: '공개 키가 화면에 없으므로 학생이 Supabase 키로 직접 확인' },
  { id: 's6-unregistered', step: 6, kind: '금지', name: '미등록 기기 판정', expected: 'deny device_not_registered', auth: 'engine',
    note: 'ALEPH SDP 엔진(제공)이 판정 요청을 보낼 때만 실측 · 로컬 연습 npm run decider:test' },
  { id: 's7-step-up', step: 7, kind: '금지', name: '복합 이상 접속 재확인', expected: 'step_up', auth: 'engine',
    note: '엔진이 stepUp을 검증할 때만 실측 · 로컬 연습 npm run fixture:7' },
  { id: 's8-zone-decider', step: 8, kind: '금지', name: 'B의 A 메모·공지 수정 판정', expected: 'deny route_not_allowed', auth: 'engine',
    note: '엔진 판정 요청으로만 실측 · 로컬 연습 npm run decider:zones' },
  { id: 's8-notice-read', step: 8, kind: '정상', name: '공지 목록 읽기', expected: '200', auth: 'session',
    run: async f => { const r = await f('/api/notices'); const d = await json(r); return { r, ok: r.status === 200 && Array.isArray(d), note: Array.isArray(d) ? `${d.length}건` : '' }; } },
  { id: 's8-notice-edit', step: 8, kind: '금지', name: '학생의 공지 수정', expected: '403 INSTRUCTOR_ONLY', auth: 'session',
    run: async f => { const r = await f(`/api/notices/${ZERO}`, { method: 'PUT', body: JSON.stringify({ title: '작전실 시험' }) }); const d = await json(r); return { r, code: d?.error, ok: r.status === 403 && d?.error === 'INSTRUCTOR_ONLY' }; } },
  { id: 's9-detect', step: 9, kind: '금지', name: '도플갱어 다량 조회 회수 제안', expected: 'propose_revocation', auth: 'engine',
    note: '엔진이 사건을 전달할 때만 실측 · 로컬 연습 npm run detect:test' },
  { id: 's10-anon-restore', step: 10, kind: '금지', name: '로그인 없이 복원', expected: '401 LOGIN_REQUIRED', auth: 'none',
    run: async f => { const r = await f(`/api/restore/${ZERO}`, { method: 'POST' }); const d = await json(r); return { r, code: d?.error, ok: r.status === 401 }; } },
  { id: 's10-restore-other', step: 10, kind: '금지', name: '남의(사본 없는) 메모 복원', expected: '404 NOT_FOUND', auth: 'session',
    run: async f => { const r = await f(`/api/restore/${randomId()}`, { method: 'POST' }); const d = await json(r); return { r, code: d?.error, ok: r.status === 404 }; } },
  { id: 's10-restore-own', step: 10, kind: '정상', name: '내 메모 한 건 복원(해시 대조)', expected: '200 contentHash 일치', auth: 'manual',
    note: '복원은 메모 내용을 사본으로 되돌리므로 자동 실행하지 않음 · 시험 계정 B로 학생이 직접' },
  { id: 's11-session', step: 11, kind: '정상', name: '승인된 기기 확인', expected: '200 approved', auth: 'session',
    run: async f => { const r = await f('/api/auth/session'); const d = await json(r); return { r, ok: r.status === 200 && d?.device?.status === 'approved', note: d?.device?.status ?? '' }; } },
  { id: 's11-csrf', step: 11, kind: '금지', name: '화면 표시 헤더 없는 쓰기 요청', expected: '403 CSRF_CHECK_FAILED', auth: 'session', rawHeaders: true,
    run: async f => { const r = await f('/api/device/request', { method: 'POST' }); const d = await json(r); return { r, code: d?.error, ok: r.status === 403 && d?.error === 'CSRF_CHECK_FAILED' }; } },
  { id: 's11-manifest', step: 11, kind: '정상', name: '설치형 웹앱 설정', expected: '200 앱 이름 있음', auth: 'none',
    run: async f => { const r = await f('/manifest.webmanifest'); const d = await json(r); return { r, ok: r.status === 200 && typeof d?.name === 'string', note: d?.name ? '이름 있음' : '' }; } },
];

// base: 사이트 주소('' = 같은 사이트). session: 로그인·승인된 기기 쿠키로 보낼 수 있는지.
export async function runChecks({ base = '', session = false, fetchImpl = globalThis.fetch } = {}) {
  const rows = [];
  const ctx = {};
  for (const check of CHECKS) {
    const row = { id: check.id, step: check.step, kind: check.kind, name: check.name, expected: check.expected,
      actual: null, requestId: null, checkedAt: null, result: '미실행', note: check.note ?? '' };
    if (!check.run || (check.auth === 'session' && !session) || (check.needsOwnId && !ctx.ownId)) {
      if (check.auth === 'session' && !session) row.note = '로그인·승인된 기기가 필요 (작전실 화면에서 실행)';
      if (check.needsOwnId && session && !ctx.ownId) row.note = '내 메모가 없어 대상 ID 없음';
      rows.push(row);
      continue;
    }
    const f = (path, init = {}) => fetchImpl(`${base}${path}`, {
      ...init, cache: 'no-store', redirect: 'error',
      credentials: check.auth === 'session' ? 'same-origin' : 'omit',
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(check.auth === 'session' && !check.rawHeaders ? { 'X-Vault-Request': '1' } : {}), ...(init.headers ?? {}) },
    });
    try {
      const out = await check.run(f, ctx);
      if (out.ownId) ctx.ownId = out.ownId;
      row.checkedAt = new Date().toISOString();
      row.requestId = out.r.headers.get('x-vercel-id');
      row.actual = `${out.r.status}${out.code ? ` ${out.code}` : ''}${out.note ? ` · ${out.note}` : ''}`;
      row.result = out.ok ? '일치' : '불일치';
      if (base && !row.requestId) { row.result = '미실행'; row.note = '배포 서버 응답이 아님(중간 프록시 등)'; }
    } catch {
      row.note = '요청을 보내지 못함';
    }
    rows.push(row);
  }
  return rows;
}

export function summarize(rows) {
  const by = result => rows.filter(row => row.result === result).length;
  return { total: rows.length, matched: by('일치'), mismatched: by('불일치'), notRun: by('미실행'),
    finalAssault41: '심판 총공세 41종 목록은 이 저장소에 없음 — 이 표의 실측만 기록하고 41종 통과 여부는 미실행(심판 판정)' };
}
