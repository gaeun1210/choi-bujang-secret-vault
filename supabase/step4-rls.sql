-- BYTE BACK 4단계 ③ 메모 테이블 RLS + 최소 권한 (학습용 제안 SQL — 학생이 검토 후 실행)
-- 대상은 public.vault_notes 하나뿐입니다. 다른 테이블은 건드리지 않습니다.
-- SQL Editor는 마지막 조회 결과만 보여 주므로 [가] → [나] → [다]를 각각 따로 선택해 Run 하세요.
-- 서버 함수는 계속 서버 전용 키(service_role)로 접근하며, 앱 API의 소유자 검사가 1차 방어입니다.
-- 이 RLS는 Data API를 직접 부를 때의 2차 방어입니다.

-- ============================================================
-- [가] 적용 전 권한 기록 (이 블록만 선택해 Run → 결과를 캡처해 두기)
-- ============================================================
select r.rolname as role,
       p.privilege,
       has_table_privilege(r.rolname, 'public.vault_notes', p.privilege) as has_privilege,
       exists (
         select 1 from information_schema.role_table_grants g
         where g.table_schema = 'public' and g.table_name = 'vault_notes'
           and g.grantee = r.rolname and g.privilege_type = p.privilege
       ) as listed_in_role_table_grants
from (values ('anon'), ('authenticated')) as r(rolname)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                   ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(privilege)
order by role, privilege;

-- ============================================================
-- [나] 적용 (이 블록만 선택해 Run)
-- ============================================================
begin;

alter table public.vault_notes enable row level security;

-- 기존 권한 모두 회수
revoke all on table public.vault_notes from public, anon, authenticated;

-- 로그인 사용자(authenticated)에게 네 가지 권한만 부여. anon에는 아무것도 주지 않음.
grant select, insert, update, delete on table public.vault_notes to authenticated;

-- 정책: 모두 auth.uid() = owner_id 일 때만 허용
drop policy if exists vault_notes_select_own on public.vault_notes;
drop policy if exists vault_notes_insert_own on public.vault_notes;
drop policy if exists vault_notes_update_own on public.vault_notes;
drop policy if exists vault_notes_delete_own on public.vault_notes;

create policy vault_notes_select_own on public.vault_notes
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy vault_notes_insert_own on public.vault_notes
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy vault_notes_update_own on public.vault_notes
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy vault_notes_delete_own on public.vault_notes
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

commit;

-- ============================================================
-- [다] 적용 후 권한 대조 (이 블록만 선택해 Run)
-- 기대: anon은 7개 모두 false / authenticated는 SELECT·INSERT·UPDATE·DELETE만 true
-- ============================================================
select r.rolname as role,
       p.privilege,
       has_table_privilege(r.rolname, 'public.vault_notes', p.privilege) as has_privilege,
       exists (
         select 1 from information_schema.role_table_grants g
         where g.table_schema = 'public' and g.table_name = 'vault_notes'
           and g.grantee = r.rolname and g.privilege_type = p.privilege
       ) as listed_in_role_table_grants,
       case
         when r.rolname = 'anon' then false
         else p.privilege in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
       end as expected
from (values ('anon'), ('authenticated')) as r(rolname)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                   ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(privilege)
order by role, privilege;

-- (선택) 정책 4개 확인: 하나씩 따로 Run
-- select policyname, cmd, roles, qual, with_check from pg_policies
-- where schemaname = 'public' and tablename = 'vault_notes' order by cmd;
