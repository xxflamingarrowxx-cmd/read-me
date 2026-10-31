-- Public reader search. Private, suspended, and blocked profiles stay out of results.
alter table profiles add column if not exists is_private boolean not null default false;
alter table profiles add column if not exists suspended boolean not null default false;

create table if not exists blocks (
  blocker_id text not null references profiles (user_id) on delete cascade,
  blocked_id text not null references profiles (user_id) on delete cascade,
  primary key (blocker_id, blocked_id)
);
