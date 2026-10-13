// 10단계 안전 정책 도구 공통 부분 — 판정기(src/decider.mjs)의 SAFETY-POLICY 블록만 읽고 씁니다.
// 실제 운영 정책(ALEPH SDP 엔진·심판 쪽)은 건드리지 않습니다.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const BEGIN = '// SAFETY-POLICY:BEGIN';
const END = '// SAFETY-POLICY:END';
const DECL = /^const SAFETY_POLICY = ([\s\S]*);\s*$/u;

// 키 순서와 상관없이 같은 내용이면 같은 문자열·해시가 되도록 정렬해서 직렬화합니다.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
export const policyHash = policy => sha256(canonical(policy));

function blockRange(text) {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start < 0 || end < 0 || end < start || text.indexOf(BEGIN, start + 1) >= 0) {
    throw new Error('판정기에서 SAFETY-POLICY 블록을 하나만 찾을 수 없습니다. 중단합니다.');
  }
  return { bodyStart: start + BEGIN.length + 1, bodyEnd: end };
}

export function readPolicyFromDecider(text) {
  const { bodyStart, bodyEnd } = blockRange(text);
  const match = DECL.exec(text.slice(bodyStart, bodyEnd).trim());
  if (!match) throw new Error('SAFETY-POLICY 블록 모양이 다릅니다. 중단합니다.');
  return JSON.parse(match[1]);
}

// 블록 안만 바꾸고, 블록 밖의 판정기 코드는 한 글자도 바꾸지 않습니다.
export function writePolicyIntoDecider(text, policy) {
  const { bodyStart, bodyEnd } = blockRange(text);
  const body = `const SAFETY_POLICY = ${JSON.stringify(policy, null, 2)};\n`;
  return text.slice(0, bodyStart) + body + text.slice(bodyEnd);
}

// 침해 전에 검증한 사본: MANIFEST에 적힌 파일을 다시 읽어 해시를 대조합니다. 없거나 다르면 중단.
export async function readVerifiedBackup(backupDir) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(new URL('MANIFEST.json', backupDir), 'utf8'));
  } catch {
    throw new Error('검증된 정책 사본 목록(policy/backup/MANIFEST.json)이 없습니다. 중단합니다.');
  }
  if (typeof manifest?.file !== 'string' || !/^[a-z0-9._-]+\.json$/u.test(manifest.file)
      || typeof manifest.sha256 !== 'string' || typeof manifest.version !== 'string') {
    throw new Error('정책 사본 목록 형식이 맞지 않습니다. 중단합니다.');
  }
  let policy;
  try {
    policy = JSON.parse(await readFile(new URL(manifest.file, backupDir), 'utf8'));
  } catch {
    throw new Error(`정책 사본 파일(${manifest.file})을 읽을 수 없습니다. 중단합니다.`);
  }
  const actual = policyHash(policy);
  if (actual !== manifest.sha256 || policy.version !== manifest.version) {
    throw new Error(`정책 사본 검증 실패: 해시나 버전이 목록과 다릅니다(목록 ${manifest.sha256.slice(0, 12)}…, 실제 ${actual.slice(0, 12)}…). 중단합니다.`);
  }
  return { manifest, policy, hash: actual };
}

const routeKey = route => `${route.method} ${route.shape}`;

// 사본(safe)과 현재(current)의 차이를 사람이 읽을 수 있는 항목으로 돌려줍니다.
export function diffPolicies(safe, current) {
  const changes = [];
  const safeRoutes = new Map((safe.zoneRoutes ?? []).map(route => [routeKey(route), route]));
  const currentRoutes = new Map((current.zoneRoutes ?? []).map(route => [routeKey(route), route]));
  for (const [key, route] of currentRoutes) {
    if (!safeRoutes.has(key)) changes.push({ item: `zoneRoutes ${key}`, change: '추가됨 → 되돌리면 삭제', from: null, to: route });
    else if (canonical(route) !== canonical(safeRoutes.get(key))) {
      changes.push({ item: `zoneRoutes ${key}`, change: '바뀜 → 사본 값으로', from: route, to: safeRoutes.get(key) });
    }
  }
  for (const [key, route] of safeRoutes) {
    if (!currentRoutes.has(key)) changes.push({ item: `zoneRoutes ${key}`, change: '빠짐 → 되돌리면 다시 추가', from: null, to: route });
  }
  const keys = new Set([...Object.keys(safe), ...Object.keys(current)]);
  keys.delete('zoneRoutes');
  for (const key of [...keys].sort()) {
    const a = safe[key];
    const b = current[key];
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      for (const sub of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
        if (canonical(a[sub]) !== canonical(b[sub])) {
          changes.push({ item: `${key}.${sub}`, change: '바뀜 → 사본 값으로', from: b[sub] ?? null, to: a[sub] ?? null });
        }
      }
    } else if (canonical(a) !== canonical(b)) {
      if (Array.isArray(a) && Array.isArray(b)) {
        const added = b.filter(x => !a.includes(x));
        const removed = a.filter(x => !b.includes(x));
        changes.push({ item: key, change: `바뀜 → 사본 값으로 (빠진 값 ${JSON.stringify(removed)}, 더해진 값 ${JSON.stringify(added)})`, from: b, to: a });
      } else {
        changes.push({ item: key, change: '바뀜 → 사본 값으로', from: b ?? null, to: a ?? null });
      }
    }
  }
  return changes;
}

export function printReport({ backup, current, currentHash, changes, write }) {
  write(`복원할 사본: ${backup.manifest.version} (sha256 ${backup.hash.slice(0, 16)}…, 검증 통과 · 기록 ${backup.manifest.verifiedAt})\n`);
  write(`현재 시험 정책: ${current.version ?? '(버전 없음)'} (sha256 ${currentHash.slice(0, 16)}…)\n`);
  if (!changes.length) {
    write('차이 없음: 현재 시험 정책이 검증한 사본과 같습니다.\n');
    return;
  }
  write(`바뀔 항목 ${changes.length}개:\n`);
  for (const item of changes) write(`  - ${item.item}: ${item.change}\n`);
}
