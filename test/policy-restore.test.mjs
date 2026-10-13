// 10단계: 침해된 시험 정책을 검증한 사본으로 되돌리는 절차 시험 (임시 폴더에서만 실행, 저장소 파일은 그대로)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BEGIN = '// SAFETY-POLICY:BEGIN';
const END = '// SAFETY-POLICY:END';
const outside = text => text.slice(0, text.indexOf(BEGIN)) + text.slice(text.indexOf(END));
const policyOf = text => JSON.parse(/const SAFETY_POLICY = ([\s\S]*);\s*$/u
  .exec(text.slice(text.indexOf(BEGIN) + BEGIN.length, text.indexOf(END)).trim())[1]);

async function sandbox() {
  const dir = await mkdtemp(join(tmpdir(), 'policy-restore-'));
  for (const path of ['src/decider.mjs', 'scripts/policy-lib.mjs', 'scripts/policy-diff.mjs', 'scripts/policy-restore.mjs',
    'scripts/decider-test.mjs', 'scripts/fixture-7.mjs', 'policy/backup']) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await cp(join(root, path), join(dir, path), { recursive: true });
  }
  await writeFile(join(dir, 'policy', 'audit.log'), '{"at":"2026-10-01T00:00:00.000Z","action":"earlier_record"}\n');
  return dir;
}
const run = (dir, script, args = []) => spawnSync(process.execPath, [join(dir, 'scripts', script), ...args], { encoding: 'utf8' });
let n = 0;
const load = async dir => import(`${pathToFileURL(join(dir, 'src', 'decider.mjs')).href}?v=${n += 1}`);
const base = { schema: 'aleph.decision.v1', classId: 'c', projectId: 'p', deviceId: 'a'.repeat(16), service: 'notes',
  queryLength: 0, querySha256: '', at: new Date().toISOString(), policyRevision: 1, deviceRegistered: true,
  stepUp: { verified: false, authAgeSeconds: null }, recentEvents: [], signals: { source: 'none', region: 'unknown', network: 'unknown', hour: 12 } };
const req = (subjectId, method, path, route) => ({ ...base, requestId: `r${n}`, subjectId, method, path, route });

test('침해된 시험 정책을 확인 뒤 검증 사본으로 되돌리면 B의 A 자료 요청이 다시 거부되고 A 요청은 유지된다', async () => {
  const dir = await sandbox();
  try {
    const deciderPath = join(dir, 'src', 'decider.mjs');
    const original = await readFile(deciderPath, 'utf8');
    const safe = policyOf(original);
    // 가상 침공: 목록 경로 열기, 다른 사용자 ID 검사·주인 기억 끄기, 공지 수정 강사 제한 풀기
    const tampered = structuredClone(safe);
    tampered.version = 'tampered';
    tampered.zoneRoutes.unshift({ method: 'GET', shape: '/notes', zone: 'own_notes', rule: 'zone_own_notes', services: ['notes'] });
    tampered.zoneRoutes = tampered.zoneRoutes.map(r => (r.instructorOnly ? { ...r, instructorOnly: false } : r));
    tampered.ownerChecks.denyOtherSubjectIds = false;
    tampered.ownerChecks.rememberFirstOwner = false;
    const tamperedText = original.replace(/const SAFETY_POLICY = [\s\S]*?;\n(?=\/\/ SAFETY-POLICY:END)/u,
      `const SAFETY_POLICY = ${JSON.stringify(tampered, null, 2)};\n`);
    await writeFile(deciderPath, tamperedText);

    let decider = await load(dir);
    assert.equal((await decider.decide(req('learner_b', 'GET', '/notes/learner_a', 'GET /notes/:id'))).decision, 'allow');
    assert.equal((await decider.decide(req('learner_b', 'PUT', '/notices/n1', 'PUT /notices/:id'))).decision, 'allow');

    const diff = run(dir, 'policy-diff.mjs');
    assert.equal(diff.status, 0);
    assert.match(diff.stdout, /복원할 사본: safe-v9/u);
    assert.match(diff.stdout, /바뀔 항목 \d+개/u);
    assert.match(diff.stdout, /zoneRoutes GET \/notes: 추가됨/u);
    assert.match(diff.stdout, /ownerChecks\.denyOtherSubjectIds/u);
    assert.equal(await readFile(deciderPath, 'utf8'), tamperedText, 'diff는 파일을 바꾸지 않는다');

    const noConfirm = run(dir, 'policy-restore.mjs');
    assert.equal(noConfirm.status, 2);
    assert.match(noConfirm.stdout, /아직 바꾸지 않았습니다/u);
    assert.equal(await readFile(deciderPath, 'utf8'), tamperedText, '확인 없이는 바꾸지 않는다');

    const restored = run(dir, 'policy-restore.mjs', ['--confirm=safe-v9']);
    assert.equal(restored.status, 0, restored.stderr);
    assert.match(restored.stdout, /통과 · 등록 기기의 정상 요청/u);
    const after = await readFile(deciderPath, 'utf8');
    assert.deepEqual(policyOf(after), safe);
    assert.equal(outside(after), outside(original), '블록 밖 판정기 코드는 그대로');
    const audit = (await readFile(join(dir, 'policy', 'audit.log'), 'utf8')).trim().split('\n');
    assert.equal(audit.length, 2);
    assert.match(audit[0], /earlier_record/u, '기존 감사 기록 보존');
    assert.equal(JSON.parse(audit[1]).action, 'policy_restore');

    decider = await load(dir);
    assert.equal((await decider.decide(req('learner_b', 'GET', '/notes/learner_a', 'GET /notes/:id'))).decision, 'deny');
    assert.equal((await decider.decide(req('learner_a', 'GET', '/notes/learner_a', 'GET /notes/:id'))).decision, 'allow');
    assert.equal((await decider.decide(req('learner_a', 'PUT', '/notes/learner_a-1', 'PUT /notes/:id'))).decision, 'allow');
    assert.equal((await decider.decide(req('learner_b', 'GET', '/notes', 'GET /notes'))).decision, 'deny');
    assert.equal((await decider.decide(req('learner_b', 'PUT', '/notices/n1', 'PUT /notices/:id'))).decision, 'deny');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('정책 사본이 없거나 검증에 실패하면 차이 보기와 되돌리기가 중단된다', async () => {
  const dir = await sandbox();
  try {
    const file = join(dir, 'policy', 'backup', 'safety-policy.safe-v9.json');
    const policy = JSON.parse(await readFile(file, 'utf8'));
    policy.ownerChecks.denyOtherSubjectIds = false;            // 사본 변조
    await writeFile(file, JSON.stringify(policy));
    for (const script of ['policy-diff.mjs', 'policy-restore.mjs']) {
      const out = run(dir, script, ['--confirm=safe-v9']);
      assert.equal(out.status, 1);
      assert.match(out.stderr, /검증 실패.*중단/u);
    }
    await rm(join(dir, 'policy', 'backup'), { recursive: true });
    const missing = run(dir, 'policy-diff.mjs');
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /사본 목록.*없습니다.*중단/u);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
