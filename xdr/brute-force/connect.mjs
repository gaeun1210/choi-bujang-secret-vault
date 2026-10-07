// 보너스 xdr-01 연결: 경보 → decide → (block만) 거부 규칙 · (block·alert) xdr/alerts.log 한 줄씩
// → 시험 경보를 다시 흘려 막힘·통과를 확인합니다. 실행: node xdr/brute-force/connect.mjs
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { decide } from './decide.mjs';
import { readAlerts } from './read-alerts.mjs';
import { RULE_ID, checkSource } from './ztna-plugin.mjs';

const FIXTURE = new URL('../fixtures/brute-force.json', import.meta.url);
const RULES_FILE = new URL('./deny-rules.json', import.meta.url);
const LOG_FILE = new URL('../alerts.log', import.meta.url);
const BLOCK_MINUTES = 60;

const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
const { rows } = await readAlerts(FIXTURE);
const decided = [];
for (const [index, alert] of fixture.alerts.entries()) {
  decided.push({ row: rows[index], ...(await decide(alert)) });
}

// 정상 사용자 보호: 정상(record)으로 판단된 이벤트에 나온 주소는 차단 규칙에서 뺍니다.
const normalSources = new Set(decided.filter(item => item.action === 'record').map(item => item.row.srcip));

const bySource = new Map();
for (const item of decided.filter(entry => entry.action === 'block')) {
  if (normalSources.has(item.row.srcip)) continue;
  const list = bySource.get(item.row.srcip) ?? [];
  list.push(item);
  bySource.set(item.row.srcip, list);
}
const rules = [...bySource.entries()].map(([srcip, items]) => {
  const first = Math.min(...items.map(item => Date.parse(item.row.time)));
  const last = Math.max(...items.map(item => Date.parse(item.row.time)));
  return {
    ruleId: RULE_ID,
    srcip,
    createdAt: new Date(first).toISOString(),
    expiresAt: new Date(last + BLOCK_MINUTES * 60 * 1000).toISOString(),
    evidenceAlertIds: items.map(item => item.row.id),
    reason: [...new Set(items.map(item => item.reason))].join(' / '),
  };
}).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
await writeFile(RULES_FILE, `${JSON.stringify({ schema: 'aleph.xdr.deny-rules.v1', moduleKey: 'brute-force',
  blockMinutes: BLOCK_MINUTES, rules }, null, 2)}\n`, 'utf8');

// 알림 로그: block·alert만 한 줄씩. 이미 적힌 경보 번호는 다시 적지 않습니다.
let existing = '';
try { existing = await readFile(LOG_FILE, 'utf8'); } catch { /* 처음 */ }
const logged = new Set([...existing.matchAll(/\balert=(\S+)/gu)].map(match => match[1]));
const lines = decided.filter(item => item.action !== 'record' && !logged.has(item.row.id)).map(item =>
  [item.row.time, `module=brute-force`, `alert=${item.row.id}`, `action=${item.action}`,
    `confidence=${item.confidence}`, `src=${item.row.srcip}`, `user=${item.row.user}`,
    `reason="${item.reason.replaceAll('"', "'")}"`].join(' '));
if (lines.length) await appendFile(LOG_FILE, `${lines.join('\n')}\n`, 'utf8');

// 다시 흘리기: 각 경보 시각에 그 주소에서 요청이 왔다고 보고 부품으로 확인
const replay = decided.map(item => ({ id: item.row.id, action: item.action,
  blocked: Boolean(checkSource({ srcip: item.row.srcip, at: item.row.time }, rules)) }));
const normalBlocked = replay.filter(item => item.action === 'record' && item.blocked);
const ambiguousBlocked = replay.filter(item => item.action === 'alert' && item.blocked);
const attacksPassed = replay.filter(item => item.action === 'block' && !item.blocked);
console.log(`거부 규칙 ${rules.length}개 · 알림 로그 새 줄 ${lines.length}개`);
console.log(`다시 흘리기: 공격 막힘 ${replay.filter(i => i.action === 'block' && i.blocked).length}건 · 공격 통과 ${attacksPassed.length}건 · 애매함 막힘 ${ambiguousBlocked.length}건 · 정상 막힘 ${normalBlocked.length}건`);
if (normalBlocked.length || ambiguousBlocked.length || attacksPassed.length) process.exitCode = 1;
