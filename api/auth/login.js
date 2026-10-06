// POST /api/auth/login {email,password} → 200 {accessToken,expiresAt,email} · 실패 401 {error,message}
import { LOGIN_REASONS, authClient } from '../../src/auth-api.mjs';
import { readBody, send } from '../../src/notes-api.mjs';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/u;

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'POST만 됩니다.' });
  }
  const input = readBody(request);
  const email = typeof input?.email === 'string' ? input.email.trim() : '';
  const password = typeof input?.password === 'string' ? input.password : '';
  if (!EMAIL.test(email) || !password || password.length > 200) {
    return send(response, 400, { error: 'INVALID_LOGIN_INPUT', message: '이메일과 비밀번호를 확인해 주세요.' });
  }
  const supabase = authClient();
  if (!supabase) {
    console.error('auth: 서버 환경변수가 설정되지 않았습니다.');
    return send(response, 500, { error: 'SERVER_NOT_CONFIGURED', message: '서버 설정을 확인해 주세요.' });
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session?.access_token) {
      const code = typeof error?.code === 'string' ? error.code : 'login_failed';
      const status = code === 'over_request_rate_limit' ? 429 : 401;
      return send(response, status, {
        error: 'LOGIN_FAILED', reason: code,
        message: LOGIN_REASONS[code] ?? '로그인하지 못했습니다. 입력을 확인해 주세요.',
      });
    }
    return send(response, 200, {
      accessToken: data.session.access_token,
      expiresAt: data.session.expires_at ?? null,
      email: data.user?.email ?? email,
    });
  } catch {
    console.error('auth: 로그인 서버에 연결하지 못했습니다.');
    return send(response, 502, { error: 'AUTH_UNAVAILABLE', message: '로그인 서버에 연결하지 못했습니다.' });
  }
}
