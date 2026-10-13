// 9단계 탐지 함수 — ALEPH SDP 엔진이 검증해 넘긴 가상 사건만 읽고, 별도 결과로 회수를 "제안"만 합니다.
// 계약: docs/DETECT_EVENTS.md. 판정기(src/decider.mjs)의 허용/거부 응답 형식은 바꾸지 않습니다.
// 회수 API를 만들거나 기기 권한을 직접 바꾸지 않습니다. 실제 회수와 경과 시간은 심판이 확인합니다.
// 브라우저가 보낸 사용자 번호는 신원으로 쓰지 않습니다.

export const DETECTION_RULE_IDS = Object.freeze(['burst_read_unusual_network']);

const WINDOW_MS = 10 * 60 * 1000;      // 어느 10분 구간이든
const BURST_OVER = 120;                // 같은 사용자 GET이 120건을 넘을 때(121건부터)
const UNUSUAL_NETWORKS = new Set(['unusual', 'new', 'first_seen']);
const USUAL_NETWORKS = new Set(['usual', 'known', 'home']);
const SUBJECT = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
const DEVICE = /^[0-9a-f]{16}$/iu;     // 엔진이 확인한 기기 ID (16자리 16진수, 개인키 아님)
const DECISIONS = new Set(['allow', 'deny', 'step_up']);

// ── 1) 입력 정리: 가명 사용자·기기·요청 종류·판정(+시각·네트워크 표시)만 꺼냅니다 ──
// 메모 내용·토큰·실명·이메일 같은 다른 칸은 읽지도, 저장하지도, 출력하지도 않습니다.
// 모양이 틀린 사건은 버리고, 없는 값은 정상값으로 채우지 않고 null로 둡니다.
export function readEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const at = typeof event.at === 'string' ? Date.parse(event.at) : Number.NaN;
  const sub = event.identity && typeof event.identity === 'object' ? event.identity.sub : undefined;
  if (!Number.isFinite(at) || typeof event.method !== 'string' || typeof sub !== 'string' || !SUBJECT.test(sub)) {
    return null;
  }
  // 기기·네트워크·판정은 엔진 사건에 들어올 수 있는 자리 몇 곳에서만 찾고, 형식이 맞을 때만 씁니다.
  const firstString = (...values) => values.find(value => typeof value === 'string') ?? null;
  const deviceRaw = firstString(event.deviceId, event.device_id, event.device?.id, event.device?.deviceId,
    typeof event.device === 'string' ? event.device : undefined, event.identity.deviceId, event.identity.device_id,
    typeof event.identity.device === 'string' ? event.identity.device : event.identity.device?.id);
  const networkRaw = firstString(event.network, event.signals?.network, event.context?.network,
    typeof event.network === 'object' ? event.network?.kind : undefined);
  const decisionRaw = firstString(event.decision, event.result?.decision);
  const network = networkRaw ? networkRaw.toLowerCase() : null;
  const decision = decisionRaw ? decisionRaw.toLowerCase() : null;
  return {
    at,
    method: event.method.toUpperCase(),
    subject: sub,
    device: deviceRaw && DEVICE.test(deviceRaw) ? deviceRaw.toLowerCase() : null,
    network: network && (UNUSUAL_NETWORKS.has(network) || USUAL_NETWORKS.has(network)) ? network : null,
    decision: decision && DECISIONS.has(decision) ? decision : null,
  };
}

// 같은 사용자의 GET 가운데, 10분 안에 120건을 넘게 몰린 첫 구간을 찾습니다(다른 사용자와 합산하지 않음).
function firstBurst(reads) {
  let start = 0;
  for (let end = 0; end < reads.length; end += 1) {
    while (reads[end].at - reads[start].at >= WINDOW_MS) start += 1;
    if (end - start + 1 > BURST_OVER) return reads.slice(start, end + 1);
  }
  return null;
}

// ── 2) 탐지 규칙: 평소와 다른 네트워크 + 갑작스러운 다량 조회가 함께일 때만 의심 ──
// 지역은 쓰지 않습니다. 사건에 네트워크 표시가 있고 그 구간이 모두 평소 네트워크면 정상으로 둡니다.
// 계약의 연습 사건처럼 네트워크 표시가 아예 없으면, 계약 기준(10분 120건 초과)만으로 판단합니다.
export function suspiciousBurst(events) {
  const bySubject = new Map();
  for (const event of events) {
    if (event.method !== 'GET') continue;
    if (!bySubject.has(event.subject)) bySubject.set(event.subject, []);
    bySubject.get(event.subject).push(event);
  }
  const found = [];
  for (const [subject, reads] of bySubject) {
    reads.sort((a, b) => a.at - b.at);
    const burst = firstBurst(reads);
    if (!burst) continue;
    const withNetwork = burst.filter(event => event.network !== null);
    const unusual = withNetwork.filter(event => UNUSUAL_NETWORKS.has(event.network));
    if (withNetwork.length > 0 && unusual.length === 0) continue;   // 평소 네트워크의 다량 조회는 정상 유지
    found.push({ subject, burst, unusual, startedAt: burst[0].at });
  }
  found.sort((a, b) => a.startedAt - b.startedAt);
  return found[0] ?? null;
}

// 회수 대상 기기 한 개: 평소와 다른 네트워크에서 가장 많이 조회한 확인된 기기(없으면 구간에서 가장 많이 조회한 기기).
// 사건에 확인된 기기 ID가 없으면 대상 기기를 지어내지 않습니다.
function targetDevice(found) {
  const pool = found.unusual.some(event => event.device) ? found.unusual : found.burst;
  const counts = new Map();
  for (const event of pool) if (event.device) counts.set(event.device, (counts.get(event.device) ?? 0) + 1);
  let best = null;
  for (const [device, count] of counts) if (!best || count > best.count) best = { device, count };
  return best?.device ?? null;
}

// ── 3) 별도 탐지 결과: 의심이면 propose_revocation, 아니면 observe ──
export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  const found = suspiciousBurst(events.map(readEvent).filter(Boolean));
  if (!found) return { action: 'observe' };
  const result = { action: 'propose_revocation', reasonCode: 'burst_read', subject: found.subject };
  const device = targetDevice(found);
  if (device) result.device = device;
  return result;
}
