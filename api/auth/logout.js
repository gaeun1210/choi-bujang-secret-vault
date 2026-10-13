// POST /api/auth/logout → 200 {loggedOut:true}
// 토큰(헤더 또는 HttpOnly 세션 쿠키)을 검사한 뒤 Supabase 세션을 끝내고 세션 쿠키를 지웁니다. 기기 쿠키는 남깁니다.
import { authClient } from '../../src/auth-api.mjs';
import { SESSION_COOKIE, requireLogin, send, setCookie } from '../../src/notes-api.mjs';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'POST만 됩니다.' });
  }
  const session = await requireLogin(request, response);
  if (!session) return undefined;
  try {
    await authClient()?.auth.admin.signOut(session.token, 'local');
  } catch {
    console.error('auth: 세션 종료 요청이 실패했습니다.');
  }
  setCookie(response, SESSION_COOKIE, '', 0);
  return send(response, 200, { loggedOut: true });
}
