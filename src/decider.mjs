// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
// 계약: docs/DECIDER_REQUEST.md (aleph.decision.v1) — 계약에 있는 값만 씁니다.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered', 'step_up_required',
  'zone_route_allowlist', 'zone_own_notes', 'zone_notices_read', 'zone_notice_instructor_only']);

const READ_METHODS = new Set(['GET', 'HEAD']);

// ── 8단계 구역 표: 엔진이 확인한 메서드 + 정확한 경로 모양만 허용합니다. 표에 없는 경로는 거부. ──
// 경로는 자료 ID 하나만 고르고(쿼리로 기능을 고르지 않음), :id와 같은 깊이에 기능 경로를 두지 않습니다.
const ZONE_ROUTES = Object.freeze([
  { method: 'GET', shape: '/notes', zone: 'own_notes', rule: 'zone_own_notes' },
  { method: 'GET', shape: '/notes/:id', zone: 'own_notes', rule: 'zone_own_notes' },
  { method: 'PUT', shape: '/notes/:id', zone: 'own_notes', rule: 'zone_own_notes' },
  { method: 'GET', shape: '/notices', zone: 'notices', rule: 'zone_notices_read' },
  { method: 'GET', shape: '/notices/:id', zone: 'notices', rule: 'zone_notices_read' },
  { method: 'PUT', shape: '/notices/:id', zone: 'notices', rule: 'zone_notice_instructor_only', instructorOnly: true },
].map(Object.freeze));
const RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;
// 자료 ID 자리에 기능 이름이 오면 자료가 아니라 기능을 고르는 것이므로 거부합니다.
const FEATURE_WORDS = new Set(['export', 'import', 'download', 'backup', 'bulk', 'all', 'admin', 'search', 'dump', 'sync']);

// 요청 경로가 구역 표의 한 줄과 정확히 맞으면 그 줄을, 아니면 null.
export function matchZoneRoute(request) {
  const method = request?.method === 'HEAD' ? 'GET' : request?.method;
  const { path, route, queryLength } = request ?? {};
  if (typeof method !== 'string' || typeof path !== 'string' || typeof route !== 'string') return null;
  if (queryLength !== 0) return null;                     // 쿼리로 기능·대상을 고르지 않음
  const segments = path.split('/');                       // '/notes/abc' → ['', 'notes', 'abc']
  for (const entry of ZONE_ROUTES) {
    if (entry.method !== method || route !== `${request.method} ${entry.shape}`) continue;
    const shape = entry.shape.split('/');
    if (shape.length !== segments.length || segments[0] !== '') continue;
    const ok = shape.every((part, index) => (part === ':id'
      ? RESOURCE_ID.test(segments[index]) && !FEATURE_WORDS.has(segments[index].toLowerCase())
      : part === segments[index]));
    if (ok) return entry;
  }
  return null;
}

// 7단계 step_up_required 기준 (가상 접속 사건 전용)
const TRUSTED_SIGNAL_SOURCE = 'judge_fixture';     // 엔진이 검증해 넘긴 가상 사건 표시
const KNOWN_SIGNAL_SOURCES = new Set(['none', TRUSTED_SIGNAL_SOURCE]);
const OFF_HOURS = hour => hour >= 0 && hour < 6;   // 평소와 다른 시각: 새벽 0~5시
const NEW_NETWORKS = new Set(['unusual', 'new', 'first_seen']);
const BURST_WINDOW_SECONDS = 600;                  // 최근 10분 안의 사건만
const BURST_MIN_COUNT = 10;                        // 갑자기 많은 자료 읽기: 사건 수 합 10 이상
const FRESH_LOGIN_SECONDS = 300;                   // 다시 로그인한 지 5분 안이어야 통과

const respond = (request, decision, reasonCode, ruleIds) => ({
  schema: 'aleph.decision.v1',
  requestId: request?.requestId,
  decision,
  reasonCode,
  ruleIds,
});

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasOnlyKeys = (value, keys) => isPlainObject(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const shortText = value => typeof value === 'string' && value.length > 0 && value.length <= 32;

// ── 입력 검사 ───────────────────────────────────────────────
// 접속 정보(signals)는 계약 모양이 정확하고 출처가 엔진의 가상 사건(judge_fixture)일 때만 믿습니다.
// 출처가 'none'·없음·그 밖의 값(브라우저 헤더를 흉내 낸 값 등)이면 신뢰하지 않고, 정상값으로 채우지도 않습니다.
export function trustedSignals(request) {
  const signals = request?.signals;
  if (!hasOnlyKeys(signals, ['source', 'region', 'network', 'hour'])) return null;
  if (!KNOWN_SIGNAL_SOURCES.has(signals.source) || signals.source !== TRUSTED_SIGNAL_SOURCE) return null;
  if (!shortText(signals.region) || !shortText(signals.network)) return null;
  if (!Number.isInteger(signals.hour) || signals.hour < 0 || signals.hour > 23) return null;
  return { region: signals.region, network: signals.network, hour: signals.hour };
}

// 최근 사건: 최대 12건, 각 {kind, ageSeconds, count}. 모양이 틀린 항목은 버립니다(채우지 않음).
export function trustedEvents(request) {
  const events = request?.recentEvents;
  if (!Array.isArray(events) || events.length > 12) return [];
  return events.filter(event => hasOnlyKeys(event, ['kind', 'ageSeconds', 'count'])
    && shortText(event.kind)
    && Number.isInteger(event.ageSeconds) && event.ageSeconds >= 0
    && Number.isInteger(event.count) && event.count >= 0);
}

// 다시 로그인 확인: 엔진이 verified=true와 0~900초 나이를 줄 때만 유효. 오래된 로그인은 통과시키지 않습니다.
export function freshStepUp(request) {
  const stepUp = request?.stepUp;
  if (!hasOnlyKeys(stepUp, ['verified', 'authAgeSeconds']) || stepUp.verified !== true) return false;
  const age = stepUp.authAgeSeconds;
  return Number.isInteger(age) && age >= 0 && age <= 900 && age <= FRESH_LOGIN_SECONDS;
}

// ── 7단계 규칙: 평소와 다른 시각 + 처음 보는 네트워크 + 갑자기 많은 자료 읽기 → 추가 확인 ──
// 지역(region)은 판단에 쓰지 않습니다. 지역 하나만으로는 막지 않고, 영구 차단 대신 다시 로그인만 요구합니다.
export function unusualAccessReasons(request) {
  const signals = trustedSignals(request);
  if (!signals) return [];
  const burst = trustedEvents(request)
    .filter(event => event.ageSeconds <= BURST_WINDOW_SECONDS)
    .reduce((sum, event) => sum + event.count, 0);
  const reasons = [];
  if (OFF_HOURS(signals.hour)) reasons.push(`off_hours:${signals.hour}`);
  if (NEW_NETWORKS.has(signals.network)) reasons.push(`new_network:${signals.network}`);
  if (burst >= BURST_MIN_COUNT) reasons.push(`burst_read:${burst}`);
  return reasons.length === 3 ? reasons : [];
}

export async function decide(request) {
  // 6단계 device_registered: 엔진이 확인한 기기 등록 여부가 정확히 true일 때만 다음으로 넘어갑니다.
  // 미등록(false)이거나 값이 없으면(그 밖의 모든 값 포함) 거부합니다.
  if (request?.deviceRegistered !== true) {
    return respond(request, 'deny', 'device_not_registered', ['device_registered']);
  }

  // 형식이 깨진 요청(메서드·경로가 문자열이 아님)은 시작 틀의 기본 거부를 그대로 따릅니다.
  if (typeof request.method !== 'string' || typeof request.path !== 'string') {
    return respond(request, 'deny', 'starter_not_ready', ['starter.deny']);
  }

  // 8단계 zone_route_allowlist: 구역 표에 없는 메서드·경로(알 수 없는 경로, 쿼리, 기능 경로)는 거부
  const zone = matchZoneRoute(request);
  if (!zone) return respond(request, 'deny', 'route_not_allowed', ['zone_route_allowlist']);

  // 엔진이 확인한 사용자(가명 subjectId)가 없으면 어느 구역도 열지 않습니다.
  if (typeof request.subjectId !== 'string' || !request.subjectId) {
    return respond(request, 'deny', 'zone_not_allowed', [zone.rule]);
  }

  // 8단계 zone_notice_instructor_only: 공지 수정은 강사만. 현재 계약에는 엔진이 확인한 강사 역할이 없으므로
  // 브라우저 값으로 채우지 않고 모두 거부합니다(최종 자료 API도 DB의 강사 권한을 다시 확인).
  if (zone.instructorOnly) return respond(request, 'deny', 'zone_not_allowed', [zone.rule]);

  const rules = ['device_registered', zone.rule];
  // 읽기에는 7단계 step_up_required를 그대로 적용합니다.
  if (READ_METHODS.has(request.method) && unusualAccessReasons(request).length) {
    if (!freshStepUp(request)) {
      return respond(request, 'step_up', 'step_up_required', ['step_up_required']);
    }
    rules.push('step_up_required');
  }
  // 자기 메모 읽기·수정, 공지 읽기 허용. 메모의 실제 주인 확인은 자료 API가 확인된 사용자 ID와
  // DB owner_id로 다시 합니다(판정기의 subjectId는 가명이라 owner_id와 직접 비교하지 않음).
  return respond(request, 'allow', 'approved', rules);
}
