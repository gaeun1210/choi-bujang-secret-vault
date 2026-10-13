// POST /api/device/approve {code} → 이미 승인된 기기에서만, 같은 사용자의 대기 중인 다른 기기 한 대를 승인합니다.
// 승인되지 않은 기기는 이 요청을 보낼 수 없어서(403) 스스로를 승인할 수 없습니다.
import { DEVICE_CODE, approveDevice, dbFailure, deviceState, logDenial, readBody, requireUser,
  send } from '../../src/notes-api.mjs';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'POST만 됩니다.' });
  }
  const owner = await requireUser(request, response);      // 로그인 + 이 기기 승인 확인
  if (!owner) return undefined;
  const input = readBody(request);
  const code = typeof input?.code === 'string' ? input.code.trim().toUpperCase() : '';
  if (!DEVICE_CODE.test(code)) return send(response, 400, { error: 'INVALID_CODE', message: '기기 코드는 XXXX-XXXX 모양입니다.' });
  try {
    const me = await deviceState(request, owner);
    if (me.status !== 'approved') {
      // 심판 토큰 등 브라우저 기기 쿠키가 없는 요청은 다른 기기를 승인할 수 없습니다.
      await logDenial('approver_not_device', `device:${code}`, owner, request);
      return send(response, 403, { error: 'APPROVER_DEVICE_REQUIRED', message: '승인된 기기의 자료실 화면에서만 승인할 수 있습니다.' });
    }
    if (code === me.code) return send(response, 400, { error: 'ALREADY_THIS_DEVICE', message: '이 기기는 이미 승인되어 있습니다.' });
    const approved = await approveDevice(owner, code, me.code);
    if (!approved) {
      await logDenial('device_code_not_pending', `device:${code}`, owner, request);
      return send(response, 404, { error: 'DEVICE_NOT_FOUND', message: '대기 중인 내 기기 코드가 아닙니다.' });
    }
    return send(response, 200, { approved: true, code });
  } catch (error) {
    return dbFailure(response, error);
  }
}
