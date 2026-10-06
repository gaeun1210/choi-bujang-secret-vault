-- BYTE BACK 4단계 ① 소유자 연결 + B 시험 메모 (학습용 제안 SQL)
-- API·권한 정책은 바꾸지 않습니다. 이메일은 Git에 올리지 않도록 자리표시로 두었습니다.
-- 실행 전 'A계정-이메일' 2곳, 'B계정-이메일' 1곳을 Authentication → Users의 실제 시험 계정 이메일로 바꾸세요.
-- 여러 번 실행해도 메모가 중복되지 않습니다.

-- 1) 주인 없는 기존 가상 메모를 A 계정에 연결 (3단계에서 이미 연결됐다면 0행 변경)
update public.vault_notes
set owner_id = (select id from auth.users where email = 'A계정-이메일')
where owner_id is null
  and exists (select 1 from auth.users where email = 'A계정-이메일');

-- 2) B 소유의 공개 가능한 시험 메모 1건 (이미 있으면 다시 넣지 않음)
insert into public.vault_notes (owner_id, title, content)
select u.id, 'B 시험 메모', 'B 계정 소유 확인용 공개 가능 시험 메모'
from auth.users u
where u.email = 'B계정-이메일'
  and not exists (
    select 1 from public.vault_notes n
    where n.owner_id = u.id and n.title = 'B 시험 메모'
  );

-- 3) 확인: 계정별 메모 수 (A는 기존 가상 메모 수, B는 1 이상이면 정상. 주인 없는 메모 0)
select coalesce(u.email, '(주인 없음)') as owner_email,
       n.owner_id,
       count(*) as notes
from public.vault_notes n
left join auth.users u on u.id = n.owner_id
group by u.email, n.owner_id
order by owner_email;
