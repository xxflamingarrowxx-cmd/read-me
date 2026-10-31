-- Login streak and shelf streak. A missed day never removes points.

create table if not exists streaks (
  user_id      text primary key references profiles (user_id) on delete cascade,
  login_last   date,
  login_count  integer not null default 0,
  shelf_last   date,
  shelf_count  integer not null default 0,
  freeze_week  date
);

create table if not exists streak_awards (
  user_id    text not null references profiles (user_id) on delete cascade,
  kind       text not null check (kind in ('login', 'shelf')),
  milestone  integer not null check (milestone in (3, 7, 30, 100)),
  points     integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, milestone)
);
