// 3단계 자료 API 공통 부분: 로그인 토큰 검사(틀의 verify-login.mjs)와 학습용 DB 접근.
// 서버 전용 키는 환경변수에서만 읽고 응답·로그에 넣지 않습니다.
// 브라우저가 보낸 userId·role·owner_id 같은 값은 쓰지 않고, 토큰 검사로 확인한 사용자 ID만 씁니다.
// 4단계: 읽기·추가·수정·삭제 모두 "확인된 사용자 ID = DB의 owner_id"인 행만 다룹니다.
// 남의 메모는 존재 여부도 알리지 않도록 '없음(404)'과 똑같이 거부합니다.
import { readFileSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
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

// ── 11단계: 쿠키 ─────────────────────────────────────────────
// 로그인 토큰과 기기 비밀값은 HttpOnly 쿠키로만 브라우저에 둡니다(자바스크립트·브라우저 저장소에서 읽을 수 없음).
export const SESSION_COOKIE = '__Host-vault_session';
export const DEVICE_COOKIE = '__Host-vault_device';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function readCookies(request) {
  const header = request.headers?.cookie;
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name && value && value.length <= 8192) out[name] = value;
  }
  return out;
}

export function setCookie(response, name, value, maxAgeSeconds) {
  const cookie = `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`;
  const existing = typeof response.getHeader === 'function' ? response.getHeader('Set-Cookie') : undefined;
  const list = existing ? [].concat(existing) : [];
  response.setHeader('Set-Cookie', [...list, cookie]);
}

// 토큰 검사: Authorization 헤더(심판·도구)나 HttpOnly 세션 쿠키(자료실 화면). 실패하면 null.
// 쿠키로 들어온 쓰기 요청은 같은 사이트 화면만 붙이는 X-Vault-Request 헤더가 있어야 합니다(교차 사이트 요청 위조 방지).
export async function requireLogin(request, response) {
  let verify;
  try {
    verify = loginVerifier();
  } catch {
    console.error('notes: 로그인 검사 설정을 불러오지 못했습니다.');
    send(response, 500, { error: 'SERVER_NOT_CONFIGURED', message: '서버 설정을 확인해 주세요.' });
    return null;
  }
  const header = request.headers?.authorization;
  const cookieToken = readCookies(request)[SESSION_COOKIE];
  const viaCookie = typeof header !== 'string' && typeof cookieToken === 'string';
  const authorization = typeof header === 'string' ? header : viaCookie ? `Bearer ${cookieToken}` : undefined;
  const login = await verify(authorization).catch(() => null);
  if (!login?.userId) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    send(response, 401, { error: 'LOGIN_REQUIRED', message: '로그인이 필요합니다. 토큰이 없거나 확인되지 않았습니다.' });
    return null;
  }
  if (viaCookie && UNSAFE_METHODS.has(request.method) && request.headers?.['x-vault-request'] !== '1') {
    send(response, 403, { error: 'CSRF_CHECK_FAILED', message: '자료실 화면에서 보낸 요청만 받습니다.' });
    return null;
  }
  return { owner: ownerKey(login), login, viaCookie, token: authorization.slice('Bearer '.length) };
}

// 자료 API용: 로그인 확인 + (학생 로그인이면) 이 기기가 서버에 승인된 등록 기기인지 확인.
// 심판 토큰의 기기는 반 엔진과 판정기(deviceRegistered)가 확인하므로 여기서는 브라우저 기기 쿠키를 요구하지 않습니다.
// 반환: 확인된 사용자(주인) 키 또는 null(이미 응답함).
export async function requireUser(request, response, { device = true } = {}) {
  const session = await requireLogin(request, response);
  if (!session) return null;
  if (!device || session.login.kind !== 'student') return session.owner;
  let state;
  try {
    state = await deviceState(request, session.owner);
  } catch {
    send(response, 503, { error: 'DEVICE_CHECK_UNAVAILABLE', message: '기기 승인 상태를 확인할 수 없어 자료를 열지 않습니다.' });
    return null;
  }
  if (state.status !== 'approved') {
    logDenial('device_not_approved', `device:${state.code ?? '?'}`, session.owner);
    send(response, 403, { error: 'DEVICE_NOT_APPROVED', status: state.status, code: state.code ?? null,
      message: '이 기기는 아직 서버에서 승인되지 않았습니다. 승인 전에는 자료를 보여 주지 않습니다.' });
    return null;
  }
  return session.owner;
}

// 메모 주인 키: 학생 로그인은 Supabase 사용자 ID 그대로.
// 심판 토큰은 같은 sub 안에서 A·B를 identity('a'·'b')로 구별하므로, sub와 identity를 함께 묶은
// 고정 UUID를 주인 키로 씁니다. 그래서 심판 B가 심판 A의 메모를 자기 것으로 볼 수 없습니다.
export function ownerKey(login) {
  const sub = String(login.userId).toLowerCase();
  if (login.kind !== 'judge') return sub;
  const digest = createHash('sha256').update(`aleph-judge-owner:${sub}:${login.identity}`).digest('hex');
  const variant = ((Number.parseInt(digest[16], 16) & 0x3) | 0x8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
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

// 본문에 소유자 값을 넣어 보내면, 확인된 사용자 ID와 다를 때 기본 거부합니다.
const OWNER_FIELDS = ['owner_id', 'ownerId', 'userId', 'user_id', 'owner'];
export function ownerMismatch(input, userId) {
  return OWNER_FIELDS.some(key => input[key] !== undefined
    && (typeof input[key] !== 'string' || input[key].toLowerCase() !== userId.toLowerCase()));
}

export function newNoteId(input) {
  if (input.id === undefined || input.id === null) return { value: randomUUID() };
  if (typeof input.id !== 'string' || !UUID.test(input.id)) return { error: 'id는 UUID여야 합니다.' };
  return { value: input.id.toLowerCase() };
}

const toNote = row => ({ id: row.note_id, title: row.title, body: row.content });
// DB가 돌려준 행도 한 번 더 확인합니다: 주인이 다르면 없는 것으로 취급.
const owned = (rows, userId) => rows.filter(row => row.owner_id === userId);

// 학습용 DB(PostgREST) 호출. 실패 이유는 상태 코드만 남깁니다.
async function db(path, { method = 'GET', body, prefer, table = 'vault_notes' } = {}) {
  const baseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!baseUrl || !secretKey) throw Object.assign(new Error('config'), { status: 500 });
  const headers = { apikey: secretKey, Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const upstream = await fetch(new URL(`/rest/v1/${table}${path}`, baseUrl), {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    redirect: 'error', signal: AbortSignal.timeout(8000),
  });
  if (!upstream.ok) {
    console.error(`notes: 자료 저장소 응답 실패 (${method} HTTP ${upstream.status})`);
    throw Object.assign(new Error('upstream'), { status: upstream.status });
  }
  if (upstream.status === 204) return [];
  const text = await upstream.text();
  return text ? JSON.parse(text) : [];
}

const SELECT = 'select=note_id,owner_id,title,content';

// ── 10단계: 비공개 메모 사본과 감사 기록 ─────────────────────────
// 내용 해시 = sha256(제목 + 줄바꿈 + 내용) 16진수. supabase/step10-backup.sql 의 계산과 같습니다.
export const contentHash = (title, body) => createHash('sha256').update(`${title}\n${body}`, 'utf8').digest('hex');

// 감사 기록은 덧붙이기만 합니다. 토큰·내용은 남기지 않고 사용자 키는 앞 8자리만.
export async function audit(action, resource, actor, detail = {}) {
  try {
    await db('', { table: 'vault_audit', method: 'POST', body: {
      action, resource, actor: String(actor ?? '-').slice(0, 8), detail } });
  } catch {
    console.error(`audit: 감사 기록을 남기지 못했습니다 (${action})`);
  }
}

export const backups = {
  // 메모를 만들 때 사본 한 건을 남기고, 돌려받은 행의 해시로 바로 검증합니다.
  async snapshotOnCreate(id, ownerId, note) {
    const hash = contentHash(note.title, note.body);
    const rows = await db('?select=note_id,owner_id,content_hash', { table: 'vault_notes_backup', method: 'POST',
      prefer: 'return=representation',
      body: { note_id: id, owner_id: ownerId, title: note.title, content: note.body, content_hash: hash, source: 'create' } });
    if (rows[0]?.content_hash !== hash || rows[0]?.owner_id !== ownerId) throw new Error('backup_verify');
    return hash;
  },
  // 침해 전 사본: 그 메모의 가장 이른 사본(만들 때 또는 seed)
  async earliest(id) {
    const rows = await db(`?select=note_id,owner_id,title,content,content_hash,source,created_at&note_id=eq.${id}&order=id.asc&limit=1`,
      { table: 'vault_notes_backup' });
    return rows[0] ?? null;
  },
};

// 복원용: 주인 조건 없이 그 ID의 현재 행을 확인(다른 사람 행이면 복원하지 않기 위해)
export async function currentNoteRow(id) {
  const rows = await db(`?${'select=note_id,owner_id,title,content'}&note_id=eq.${id}&limit=1`);
  return rows[0] ?? null;
}

export async function restoreNoteRow(id, ownerId, snapshot, exists) {
  if (exists) {
    return db(`?note_id=eq.${id}&owner_id=eq.${ownerId}&select=note_id,owner_id,title,content`, {
      method: 'PATCH', prefer: 'return=representation', body: { title: snapshot.title, content: snapshot.content } });
  }
  return db('?select=note_id,owner_id,title,content', { method: 'POST', prefer: 'return=representation',
    body: { note_id: id, owner_id: ownerId, title: snapshot.title, content: snapshot.content } });
}

// ── 8단계: 자원 ID와 구역 ─────────────────────────────────────
// 메모와 강사 공지는 서로 다른 구역·자원 ID를 씁니다. 서버는 요청 경로로 구역을 정하고
// 자원 ID는 "구역:UUID" 모양으로만 다룹니다(예: note:…, notice:…). 응답 모양 {id,title,body}는 그대로입니다.
export const ZONES = Object.freeze({
  note: Object.freeze({ zone: 'own_notes', table: 'vault_notes', idColumn: 'note_id', basePath: '/api/notes' }),
  notice: Object.freeze({ zone: 'notices', table: 'vault_notices', idColumn: 'notice_id', basePath: '/api/notices' }),
});
export const resourceId = (kind, id) => `${kind}:${String(id).toLowerCase()}`;

// 거부 사유를 짧게 남깁니다. 토큰·본문·이메일은 남기지 않고, 사용자 ID는 앞 8자리만.
export function logDenial(code, resource, userId) {
  console.warn(`deny ${code} resource=${resource} user=${String(userId ?? '-').slice(0, 8)}`);
}

// 본문에 role·isInstructor 같은 값이 와도 권한 판단에 쓰지 않습니다(기록만).
const ROLE_FIELDS = ['role', 'roles', 'isInstructor', 'is_instructor', 'admin', 'isAdmin'];
export const claimedRole = input => ROLE_FIELDS.some(key => input?.[key] !== undefined);

export const notes = {
  async listOwned(userId) {
    const rows = await db(`?${SELECT}&owner_id=eq.${userId}&order=id.asc&limit=100`);
    return owned(rows, userId).map(toNote);
  },
  async getOwned(id, userId) {
    const rows = owned(await db(`?${SELECT}&note_id=eq.${id}&owner_id=eq.${userId}&limit=1`), userId);
    return rows[0] ? toNote(rows[0]) : null;
  },
  async create(id, userId, note) {
    const rows = await db(`?${SELECT}`, {
      method: 'POST', prefer: 'return=representation',
      body: { note_id: id, owner_id: userId, title: note.title, content: note.body },
    });
    if (rows[0]?.owner_id !== userId) throw Object.assign(new Error('owner'), { status: 502 });
    // 10단계: 만들 때의 내용을 비공개 사본으로 남깁니다(사본 실패가 메모 저장을 막지는 않음, 기록만).
    try {
      await backups.snapshotOnCreate(rows[0].note_id, userId, note);
    } catch {
      console.error(`backup: 사본을 남기지 못했습니다 resource=note:${rows[0].note_id}`);
    }
    return toNote(rows[0]);
  },
  // 기존 행: owner_id=본인 조건으로만 찾음. 새 행: owner_id는 바꾸지 않으므로 그대로 본인.
  async updateOwned(id, userId, note) {
    const patch = {};
    if (note.title !== undefined) patch.title = note.title;
    if (note.body !== undefined) patch.content = note.body;
    const rows = await db(`?note_id=eq.${id}&owner_id=eq.${userId}&${SELECT}`, {
      method: 'PATCH', prefer: 'return=representation', body: patch,
    });
    const mine = owned(rows, userId);
    if (rows.length !== mine.length) throw Object.assign(new Error('owner'), { status: 502 });
    return mine[0] ? toNote(mine[0]) : null;
  },
  async removeOwned(id, userId) {
    const rows = await db(`?note_id=eq.${id}&owner_id=eq.${userId}&select=note_id,owner_id`, {
      method: 'DELETE', prefer: 'return=representation',
    });
    return owned(rows, userId).length > 0;
  },
};

// 강사 권한: 화면 메뉴나 요청 본문이 아니라 DB(vault_staff)에 저장된 값만 봅니다.
export async function isInstructor(userId) {
  const rows = await db(`?select=user_id,role&user_id=eq.${userId}&role=eq.instructor&limit=1`, { table: 'vault_staff' });
  return rows.some(row => row.user_id === userId && row.role === 'instructor');
}

const NOTICE_SELECT = 'select=notice_id,title,content';
const toNotice = row => ({ id: row.notice_id, title: row.title, body: row.content });

export const notices = {
  async list() {
    return (await db(`?${NOTICE_SELECT}&order=id.asc&limit=50`, { table: 'vault_notices' })).map(toNotice);
  },
  async get(id) {
    const rows = await db(`?${NOTICE_SELECT}&notice_id=eq.${id}&limit=1`, { table: 'vault_notices' });
    return rows[0] ? toNotice(rows[0]) : null;
  },
  async update(id, userId, notice) {
    const patch = { updated_by: userId, updated_at: new Date().toISOString() };
    if (notice.title !== undefined) patch.title = notice.title;
    if (notice.body !== undefined) patch.content = notice.body;
    const rows = await db(`?notice_id=eq.${id}&${NOTICE_SELECT}`, {
      table: 'vault_notices', method: 'PATCH', prefer: 'return=representation', body: patch,
    });
    return rows[0] ? toNotice(rows[0]) : null;
  },
};

// ── 11단계: 기기 승인 ────────────────────────────────────────
// 브라우저의 기기 비밀값(HttpOnly 쿠키)의 sha256만 서버 DB(vault_devices)에 둡니다.
// 상태(pending·approved·revoked)는 서버만 바꿉니다. 화면의 버튼은 "요청"만 할 수 있습니다.
const DEVICE_SECRET = /^[A-Za-z0-9_-]{43}$/u;
export const deviceHashOf = secret => createHash('sha256').update(`aleph-device:${secret}`, 'utf8').digest('hex');
export const deviceCodeOf = hash => `${hash.slice(0, 4)}-${hash.slice(4, 8)}`.toUpperCase();
export const DEVICE_CODE = /^[0-9A-F]{4}-[0-9A-F]{4}$/u;

export function deviceSecretOf(request) {
  const secret = readCookies(request)[DEVICE_COOKIE];
  return typeof secret === 'string' && DEVICE_SECRET.test(secret) ? secret : null;
}

export async function deviceState(request, owner) {
  const secret = deviceSecretOf(request);
  if (!secret) return { status: 'none', code: null, deviceId: null };
  const hash = deviceHashOf(secret);
  const rows = await db(`?select=status,device_code&device_hash=eq.${hash}&owner_id=eq.${owner}&limit=1`, { table: 'vault_devices' });
  return { status: rows[0]?.status ?? 'none', code: rows[0]?.device_code ?? deviceCodeOf(hash), deviceId: hash.slice(0, 16) };
}

// 승인 요청: 기기 비밀값이 없으면 새로 만들어 HttpOnly 쿠키로만 내려 주고, 대기(pending)로 등록합니다.
export async function requestDevice(request, response, owner) {
  let secret = deviceSecretOf(request);
  if (!secret) {
    secret = randomBytes(32).toString('base64url');
    setCookie(response, DEVICE_COOKIE, secret, 365 * 24 * 60 * 60);
  }
  const hash = deviceHashOf(secret);
  const code = deviceCodeOf(hash);
  const rows = await db(`?select=status,device_code&device_hash=eq.${hash}&owner_id=eq.${owner}&limit=1`, { table: 'vault_devices' });
  if (!rows[0]) {
    await db('', { table: 'vault_devices', method: 'POST',
      body: { device_hash: hash, owner_id: owner, device_code: code, status: 'pending' } });
    await audit('device_request', `device:${code}`, owner, {});
    return { status: 'pending', code, deviceId: hash.slice(0, 16) };
  }
  return { status: rows[0].status, code: rows[0].device_code, deviceId: hash.slice(0, 16) };
}

// 다른 기기 승인: 이미 승인된 기기에서, 같은 사용자의 대기 중인 기기 코드 한 건만 승인합니다.
export async function approveDevice(owner, code, approverCode) {
  const rows = await db(`?device_code=eq.${code}&owner_id=eq.${owner}&status=eq.pending&select=device_code,status`, {
    table: 'vault_devices', method: 'PATCH', prefer: 'return=representation',
    body: { status: 'approved', approved_at: new Date().toISOString(), approved_via: `device:${approverCode}` } });
  if (rows.length) await audit('device_approve', `device:${code}`, owner, { via: `device:${approverCode}` });
  return rows.length > 0;
}

export function dbFailure(response, error) {
  if (error?.status === 409) return send(response, 409, { error: 'ID_CONFLICT', message: '이미 있는 id입니다.' });
  if (error?.status === 500 && error.message === 'config') {
    return send(response, 500, { error: 'SERVER_NOT_CONFIGURED', message: '서버 설정을 확인해 주세요.' });
  }
  return send(response, 502, { error: 'NOTES_UNAVAILABLE', message: '자료 저장소에 연결하지 못했습니다.' });
}
