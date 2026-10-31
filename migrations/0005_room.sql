-- The room starts as a shelf in a bare house. Everything else is bought.
alter table profiles add column if not exists floor text not null default '';
alter table profiles add column if not exists wall text not null default '';
alter table profiles add column if not exists chair text not null default '';
alter table profiles add column if not exists clock text not null default '';
alter table profiles add column if not exists rug text not null default '';
alter table profiles add column if not exists souvenir text not null default '';
alter table profiles alter column lamp set default '';

update profiles set lamp = '' where lamp = 'lamp-brass';

update profiles set
  floor = 'floor-oak',
  wall = 'wall-plaster',
  chair = 'chair-oatmeal',
  clock = 'clock-round',
  rug = 'rug-sage',
  souvenir = 'souvenir-wand'
where user_id = 'patron-mira';

update profiles set
  floor = 'floor-herring',
  wall = 'wall-brick',
  chair = 'chair-ink',
  clock = 'clock-night',
  rug = 'rug-ink',
  souvenir = 'souvenir-knife'
where user_id = 'patron-jonah';

update profiles set
  floor = 'floor-tile',
  wall = 'wall-sage',
  chair = 'chair-sage',
  clock = 'clock-school',
  rug = 'rug-berry',
  souvenir = 'souvenir-rye'
where user_id = 'patron-adele';
