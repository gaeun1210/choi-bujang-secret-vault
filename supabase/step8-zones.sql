-- BYTE BACK 8단계: 강사 공지 구역과 강사 권한 (학습용 제안 SQL — 학생이 검토 후 실행)
-- 새 테이블 두 개만 만듭니다. 기존 메모 테이블(public.vault_notes)과 자료·주소는 그대로 둡니다.
-- SQL Editor는 마지막 결과만 보여 주므로 [가] → [나] 순서로 하나씩 붙여 넣어 Run 하세요.

-- ============================================================
-- [가] 공지·강사 권한 테이블 만들기 (여러 번 실행해도 안전)
-- ============================================================
begin;

-- 강사 공지: 자원 ID는 notice_id(UUID). 메모(note_id)와 다른 구역입니다.
create table if not exists public.vault_notices (
  id         bigint generated always as identity primary key,
  notice_id  uuid not null default gen_random_uuid() unique,
  title      text not null,
  content    text not null,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 강사 권한은 서버가 DB에서만 확인합니다. 화면 메뉴·요청 본문의 role은 믿지 않습니다.
create table if not exists public.vault_staff (
  user_id    uuid primary key,
  role       text not null check (role = 'instructor'),
  created_at timestamptz not null default now()
);

-- 5단계와 같은 원칙: 직접 접근 권한 없음, 서버 함수(service_role)만 접근
alter table public.vault_notices enable row level security;
alter table public.vault_staff   enable row level security;
revoke all on table public.vault_notices from public, anon, authenticated;
revoke all on table public.vault_staff   from public, anon, authenticated;
grant select, update on table public.vault_notices to service_role;
grant select on table public.vault_staff to service_role;

-- 공개해도 되는 가상 공지 1건 (이미 있으면 다시 넣지 않음)
insert into public.vault_notices (title, content)
select '3주차 실습 안내', '가상 공지: 이번 주 실습은 방어전 8단계입니다. 자료마다 갈 수 있는 구역을 확인해 주세요.'
where not exists (select 1 from public.vault_notices where title = '3주차 실습 안내');

commit;

-- (선택) 강사 계정 지정: 강사 역할을 시험해 볼 때만, 시험 계정 이메일로 바꿔 따로 실행하세요.
-- 지정하지 않으면 모든 학생 계정의 공지 수정은 거부됩니다(이번 단계의 기본 확인).
-- insert into public.vault_staff (user_id, role)
-- select id, 'instructor' from auth.users where email = '강사-시험-계정-이메일'
-- on conflict (user_id) do nothing;

-- ============================================================
-- [나] 확인: 공지 1건, 강사 0명(또는 지정한 수), 두 테이블 모두 anon·authenticated 권한 없음
-- ============================================================
select
  (select count(*) from public.vault_notices) as notices,
  (select count(*) from public.vault_staff)   as instructors,
  has_table_privilege('anon', 'public.vault_notices', 'select')          as anon_notices,
  has_table_privilege('authenticated', 'public.vault_notices', 'select') as auth_notices,
  has_table_privilege('anon', 'public.vault_staff', 'select')            as anon_staff,
  has_table_privilege('authenticated', 'public.vault_staff', 'select')   as auth_staff,
  (select relrowsecurity from pg_class where oid = 'public.vault_notices'::regclass) as notices_rls,
  (select relrowsecurity from pg_class where oid = 'public.vault_staff'::regclass)   as staff_rls;
