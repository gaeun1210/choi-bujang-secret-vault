-- BYTE BACK 10단계: 비공개 가상 메모 사본(백업)과 감사 기록 (학습용 제안 SQL — 학생이 검토 후 실행)
-- 새 테이블 두 개만 만듭니다. 기존 메모·공지 테이블의 자료와 권한은 바꾸지 않습니다.
-- SQL Editor는 마지막 결과만 보여 주므로 [가] → [나] 순서로 하나씩 붙여 넣어 Run 하세요.
-- 내용 해시 = sha256( 제목 + 줄바꿈 + 내용 ) 16진수 — 서버 함수(src/notes-api.mjs contentHash)와 같은 방식입니다.

-- ============================================================
-- [가] 사본·감사 테이블 만들기 + 지금 있는 메모의 사본 남기기 (여러 번 실행해도 안전)
-- ============================================================
begin;

-- 비공개 메모 사본: 메모를 만들 때(그리고 지금 있는 메모는 아래 seed로) 한 번 남깁니다.
create table if not exists public.vault_notes_backup (
  id           bigint generated always as identity primary key,
  note_id      uuid not null,
  owner_id     uuid not null,
  title        text not null,
  content      text not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  source       text not null check (source in ('create', 'seed')),
  created_at   timestamptz not null default now()
);
create index if not exists vault_notes_backup_note_id_idx on public.vault_notes_backup (note_id, id);

-- 감사 기록: 덧붙이기만 합니다(수정·삭제 권한 없음).
create table if not exists public.vault_audit (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  action   text not null,
  resource text not null,
  actor    text not null,
  detail   jsonb not null default '{}'::jsonb
);

-- 직접 접근 권한 없음(5단계와 같은 원칙). 서버 함수(service_role)도 읽기·덧붙이기만 가능.
alter table public.vault_notes_backup enable row level security;
alter table public.vault_audit        enable row level security;
revoke all on table public.vault_notes_backup from public, anon, authenticated;
revoke all on table public.vault_audit        from public, anon, authenticated;
revoke update, delete, truncate on table public.vault_notes_backup from service_role;
revoke update, delete, truncate on table public.vault_audit        from service_role;
grant select, insert on table public.vault_notes_backup to service_role;
grant select, insert on table public.vault_audit        to service_role;

-- 침해 전 사본: 지금 주인이 있는 메모마다 사본이 없으면 한 건씩 남깁니다.
insert into public.vault_notes_backup (note_id, owner_id, title, content, content_hash, source)
select n.note_id, n.owner_id, n.title, n.content,
       encode(sha256(convert_to(n.title || chr(10) || n.content, 'UTF8')), 'hex'), 'seed'
from public.vault_notes n
where n.owner_id is not null
  and not exists (select 1 from public.vault_notes_backup b where b.note_id = n.note_id);

commit;

-- ============================================================
-- [나] 확인: 사본 수 = 주인 있는 메모 수, 사본 해시가 모두 다시 계산한 값과 같음(mismatched = 0),
--          anon·authenticated 권한 없음, service_role은 수정·삭제 불가
-- ============================================================
select
  (select count(*) from public.vault_notes where owner_id is not null) as notes_with_owner,
  (select count(distinct note_id) from public.vault_notes_backup)     as notes_backed_up,
  (select count(*) from public.vault_notes_backup
     where content_hash <> encode(sha256(convert_to(title || chr(10) || content, 'UTF8')), 'hex')) as mismatched,
  has_table_privilege('anon', 'public.vault_notes_backup', 'select')          as anon_backup,
  has_table_privilege('authenticated', 'public.vault_notes_backup', 'select') as auth_backup,
  has_table_privilege('anon', 'public.vault_audit', 'select')                 as anon_audit,
  has_table_privilege('service_role', 'public.vault_notes_backup', 'update')  as server_can_edit_backup,
  has_table_privilege('service_role', 'public.vault_audit', 'delete')         as server_can_delete_audit;
