-- One public note starts tipped, so the gold book is visible on a shared shelf.
update reviews
set tips = 10
where id = 'rev-mira-prince' and tips = 0;
