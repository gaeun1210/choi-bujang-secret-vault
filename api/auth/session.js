// GET /api/auth/session → 화면이 새로고침 뒤 상태를 알기 위한 요약(토큰은 돌려주지 않음)
// 200 {loggedIn:false} 또는 {loggedIn:true, device:{status, code, deviceId}}
import { opsSummaryHandler } from '../../src/ops-summary.mjs';
import { deviceState, readCookies, requireLogin, send, SESSION_COOKIE } from '../../src/notes-api.mjs';

export default async function handler(request, response) {
  // 12단계: /api/ops/summary 는 vercel.json rewrites로 여기(view=ops)에 옵니다. 서버 함수 수를 12개로 유지하기 위함.
  const path = String(request.url ?? '').split('?')[0];
  if (request.query?.view === 'ops' || path === '/api/ops/summary') return opsSummaryHandler(request, response);
  if ((request.method ?? 'GET') !== 'GET') {
    response.setHeader('Allow', 'GET');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'GET만 됩니다.' });
  }
  if (!readCookies(request)[SESSION_COOKIE] && typeof request.headers?.authorization !== 'string') {
    return send(response, 200, { loggedIn: false });
  }
  const session = await requireLogin(request, response);
  if (!session) return undefined;
  if (session.login.kind !== 'student') {
    return send(response, 200, { loggedIn: true, device: { status: 'engine_verified', code: null, deviceId: null } });
  }
  try {
    return send(response, 200, { loggedIn: true, device: await deviceState(request, session.owner) });
  } catch {
    return send(response, 200, { loggedIn: true, device: { status: 'unavailable', code: null, deviceId: null } });
  }
}
