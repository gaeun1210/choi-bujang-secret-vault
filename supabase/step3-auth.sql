-- BYTE BACK 3단계: 로그인한 사용자의 가상 메모 추가·수정·삭제를 위한 테이블 보강
-- Supabase 대시보드 → SQL Editor에 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- 메모 문장·비밀번호·키는 들어 있지 않으므로 Git에 올려도 됩니다.

-- 1) 바깥에 보여 줄 메모 번호를 UUID로 둡니다 (순서대로 매긴 번호를 노출하지 않음).
alter table public.vault_notes
  add column if not exists note_id uuid not null default gen_random_uuid();
create unique index if not exists vault_notes_note_id_key on public.vault_notes (note_id);

-- 2) 서버 함수(서버 전용 키 = service_role)만 읽기·추가·수정·삭제할 수 있습니다.
--    anon·authenticated는 2단계처럼 계속 권한이 없습니다.
grant select, insert, update, delete on table public.vault_notes to service_role;
revoke all on table public.vault_notes from anon, authenticated;

-- 3) 2단계에서 옮긴 주인 없는 가상 메모 4건을 A 계정 것으로 표시합니다.
--    먼저 Authentication → Users에서 A 계정을 만든 뒤, 아래 따옴표 안을 A 계정 이메일로 바꾸고 실행하세요.
update public.vault_notes
set owner_id = (select id from auth.users where email = 'A계정-이메일을-여기에')
where owner_id is null
  and exists (select 1 from auth.users where email = 'A계정-이메일을-여기에');

-- 4) 확인: note_id가 모두 채워졌고, A 계정 메모가 4건이면 정상입니다.
select count(*) filter (where note_id is not null) as with_note_id,
       count(*) filter (where owner_id is not null) as with_owner,
       count(*) as total
from public.vault_notes;

select has_table_privilege('anon', 'public.vault_notes', 'select') as anon_select,
       has_table_privilege('service_role', 'public.vault_notes', 'insert') as service_role_insert;
