-- Read-Me library: per-reader shelves, reviews, and point awards.
-- Public shelf rows are readable by any signed-in reader. Writes always use
-- the session user id, never a client-supplied owner.

create table if not exists profiles (
  user_id      text primary key,
  display_name text not null,
  points       integer not null default 0 check (points >= 0),
  outfit       text not null default 'outfit-oatmeal',
  shelf        text not null default 'shelf-honey',
  lamp         text not null default 'lamp-brass',
  created_at   timestamptz not null default now()
);

create table if not exists owned_items (
  user_id text not null references profiles (user_id) on delete cascade,
  item_id text not null,
  primary key (user_id, item_id)
);

create table if not exists books (
  id             text primary key,
  user_id        text not null references profiles (user_id) on delete cascade,
  isbn           text not null default '',
  title          text not null,
  author         text not null,
  cover_url      text,
  page_count     integer not null check (page_count > 0),
  pages_read     integer not null default 0 check (pages_read >= 0),
  status         text not null default 'reading' check (status in ('reading', 'finished')),
  points_earned  integer not null default 0,
  added_at       timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  finished_at    timestamptz
);

create index if not exists books_user_idx on books (user_id);

create table if not exists reviews (
  id             text primary key,
  user_id        text not null references profiles (user_id) on delete cascade,
  book_id        text not null references books (id) on delete cascade,
  pages          integer not null,
  body           text not null,
  points_earned  integer not null default 0,
  tips           integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists reviews_book_idx on reviews (book_id);
create index if not exists reviews_user_idx on reviews (user_id);

create table if not exists tips (
  id            text primary key,
  review_id     text not null references reviews (id) on delete cascade,
  from_user_id  text not null references profiles (user_id) on delete cascade,
  to_user_id    text not null references profiles (user_id) on delete cascade,
  amount        integer not null check (amount > 0),
  created_at    timestamptz not null default now(),
  unique (review_id, from_user_id)
);

insert into profiles (user_id, display_name, points, outfit, shelf, lamp)
values
  ('patron-mira', 'Mira', 180, 'outfit-berry', 'shelf-honey', 'lamp-lantern'),
  ('patron-jonah', 'Jonah', 420, 'outfit-sage', 'shelf-walnut', 'lamp-green'),
  ('patron-adele', 'Adele', 90, 'outfit-oatmeal', 'shelf-sage', 'lamp-brass')
on conflict (user_id) do nothing;

insert into books (id, user_id, isbn, title, author, cover_url, page_count, pages_read, status, points_earned, finished_at)
values
  (
    'book-mira-prince', 'patron-mira', '9780156012195',
    'The Little Prince', 'Antoine de Saint-Exupéry',
    'https://covers.openlibrary.org/b/isbn/9780156012195-M.jpg',
    96, 96, 'finished', 272, now()
  ),
  (
    'book-jonah-piranesi', 'patron-jonah', '9781635575637',
    'Piranesi', 'Susanna Clarke',
    'https://covers.openlibrary.org/b/isbn/9781635575637-M.jpg',
    245, 245, 'finished', 570, now()
  ),
  (
    'book-jonah-hobbit', 'patron-jonah', '9780547928227',
    'The Hobbit', 'J.R.R. Tolkien',
    'https://covers.openlibrary.org/b/isbn/9780547928227-M.jpg',
    300, 60, 'reading', 120, null
  ),
  (
    'book-adele-pride', 'patron-adele', '9780141439518',
    'Pride and Prejudice', 'Jane Austen',
    'https://covers.openlibrary.org/b/isbn/9780141439518-M.jpg',
    279, 80, 'reading', 160, null
  )
on conflict (id) do nothing;

insert into reviews (id, user_id, book_id, pages, body, points_earned, tips)
values
  (
    'rev-mira-prince', 'patron-mira', 'book-mira-prince', 96,
    'The rose is fussy and worth it. I read the ending twice and the sky still felt large.',
    272, 0
  ),
  (
    'rev-jonah-piranesi', 'patron-jonah', 'book-jonah-piranesi', 245,
    'The halls repeat until a name breaks the pattern. I kept a tide chart beside the book.',
    570, 0
  ),
  (
    'rev-jonah-hobbit', 'patron-jonah', 'book-jonah-hobbit', 60,
    'Bilbo leaves the door open and the pantry full. I would not have been that brave.',
    120, 0
  ),
  (
    'rev-adele-pride', 'patron-adele', 'book-adele-pride', 80,
    'Elizabeth walks to Netherfield in the mud, and I liked her more for the ruined hem.',
    160, 0
  )
on conflict (id) do nothing;
