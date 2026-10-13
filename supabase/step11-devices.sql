-- BYTE BACK 11단계: 기기 승인 목록 (학습용 제안 SQL — 학생이 검토 후 실행)
-- 새 테이블 하나만 만듭니다. 기존 메모·공지·사본·감사 테이블은 바꾸지 않습니다.
-- 브라우저에는 기기 비밀값이 HttpOnly 쿠키로만 있고(자바스크립트가 읽을 수 없음),
-- 이 테이블에는 그 비밀값의 sha256 해시만 저장합니다. 승인 여부는 이 테이블(서버)만 정합니다.

-- ============================================================
-- [가] 기기 승인 테이블 만들기 (여러 번 실행해도 안전)
-- ============================================================
begin;

create table if not exists public.vault_devices (
  device_hash  text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  owner_id     uuid not null,
  device_code  text not null check (device_code ~ '^[0-9A-F]{4}-[0-9A-F]{4}$'),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  label        text,
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  approved_via text,
  primary key (device_hash, owner_id)
);
create index if not exists vault_devices_owner_code_idx on public.vault_devices (owner_id, device_code);

alter table public.vault_devices enable row level security;
revoke all on table public.vault_devices from public, anon, authenticated;
revoke delete, truncate on table public.vault_devices from service_role;
grant select, insert, update on table public.vault_devices to service_role;

commit;

-- ============================================================
-- [나] 확인: anon·authenticated 권한 없음, RLS 켜짐
-- ============================================================
select
  has_table_privilege('anon', 'public.vault_devices', 'select')          as anon_devices,
  has_table_privilege('authenticated', 'public.vault_devices', 'select') as auth_devices,
  (select relrowsecurity from pg_class where oid = 'public.vault_devices'::regclass) as devices_rls,
  (select count(*) from public.vault_devices) as devices;

-- ============================================================
-- [다] 첫 기기 승인 (자료실 화면에서 "이 기기 승인 요청"을 누른 뒤, 화면에 나온 기기 코드로 실행)
-- 'XXXX-XXXX' 를 화면의 기기 코드로 바꾸세요. 대기(pending) 중인 그 코드 한 건만 승인합니다.
-- 두 번째 기기부터는 이미 승인된 기기의 자료실 화면에서 승인할 수 있습니다.
-- ============================================================
-- update public.vault_devices
-- set status = 'approved', approved_at = now(), approved_via = 'sql_editor'
-- where device_code = 'XXXX-XXXX' and status = 'pending';
--
-- insert into public.vault_audit (action, resource, actor, detail)
-- values ('device_approve', 'device:XXXX-XXXX', 'sql', '{"via":"sql_editor"}'::jsonb);
