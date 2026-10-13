// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
// 계약: docs/DECIDER_REQUEST.md (aleph.decision.v1) — 계약에 있는 값만 씁니다.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered']);

const READ_METHODS = new Set(['GET', 'HEAD']);

const respond = (request, decision, reasonCode, ruleId) => ({
  schema: 'aleph.decision.v1',
  requestId: request?.requestId,
  decision,
  reasonCode,
  ruleIds: [ruleId],
});

export async function decide(request) {
  // 6단계 device_registered: 엔진이 확인한 기기 등록 여부가 정확히 true일 때만 다음으로 넘어갑니다.
  // 미등록(false)이거나 값이 없으면(그 밖의 모든 값 포함) 거부합니다.
  if (request?.deviceRegistered !== true) {
    return respond(request, 'deny', 'device_not_registered', 'device_registered');
  }

  // 등록 기기의 내 자료실 읽기(GET·HEAD)만 허용합니다.
  if (READ_METHODS.has(request.method)) {
    return respond(request, 'allow', 'approved', 'device_registered');
  }

  // 그 밖의 요청은 시작 틀의 기본 거부를 그대로 따릅니다.
  return respond(request, 'deny', 'starter_not_ready', 'starter.deny');
}
