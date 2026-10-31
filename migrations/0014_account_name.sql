-- The name on the shelf is chosen by the reader, not locked to Google, X, or email.
alter table profiles add column if not exists name_set boolean not null default false;
