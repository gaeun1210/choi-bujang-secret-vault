// GET /api/notices → 강사 공지 목록 [{id,title,body}] (로그인한 사용자 누구나 읽기)
// 구역: notices, 자원 ID notice:<UUID>. 메모 구역(/api/notes)과 섞이지 않습니다.
import { dbFailure, notices, requireUser, send } from '../../src/notes-api.mjs';

export default async function handler(request, response) {
  if ((request.method ?? 'GET') !== 'GET') {
    response.setHeader('Allow', 'GET');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: '공지 목록은 GET만 됩니다.' });
  }
  const userId = await requireUser(request, response);
  if (!userId) return undefined;
  try {
    return send(response, 200, await notices.list());
  } catch (error) {
    return dbFailure(response, error);
  }
}
