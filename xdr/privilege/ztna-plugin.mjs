// 보너스 xdr-05: ZTNA 판정기에 꽂는 "확인 단계 하나" 부품 — 가로챈 계정의 세션을 거둡니다.
// src/decider.mjs의 기존 규칙(RULE_IDS)은 고치지 않습니다. 판정기는 자기 규칙을 먼저 보고,
// 계정·출발 주소를 아는 연결 지점(respond.mjs 등)에서만 이 부품을 한 번 더 불러 회수 여부를 확인합니다.
// (현재 판정기 요청 계약 aleph.decision.v1에는 계정 이름·출발 주소 칸이 없어서, 계약에 없는 값을 지어내지 않습니다.)
// 회수 단위는 "계정 + 공격이 일어난 출발 주소" 세션입니다. 같은 계정이라도 평소 주소의 정상 세션은 통과합니다.
import { readFileSync } from 'node:fs';

export const RULE_ID = 'xdr_privilege_session_revoke';
export const REASON_CODE = 'privilege_session_revoked';
const RULES_FILE = new URL('./deny-rules.json', import.meta.url);

export function loadDenyRules(path = RULES_FILE) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(data?.rules) ? data.rules : [];
  } catch {
    return [];
  }
}

// { user, srcip, at } → 거둬야 하면 { decision:'deny', reasonCode, ruleIds, evidenceAlertIds, expiresAt }, 아니면 null(통과)
export function checkSession({ user, srcip, at = new Date().toISOString() } = {}, rules = loadDenyRules()) {
  if (typeof user !== 'string' || !user || typeof srcip !== 'string' || !srcip) return null;
  const now = Date.parse(at);
  const hit = rules.find(rule => rule.user === user && rule.srcip === srcip
    && Number.isFinite(now) && now < Date.parse(rule.expiresAt) && now >= Date.parse(rule.createdAt));
  if (!hit) return null;
  return { decision: 'deny', reasonCode: REASON_CODE, ruleIds: [RULE_ID],
    evidenceAlertIds: hit.evidenceAlertIds, expiresAt: hit.expiresAt };
}
