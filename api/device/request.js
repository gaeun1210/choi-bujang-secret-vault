// POST /api/device/request → 이 기기를 승인 "요청"(pending)으로 등록하고 상태를 돌려줍니다.
// 이 요청만으로는 승인되지 않습니다. 승인은 서버 DB에서만(첫 기기는 SQL Editor, 그다음은 승인된 다른 기기에서) 합니다.
import { dbFailure, requestDevice, requireLogin, send } from '../../src/notes-api.mjs';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'POST만 됩니다.' });
  }
  const session = await requireLogin(request, response);
  if (!session) return undefined;
  if (session.login.kind !== 'student') {
    return send(response, 200, { status: 'engine_verified', code: null, message: '심판 요청의 기기는 반 엔진이 확인합니다.' });
  }
  try {
    return send(response, 200, await requestDevice(request, response, session.owner));
  } catch (error) {
    return dbFailure(response, error);
  }
}
