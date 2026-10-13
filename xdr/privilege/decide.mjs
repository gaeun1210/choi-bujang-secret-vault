// 보너스 xdr-05 판단 모듈 — 심판은 인터넷 없이 이 파일 하나만 불러 경보마다 decide(alert)를 부릅니다.
// 그래서 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않습니다.
// 반환: { action: 'block' | 'alert' | 'record', confidence(0~1), reason(근거 패턴 이름 한 줄) }
// confidence = 경보가 패턴과 얼마나 뚜렷하게 맞는지. 0.85 이상 block · 0.5 이상 alert · 그 아래 record.

// xdr/privilege/patterns.json 의 패턴을 그대로 옮긴 상수 (근거: MITRE ATT&CK T1068, T1078)
const TECHNIQUES = Object.freeze(['T1068', 'T1078']);
const CLEAR_MIN_LEVEL = 10;
const WEAK_MIN_LEVEL = 5;
const PATTERNS = Object.freeze({
  adminGroupAdd: Object.freeze({
    id: 't1078_admin_group_add', name: '관리자 그룹 추가', weight: 0.3,
    group: 'administrators',
    keywords: Object.freeze(['관리자 그룹에 추가', '관리자 그룹에 들어가', '관리자로 들어왔', '관리자 그룹 추가']),
    notWhen: Object.freeze(['관리자 그룹은 아닙니다']),
  }),
  adminCommand: Object.freeze({
    id: 't1068_unfamiliar_admin_command', name: '처음 보는 관리자 명령', weight: 0.25,
    keywords: Object.freeze(['관리자 명령을 실행', '권한 명령을 실행', '명령 실행', '관리자 권한으로 바뀌']),
  }),
  unusual: Object.freeze({
    id: 't1068_t1078_unusual_time_or_source', name: '업무 시간 밖·처음 보는 곳의 권한 사용', weight: 0.2,
    keywords: Object.freeze(['수업 시간 밖', '업무처럼 보이지 않는 시각', '처음 보는', '처음 봅니다', '원격 주소', '곧바로', '방금 관리자가 된', '다른 계정의 권한']),
  }),
  weak: Object.freeze({ id: 't1068_t1078_weak_privilege_event', name: '확인이 필요한 약한 권한 변경' }),
});

const asText = value => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
const round = value => Math.round(Math.min(0.99, Math.max(0, value)) * 100) / 100;
const actionOf = confidence => (confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record');

export function decide(alert) {
  const data = alert && typeof alert.data === 'object' && alert.data ? alert.data : {};
  const rule = alert && typeof alert.rule === 'object' && alert.rule ? alert.rule : {};
  const level = Number.isFinite(Number(rule.level)) ? Number(rule.level) : 0;
  const mitre = Array.isArray(rule.mitre) ? rule.mitre.map(asText) : [];
  const description = asText(rule.description);
  const group = asText(data.group).toLowerCase();
  const repeats = Number.parseInt(asText(data.count), 10) || 1;
  const techniques = TECHNIQUES.filter(id => mitre.includes(id));

  // 권한 관련 기법 표시가 없는 경보: 정상 활동(로그인·조회·로그아웃 등)
  if (!techniques.length) {
    return { action: 'record', confidence: 0.05, reason: '권한 상승 신호 없음(정상 이벤트)' };
  }

  const hits = [];
  let strong = 0;
  const groupNegated = PATTERNS.adminGroupAdd.notWhen.some(word => description.includes(word));
  if (!groupNegated && (group === PATTERNS.adminGroupAdd.group
      || PATTERNS.adminGroupAdd.keywords.some(word => description.includes(word)))) {
    strong += PATTERNS.adminGroupAdd.weight; hits.push(PATTERNS.adminGroupAdd.name);
  }
  if (PATTERNS.adminCommand.keywords.some(word => description.includes(word))) {
    strong += PATTERNS.adminCommand.weight; hits.push(PATTERNS.adminCommand.name);
  }
  if (PATTERNS.unusual.keywords.some(word => description.includes(word))) {
    strong += PATTERNS.unusual.weight; hits.push(PATTERNS.unusual.name);
  }
  if (repeats >= 2) strong += 0.1;                       // 반복(여러 계정·다시 들어옴)
  if (techniques.length === 2) strong += 0.1;            // 권한 상승 악용 + 정상 계정 도용 함께

  // 1) 명확한 권한 가로채기: 강한 신호 + 높은 규칙 수준 → 세션 회수 후보
  if (strong >= 0.3 && level >= CLEAR_MIN_LEVEL) {
    const confidence = round(0.7 + strong * 0.5);
    return { action: actionOf(confidence), confidence, reason: `${hits.join(' + ')} (${techniques.join('·')})` };
  }
  // 2) 권한 관련이지만 신호가 약함: 알림만
  if (level >= WEAK_MIN_LEVEL) {
    const confidence = round(0.5 + (strong > 0 ? 0.1 : 0) + (level >= 7 ? 0.05 : 0));
    return { action: actionOf(confidence), confidence, reason: `${PATTERNS.weak.name} (${techniques.join('·')}) — 확인 필요` };
  }
  // 3) 낮은 수준의 권한 경보: 기록만
  return { action: 'record', confidence: 0.2, reason: '권한 상승 신호 없음(정상 이벤트)' };
}
