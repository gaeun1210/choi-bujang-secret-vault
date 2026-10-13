// 보너스 xdr-04 판단 모듈 — 심판은 인터넷 없이 이 파일 하나만 불러 경보마다 decide(alert)를 부릅니다.
// 그래서 이 파일은 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않습니다.
// 반환: { action: 'block' | 'alert' | 'record', confidence(0~1), reason(근거 패턴 이름 한 줄) }
// confidence = 경보가 패턴과 얼마나 뚜렷하게 맞는지. 0.85 이상 block · 0.5 이상 alert · 그 아래 record.

// xdr/persistence/patterns.json 의 패턴을 그대로 옮긴 상수 (근거: MITRE ATT&CK T1543, T1053)
const MECHANISMS = Object.freeze(['T1543', 'T1053']);
const CLEAR_MIN_LEVEL = 10;
const WEAK_MIN_LEVEL = 5;
const PATTERNS = Object.freeze({
  unsignedService: Object.freeze({
    id: 't1543_unsigned_new_service', name: '서명 없는 새 서비스 등록', weight: 0.25,
    keywords: Object.freeze(['서명 없는', '서명이 없']),
  }),
  unfamiliarTask: Object.freeze({
    id: 't1053_unfamiliar_scheduled_task', name: '낯선 예약 작업', weight: 0.2,
    keywords: Object.freeze(['처음 보는', '임의 문자열']),
  }),
  tempOrStartup: Object.freeze({
    id: 't1543_t1053_temp_or_startup_executable', name: '임시·시작 폴더 실행 파일을 가리키는 등록', weight: 0.25,
    pathContains: Object.freeze(['\\appdata\\local\\temp\\', '\\start menu\\programs\\startup\\']),
  }),
  survivesReboot: Object.freeze({
    id: 't1543_survives_reboot_unlisted', name: '다시 켜도 남도록 등록된 목록 밖 항목', weight: 0.15,
    keywords: Object.freeze(['다시 켜도 남도록', '평소 목록에 없는', '같은 임시 파일을 함께']),
  }),
  weakChange: Object.freeze({ id: 't1543_t1053_weak_change', name: '확인이 필요한 약한 변경' }),
});
// 등록이 실제로 없었다는 표현: 강한 신호가 있어도 차단하지 않고 알림만
const NOT_REGISTERED = Object.freeze(['등록은 없', '이어서 실행된 기록은 없']);
// 정상 운영 표현: 기존·서명된·평소대로
const NORMAL_WORDS = Object.freeze(['서명된 채로', '평소 시각에 그대로', '평소 저장소', '기존 예약 작업', '읽기만']);

const asText = value => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
const round = value => Math.round(Math.min(0.99, Math.max(0, value)) * 100) / 100;
const actionOf = confidence => (confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record');

export function decide(alert) {
  const data = alert && typeof alert.data === 'object' && alert.data ? alert.data : {};
  const rule = alert && typeof alert.rule === 'object' && alert.rule ? alert.rule : {};
  const level = Number.isFinite(Number(rule.level)) ? Number(rule.level) : 0;
  const mitre = Array.isArray(rule.mitre) ? rule.mitre.map(asText) : [];
  const description = asText(rule.description);
  const path = asText(data.path).toLowerCase();
  const repeats = Number.parseInt(asText(data.count), 10) || 1;
  const mechanisms = MECHANISMS.filter(id => mitre.includes(id));

  if (!mechanisms.length || NORMAL_WORDS.some(word => description.includes(word))) {
    return { action: 'record', confidence: mechanisms.length ? 0.2 : 0.05, reason: '평소 목록의 정상 동작(지속성 신호 없음)' };
  }

  const hits = [];
  let strong = 0;
  if (PATTERNS.unsignedService.keywords.some(word => description.includes(word))) {
    strong += PATTERNS.unsignedService.weight; hits.push(PATTERNS.unsignedService.name);
  }
  if (PATTERNS.unfamiliarTask.keywords.some(word => description.includes(word))) {
    strong += PATTERNS.unfamiliarTask.weight; hits.push(PATTERNS.unfamiliarTask.name);
  }
  if (PATTERNS.tempOrStartup.pathContains.some(part => path.includes(part))) {
    strong += PATTERNS.tempOrStartup.weight; hits.push(PATTERNS.tempOrStartup.name);
  }
  if (PATTERNS.survivesReboot.keywords.some(word => description.includes(word))) {
    strong += PATTERNS.survivesReboot.weight; if (!hits.includes(PATTERNS.survivesReboot.name)) hits.push(PATTERNS.survivesReboot.name);
  }
  if (repeats >= 3) strong += 0.15;                     // 같은 주소에서 반복 등록
  if (mechanisms.length === 2) strong += 0.1;           // 서비스와 예약 작업이 함께

  const notRegistered = NOT_REGISTERED.some(word => description.includes(word));
  // 1) 명확한 지속성 설치: 강한 신호 + 높은 규칙 수준 + 실제 등록 → 차단 후보
  if (strong >= 0.25 && level >= CLEAR_MIN_LEVEL && !notRegistered) {
    const confidence = round(0.7 + strong * 0.6 + (level >= 12 ? 0.05 : 0));
    return { action: actionOf(confidence), confidence, reason: `${hits.join(' + ') || PATTERNS.unsignedService.name} (${mechanisms.join('·')})` };
  }
  // 2) 등록·변경 경보지만 신호가 약함: 알림만
  if (level >= WEAK_MIN_LEVEL) {
    const confidence = round(0.5 + (strong > 0 ? 0.1 : 0) + (level >= 7 ? 0.05 : 0));
    return { action: actionOf(confidence), confidence, reason: `${PATTERNS.weakChange.name} (${mechanisms.join('·')}) — 확인 필요` };
  }
  // 3) 낮은 수준의 등록 경보: 기록만
  return { action: 'record', confidence: 0.2, reason: '평소 목록의 정상 동작(지속성 신호 없음)' };
}
