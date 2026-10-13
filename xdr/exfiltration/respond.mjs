// 보너스 xdr-06 대응 모듈: decide 결과 가운데 차단 후보(block)만 "그 유출 목적지"를 막는 ZTNA 판정기
// 거부 규칙으로 넣고, block·alert 알림을 xdr/alerts.log 에 한 줄씩 쌓습니다.
// decide.mjs 는 판단만 하고 이 일은 하지 않습니다. 판정기의 기존 규칙(src/decider.mjs)은 고치지 않습니다.
// 실행: node xdr/exfiltration/respond.mjs
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { decide } from './decide.mjs';
import { RULE_ID, checkDestination } from './ztna-plugin.mjs';

const FIXTURE = new URL('../fixtures/exfiltration.json', import.meta.url);
const RULES_FILE = new URL('./deny-rules.json', import.meta.url);
const LOG_FILE = new URL('../alerts.log', import.meta.url);
const BLOCK_MINUTES = 60;

const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
const decided = [];
for (const alert of fixture.alerts) {
  decided.push({
    id: String(alert.id ?? ''),
    time: String(alert.timestamp ?? ''),
    srcip: String(alert.data?.srcip ?? ''),
    dstip: String(alert.data?.dstip ?? ''),
    user: String(alert.data?.srcuser ?? ''),
    ...(await decide(alert)),
  });
}

// 정상 사용자 보호: 정상(record)으로 판단된 이벤트가 쓰는 평소 목적지(자료실 등)는 막지 않습니다.
const usualDestinations = new Set(decided.filter(item => item.action === 'record' && item.dstip).map(item => item.dstip));

const byDestination = new Map();
for (const item of decided) {
  if (item.action !== 'block' || !item.dstip || usualDestinations.has(item.dstip)) continue;
  byDestination.set(item.dstip, [...(byDestination.get(item.dstip) ?? []), item]);
}
const rules = [...byDestination.entries()].map(([dstip, items]) => {
  const times = items.map(item => Date.parse(item.time));
  return {
    ruleId: RULE_ID,
    dstip,
    createdAt: new Date(Math.min(...times)).toISOString(),
    expiresAt: new Date(Math.max(...times) + BLOCK_MINUTES * 60 * 1000).toISOString(),
    evidenceAlertIds: items.map(item => item.id),
    reason: [...new Set(items.map(item => item.reason))].join(' / '),
  };
}).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
await writeFile(RULES_FILE, `${JSON.stringify({ schema: 'aleph.xdr.deny-rules.v1', moduleKey: 'exfiltration',
  blockMinutes: BLOCK_MINUTES, unit: 'destination', rules }, null, 2)}\n`, 'utf8');

// 알림 로그: block·alert만 한 줄씩. 이미 적힌 경보 번호는 다시 적지 않습니다.
let existing = '';
try { existing = await readFile(LOG_FILE, 'utf8'); } catch { /* 처음 실행 */ }
const logged = new Set([...existing.matchAll(/\balert=(\S+)/gu)].map(match => match[1]));
const lines = decided.filter(item => item.action !== 'record' && !logged.has(item.id)).map(item =>
  [item.time, 'module=exfiltration', `alert=${item.id}`, `action=${item.action}`,
    `confidence=${item.confidence}`, `src=${item.srcip}`, `dst=${item.dstip}`, `user=${item.user}`,
    `reason="${item.reason.replaceAll('"', "'")}"`].join(' '));
if (lines.length) await appendFile(LOG_FILE, `${lines.join('\n')}\n`, 'utf8');

// 시험 경보 다시 흘리기: 경보 시각에 그 목적지로 전송이 나간다고 보고 판정기 부품으로 확인
const replay = decided.map(item => ({ ...item,
  blocked: Boolean(checkDestination({ dstip: item.dstip, at: item.time }, rules)) }));
const count = (action, blocked) => replay.filter(item => item.action === action && item.blocked === blocked).length;
console.log(`목적지 차단 규칙 ${rules.length}개 · 알림 로그 새 줄 ${lines.length}개`);
console.log(`다시 흘리기: 공격 막힘 ${count('block', true)}건 · 공격 통과 ${count('block', false)}건 · `
  + `애매함 막힘 ${count('alert', true)}건 · 정상 막힘 ${count('record', true)}건 · 정상 통과 ${count('record', false)}건`);
if (count('block', false) || count('alert', true) || count('record', true)) process.exitCode = 1;
