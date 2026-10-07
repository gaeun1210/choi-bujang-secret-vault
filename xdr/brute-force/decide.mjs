// 보너스 xdr-01 판단 모듈: 경보를 T1110 패턴과 맞춰 보고, 애매한 건만 Jev에게 확신도를 묻습니다.
// 반환: { action: 'block' | 'alert' | 'record', confidence(0~1), reason(근거 패턴 이름 한 줄) }
// 기준: 확신도 0.85 이상 block · 0.5 이상 alert · 그 아래 record. Jev가 응답하지 않으면 alert.
import { readFileSync } from 'node:fs';
import { extractAlert } from './read-alerts.mjs';

const { patterns } = JSON.parse(readFileSync(new URL('./patterns.json', import.meta.url), 'utf8'));
const RAPID = patterns.find(item => item.id === 't1110_rapid_failures_same_source');
const SPRAY = patterns.find(item => item.id === 't1110_password_spraying');

export const BLOCK_AT = 0.85;
export const ALERT_AT = 0.5;
// 애매한 경보는 Jev 답이 아무리 높아도 차단까지 가지 않습니다 (아주 명확한 경우에만 차단).
const AMBIGUOUS_MAX = 0.84;
const JEV_TIMEOUT_MS = 2500;

const round = value => Math.round(value * 100) / 100;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function actionFor(confidence) {
  if (confidence >= BLOCK_AT) return 'block';
  if (confidence >= ALERT_AT) return 'alert';
  return 'record';
}

function matchesRapid(row) {
  const c = RAPID.condition;
  return row.mitre.includes(c.mitre) && (row.level ?? 0) >= c.minLevel && (row.failures ?? 0) >= c.minFailures;
}

function matchesSpray(row) {
  const c = SPRAY.condition;
  if (!row.mitre.includes(c.mitre) || (row.level ?? 0) < c.minLevel) return false;
  if (row.accountCount >= c.minAccounts) return true;
  const said = c.keywords.some(word => (row.description ?? '').includes(word))
    || /계정\s*\d+\s*개/u.test(row.description ?? '');
  return said && (row.failures ?? 0) >= c.minFailures;
}

// Jev에게 확신도(0~1)를 묻습니다. JEV_URL이 없거나, 늦거나, 형식이 틀리면 null(응답 없음).
// 보내는 값은 경보 요약뿐이며 키·비밀값은 넣지 않습니다.
async function askJev(row) {
  const url = process.env.JEV_URL;
  if (!url || !url.startsWith('https://')) return null;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        question: '이 로그인 실패 경보가 무차별 대입 공격일 확신도를 0~1 숫자로 답해 주세요.',
        alert: { id: row.id, time: row.time, srcip: row.srcip, user: row.user,
          level: row.level, description: row.description, failures: row.failures },
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const value = Number(data?.confidence);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
  } catch {
    return null;
  }
}

export async function decide(alert) {
  const row = extractAlert(alert);

  // 1) 명확한 공격: 패턴 조건을 그대로 만족 → 차단
  const rapid = matchesRapid(row);
  const spray = matchesSpray(row);
  if (rapid || spray) {
    const names = [rapid && RAPID.name, spray && SPRAY.name].filter(Boolean).join(' + ');
    const confidence = round(clamp(0.86 + ((row.level ?? 10) - 10) * 0.02
      + Math.min(row.failures ?? 0, 100) / 1000 + (rapid && spray ? 0.02 : 0), BLOCK_AT, 0.99));
    return { action: 'block', confidence, reason: `패턴 일치: ${names} (T1110)` };
  }

  // 2) 정상 이벤트: T1110 표시가 없고 규칙 수준이 낮음 → 기록만
  if (!row.mitre.includes('T1110') && (row.level ?? 0) <= 4) {
    return { action: 'record', confidence: 0.05, reason: '패턴 불일치: 로그인 실패 연속·여러 계정 대입 신호 없음 (정상 이벤트)' };
  }

  // 3) 애매함: T1110 관련이지만 패턴 기준에 못 미침 → Jev에게 묻기
  const hint = (row.failures ?? 0) > 0 ? `실패 ${row.failures}건` : '실패 수 없음';
  const jev = await askJev(row);
  if (jev === null) {
    const local = round(clamp(ALERT_AT + Math.min(row.failures ?? 0, 14) / 14 * 0.2, ALERT_AT, AMBIGUOUS_MAX));
    return { action: 'alert', confidence: local,
      reason: `애매함: ${RAPID.name} 기준 미달(${hint}) · Jev 응답 없음 → 알림` };
  }
  const confidence = round(clamp(jev, 0, AMBIGUOUS_MAX));
  return { action: actionFor(confidence), confidence,
    reason: `애매함: ${RAPID.name} 기준 미달(${hint}) · Jev 확신도 ${round(jev)}` };
}
