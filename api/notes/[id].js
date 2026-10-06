// GET /api/notes/:id → {id,title,body} · PUT /api/notes/:id → 수정 · DELETE /api/notes/:id → 삭제
// 4단계: 확인된 사용자 ID와 DB의 owner_id가 같은 메모만 읽기·수정·삭제합니다. 남의 메모는 404로 거부.
import { UUID, cleanNote, dbFailure, notes, ownerMismatch, readBody, requireUser, send } from '../../src/notes-api.mjs';

const notFound = response => send(response, 404, { error: 'NOT_FOUND', message: '메모가 없습니다.' });

export default async function handler(request, response) {
  const method = request.method ?? 'GET';
  if (!['GET', 'PUT', 'DELETE'].includes(method)) {
    response.setHeader('Allow', 'GET, PUT, DELETE');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'GET, PUT, DELETE만 됩니다.' });
  }
  const userId = await requireUser(request, response);
  if (!userId) return undefined;

  const raw = request.query?.id;
  const id = typeof raw === 'string' && UUID.test(raw) ? raw.toLowerCase() : null;
  if (!id) return notFound(response);

  try {
    if (method === 'GET') {
      const note = await notes.getOwned(id, userId);
      return note ? send(response, 200, note) : notFound(response);
    }
    if (method === 'PUT') {
      const input = readBody(request);
      if (!input) return send(response, 400, { error: 'INVALID_JSON', message: 'JSON 객체를 보내 주세요.' });
      if (ownerMismatch(input, userId)) {
        return send(response, 403, { error: 'OWNER_CHANGE_FORBIDDEN', message: '메모 소유자는 바꿀 수 없습니다.' });
      }
      const note = cleanNote(input, { partial: true });
      if (note.error) return send(response, 400, { error: 'INVALID_NOTE', message: note.error });
      const updated = await notes.updateOwned(id, userId, note.value);
      return updated ? send(response, 200, updated) : notFound(response);
    }
    const removed = await notes.removeOwned(id, userId);
    return removed ? send(response, 200, { id, deleted: true }) : notFound(response);
  } catch (error) {
    return dbFailure(response, error);
  }
}
