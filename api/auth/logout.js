// POST /api/auth/logout (Authorization: Bearer <토큰>) → 200 {loggedOut:true}
// 토큰을 먼저 검사한 뒤 Supabase에서 이 로그인의 세션을 끝냅니다.
import { authClient } from '../../src/auth-api.mjs';
import { requireUser, send } from '../../src/notes-api.mjs';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'POST만 됩니다.' });
  }
  const userId = await requireUser(request, response);
  if (!userId) return undefined;
  const token = request.headers.authorization.slice('Bearer '.length);
  try {
    await authClient()?.auth.admin.signOut(token, 'local');
  } catch {
    console.error('auth: 세션 종료 요청이 실패했습니다.');
  }
  return send(response, 200, { loggedOut: true });
}
