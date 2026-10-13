// 보너스 xdr-06: ZTNA 판정기에 꽂는 "확인 단계 하나" 부품 — 유출 목적지를 막습니다.
// src/decider.mjs의 기존 규칙(RULE_IDS)은 고치지 않습니다. 판정기는 자기 규칙을 먼저 보고,
// 목적지 주소를 아는 연결 지점(respond.mjs 등)에서만 이 부품을 한 번 더 불러 차단 여부를 확인합니다.
// (현재 판정기 요청 계약 aleph.decision.v1에는 목적지 주소 칸이 없어서, 계약에 없는 값을 지어내지 않습니다.)
import { readFileSync } from 'node:fs';

export const RULE_ID = 'xdr_exfiltration_destination_block';
export const REASON_CODE = 'exfiltration_destination_blocked';
const RULES_FILE = new URL('./deny-rules.json', import.meta.url);

export function loadDenyRules(path = RULES_FILE) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(data?.rules) ? data.rules : [];
  } catch {
    return [];
  }
}

// { dstip, at } → 막아야 하면 { decision:'deny', reasonCode, ruleIds, evidenceAlertIds, expiresAt }, 아니면 null(통과)
export function checkDestination({ dstip, at = new Date().toISOString() } = {}, rules = loadDenyRules()) {
  if (typeof dstip !== 'string' || !dstip) return null;
  const now = Date.parse(at);
  const hit = rules.find(rule => rule.dstip === dstip
    && Number.isFinite(now) && now < Date.parse(rule.expiresAt) && now >= Date.parse(rule.createdAt));
  if (!hit) return null;
  return { decision: 'deny', reasonCode: REASON_CODE, ruleIds: [RULE_ID],
    evidenceAlertIds: hit.evidenceAlertIds, expiresAt: hit.expiresAt };
}
