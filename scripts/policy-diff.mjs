// npm run policy:diff — 침해 전에 검증한 안전 정책 사본과 현재 시험 정책(판정기 블록)의 차이만 보여 줍니다.
// 아무 파일도 바꾸지 않습니다. 사본이 없거나 검증에 실패하면 중단합니다.
import { readFile } from 'node:fs/promises';
import { diffPolicies, policyHash, printReport, readPolicyFromDecider, readVerifiedBackup } from './policy-lib.mjs';

const root = new URL('../', import.meta.url);
try {
  const backup = await readVerifiedBackup(new URL('policy/backup/', root));
  const current = readPolicyFromDecider(await readFile(new URL('src/decider.mjs', root), 'utf8'));
  const changes = diffPolicies(backup.policy, current);
  printReport({ backup, current, currentHash: policyHash(current), changes, write: t => process.stdout.write(t) });
} catch (error) {
  process.stderr.write(`정책 차이 보기 중단: ${error.message}\n`);
  process.exitCode = 1;
}
