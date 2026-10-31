-- Title format and series name. Points are granted once, from the format, not per page.

alter table books add column if not exists format text not null default 'novel';
alter table books add column if not exists series_name text not null default '';

do $$ begin
  alter table books add constraint books_format_check
    check (format in ('novel', 'graphic', 'manga', 'comic'));
exception when duplicate_object then null;
end $$;

alter table discussions add column if not exists book_format text not null default 'novel';

create table if not exists series_bonuses (
  user_id     text not null references profiles (user_id) on delete cascade,
  series_name text not null,
  points      integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (user_id, series_name)
);
