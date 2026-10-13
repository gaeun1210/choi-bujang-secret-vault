// npm run policy:restore — 검증한 안전 정책 사본으로 시험 정책(판정기의 SAFETY-POLICY 블록)만 되돌립니다.
// 1) 사본 검증(없거나 다르면 중단) 2) 바뀔 항목 표시 3) --confirm=<버전> 이 있을 때만 적용
// 4) policy/audit.log 에 한 줄 덧붙이기(기존 기록은 지우거나 고치지 않음) 5) 판정기 연습 시험 다시 실행
// 블록 밖의 판정기 코드, 다른 서비스 규칙, 자료 API, 실제 운영 정책은 건드리지 않습니다.
import { spawnSync } from 'node:child_process';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { diffPolicies, policyHash, printReport, readPolicyFromDecider, readVerifiedBackup,
  writePolicyIntoDecider } from './policy-lib.mjs';

const root = new URL('../', import.meta.url);
const deciderUrl = new URL('src/decider.mjs', root);
const write = t => process.stdout.write(t);
try {
  const backup = await readVerifiedBackup(new URL('policy/backup/', root));
  const text = await readFile(deciderUrl, 'utf8');
  const current = readPolicyFromDecider(text);
  const currentHash = policyHash(current);
  const changes = diffPolicies(backup.policy, current);
  printReport({ backup, current, currentHash, changes, write });
  if (!changes.length) {
    write('되돌릴 것이 없어 아무것도 바꾸지 않았습니다.\n');
  } else {
    const confirm = process.argv.slice(2).find(arg => arg.startsWith('--confirm='))?.slice('--confirm='.length);
    if (confirm !== backup.manifest.version) {
      write(`\n아직 바꾸지 않았습니다. 위 항목을 확인한 뒤 적용하려면:\n  npm run policy:restore -- --confirm=${backup.manifest.version}\n`);
      process.exitCode = 2;
    } else {
      await writeFile(deciderUrl, writePolicyIntoDecider(text, backup.policy), 'utf8');
      const check = readPolicyFromDecider(await readFile(deciderUrl, 'utf8'));
      if (policyHash(check) !== backup.hash) throw new Error('되돌린 뒤 다시 읽은 정책 해시가 사본과 다릅니다.');
      await appendFile(new URL('policy/audit.log', root), `${JSON.stringify({
        at: new Date().toISOString(), action: 'policy_restore', version: backup.manifest.version,
        fromSha256: currentHash, toSha256: backup.hash, changedItems: changes.map(item => item.item),
      })}\n`, 'utf8');
      write(`\n적용 완료: 시험 정책을 ${backup.manifest.version} 으로 되돌렸고 policy/audit.log 에 한 줄을 덧붙였습니다.\n`);
      write('판정기 연습 시험을 다시 실행합니다:\n');
      const result = spawnSync(process.execPath, [fileURLToPath(new URL('scripts/decider-test.mjs', root))], { encoding: 'utf8' });
      write(result.stdout);
      if (result.status !== 0) {
        process.stderr.write(result.stderr);
        process.exitCode = 1;
      }
    }
  }
} catch (error) {
  process.stderr.write(`정책 되돌리기 중단: ${error.message}\n`);
  process.exitCode = 1;
}
