// 5단계: 로그인·로그아웃도 서버 함수가 맡습니다. 브라우저에는 Supabase 주소·공개 키·SDK가 없습니다.
// 서버는 공식 SDK(supabase-js)로 Supabase Auth를 부르고, 서버 전용 키는 환경변수에서만 읽습니다.
// 비밀번호와 토큰은 로그에 남기지 않고, refresh token은 브라우저에 주지 않습니다.
import { createClient } from '@supabase/supabase-js';

let client;
export function authClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return client;
}

export const LOGIN_REASONS = {
  invalid_credentials: '이메일 또는 비밀번호가 맞지 않습니다.',
  email_not_confirmed: '이메일 인증이 끝나지 않은 계정입니다.',
  over_request_rate_limit: '시도가 너무 많습니다. 잠시 뒤 다시 해 주세요.',
  user_banned: '사용이 막힌 계정입니다.',
};
