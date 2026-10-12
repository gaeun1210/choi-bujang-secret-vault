// 보너스 xdr-01 판단 모듈 — 심판은 인터넷 없이 이 파일 하나만 불러 경보마다 decide(alert)를 부릅니다.
// 그래서 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않습니다.
// 반환: { action: 'block' | 'alert' | 'record', confidence(0~1), reason(근거 패턴 이름 한 줄) }
// confidence = 경보가 패턴과 얼마나 뚜렷하게 맞는지. 0.85 이상 block · 0.5 이상 alert · 그 아래 record.

// xdr/brute-force/patterns.json 의 패턴을 그대로 옮긴 상수 (근거: MITRE ATT&CK T1110)
const PATTERNS = Object.freeze([
  Object.freeze({
    id: 't1110_rapid_failures_same_source',
    name: '짧은 시간 같은 주소의 로그인 실패 연속',
    technique: 'T1110.001',
    condition: Object.freeze({ mitre: 'T1110', minLevel: 10, minFailures: 15 }),
    evidence: 'MITRE ATT&CK T1110.001(비밀번호 추측): 공격자가 비밀번호를 반복해 넣어 보므로 짧은 시간에 같은 출발지의 로그인 실패가 연속으로 쌓인다.',
  }),
  Object.freeze({
    id: 't1110_password_spraying',
    name: '여러 계정에 같은 비밀번호 대입',
    technique: 'T1110.003',
    condition: Object.freeze({
      mitre: 'T1110', minLevel: 10, minAccounts: 5, minFailures: 10,
      keywords: Object.freeze(['여러 계정', '서로 다른 계정', '계정 이름을 바꿔', '같은 비밀번호']),
    }),
    evidence: 'MITRE ATT&CK T1110.003(패스워드 스프레이): 계정 잠금을 피하려고 흔한 비밀번호 하나를 여러 계정에 차례로 넣어 본다.',
  }),
]);
const [RAPID, SPRAY] = PATTERNS;

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;

const round = value => Math.round(value * 100) / 100;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const toInt = value => {
  const number = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
};

function actionFor(confidence) {
  if (confidence >= BLOCK_AT) return 'block';
  if (confidence >= ALERT_AT) return 'alert';
  return 'record';
}

// 경보에서 판단에 필요한 값만 꺼냅니다 (원본은 바꾸지 않음)
function facts(alert) {
  const rule = alert && typeof alert === 'object' ? alert.rule ?? {} : {};
  const data = alert && typeof alert === 'object' ? alert.data ?? {} : {};
  const accounts = typeof data.accounts === 'string'
    ? data.accounts.split(',').map(item => item.trim()).filter(Boolean).length
    : 0;
  return {
    t1110: Array.isArray(rule.mitre) && rule.mitre.includes('T1110'),
    level: toInt(rule.level),
    failures: toInt(data.count),
    accounts,
    description: typeof rule.description === 'string' ? rule.description : '',
  };
}

function matchesRapid(f) {
  const c = RAPID.condition;
  return f.t1110 && f.level >= c.minLevel && f.failures >= c.minFailures;
}

function matchesSpray(f) {
  const c = SPRAY.condition;
  if (!f.t1110 || f.level < c.minLevel) return false;
  if (f.accounts >= c.minAccounts) return true;
  const said = c.keywords.some(word => f.description.includes(word)) || /계정\s*\d+\s*개/u.test(f.description);
  return said && f.failures >= c.minFailures;
}

export function decide(alert) {
  const f = facts(alert);

  // 1) 패턴 조건을 그대로 만족 → 뚜렷함. 수준·실패 수가 클수록 확신도 상승 (0.86~0.99)
  const rapid = matchesRapid(f);
  const spray = matchesSpray(f);
  if (rapid || spray) {
    const names = [rapid && RAPID.name, spray && SPRAY.name].filter(Boolean).join(' + ');
    const confidence = round(clamp(0.86 + (f.level - 10) * 0.02 + Math.min(f.failures, 100) / 1000
      + (rapid && spray ? 0.02 : 0), BLOCK_AT, 0.99));
    return { action: actionFor(confidence), confidence, reason: `근거 패턴: ${names} (T1110)` };
  }

  // 2) T1110 표시는 있지만 기준 미달 → 일부만 맞음. 실패 수에 따라 0.5~0.75 (알림만, 차단 안 함)
  if (f.t1110) {
    const confidence = round(clamp(ALERT_AT + Math.min(f.failures, 14) / 14 * 0.25, ALERT_AT, 0.75));
    return { action: actionFor(confidence), confidence,
      reason: `근거 패턴: ${RAPID.name} 일부 일치(실패 ${f.failures}건, 기준 ${RAPID.condition.minFailures}건 미달)` };
  }

  // 3) T1110 표시가 없음 → 패턴과 맞지 않음. 수준이 높으면 사람이 보도록 알림, 낮으면 기록
  if (f.level >= 7) {
    return { action: 'alert', confidence: ALERT_AT, reason: '근거 패턴: 없음 (T1110 표시 없음, 경보 수준이 높아 확인 필요)' };
  }
  return { action: 'record', confidence: 0.05, reason: '근거 패턴: 없음 (로그인 실패 연속·여러 계정 대입 신호 없음, 정상 이벤트)' };
}
