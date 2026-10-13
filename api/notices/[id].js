// GET /api/notices/:id → {id,title,body} (로그인한 사용자 누구나)
// PUT /api/notices/:id {title,body} → DB(vault_staff)에 강사로 저장된 사용자만. 그 밖에는 403.
// 화면 메뉴·요청 본문의 role은 믿지 않습니다. 거부 사유는 서버 기록에 짧게 남깁니다.
import { UUID, claimedRole, cleanNote, dbFailure, isInstructor, logDenial, notices, readBody, requireUser,
  resourceId, send } from '../../src/notes-api.mjs';

const notFound = response => send(response, 404, { error: 'NOT_FOUND', message: '공지가 없습니다.' });

export default async function handler(request, response) {
  const method = request.method ?? 'GET';
  if (!['GET', 'PUT'].includes(method)) {
    response.setHeader('Allow', 'GET, PUT');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: '공지는 GET, PUT만 됩니다.' });
  }
  const userId = await requireUser(request, response);
  if (!userId) return undefined;

  const raw = request.query?.id;
  const id = typeof raw === 'string' && UUID.test(raw) ? raw.toLowerCase() : null;

  // 공지 수정은 어떤 ID를 보내든 먼저 DB의 강사 권한부터 확인합니다(학생은 항상 403).
  if (method === 'PUT') {
    try {
      if (!(await isInstructor(userId))) {
        logDenial('instructor_only', id ? resourceId('notice', id) : 'notice:?', userId);
        return send(response, 403, { error: 'INSTRUCTOR_ONLY', message: '강사만 공지를 고칠 수 있습니다.' });
      }
    } catch (error) {
      return dbFailure(response, error);
    }
  }

  if (!id) {
    logDenial('invalid_resource_id', 'notice:?', userId);
    return notFound(response);
  }
  const resource = resourceId('notice', id);

  try {
    if (method === 'GET') {
      const notice = await notices.get(id);
      return notice ? send(response, 200, notice) : notFound(response);
    }
    const input = readBody(request);
    if (!input) return send(response, 400, { error: 'INVALID_JSON', message: 'JSON 객체를 보내 주세요.' });
    if (claimedRole(input)) logDenial('body_role_ignored', resource, userId);
    const notice = cleanNote(input, { partial: true });
    if (notice.error) return send(response, 400, { error: 'INVALID_NOTICE', message: notice.error });
    const updated = await notices.update(id, userId, notice.value);
    return updated ? send(response, 200, updated) : notFound(response);
  } catch (error) {
    return dbFailure(response, error);
  }
}
