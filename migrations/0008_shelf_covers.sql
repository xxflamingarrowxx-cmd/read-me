-- Extra finished books so a full shelf can page, plus real tips from other readers.
insert into books (id, user_id, isbn, title, author, cover_url, page_count, pages_read, status, points_earned, finished_at)
values
  ('book-mira-1984', 'patron-mira', '9780451524935', '1984', 'George Orwell', 'https://covers.openlibrary.org/b/isbn/9780451524935-M.jpg', 328, 328, 'finished', 80, '2020-01-15'),
  ('book-mira-gatsby', 'patron-mira', '9780743273565', 'The Great Gatsby', 'F. Scott Fitzgerald', 'https://covers.openlibrary.org/b/isbn/9780743273565-M.jpg', 180, 180, 'finished', 80, '2020-06-02'),
  ('book-mira-frank', 'patron-mira', '9780141439471', 'Frankenstein', 'Mary Shelley', 'https://covers.openlibrary.org/b/isbn/9780141439471-M.jpg', 280, 280, 'finished', 80, '2021-02-11'),
  ('book-mira-eyre', 'patron-mira', '9780141441146', 'Jane Eyre', 'Charlotte Brontë', 'https://covers.openlibrary.org/b/isbn/9780141441146-M.jpg', 532, 532, 'finished', 80, '2021-08-20'),
  ('book-mira-dune', 'patron-mira', '9780441172719', 'Dune', 'Frank Herbert', 'https://covers.openlibrary.org/b/isbn/9780441172719-M.jpg', 688, 688, 'finished', 80, '2022-03-04'),
  ('book-mira-hobbit', 'patron-mira', '9780547928227', 'The Hobbit', 'J.R.R. Tolkien', 'https://covers.openlibrary.org/b/isbn/9780547928227-M.jpg', 300, 300, 'finished', 80, '2022-11-09'),
  ('book-mira-pride', 'patron-mira', '9780141439518', 'Pride and Prejudice', 'Jane Austen', 'https://covers.openlibrary.org/b/isbn/9780141439518-M.jpg', 279, 279, 'finished', 80, '2023-04-18'),
  ('book-mira-piranesi', 'patron-mira', '9781635575637', 'Piranesi', 'Susanna Clarke', 'https://covers.openlibrary.org/b/isbn/9781635575637-M.jpg', 245, 245, 'finished', 80, '2023-12-01'),
  ('book-mira-rye', 'patron-mira', '9780316769488', 'The Catcher in the Rye', 'J.D. Salinger', 'https://covers.openlibrary.org/b/isbn/9780316769488-M.jpg', 277, 277, 'finished', 80, '2024-05-22')
on conflict (id) do nothing;

insert into tips (id, review_id, from_user_id, to_user_id, amount)
values
  ('tip-jonah-prince', 'rev-mira-prince', 'patron-jonah', 'patron-mira', 10),
  ('tip-adele-prince', 'rev-mira-prince', 'patron-adele', 'patron-mira', 10)
on conflict (review_id, from_user_id) do nothing;

update reviews
set tips = (
  select coalesce(sum(amount), 0)
  from tips
  where tips.review_id = reviews.id
    and tips.from_user_id <> reviews.user_id
)
where id = 'rev-mira-prince';
