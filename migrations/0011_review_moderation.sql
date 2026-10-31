-- Review reports. Points are never sold, gifted, or moved to the reporter.
alter table reviews add column if not exists hidden boolean not null default false;
alter table reviews add column if not exists removed_at timestamptz;

create table if not exists review_reports (
  id                 text primary key,
  review_id          text not null,
  reporter_id        text not null references profiles (user_id) on delete cascade,
  reason             text not null check (reason in ('spam', 'copied', 'wrong-book', 'offensive', 'other')),
  review_body        text not null,
  book_title         text not null,
  book_author        text not null default '',
  format             text not null default '',
  points_earned      integer not null default 0,
  review_created_at  timestamptz not null,
  reviewer_id        text not null,
  reviewer_name      text not null,
  status             text not null default 'open' check (status in ('open', 'dismissed', 'removed', 'removed-points')),
  created_at         timestamptz not null default now(),
  unique (review_id, reporter_id)
);

create index if not exists review_reports_review_idx on review_reports (review_id, status);

create table if not exists review_strikes (
  id            text primary key,
  user_id       text not null references profiles (user_id) on delete cascade,
  review_id     text not null unique,
  book_title    text not null,
  points_taken  integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists review_strikes_user_idx on review_strikes (user_id);
