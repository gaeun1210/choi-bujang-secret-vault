// 보너스 xdr-06 판단 모듈 — 심판은 인터넷 없이 이 파일 하나만 불러 경보마다 decide(alert)를 부릅니다.
// 그래서 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않습니다.
// 반환: { action: 'block' | 'alert' | 'record', confidence(0~1), reason(근거 패턴 이름 한 줄) }
// confidence = 경보가 패턴과 얼마나 뚜렷하게 맞는지. 0.85 이상 block · 0.5 이상 alert · 그 아래 record.

// xdr/exfiltration/patterns.json 의 패턴을 그대로 옮긴 상수 (근거: MITRE ATT&CK T1041, T1048)
const TECHNIQUES = Object.freeze(['T1041', 'T1048']);
const CLEAR_MIN_LEVEL = 10;
const WEAK_MIN_LEVEL = 5;
const BULK_BYTES = 50000000;     // 50MB
const MANY_FILES = 50;
const MANY_REPEATS = 5;
const PATTERNS = Object.freeze({
  newDestination: Object.freeze({
    id: 't1048_t1041_bulk_to_new_destination', name: '처음 보는 목적지로 대용량 전송', weight: 0.2,
    keywords: Object.freeze(['처음 보는', '처음 봅니다', '외부 주소', '평소에 쓰지 않던']),
  }),
  repeatedOrMany: Object.freeze({
    id: 't1041_repeated_or_many_files', name: '같은 목적지로 반복·다량 파일 전송', weight: 0.15,
    keywords: Object.freeze(['반복', '명령 통로', '전체']),
  }),
  offHoursArchive: Object.freeze({
    id: 't1048_off_hours_archive', name: '업무 시간 밖 압축 파일 반출', weight: 0.15,
    keywords: Object.freeze(['수업 시간 밖', '업무 시간 밖', '압축 파일']),
  }),
  weak: Object.freeze({ id: 't1041_t1048_weak_transfer', name: '확인이 필요한 작은 외부 전송' }),
});

const asText = value => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
const asNumber = value => { const number = Number(asText(value)); return Number.isFinite(number) && number >= 0 ? number : 0; };
const round = value => Math.round(Math.min(0.99, Math.max(0, value)) * 100) / 100;
const actionOf = confidence => (confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record');

export function decide(alert) {
  const data = alert && typeof alert.data === 'object' && alert.data ? alert.data : {};
  const rule = alert && typeof alert.rule === 'object' && alert.rule ? alert.rule : {};
  const level = Number.isFinite(Number(rule.level)) ? Number(rule.level) : 0;
  const mitre = Array.isArray(rule.mitre) ? rule.mitre.map(asText) : [];
  const description = asText(rule.description);
  const bytes = asNumber(data.bytes);
  const files = asNumber(data.files);
  const repeats = asNumber(data.count);
  const techniques = TECHNIQUES.filter(id => mitre.includes(id));

  // 유출 기법 표시가 없는 경보: 정상 활동(자료실과의 작은 주고받기)
  if (!techniques.length) {
    return { action: 'record', confidence: 0.05, reason: '외부 유출 신호 없음(정상 이벤트)' };
  }

  const hits = [];
  let strong = 0;
  const bulk = bytes >= BULK_BYTES;
  if (bulk) strong += 0.3;                                  // 대용량
  if (PATTERNS.newDestination.keywords.some(word => description.includes(word))) {
    strong += PATTERNS.newDestination.weight; hits.push(PATTERNS.newDestination.name);
  }
  const repeatedOrMany = files >= MANY_FILES || repeats >= MANY_REPEATS
    || PATTERNS.repeatedOrMany.keywords.some(word => description.includes(word));
  if (repeatedOrMany) { strong += PATTERNS.repeatedOrMany.weight; hits.push(PATTERNS.repeatedOrMany.name); }
  if (PATTERNS.offHoursArchive.keywords.some(word => description.includes(word))) {
    strong += PATTERNS.offHoursArchive.weight; hits.push(PATTERNS.offHoursArchive.name);
  }

  strong = Math.round(strong * 100) / 100;                  // 0.3 + 0.15 = 0.4499… 같은 소수 오차 제거
  // 1) 명확한 유출: 대용량 + 높은 규칙 수준 + 다른 강한 신호 → 목적지 차단 후보
  if (bulk && level >= CLEAR_MIN_LEVEL && strong >= 0.45) {
    const confidence = round(0.7 + strong * 0.4);
    return { action: actionOf(confidence), confidence,
      reason: `${(hits.length ? hits : [PATTERNS.newDestination.name]).join(' + ')} (${techniques.join('·')}, ${Math.round(bytes / 1000000)}MB)` };
  }
  // 2) 외부 전송이지만 작거나 실패·평소 목적지: 알림만
  if (level >= WEAK_MIN_LEVEL) {
    const confidence = round(0.5 + (hits.length ? 0.1 : 0) + (level >= 7 ? 0.05 : 0));
    return { action: actionOf(confidence), confidence, reason: `${PATTERNS.weak.name} (${techniques.join('·')}) — 확인 필요` };
  }
  // 3) 낮은 수준의 전송 경보(평소 동기화 등): 기록만
  return { action: 'record', confidence: 0.2, reason: '외부 유출 신호 없음(정상 이벤트)' };
}
