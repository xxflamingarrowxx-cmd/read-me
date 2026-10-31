-- Discussions are public to signed-in readers. The author is always the session user.

create table if not exists discussions (
  id           text primary key,
  user_id      text not null references profiles (user_id) on delete cascade,
  title        text not null,
  body         text not null,
  book_title   text not null,
  book_author  text not null,
  book_isbn    text not null default '',
  cover_url    text,
  created_at   timestamptz not null default now()
);

create index if not exists discussions_created_idx on discussions (created_at desc);

create table if not exists discussion_replies (
  id             text primary key,
  discussion_id  text not null references discussions (id) on delete cascade,
  user_id        text not null references profiles (user_id) on delete cascade,
  body           text not null,
  created_at     timestamptz not null default now()
);

create index if not exists discussion_replies_idx on discussion_replies (discussion_id, created_at);

insert into discussions (id, user_id, title, body, book_title, book_author, book_isbn, cover_url)
values
  (
    'disc-mira-prince', 'patron-mira',
    'The rose is the point',
    'I keep coming back to the prince staying. The rose is difficult and he waters her anyway. Did the ending feel like a goodbye or a return?',
    'The Little Prince', 'Antoine de Saint-Exupéry', '9780156012195',
    'https://covers.openlibrary.org/b/isbn/9780156012195-M.jpg'
  ),
  (
    'disc-jonah-piranesi', 'patron-jonah',
    'A house that keeps the tide',
    'The halls repeat until a name breaks them. I want to know which room you trusted first, and whether the tide chart helped or made it worse.',
    'Piranesi', 'Susanna Clarke', '9781635575637',
    'https://covers.openlibrary.org/b/isbn/9781635575637-M.jpg'
  ),
  (
    'disc-adele-pride', 'patron-adele',
    'Mud on the hem',
    'Elizabeth walks to Netherfield and arrives ruined. I liked her more for that than for the dialogue. Where did you decide you were on her side?',
    'Pride and Prejudice', 'Jane Austen', '9780141439518',
    'https://covers.openlibrary.org/b/isbn/9780141439518-M.jpg'
  )
on conflict (id) do nothing;

insert into discussion_replies (id, discussion_id, user_id, body)
values
  (
    'reply-jonah-rose', 'disc-mira-prince', 'patron-jonah',
    'A return. He draws the sheep so the muzzle can stay unseen, which is the same kindness he gives the rose.'
  ),
  (
    'reply-mira-mud', 'disc-adele-pride', 'patron-mira',
    'At the muddy hem. The wit comes later. The walk is the character.'
  )
on conflict (id) do nothing;
