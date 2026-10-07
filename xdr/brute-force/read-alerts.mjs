// 보너스 xdr-01 읽기 모듈: Wazuh 경보에서 시각·출발 주소·계정·규칙 수준·설명만 뽑습니다.
// 원본 경보 파일은 읽기만 하고 고치지 않습니다. 비밀값처럼 보이는 문자열은 [가림]으로 바꿉니다.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const FIXTURE = new URL('../fixtures/brute-force.json', import.meta.url);

// 비밀번호·토큰·키처럼 보이는 값
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu,
  /\b(?:sb_secret|sb_publishable|sk|pk|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{8,}/giu,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/giu,
  /(?<![A-Za-z0-9_])(pass(?:word)?|passwd|pwd|secret|token|api[_-]?key|비밀번호)\s*[:=]\s*\S+/giu,
];

export function redact(value) {
  if (typeof value !== 'string') return value;
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, (match, label) =>
    (typeof label === 'string' && match.includes(label) && /[:=]/u.test(match) ? `${label}=[가림]` : '[가림]')), value);
}

const text = (value, max = 300) => (typeof value === 'string' ? redact(value).slice(0, max) : null);
const integer = (value) => {
  const number = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};

// 경보 한 건 → 필요한 칸만. 판단 모듈이 쓸 보조 칸(id, mitre, 실패 수, 계정 목록 수)은 따로 둡니다.
export function extractAlert(alert) {
  const data = alert?.data ?? {};
  const accounts = typeof data.accounts === 'string'
    ? data.accounts.split(',').map(item => item.trim()).filter(Boolean)
    : [];
  return {
    id: text(alert?.id, 80),
    time: text(alert?.timestamp, 40),
    srcip: text(data.srcip, 64),
    user: text(data.srcuser, 80),
    level: integer(alert?.rule?.level),
    description: text(alert?.rule?.description),
    mitre: Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre.filter(item => typeof item === 'string') : [],
    failures: integer(data.count),
    accountCount: accounts.length,
  };
}

export async function readAlerts(path = FIXTURE) {
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || !Array.isArray(fixture.alerts)) {
    throw new Error('경보 묶음 형식이 아닙니다.');
  }
  return { total: fixture.alerts.length, rows: fixture.alerts.map(extractAlert) };
}

// 직접 실행: 시각·주소·계정·수준·설명 다섯 칸만 표로 출력하고, 경보 건수와 뽑은 줄 수를 대조합니다.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { total, rows } = await readAlerts();
  for (const row of rows) {
    console.log([row.time, row.srcip, row.user, row.level, row.description].join(' | '));
  }
  console.log(`경보 ${total}건 · 뽑은 줄 ${rows.length}줄 · ${total === rows.length ? '일치' : '불일치'}`);
  if (total !== rows.length) process.exitCode = 1;
}
