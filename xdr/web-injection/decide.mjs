// 보너스 xdr-02 판단 모듈 — 심판은 인터넷 없이 이 파일 하나만 불러 경보마다 decide(alert)를 부릅니다.
// 그래서 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않습니다.
// 반환: { action: 'block' | 'alert' | 'record', confidence(0~1), reason(근거 패턴 이름 한 줄) }
// confidence = 경보가 패턴과 얼마나 뚜렷하게 맞는지. 0.85 이상 block · 0.5 이상 alert · 그 아래 record.

// xdr/web-injection/patterns.json 의 패턴을 그대로 옮긴 상수 (근거: MITRE ATT&CK T1190)
const CLEAR_WHEN = Object.freeze({ mitre: 'T1190', minLevel: 10, minRepeats: 5 });
const PATTERNS = Object.freeze([
  Object.freeze({
    id: 't1190_sql_in_parameter',
    name: '요청 인자 안의 SQL 구문',
    markers: Object.freeze(['doc-sql-', 'doc-mixed-marker', "' or 1=1", 'union select', '; drop ']),
    regex: /\bselect\b.+\bfrom\b/u,
    descriptionKeywords: Object.freeze(['SQL 구문', 'SQL 표식', '데이터베이스 조회']),
    evidence: 'MITRE ATT&CK T1190: 공격자는 공개된 웹 앱의 입력을 이용해 SQL 주입으로 데이터베이스 명령을 실행한다(무브잇 CVE-2023-34362가 이 형태).',
  }),
  Object.freeze({
    id: 't1190_script_tag_in_parameter',
    name: '요청 인자 안의 스크립트 태그',
    markers: Object.freeze(['doc-script-', 'doc-mixed-marker', '<script', '%3cscript', 'javascript:', 'onerror=']),
    regex: null,
    descriptionKeywords: Object.freeze(['스크립트 삽입 표기', '스크립트 표식']),
    evidence: 'MITRE ATT&CK T1190: 공개 웹 앱의 입력 검증 약점을 노린 주입 공격에는 인자에 스크립트를 끼워 넣는 형태(OWASP Top 10 Injection·XSS)가 포함된다.',
  }),
  Object.freeze({
    id: 't1190_path_traversal_repeat',
    name: '경로 거슬러 올라가기(../) 반복',
    markers: Object.freeze(['doc-up-repeat', '../../', '..%2f..%2f', '%2e%2e%2f%2e%2e%2f']),
    regex: null,
    descriptionKeywords: Object.freeze(['거슬러 올라가는 표기', '경로 이탈 표기']),
    evidence: 'MITRE ATT&CK T1190: 공개 웹 앱의 파일 경로 처리 약점을 노려 ../ 를 반복해 허용된 폴더 밖 파일을 읽는다(경로 이탈, CWE-22).',
  }),
  Object.freeze({
    id: 't1190_command_separator_in_parameter',
    name: '요청 인자 안의 명령 구분자',
    markers: Object.freeze(['doc-cmd-separator', '; cat ', '| id', '&& whoami', '$(']),
    regex: null,
    descriptionKeywords: Object.freeze(['명령 구분자 표기']),
    evidence: 'MITRE ATT&CK T1190: 공개 웹 앱의 입력이 서버 명령에 섞이도록 구분자를 넣는 명령 주입(OWASP Top 10 Injection)으로 서버에서 명령을 실행한다.',
  }),
]);

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

// 요청 주소는 한 번 풀어 소문자로 비교합니다 (%27 → ' 등). 풀 수 없으면 그대로.
function normalizeUrl(raw) {
  const text = typeof raw === 'string' ? raw.slice(0, 2000) : '';
  let decoded = text;
  try { decoded = decodeURIComponent(text.replaceAll('+', ' ')); } catch { /* 그대로 */ }
  return `${text} ${decoded}`.toLowerCase();
}

function facts(alert) {
  const rule = alert && typeof alert === 'object' ? alert.rule ?? {} : {};
  const data = alert && typeof alert === 'object' ? alert.data ?? {} : {};
  return {
    t1190: Array.isArray(rule.mitre) && rule.mitre.includes(CLEAR_WHEN.mitre),
    level: toInt(rule.level),
    repeats: toInt(data.count),
    url: normalizeUrl(data.url),
    description: typeof rule.description === 'string' ? rule.description : '',
  };
}

// 인자 표식 또는 경보 설명의 핵심 표현으로 맞는 패턴들
function matchedPatterns(f) {
  return PATTERNS.filter(pattern => pattern.markers.some(marker => f.url.includes(marker))
    || (pattern.regex !== null && pattern.regex.test(f.url))
    || pattern.descriptionKeywords.some(word => f.description.includes(word)));
}

export function decide(alert) {
  const f = facts(alert);
  const matched = matchedPatterns(f);
  const names = matched.map(pattern => pattern.name).join(' + ');

  // 1) 같은 주소에서 반복된 명확한 주입: T1190 + 수준 10 이상 + 5번 이상 반복 + 패턴 일치 → 0.86~0.99
  if (f.t1190 && matched.length && f.level >= CLEAR_WHEN.minLevel && f.repeats >= CLEAR_WHEN.minRepeats) {
    const confidence = round(clamp(0.86 + (f.level - 10) * 0.02 + Math.min(f.repeats, 20) / 200
      + (matched.length > 1 ? 0.02 : 0), BLOCK_AT, 0.99));
    return { action: actionFor(confidence), confidence, reason: `근거 패턴: ${names} (T1190, ${f.repeats}번 반복)` };
  }

  // 2) T1190 표시는 있지만 반복이 없거나 표식이 약함 → 일부만 맞음. 0.5~0.75 (알림만, 차단 안 함)
  if (f.t1190) {
    const confidence = round(clamp(ALERT_AT + Math.max(0, f.level - 5) * 0.03 + (matched.length ? 0.1 : 0)
      + Math.min(f.repeats, 4) * 0.01, ALERT_AT, 0.75));
    const what = matched.length ? `${names} 일부 일치` : '주입 표식 불분명';
    return { action: actionFor(confidence), confidence,
      reason: `근거 패턴: ${what} (T1190 표시, ${f.repeats}번·반복 기준 ${CLEAR_WHEN.minRepeats}번 미달)` };
  }

  // 3) T1190 표시가 없음 → 주입 패턴 신호 없음. 수준이 높거나 표식이 보이면 알림, 아니면 기록
  if (matched.length || f.level >= 7) {
    return { action: 'alert', confidence: ALERT_AT,
      reason: `근거 패턴: ${matched.length ? names : '없음'} (T1190 표시 없음, 확인 필요)` };
  }
  return { action: 'record', confidence: 0.05, reason: '근거 패턴: 없음 (SQL·스크립트·경로 이탈·명령 구분자 신호 없음, 정상 이벤트)' };
}
