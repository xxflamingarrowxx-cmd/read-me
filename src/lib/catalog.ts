export const MAX_PAGES_PER_LOG = 80;
export const MIN_NOTE = 20;
export const AWARD_POINTS = 10;
/** Points a reader can earn in one local day. They are not for sale. */
export const DAILY_POINT_CAP = 500;
export const REPORTS_TO_HIDE = 3;
export const REMOVALS_BEFORE_PAUSE = 3;

/** Finish points, the first-book welcome, and the series share. One place. */
export const POINTS = {
  byFormat: {
    novel: 100,
    graphic: 60,
    manga: 30,
    comic: 10,
  },
  welcomeFinish: 250,
  seriesRate: 0.25,
  tip: 5,
  tipsPerDay: 3,
} as const;

export const BOOK_FORMATS = [
  { id: "novel", label: "Novel", tag: "NOVEL" },
  { id: "graphic", label: "Graphic novel", tag: "GRAPHIC" },
  { id: "manga", label: "Manga volume", tag: "MANGA" },
  { id: "comic", label: "Comic issue", tag: "COMIC" },
] as const;

export type BookFormat = (typeof BOOK_FORMATS)[number]["id"];

export function isBookFormat(value: string): value is BookFormat {
  return BOOK_FORMATS.some((format) => format.id === value);
}

export function formatPoints(format: BookFormat): number {
  return POINTS.byFormat[format];
}

export function formatTag(format: BookFormat): string {
  return BOOK_FORMATS.find((item) => item.id === format)?.tag ?? "NOVEL";
}

/** First finish is exactly welcomeFinish. Later finishes pay the format. */
export function finishAward(format: BookFormat, firstFinish: boolean): { total: number; welcome: number } {
  const base = formatPoints(format);
  if (!firstFinish) return { total: base, welcome: 0 };
  return { total: POINTS.welcomeFinish, welcome: POINTS.welcomeFinish - base };
}

export function seriesBonus(pointsTotal: number): number {
  return Math.round(pointsTotal * POINTS.seriesRate);
}

export function plannedFinish(
  book: { id: string; format: BookFormat; seriesName: string },
  books: { id: string; format: BookFormat; seriesName: string; status: string }[],
): { points: number; welcome: number; series: number } {
  const first = !books.some((item) => item.id !== book.id && item.status === "finished");
  const award = finishAward(book.format, first);
  const name = book.seriesName.trim().toLowerCase();
  let series = 0;
  if (name) {
    const volumes = books.filter((item) => item.seriesName.trim().toLowerCase() === name);
    const completes = volumes.length >= 2 && volumes.every((item) => item.id === book.id || item.status === "finished");
    if (completes) series = seriesBonus(volumes.reduce((sum, item) => sum + formatPoints(item.format), 0));
  }
  return { points: award.total + series, welcome: award.welcome, series };
}

export const REVIEW_REASONS = [
  { id: "spam", label: "Spam or gibberish" },
  { id: "copied", label: "Copied from somewhere else" },
  { id: "wrong-book", label: "Wrong or unrelated book" },
  { id: "offensive", label: "Offensive" },
  { id: "other", label: "Other" },
] as const;

export type ReviewReason = (typeof REVIEW_REASONS)[number]["id"];

export function isReviewReason(value: string): value is ReviewReason {
  return REVIEW_REASONS.some((reason) => reason.id === value);
}

export type Slot = "outfit" | "shelf" | "floor" | "wall" | "chair" | "clock" | "rug" | "souvenir" | "lamp";

export type Item = {
  id: string;
  slot: Slot;
  name: string;
  blurb: string;
  price: number;
  src?: string;
  tier?: number;
  place?: "shelf" | "floor" | "wall" | "shelf-top" | "wall-background" | "floor-background";
  liveClock?: boolean;
};

export const SLOT_COLUMN: Record<Slot, "outfit" | "shelf" | "floor" | "wall" | "chair" | "clock" | "rug" | "souvenir" | "lamp"> = {
  outfit: "outfit",
  shelf: "shelf",
  floor: "floor",
  wall: "wall",
  chair: "chair",
  clock: "clock",
  rug: "rug",
  souvenir: "souvenir",
  lamp: "lamp",
};

/** Every shop price. Starter, then the five older tiers, gold last. */
export const SHOP_PRICES = {
  starter: 250,
  wood: 750,
  cloth: 2000,
  library: 5000,
  heirloom: 10000,
  gold: 15000,
} as const;

export const ITEMS: Item[] = [
  {
    id: "outfit-oatmeal",
    slot: "outfit",
    name: "Male reader",
    blurb: "Brown hair, green cardigan, boots.",
    price: 0,
    src: "/assets/readme/avatar-male.png",
  },
  {
    id: "outfit-berry",
    slot: "outfit",
    name: "Female reader",
    blurb: "Long hair, a leaf clip, the same cardigan.",
    price: 0,
    src: "/assets/readme/avatar-female.png",
  },
  {
    id: "worn-pine-shelf",
    slot: "shelf",
    name: "Worn pine shelf",
    blurb: "A starter case, scuffed and still standing.",
    price: SHOP_PRICES.starter,
    tier: 0,
    place: "shelf",
    src: "/assets/readme/shop/starter/worn-pine-shelf.png",
  },
  {
    id: "patched-armchair",
    slot: "chair",
    name: "Patched armchair",
    blurb: "A starter seat with a mended cushion.",
    price: SHOP_PRICES.starter,
    tier: 0,
    place: "floor",
    src: "/assets/readme/shop/starter/patched-armchair.png",
  },
  {
    id: "cracked-wall-clock",
    slot: "clock",
    name: "Cracked wall clock",
    blurb: "A starter clock. The hands still keep your time.",
    price: SHOP_PRICES.starter,
    tier: 0,
    place: "wall",
    liveClock: true,
    src: "/assets/readme/shop/starter/cracked-wall-clock.png",
  },
  {
    id: "frayed-rug",
    slot: "rug",
    name: "Frayed rug",
    blurb: "A starter rug, worn at the edges.",
    price: SHOP_PRICES.starter,
    tier: 0,
    place: "floor",
    src: "/assets/readme/shop/rugs-horizontal/starter-frayed-rug-250pts.png",
  },
  {
    id: "rusty-key",
    slot: "souvenir",
    name: "Rusty key",
    blurb: "A starter souvenir for the top of the shelf.",
    price: SHOP_PRICES.starter,
    tier: 0,
    place: "shelf-top",
    src: "/assets/readme/shop/starter/rusty-key.png",
  },
  {
    id: "worn-peeling-wall",
    slot: "wall",
    name: "Worn peeling wall",
    blurb: "A starter wall, paint lifting at the seams.",
    price: SHOP_PRICES.starter,
    tier: 0,
    place: "wall-background",
    src: "/assets/readme/shop/starter/worn-peeling-wall.png",
  },
  {
    id: "cracked-floor",
    slot: "floor",
    name: "Cracked floor",
    blurb: "A starter floor with a split board.",
    price: SHOP_PRICES.starter,
    tier: 0,
    place: "floor-background",
    src: "/assets/readme/shop/starter/cracked-floor.png",
  },

  {
    id: "pine-plank-shelf",
    slot: "shelf",
    name: "Pine plank shelf",
    blurb: "Plain boards. The books do the talking.",
    price: SHOP_PRICES.wood,
    tier: 1,
    place: "shelf",
    src: "/assets/readme/shop/shelving/1-pine-plank-shelf-500pts.png",
  },
  {
    id: "white-cottage-shelf",
    slot: "shelf",
    name: "White cottage shelf",
    blurb: "Painted white, like a kitchen that learned to read.",
    price: SHOP_PRICES.cloth,
    tier: 2,
    place: "shelf",
    src: "/assets/readme/shop/shelving/2-white-cottage-shelf-1500pts.png",
  },
  {
    id: "oak-library-shelf",
    slot: "shelf",
    name: "Oak library shelf",
    blurb: "A proper case, with room for a whole week of books.",
    price: SHOP_PRICES.library,
    tier: 3,
    place: "shelf",
    src: "/assets/readme/shop/shelving/3-oak-library-shelf-3500pts.png",
  },
  {
    id: "dark-walnut-shelf",
    slot: "shelf",
    name: "Dark walnut shelf",
    blurb: "Deep wood, so the covers stand forward.",
    price: SHOP_PRICES.heirloom,
    tier: 4,
    place: "shelf",
    src: "/assets/readme/shop/shelving/4-dark-walnut-shelf-6500pts.png",
  },
  {
    id: "gilded-heirloom-shelf",
    slot: "shelf",
    name: "Gilded heirloom shelf",
    blurb: "Gold leaf on the rails. The top of the shelf shop.",
    price: SHOP_PRICES.gold,
    tier: 5,
    place: "shelf",
    src: "/assets/readme/shop/shelving/5-gilded-heirloom-shelf-10000pts.png",
  },
  {
    id: "beanbag",
    slot: "chair",
    name: "Beanbag",
    blurb: "A soft seat for a long chapter.",
    price: SHOP_PRICES.wood,
    tier: 1,
    place: "floor",
    src: "/assets/readme/shop/chairs/1-beanbag-500pts.png",
  },
  {
    id: "rocking-chair",
    slot: "chair",
    name: "Rocking chair",
    blurb: "Wood rockers, for reading that takes its time.",
    price: SHOP_PRICES.cloth,
    tier: 2,
    place: "floor",
    src: "/assets/readme/shop/chairs/2-rocking-chair-1500pts.png",
  },
  {
    id: "green-velvet-armchair",
    slot: "chair",
    name: "Green velvet armchair",
    blurb: "A deep green seat beside the shelf.",
    price: SHOP_PRICES.library,
    tier: 3,
    place: "floor",
    src: "/assets/readme/shop/chairs/3-green-velvet-armchair-3500pts.png",
  },
  {
    id: "leather-wingback",
    slot: "chair",
    name: "Leather wingback",
    blurb: "High wings, for reading past midnight.",
    price: SHOP_PRICES.heirloom,
    tier: 4,
    place: "floor",
    src: "/assets/readme/shop/chairs/4-leather-wingback-6500pts.png",
  },
  {
    id: "golden-throne",
    slot: "chair",
    name: "Golden throne",
    blurb: "A gilt chair, earned page by page.",
    price: SHOP_PRICES.gold,
    tier: 5,
    place: "floor",
    src: "/assets/readme/shop/chairs/5-golden-throne-10000pts.png",
  },
  {
    id: "wooden-wall-clock",
    slot: "clock",
    name: "Wooden wall clock",
    blurb: "A round face on the wall. It keeps your time.",
    price: SHOP_PRICES.wood,
    tier: 1,
    place: "wall",
    liveClock: true,
    src: "/assets/readme/shop/clocks/1-wooden-wall-clock-500pts.png",
  },
  {
    id: "cafe-clock",
    slot: "clock",
    name: "Cafe clock",
    blurb: "The clock from a reading cafe. Live hands.",
    price: SHOP_PRICES.cloth,
    tier: 2,
    place: "wall",
    liveClock: true,
    src: "/assets/readme/shop/clocks/2-cafe-clock-1500pts.png",
  },
  {
    id: "cuckoo-clock",
    slot: "clock",
    name: "Cuckoo clock",
    blurb: "A little house that tells your hour.",
    price: SHOP_PRICES.library,
    tier: 3,
    place: "wall",
    liveClock: true,
    src: "/assets/readme/shop/clocks/3-cuckoo-clock-3500pts.png",
  },
  {
    id: "grandfather-clock",
    slot: "clock",
    name: "Grandfather clock",
    blurb: "Hung on the wall. It still keeps your time.",
    price: SHOP_PRICES.heirloom,
    tier: 4,
    place: "wall",
    liveClock: true,
    src: "/assets/readme/shop/clocks/4-grandfather-clock-6500pts.png",
  },
  {
    id: "gold-pocket-watch-clock",
    slot: "clock",
    name: "Gold pocket watch",
    blurb: "Hung on the wall. The hands are yours.",
    price: SHOP_PRICES.gold,
    tier: 5,
    place: "wall",
    liveClock: true,
    src: "/assets/readme/shop/clocks/5-gold-pocket-watch-clock-10000pts.png",
  },
  {
    id: "braided-rag-rug",
    slot: "rug",
    name: "Braided rag rug",
    blurb: "Scraps braided into a circle for the floor.",
    price: SHOP_PRICES.wood,
    tier: 1,
    place: "floor",
    src: "/assets/readme/shop/rugs-horizontal/braided-rag-rug-750pts.png",
  },
  {
    id: "red-plaid-rug",
    slot: "rug",
    name: "Red plaid rug",
    blurb: "A picnic plaid, indoors.",
    price: SHOP_PRICES.cloth,
    tier: 2,
    place: "floor",
    src: "/assets/readme/shop/rugs-horizontal/red-plaid-rug-2000pts.png",
  },
  {
    id: "persian-rug",
    slot: "rug",
    name: "Persian rug",
    blurb: "A red medallion under the chair.",
    price: SHOP_PRICES.library,
    tier: 3,
    place: "floor",
    src: "/assets/readme/shop/rugs-horizontal/persian-rug-5000pts.png",
  },
  {
    id: "blue-library-rug",
    slot: "rug",
    name: "Blue library rug",
    blurb: "Deep blue, like the quiet stacks.",
    price: SHOP_PRICES.heirloom,
    tier: 4,
    place: "floor",
    src: "/assets/readme/shop/rugs-horizontal/blue-library-rug-10000pts.png",
  },
  {
    id: "gold-fringed-royal-rug",
    slot: "rug",
    name: "Gold-fringed royal rug",
    blurb: "Fringe and gilt. The floor's last word.",
    price: SHOP_PRICES.gold,
    tier: 5,
    place: "floor",
    src: "/assets/readme/shop/rugs-horizontal/gold-fringed-royal-rug-15000pts.png",
  },
  {
    id: "rye-bread-in-net",
    slot: "souvenir",
    name: "Rye bread in a net",
    blurb: "A loaf for the top of the shelf.",
    price: SHOP_PRICES.wood,
    tier: 1,
    place: "shelf-top",
    src: "/assets/readme/shop/souvenirs/1-rye-bread-in-net-500pts.png",
  },
  {
    id: "message-in-bottle",
    slot: "souvenir",
    name: "Message in a bottle",
    blurb: "A note that washed up on the shelf.",
    price: SHOP_PRICES.cloth,
    tier: 2,
    place: "shelf-top",
    src: "/assets/readme/shop/souvenirs/2-message-in-bottle-1500pts.png",
  },
  {
    id: "wizard-wand",
    slot: "souvenir",
    name: "Wizard wand",
    blurb: "For the chapter where the lights go out.",
    price: SHOP_PRICES.library,
    tier: 3,
    place: "shelf-top",
    src: "/assets/readme/shop/souvenirs/3-wizard-wand-3500pts.png",
  },
  {
    id: "bloody-knife",
    slot: "souvenir",
    name: "Bloody knife",
    blurb: "A mystery souvenir. It stays on the shelf.",
    price: SHOP_PRICES.heirloom,
    tier: 4,
    place: "shelf-top",
    src: "/assets/readme/shop/souvenirs/4-bloody-knife-6500pts.png",
  },
  {
    id: "golden-ticket-frame",
    slot: "souvenir",
    name: "Golden ticket",
    blurb: "Framed, and a little bit lucky.",
    price: SHOP_PRICES.gold,
    tier: 5,
    place: "shelf-top",
    src: "/assets/readme/shop/souvenirs/5-golden-ticket-frame-10000pts.png",
  },
  {
    id: "cream-plaster",
    slot: "wall",
    name: "Cream plaster",
    blurb: "A soft wall, just painted.",
    price: SHOP_PRICES.wood,
    tier: 1,
    place: "wall-background",
    src: "/assets/readme/shop/walls/1-cream-plaster-500pts.png",
  },
  {
    id: "sage-wainscot",
    slot: "wall",
    name: "Sage wainscot",
    blurb: "Green below the rail, cream above.",
    price: SHOP_PRICES.cloth,
    tier: 2,
    place: "wall-background",
    src: "/assets/readme/shop/walls/2-sage-wainscot-1500pts.png",
  },
  {
    id: "navy-stripe",
    slot: "wall",
    name: "Navy stripe",
    blurb: "Narrow stripes, like a library hall.",
    price: SHOP_PRICES.library,
    tier: 3,
    place: "wall-background",
    src: "/assets/readme/shop/walls/3-navy-stripe-3500pts.png",
  },
  {
    id: "dark-academia",
    slot: "wall",
    name: "Dark academia",
    blurb: "A dim study wall, for late books.",
    price: SHOP_PRICES.heirloom,
    tier: 4,
    place: "wall-background",
    src: "/assets/readme/shop/walls/4-dark-academia-6500pts.png",
  },
  {
    id: "gold-damask",
    slot: "wall",
    name: "Gold damask",
    blurb: "A gilt pattern. Quiet, not loud.",
    price: SHOP_PRICES.gold,
    tier: 5,
    place: "wall-background",
    src: "/assets/readme/shop/walls/5-gold-damask-10000pts.png",
  },
  {
    id: "worn-pine",
    slot: "floor",
    name: "Worn pine",
    blurb: "Boards that have already been walked.",
    price: SHOP_PRICES.wood,
    tier: 1,
    place: "floor-background",
    src: "/assets/readme/shop/floors/1-worn-pine-500pts.png",
  },
  {
    id: "checker-tile",
    slot: "floor",
    name: "Checker tile",
    blurb: "Black and cream squares underfoot.",
    price: SHOP_PRICES.cloth,
    tier: 2,
    place: "floor-background",
    src: "/assets/readme/shop/floors/2-checker-tile-1500pts.png",
  },
  {
    id: "honey-herringbone",
    slot: "floor",
    name: "Honey herringbone",
    blurb: "Warm boards set on the diagonal.",
    price: SHOP_PRICES.library,
    tier: 3,
    place: "floor-background",
    src: "/assets/readme/shop/floors/3-honey-herringbone-3500pts.png",
  },
  {
    id: "dark-walnut-parquet",
    slot: "floor",
    name: "Dark walnut parquet",
    blurb: "A dark inlay, like an old reading room.",
    price: SHOP_PRICES.heirloom,
    tier: 4,
    place: "floor-background",
    src: "/assets/readme/shop/floors/4-dark-walnut-parquet-6500pts.png",
  },
  {
    id: "gold-marble",
    slot: "floor",
    name: "Gold marble",
    blurb: "Pale stone with a gilt vein.",
    price: SHOP_PRICES.gold,
    tier: 5,
    place: "floor-background",
    src: "/assets/readme/shop/floors/5-gold-marble-10000pts.png",
  },
];

export const SHOP_SLOTS: { id: Slot; label: string }[] = [
  { id: "shelf", label: "Shelves" },
  { id: "wall", label: "Walls" },
  { id: "floor", label: "Floors" },
  { id: "rug", label: "Rugs" },
  { id: "chair", label: "Chairs" },
  { id: "clock", label: "Clocks" },
  { id: "souvenir", label: "Souvenirs" },
  { id: "outfit", label: "Clothes" },
];

export const STARTER_IDS = ["outfit-oatmeal", "outfit-berry"] as const;

const byId = new Map(ITEMS.map((item) => [item.id, item]));

export function itemById(id: string): Item | undefined {
  return byId.get(id);
}

export function spineIndex(title: string): number {
  let n = 0;
  for (let i = 0; i < title.length; i += 1) n = (n + title.charCodeAt(i) * (i + 1)) % 6;
  return n;
}

export type QuickPick = {
  title: string;
  author: string;
  isbn: string;
  pages: number;
};

export const QUICK_PICKS: QuickPick[] = [
  {
    title: "The Little Prince",
    author: "Antoine de Saint-Exupéry",
    isbn: "9780156012195",
    pages: 96,
  },
  {
    title: "Pride and Prejudice",
    author: "Jane Austen",
    isbn: "9780141439518",
    pages: 279,
  },
  {
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    isbn: "9780547928227",
    pages: 300,
  },
  {
    title: "Piranesi",
    author: "Susanna Clarke",
    isbn: "9781635575637",
    pages: 245,
  },
];
