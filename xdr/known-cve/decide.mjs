// 보너스 xdr-03 판단 모듈 — 심판은 인터넷 없이 이 파일 하나만 불러 경보마다 decide(alert)를 부릅니다.
// 그래서 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않습니다.
// 반환: { action: 'block' | 'alert' | 'record', confidence(0~1), reason(근거 패턴 이름 한 줄) }
// confidence = 경보가 패턴과 얼마나 뚜렷하게 맞는지. 0.85 이상 block · 0.5 이상 alert · 그 아래 record.

// xdr/known-cve/patterns.json 의 패턴을 그대로 옮긴 상수 (근거: CVE-2021-44228, MITRE ATT&CK T1190)
const JNDI_LOOKUP = /\$\{\s*jndi\s*:\s*(ldaps?|rmi|dns|iiop|corba|nds|nis|https?)\s*:\/\//iu;
const PATTERNS = Object.freeze({
  header: Object.freeze({
    id: 'cve_2021_44228_jndi_in_header',
    name: '머리글 안의 원격 조회 구문(jndi)',
    evidence: 'CVE-2021-44228: Log4j2 가 기록하는 머리글 값 안의 ${jndi:ldap://…} 조회 구문을 해석해 공격자 서버의 코드를 내려받아 실행한다(NVD).',
  }),
  parameter: Object.freeze({
    id: 'cve_2021_44228_jndi_in_parameter',
    name: '요청 인자 안의 원격 조회 구문(jndi)',
    evidence: 'MITRE ATT&CK T1190: 공개된 웹 앱의 입력(요청 인자)에 알려진 취약점 악용 문자열을 넣어 서버에서 코드를 실행한다 — CVE-2021-44228 이 대표 사례.',
  }),
  scanner: Object.freeze({
    id: 't1190_known_vuln_scanner_trace',
    name: '알려진 취약점 점검 도구의 흔적',
    markers: Object.freeze(['probe=', 'nuclei', 'interactsh', 'zgrab', 'masscan']),
    descriptionKeywords: Object.freeze(['점검 흔적']),
  }),
  weak: Object.freeze({
    id: 'cve_2021_44228_weak_indicator',
    name: '조회 구문 없는 취약점 단서(이름·단어 조각)',
    markers: Object.freeze(['jndi', 'lookup', 'log4j', 'log-library', 'cve-list', 'check']),
    regex: /cve-\d{4}-\d{4,}/iu,
  }),
  ruleTag: Object.freeze({
    id: 't1190_rule_tag_only',
    name: 'T1190 으로 분류된 경보(표식 없음)',
    mitre: 'T1190',
    minLevel: 5,
  }),
});
const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
// 머리글이 아닌 경보 칸(이 칸들은 머리글 값으로 보지 않습니다)
const NON_HEADER_FIELDS = new Set(['url', 'srcip', 'dstip', 'srcuser', 'dstuser', 'count', 'srcport', 'dstport', 'protocol']);

const asText = value => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
const round = value => Math.round(Math.min(0.99, Math.max(0, value)) * 100) / 100;
const actionOf = confidence => (confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record');

// 주소 인자는 %24%7B 처럼 바꿔 적어도 같은 구문으로 보도록 한 번 풀어 봅니다(실패하면 원문).
function decoded(text) {
  try { return decodeURIComponent(text); } catch { return text; }
}

export function decide(alert) {
  const data = alert && typeof alert.data === 'object' && alert.data ? alert.data : {};
  const rule = alert && typeof alert.rule === 'object' && alert.rule ? alert.rule : {};
  const level = Number.isFinite(Number(rule.level)) ? Number(rule.level) : 0;
  const mitre = Array.isArray(rule.mitre) ? rule.mitre.map(asText) : [];
  const description = asText(rule.description);
  const repeats = Number.parseInt(asText(data.count), 10) || 1;

  const url = decoded(asText(data.url));
  const headers = Object.entries(data)
    .filter(([key]) => !NON_HEADER_FIELDS.has(key))
    .map(([, value]) => decoded(asText(value)))
    .filter(Boolean);
  const everything = [url, ...headers].join(' ').toLowerCase();

  const inHeader = headers.some(value => JNDI_LOOKUP.test(value));
  const inParameter = JNDI_LOOKUP.test(url);
  const scannerTrace = PATTERNS.scanner.markers.some(marker => everything.includes(marker))
    || PATTERNS.scanner.descriptionKeywords.some(word => description.includes(word));

  // 1) 완전한 원격 조회 구문: 차단 후보
  if (inHeader || inParameter) {
    let confidence = 0.88;
    if (inHeader && inParameter) confidence += 0.04;   // 머리글과 인자 양쪽
    if (repeats >= 3) confidence += 0.04;              // 같은 주소에서 반복
    if (scannerTrace) confidence += 0.03;              // 점검 도구 흔적 동반
    if (level >= 12) confidence += 0.02;               // 탐지 규칙의 높은 수준
    const names = [inHeader && PATTERNS.header.name, inParameter && PATTERNS.parameter.name,
      scannerTrace && PATTERNS.scanner.name].filter(Boolean);
    confidence = round(confidence);
    return { action: actionOf(confidence), confidence, reason: `${names.join(' + ')} (CVE-2021-44228 · T1190)` };
  }

  // 2) 구문은 없지만 단서가 있음: 알림만(악용 확정 아님)
  const weakHit = PATTERNS.weak.markers.some(marker => everything.includes(marker)) || PATTERNS.weak.regex.test(everything);
  if (weakHit || scannerTrace) {
    const confidence = round(0.6 + (repeats >= 2 ? 0.05 : 0));
    const name = weakHit ? PATTERNS.weak.name : PATTERNS.scanner.name;
    return { action: actionOf(confidence), confidence, reason: `${name} — 조회 구문 없음, 확인 필요` };
  }

  // 3) 탐지 규칙이 T1190 으로 분류했지만 표식 없음: 알림만
  if (mitre.includes(PATTERNS.ruleTag.mitre) && level >= PATTERNS.ruleTag.minLevel) {
    return { action: 'alert', confidence: 0.5, reason: `${PATTERNS.ruleTag.name} — 확인 필요` };
  }

  // 4) 정상: 기록만
  const confidence = mitre.includes(PATTERNS.ruleTag.mitre) ? 0.3 : 0.05;
  return { action: 'record', confidence, reason: '알려진 취약점 표식 없음(정상 이벤트)' };
}
