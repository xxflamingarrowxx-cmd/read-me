-- Shop art is bought with points. A new room is only the shelf.
alter table profiles alter column outfit set default '';
alter table profiles alter column shelf set default '';
alter table profiles alter column lamp set default '';

update profiles set
  outfit = 'outfit-berry',
  shelf = 'oak-library-shelf',
  floor = 'honey-herringbone',
  wall = 'sage-wainscot',
  chair = 'green-velvet-armchair',
  clock = 'cuckoo-clock',
  rug = 'persian-rug',
  souvenir = 'wizard-wand',
  lamp = ''
where user_id = 'patron-mira';

update profiles set
  outfit = 'outfit-oatmeal',
  shelf = 'dark-walnut-shelf',
  floor = 'dark-walnut-parquet',
  wall = 'dark-academia',
  chair = 'leather-wingback',
  clock = 'grandfather-clock',
  rug = 'blue-library-rug',
  souvenir = 'rye-bread-in-net',
  lamp = ''
where user_id = 'patron-jonah';

update profiles set
  outfit = 'outfit-oatmeal',
  shelf = 'white-cottage-shelf',
  floor = 'checker-tile',
  wall = 'cream-plaster',
  chair = 'rocking-chair',
  clock = 'cafe-clock',
  rug = 'red-plaid-rug',
  souvenir = 'message-in-bottle',
  lamp = ''
where user_id = 'patron-adele';
