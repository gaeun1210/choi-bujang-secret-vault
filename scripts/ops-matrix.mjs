// npm run ops:matrix — 1~11단계 정상·금지 요청 실측표(터미널판). 결과는 artifacts/ops-matrix.json (Git 제외).
// 터미널에는 로그인·기기 쿠키가 없으므로 로그인이 필요한 줄은 미실행으로 남깁니다(작전실 화면에서 실행).
// 학생 판정기·탐지·정책 되돌리기는 로컬 연습 결과를 "로컬"로 따로 적습니다(엔진 실측 아님).
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runChecks, summarize } from '../public/ops-checks.mjs';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('aleph.config.json', root), 'utf8'));
const base = String(config.publicAppUrl).replace(/\/$/u, '');
const commit = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: fileURLToPath(root), encoding: 'utf8' }).stdout.trim();

const rows = await runChecks({ base, session: false });
const local = [
  ['decider:test', ['scripts/decider-test.mjs']],
  // fixture:7은 "통과" 줄 대신 결과를 출력하므로 기대 결과 두 줄이 모두 있는지 봅니다.
  ['fixture:7', ['scripts/fixture-7.mjs'], [/^정상 사건: allow$/mu, /^복합 이상 사건: step_up$/mu]],
  ['decider:zones', ['--test', 'test/decider-zones.test.mjs']],
  ['detect:test', ['scripts/detect-test.mjs']], ['policy-restore.test', ['--test', 'test/policy-restore.test.mjs']],
].map(([name, args, expect]) => {
  const out = spawnSync(process.execPath, args, { cwd: fileURLToPath(root), encoding: 'utf8' });
  const passed = expect ? expect.filter(pattern => pattern.test(out.stdout)).length : (out.stdout.match(/^통과|^ok /gmu) ?? []).length;
  const failed = expect ? expect.length - passed : (out.stdout.match(/^실패|^not ok /gmu) ?? []).length;
  return { name, source: '로컬 연습(엔진 실측 아님)', exitCode: out.status, passed, failed, checkedAt: new Date().toISOString() };
});
const report = { schema: 'aleph.ops.matrix.v1', commit, base, checkedAt: new Date().toISOString(), summary: summarize(rows), rows, local };
await mkdir(new URL('artifacts/', root), { recursive: true });
await writeFile(new URL('artifacts/ops-matrix.json', root), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

for (const row of rows) {
  process.stdout.write(`${String(row.step).padStart(2)}단계 ${row.kind} ${row.name} | 기대 ${row.expected} | 실제 ${row.actual ?? '-'} | ${row.result}${row.requestId ? ` | ${row.requestId}` : ''}${row.note ? ` | ${row.note}` : ''}\n`);
}
for (const item of local) process.stdout.write(`로컬 ${item.name}: 종료 코드 ${item.exitCode}, 통과 ${item.passed}, 실패 ${item.failed}\n`);
const s = report.summary;
process.stdout.write(`\n실측 일치 ${s.matched} · 불일치 ${s.mismatched} · 미실행 ${s.notRun} / ${s.total}줄 (커밋 ${commit})\n${s.finalAssault41}\n결과 파일: artifacts/ops-matrix.json\n`);
