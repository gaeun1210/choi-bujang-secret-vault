-- BYTE BACK 5단계: 메모 테이블의 직접 접근 권한 회수 (학습용 제안 SQL — 학생이 검토 후 실행)
-- 대상은 public.vault_notes 하나뿐입니다. 다른 테이블은 건드리지 않습니다.
-- 이후 메모는 서버 함수(서버 전용 키 = service_role)를 통해서만 읽고 고칩니다.
-- 서버 함수의 로그인·소유자 검사와 service_role 권한은 그대로 둡니다.
-- SQL Editor는 마지막 조회 결과만 보여 주므로 [가] → [나] → [다]를 하나씩 붙여 넣어 Run 하세요.

-- ============================================================
-- [가] 적용 전 권한 기록 (4단계 뒤라면 authenticated에 4개 true가 보여야 정상)
-- ============================================================
select r.rolname as role,
       p.privilege,
       has_table_privilege(r.rolname, 'public.vault_notes', p.privilege) as has_privilege,
       exists (
         select 1 from information_schema.role_table_grants g
         where g.table_schema = 'public' and g.table_name = 'vault_notes'
           and g.grantee = r.rolname and g.privilege_type = p.privilege
       ) as listed_in_role_table_grants
from (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                   ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(privilege)
order by role, privilege;

-- ============================================================
-- [나] 적용: PUBLIC·anon·authenticated의 직접 권한을 모두 회수
-- ============================================================
begin;
alter table public.vault_notes enable row level security;
revoke all on table public.vault_notes from public, anon, authenticated;
-- 서버 함수가 쓰는 service_role 권한은 유지 (이미 있으면 그대로)
grant select, insert, update, delete on table public.vault_notes to service_role;
commit;
-- 참고: 4단계의 RLS 정책 4개는 남겨 둡니다. 권한(GRANT)이 없으므로 정책이 있어도 직접 접근은 막히고,
--       나중에 실수로 권한이 다시 열려도 본인 행만 보이게 하는 2차 안전장치가 됩니다.

-- ============================================================
-- [다] 적용 후 권한 대조
-- 기대: anon·authenticated 14줄 모두 false / service_role은 SELECT·INSERT·UPDATE·DELETE true
--       (service_role의 나머지 3개는 Supabase 기본값에 따라 true일 수 있으며 이번 확인 대상이 아님)
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
         when r.rolname <> 'service_role' then 'false'
         when p.privilege in ('SELECT', 'INSERT', 'UPDATE', 'DELETE') then 'true'
         else '상관없음 (서버 전용 역할의 기본 권한)'
       end as expected
from (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                   ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(privilege)
order by role, privilege;
