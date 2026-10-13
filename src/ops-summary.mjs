// GET /api/ops/summary — 탈환 작전실 요약(12단계). 로그인 + 서버가 승인한 기기에서만.
// Vercel 무료 요금제의 서버 함수 12개 제한 때문에 별도 함수 파일 대신 api/auth/session.js가 이 처리기를 부릅니다
// (vercel.json rewrites: /api/ops/summary → /api/auth/session?view=ops).
// 학생 판정기 규칙·정책 버전, 탐지 규칙, 회수(기기 승인·취소) 상태, 복구 버전(정책 사본·메모 사본)과
// 그 수치의 근거가 되는 가린 서버 기록을 같은 응답으로 돌려줍니다. 메모 본문·토큰·비밀값은 없습니다.
import { readFileSync } from 'node:fs';
import { policyHash, readPolicyFromDecider } from '../scripts/policy-lib.mjs';
import { POLICY_VERSION, RULE_IDS } from './decider.mjs';
import { DETECTION_RULE_IDS } from './detect.mjs';
import { audit, dbFailure, opsSummary, requireUser, send } from './notes-api.mjs';

// 정책 사본 대조: 배포된 판정기 파일의 SAFETY-POLICY 블록 sha256을 실제로 계산해 사본 목록의 sha256과 비교합니다.
// 파일을 읽지 못하면 비교하지 않은 것이므로 null(미실행)입니다. 버전 이름만 같다고 같다고 하지 않습니다.
function policyBackup() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(new URL('../policy/backup/MANIFEST.json', import.meta.url), 'utf8'));
  } catch {
    return null;
  }
  let currentSha = null;
  try {
    currentSha = policyHash(readPolicyFromDecider(readFileSync(new URL('./decider.mjs', import.meta.url), 'utf8')));
  } catch { /* 미실행 */ }
  return { version: manifest.version, sha256: `${String(manifest.sha256).slice(0, 12)}…`, verifiedAt: manifest.verifiedAt,
    currentSha256: currentSha ? `${currentSha.slice(0, 12)}…` : null,
    matches: currentSha ? currentSha === manifest.sha256 : null };
}

// 출처: 제공 엔진과 학생 작업을 나눠 적습니다.
const SOURCES = Object.freeze({
  engine: { name: 'ALEPH SDP 엔진', provider: '운영 측 제공', role: '신원·기기·경로 확인, 판정 요청 전달, 탐지 사건 전달, 접속 회수 실행',
    inThisRepo: false },
  student: [
    { part: '판정기', files: 'src/decider.mjs' },
    { part: '탐지 규칙', files: 'src/detect.mjs' },
    { part: '접속 앱', files: 'public/' },
    { part: '자료실', files: 'api/, src/notes-api.mjs, src/ops-summary.mjs, supabase/' },
  ],
});

export async function opsSummaryHandler(request, response) {
  if ((request.method ?? 'GET') !== 'GET') {
    response.setHeader('Allow', 'GET');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'GET만 됩니다.' });
  }
  const owner = await requireUser(request, response);
  if (!owner) return undefined;
  // 진단(12단계): 누가 작전실 요약을 읽었는지 감사 기록에 덧붙입니다(사용자 키 앞 8자리, 시각만).
  await audit('ops_view', 'route:GET /api/ops/summary', owner, {});
  try {
    const server = await opsSummary(owner);
    const backup = policyBackup();
    return send(response, 200, {
      schema: 'aleph.ops.summary.v1',
      checkedAt: new Date().toISOString(),
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 12) || null,
      decider: { source: '학생 작업: src/decider.mjs', ruleIds: [...RULE_IDS], policyVersion: POLICY_VERSION,
        policyMatchesBackup: backup?.matches ?? null,
        liveDecisions: '미실행 — 판정 요청은 ALEPH SDP 엔진(제공)이 보내며 이 서버에는 판정 기록이 없음' },
      detection: { source: '학생 작업: src/detect.mjs', ruleIds: [...DETECTION_RULE_IDS],
        events: '미실행 — 탐지 사건은 ALEPH SDP 엔진(제공)이 전달하며 이 서버에는 사건 기록이 없음' },
      revocation: { source: 'server:vault_devices', ...server.devices },
      recovery: { source: 'server:vault_notes_backup + policy/backup', policyBackup: backup, ...server.backups,
        restores: server.audit.byAction.restore_note ?? 0 },
      denials: { source: 'server:vault_audit action=deny (모든 요청, 가림, 최근 50건)', ...server.denials },
      sources: SOURCES,
      views: { source: 'server:vault_audit action=ops_view (모든 사용자, 가림, 최근 20건)', ...server.views },
      notes: server.notes,
      audit: { source: 'server:vault_audit (내 기록, 최근 50건)', ...server.audit },
    });
  } catch (error) {
    return dbFailure(response, error);
  }
}
