// 2단계 서버 함수: 학습용 Supabase 테이블에서 가상 메모를 읽어 화면에 돌려줍니다.
// 서버 전용 키는 Vercel 환경변수에서만 읽고, 응답·로그에 절대 넣지 않습니다.
// 약점(3단계에서 막을 것): 이 주소는 아직 로그인 없이 누구나 호출할 수 있습니다.
const SAMPLE_MARKER = 'SAMPLE_NOTE_1';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method && request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const baseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!baseUrl || !secretKey) {
    console.error('notes: 서버 환경변수가 설정되지 않았습니다.');
    return response.status(500).json({ error: 'SERVER_NOT_CONFIGURED' });
  }

  let endpoint;
  try {
    endpoint = new URL('/rest/v1/vault_notes', baseUrl);
  } catch {
    console.error('notes: SUPABASE_URL 형식이 올바르지 않습니다.');
    return response.status(500).json({ error: 'SERVER_NOT_CONFIGURED' });
  }
  endpoint.searchParams.set('select', 'title,content');
  endpoint.searchParams.set('order', 'id.asc');
  endpoint.searchParams.set('limit', '20');

  try {
    const upstream = await fetch(endpoint, {
      headers: { apikey: secretKey, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      // 상태 코드만 남깁니다. 키·요청 헤더·응답 본문은 로그에 남기지 않습니다.
      console.error(`notes: 자료 저장소 응답 실패 (HTTP ${upstream.status})`);
      return response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
    }
    const rows = await upstream.json();
    const notes = Array.isArray(rows)
      ? rows.map(row => ({ title: String(row.title ?? ''), content: String(row.content ?? '') }))
      : [];
    return response.status(200).json({ sampleMarker: SAMPLE_MARKER, notes });
  } catch {
    console.error('notes: 자료 저장소에 연결하지 못했습니다.');
    return response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
  }
}
