// POST /api/restore/:id — 비공개 메모 사본에서 "본인 메모 한 건"만 복원합니다(10단계).
// 1) 로그인 확인 2) 그 메모의 침해 전 사본(가장 이른 사본) 찾기 3) 사본 해시 재검증(실패하면 중단)
// 4) 사본 소유자 = 요청자인지 대조(아니면 404) 5) 그 한 건만 되돌림 6) 다시 읽어 ID·소유자·내용 해시 대조
// 7) 감사 기록 덧붙이기. 다른 메모와 기존 감사 기록은 건드리지 않습니다.
import { UUID, audit, backups, contentHash, currentNoteRow, dbFailure, logDenial, requireUser, resourceId,
  restoreNoteRow, send } from '../../src/notes-api.mjs';

const notFound = response => send(response, 404, { error: 'NOT_FOUND', message: '복원할 메모 사본이 없습니다.' });

export default async function handler(request, response) {
  if ((request.method ?? 'GET') !== 'POST') {
    response.setHeader('Allow', 'POST');
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED', message: '복원은 POST만 됩니다.' });
  }
  const userId = await requireUser(request, response);
  if (!userId) return undefined;

  const raw = request.query?.id;
  const id = typeof raw === 'string' && UUID.test(raw) ? raw.toLowerCase() : null;
  if (!id) {
    logDenial('invalid_resource_id', 'note:?', userId);
    return notFound(response);
  }
  const resource = resourceId('note', id);

  try {
    const snapshot = await backups.earliest(id);
    if (!snapshot) {
      logDenial('backup_missing', resource, userId);
      return notFound(response);
    }
    if (contentHash(snapshot.title, snapshot.content) !== snapshot.content_hash) {
      await audit('restore_stopped', resource, userId, { reason: 'backup_hash_mismatch' });
      return send(response, 409, { error: 'BACKUP_VERIFY_FAILED', message: '사본 검증에 실패해 복원을 중단했습니다.' });
    }
    if (snapshot.owner_id !== userId) {
      logDenial('not_owner', resource, userId);
      await audit('restore_denied', resource, userId, { reason: 'not_owner' });
      return notFound(response);
    }
    const current = await currentNoteRow(id);
    if (current && current.owner_id !== userId) {
      logDenial('owner_conflict', resource, userId);
      await audit('restore_denied', resource, userId, { reason: 'owner_conflict' });
      return notFound(response);
    }
    const changed = !current || current.title !== snapshot.title || current.content !== snapshot.content;
    if (changed) await restoreNoteRow(id, userId, snapshot, Boolean(current));

    const after = await currentNoteRow(id);
    const afterHash = after ? contentHash(after.title, after.content) : null;
    if (!after || after.note_id !== id || after.owner_id !== userId || afterHash !== snapshot.content_hash) {
      await audit('restore_stopped', resource, userId, { reason: 'post_restore_mismatch' });
      return send(response, 500, { error: 'RESTORE_VERIFY_FAILED', message: '복원 뒤 대조가 맞지 않습니다.' });
    }
    await audit('restore_note', resource, userId, { contentHash: afterHash, snapshotSource: snapshot.source,
      snapshotAt: snapshot.created_at, changed });
    return send(response, 200, {
      id, title: after.title, body: after.content,
      contentHash: afterHash, ownerVerified: true, restoredFrom: snapshot.created_at, changed,
    });
  } catch (error) {
    return dbFailure(response, error);
  }
}
