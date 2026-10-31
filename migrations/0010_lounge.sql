-- Friends and private notes. Points and owned items are never moved here.
alter table profiles add column if not exists request_policy text not null default 'anyone';
alter table profiles add column if not exists is_admin boolean not null default false;

create table if not exists friend_requests (
  id            text primary key,
  from_user_id  text not null references profiles (user_id) on delete cascade,
  to_user_id    text not null references profiles (user_id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  unique (from_user_id, to_user_id),
  check (from_user_id <> to_user_id)
);

create index if not exists friend_requests_to_idx on friend_requests (to_user_id, status);
create index if not exists friend_requests_from_idx on friend_requests (from_user_id, status);

create table if not exists messages (
  id            text primary key,
  from_user_id  text not null references profiles (user_id) on delete cascade,
  to_user_id    text not null references profiles (user_id) on delete cascade,
  body          text not null,
  created_at    timestamptz not null default now(),
  read_at       timestamptz,
  check (from_user_id <> to_user_id)
);

create index if not exists messages_pair_idx on messages (from_user_id, to_user_id, created_at);
create index if not exists messages_inbox_idx on messages (to_user_id, read_at);

create table if not exists reports (
  id              text primary key,
  reporter_id     text not null references profiles (user_id) on delete cascade,
  target_user_id  text not null references profiles (user_id) on delete cascade,
  reason          text not null,
  place           text not null default 'profile' check (place in ('profile', 'chat')),
  created_at      timestamptz not null default now()
);

create index if not exists reports_created_idx on reports (created_at desc);

create table if not exists rate_events (
  user_id     text not null,
  kind        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists rate_events_idx on rate_events (user_id, kind, created_at);
