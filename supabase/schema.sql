-- ════════════════════════════════════════════════════════════
--  사주 리포트 판매 — Supabase 스키마
--  Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행하세요.
-- ════════════════════════════════════════════════════════════

-- 1) 상품 가격표. 금액 검증의 기준이 되므로 서버만 읽습니다.
create table if not exists products (
  code        text primary key,
  name        text not null,
  amount      integer not null check (amount > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into products (code, name, amount) values
  ('life',    '평생사주 30문항',  29000),
  ('wealth',  '재물사주 30문항',  24000),
  ('destiny', '인연사주 30문항',  24000),
  ('year',    '올해의 운세',        9900),
  ('compat',  '궁합 리포트',       19000)
on conflict (code) do update
  set name = excluded.name, amount = excluded.amount;

-- 2) 주문
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  order_id        text unique not null,          -- 토스에 넘긴 주문번호
  product_code    text not null references products(code),
  amount          integer not null,
  email           text not null,
  status          text not null default 'pending'
                  check (status in ('pending','paid','canceled','failed')),
  payment_key     text,                          -- 토스 결제 식별자. 조회·취소에 필요
  method          text,
  approved_at     timestamptz,
  canceled_at     timestamptz,
  cancel_reason   text,
  -- 구매 시점의 사주 입력값. 재조회용이며 이름·연락처는 담지 않습니다.
  birth           jsonb,
  access_token    text unique not null,          -- 기기 복원용 무작위 토큰
  viewed_at       timestamptz,                   -- 최초 열람 시각 (환불 기준)
  raw             jsonb,                         -- 토스 응답 원문 보관
  created_at      timestamptz not null default now()
);

create index if not exists orders_email_idx  on orders (email);
create index if not exists orders_token_idx  on orders (access_token);
create index if not exists orders_status_idx on orders (status);

-- 3) 환불 로그
create table if not exists refunds (
  id            uuid primary key default gen_random_uuid(),
  order_id      text not null references orders(order_id),
  amount        integer not null,
  reason        text,
  created_at    timestamptz not null default now()
);

-- 4) 결제 웹훅 수신 기록 (중복 처리 방지)
create table if not exists webhook_events (
  event_id    text primary key,
  type        text,
  payload     jsonb,
  received_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════
--  RLS — 브라우저(anon 키)에서는 아무것도 못 읽게 막습니다.
--  모든 접근은 service_role 키를 쓰는 서버 함수를 통해서만 이뤄집니다.
-- ════════════════════════════════════════════════════════════
alter table products       enable row level security;
alter table orders         enable row level security;
alter table refunds        enable row level security;
alter table webhook_events enable row level security;
-- 정책을 하나도 만들지 않으면 anon 은 전부 거부됩니다. 의도된 설정입니다.

-- ════════════════════════════════════════════════════════════
--  적중 체크 — 예측이 맞았는지 사용자가 남기는 기록
-- ════════════════════════════════════════════════════════════
create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  user_key    text not null,                 -- 기기에서 만든 익명 키 (로그인 없음)
  kind        text not null,                 -- daily | year | life | wealth | destiny | taekil | decision
  ref_id      text,                          -- 문항 번호, 날짜, 질문 코드 등
  field       text,                          -- 금전 / 애정 / 건강 …
  hit         boolean not null,              -- 맞았다 / 아니다
  note        text,
  birth_hash  text,                          -- 같은 명식끼리 묶어 보기 위한 해시 (생년월일 원본 아님)
  created_at  timestamptz not null default now()
);
create index if not exists feedback_user_idx on feedback (user_key);
create index if not exists feedback_kind_idx on feedback (kind, field);
alter table feedback enable row level security;

-- 선물 주문
alter table orders add column if not exists gift_email text;
alter table orders add column if not exists gift_message text;

-- 구독
create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  billing_key   text,                        -- 토스 빌링키 (자동결제)
  customer_key  text,
  plan          text not null default 'basic',
  amount        integer not null default 4900,
  status        text not null default 'active'
                check (status in ('active','paused','canceled')),
  next_charge   date,
  started_at    timestamptz not null default now(),
  canceled_at   timestamptz
);
create index if not exists subs_email_idx on subscriptions (email);
alter table subscriptions enable row level security;

insert into products (code, name, amount) values
  ('sub', '구독 — 택일·결정상담·월간리포트', 4900)
on conflict (code) do update set name = excluded.name, amount = excluded.amount;
