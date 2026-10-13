// 8단계 자원 구역 규칙 로컬 연습 — 가상 요청으로 decide()의 구역 판정을 확인합니다.
// ALEPH SDP 엔진(제공)의 실제 판정이나 심판 통과 증거가 아닙니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';

const { normal, suspicious } = fixtureRequests();
const req = (method, path, extra = {}) => {
  const parts = path.split('/');
  const route = `${method} ${parts.length === 3 ? `/${parts[1]}/:id` : path}`;
  return { ...normal, method, path, route, ...extra };
};
const A = '9f'.repeat(16);
const B = 'a1'.repeat(16);

const cases = [
  ['정상 · A 자기 메모 읽기', normal, 'allow'],
  ['정상 · A 자기 메모 수정', req('PUT', '/notes/demo'), 'allow'],
  ['정상 · 공지 읽기', req('GET', '/notices/n1'), 'allow'],
  ['금지 · 메모 목록(8단계에서 닫음)', req('GET', '/notes'), 'deny'],
  ['금지 · B가 A 메모 읽기', req('GET', '/notes/learner_a', { subjectId: 'learner_b' }), 'deny'],
  ['금지 · B가 A 메모 수정', req('PUT', '/notes/learner_a-note-1', { subjectId: 'learner_b' }), 'deny'],
  ['금지 · B가 A 메모 수정(해시 주체)', req('PUT', `/notes/${B}-note-1`, { subjectId: A }), 'deny'],
  ['금지 · 학생의 공지 수정', req('PUT', '/notices/n1'), 'deny'],
  ['금지 · 메모 경로로 공지 수정', req('PUT', '/notes/notice-1'), 'deny'],
  ['금지 · 알 수 없는 경로', req('GET', '/admin'), 'deny'],
  ['금지 · 미등록 기기', { ...normal, deviceRegistered: false }, 'deny'],
  ['추가 확인 · 복합 이상 접속', suspicious, 'step_up'],
];

for (const [label, request, want] of cases) {
  test(label, async () => {
    const result = await decide(request);
    assert.deepEqual(Object.keys(result).sort(), ['decision', 'reasonCode', 'requestId', 'ruleIds', 'schema']);
    assert.equal(result.requestId, request.requestId);
    assert.equal(result.decision, want);
    if (want !== 'allow') assert.ok(result.ruleIds.length > 0);
  });
}

test('B의 A 메모 수정 거부 이유는 route_not_allowed', async () => {
  const result = await decide(req('PUT', '/notes/learner_a-note-1', { subjectId: 'learner_b' }));
  assert.equal(result.reasonCode, 'route_not_allowed');
});
