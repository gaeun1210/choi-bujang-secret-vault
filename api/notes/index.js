// GET /api/notes  → 로그인 사용자의 가상 메모 배열 [{id,title,body}]
// POST /api/notes → {id?,title,body} 추가, owner_id는 서버가 확인한 사용자 ID. 201 {id}
import { cleanNote, dbFailure, newNoteId, notes, readBody, requireUser, send } from '../../src/notes-api.mjs';

export default async function handler(request, response) {
  const method = request.method ?? 'GET';
  if (method !== 'GET' && method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'GET 또는 POST만 됩니다.' });
  }
  const userId = await requireUser(request, response);
  if (!userId) return undefined;

  try {
    if (method === 'GET') return send(response, 200, await notes.listOwned(userId));

    const input = readBody(request);
    if (!input) return send(response, 400, { error: 'INVALID_JSON', message: 'JSON 객체를 보내 주세요.' });
    const id = newNoteId(input);
    if (id.error) return send(response, 400, { error: 'INVALID_ID', message: id.error });
    const note = cleanNote(input);
    if (note.error) return send(response, 400, { error: 'INVALID_NOTE', message: note.error });
    const created = await notes.create(id.value, userId, note.value);
    return send(response, 201, { id: created.id });
  } catch (error) {
    return dbFailure(response, error);
  }
}
