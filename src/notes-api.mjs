// 3단계 자료 API 공통 부분: 로그인 토큰 검사(틀의 verify-login.mjs)와 학습용 DB 접근.
// 서버 전용 키는 환경변수에서만 읽고 응답·로그에 넣지 않습니다.
// 브라우저가 보낸 userId·role 같은 값은 쓰지 않고, 토큰 검사로 확인한 사용자 ID만 씁니다.
// 아직 소유자 검사는 없습니다: 로그인한 B가 A 메모의 id를 알면 읽고 고칠 수 있습니다 (4단계에서 막음).
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createLoginVerifier } from './verify-login.mjs';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const TITLE_MAX = 100;
const BODY_MAX = 2000;

let verifier;
function loginVerifier() {
  if (!verifier) {
    const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
    verifier = createLoginVerifier({ config, supabaseSecretKey: process.env.SUPABASE_SECRET_KEY });
  }
  return verifier;
}

export function send(response, status, body) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  return response.status(status).json(body);
}

// 토큰이 없거나 검사에 실패하면 null. 성공하면 서버가 확인한 사용자 ID.
export async function requireUser(request, response) {
  let verify;
  try {
    verify = loginVerifier();
  } catch {
    console.error('notes: 로그인 검사 설정을 불러오지 못했습니다.');
    send(response, 500, { error: 'SERVER_NOT_CONFIGURED', message: '서버 설정을 확인해 주세요.' });
    return null;
  }
  const header = request.headers?.authorization;
  const login = await verify(typeof header === 'string' ? header : undefined).catch(() => null);
  if (!login?.userId) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    send(response, 401, { error: 'LOGIN_REQUIRED', message: '로그인이 필요합니다. 토큰이 없거나 확인되지 않았습니다.' });
    return null;
  }
  return login.userId;
}

export function readBody(request) {
  const raw = request.body;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  }
  return null;
}

// 제목·내용 검사. partial이면 둘 중 하나만 와도 됩니다.
export function cleanNote(input, { partial = false } = {}) {
  const out = {};
  for (const [key, max] of [['title', TITLE_MAX], ['body', BODY_MAX]]) {
    if (input[key] === undefined) {
      if (!partial) return { error: `${key}가 필요합니다.` };
      continue;
    }
    if (typeof input[key] !== 'string') return { error: `${key}는 문자열이어야 합니다.` };
    const value = input[key].trim();
    if ((key === 'title' && !value) || value.length > max) {
      return { error: `${key} 길이를 확인해 주세요 (최대 ${max}자${key === 'title' ? ', 빈 제목 불가' : ''}).` };
    }
    out[key] = value;
  }
  if (partial && !Object.keys(out).length) return { error: 'title 또는 body가 필요합니다.' };
  return { value: out };
}

export function newNoteId(input) {
  if (input.id === undefined || input.id === null) return { value: randomUUID() };
  if (typeof input.id !== 'string' || !UUID.test(input.id)) return { error: 'id는 UUID여야 합니다.' };
  return { value: input.id.toLowerCase() };
}

const toNote = row => ({ id: row.note_id, title: row.title, body: row.content });

// 학습용 DB(PostgREST) 호출. 실패 이유는 상태 코드만 남깁니다.
async function db(path, { method = 'GET', body, prefer } = {}) {
  const baseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!baseUrl || !secretKey) throw Object.assign(new Error('config'), { status: 500 });
  const headers = { apikey: secretKey, Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const upstream = await fetch(new URL(`/rest/v1/vault_notes${path}`, baseUrl), {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    redirect: 'error', signal: AbortSignal.timeout(8000),
  });
  if (!upstream.ok) {
    console.error(`notes: 자료 저장소 응답 실패 (${method} HTTP ${upstream.status})`);
    throw Object.assign(new Error('upstream'), { status: upstream.status });
  }
  return upstream.status === 204 ? [] : upstream.json();
}

const SELECT = 'select=note_id,title,content';

export const notes = {
  async listOwned(userId) {
    const rows = await db(`?${SELECT}&owner_id=eq.${userId}&order=id.asc&limit=100`);
    return rows.map(toNote);
  },
  async get(id) {
    const rows = await db(`?${SELECT}&note_id=eq.${id}&limit=1`);
    return rows[0] ? toNote(rows[0]) : null;
  },
  async create(id, userId, note) {
    const rows = await db(`?${SELECT}`, {
      method: 'POST', prefer: 'return=representation',
      body: { note_id: id, owner_id: userId, title: note.title, content: note.body },
    });
    return toNote(rows[0]);
  },
  async update(id, note) {
    const patch = {};
    if (note.title !== undefined) patch.title = note.title;
    if (note.body !== undefined) patch.content = note.body;
    const rows = await db(`?note_id=eq.${id}&${SELECT}`, {
      method: 'PATCH', prefer: 'return=representation', body: patch,
    });
    return rows[0] ? toNote(rows[0]) : null;
  },
  async remove(id) {
    const rows = await db(`?note_id=eq.${id}&select=note_id`, {
      method: 'DELETE', prefer: 'return=representation',
    });
    return rows.length > 0;
  },
};

export function dbFailure(response, error) {
  if (error?.status === 409) return send(response, 409, { error: 'ID_CONFLICT', message: '이미 있는 id입니다.' });
  if (error?.status === 500 && error.message === 'config') {
    return send(response, 500, { error: 'SERVER_NOT_CONFIGURED', message: '서버 설정을 확인해 주세요.' });
  }
  return send(response, 502, { error: 'NOTES_UNAVAILABLE', message: '자료 저장소에 연결하지 못했습니다.' });
}
