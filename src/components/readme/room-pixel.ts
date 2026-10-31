import { itemById } from "@/lib/catalog";

export type RoomBook = {
  id: string;
  title: string;
  status: "reading" | "finished";
  coverUrl?: string | null;
  tipped?: boolean;
  tips?: number;
  finishedAt?: string | null;
  format?: "novel" | "graphic" | "manga" | "comic";
};

export type RoomState = {
  books: RoomBook[];
  outfitId: string;
  shelfId: string;
  lampId: string;
  floorId: string;
  wallId: string;
  chairId: string;
  clockId: string;
  rugId: string;
  souvenirId: string;
};

type SkyKind = "clear" | "cloud" | "rain" | "snow" | "storm" | "night" | "night-cloud";
type Rect = { x: number; y: number; w: number; h: number };

let W = 960;
let H = 900;
let FLOOR = 740;
let phoneMode = false;
let minTap = 44;
let SHELF: Rect = { x: 8, y: 62, w: 384, h: 678 };

const ZONES = {
  window: { x: 470, y: 8, w: 470, h: 420 },
};

const SPINE = ["#8d3d32", "#2f5d50", "#3d4f86", "#a56b2a", "#6d3d6a", "#8a5a32", "#3f6d8a", "#a34b55"];

const ZONE_MAP: Record<string, [number, number]> = {
  "America/New_York": [40.71, -74.01],
  "America/Chicago": [41.88, -87.63],
  "America/Denver": [39.74, -104.99],
  "America/Los_Angeles": [34.05, -118.24],
  "America/Phoenix": [33.45, -112.07],
  "Europe/London": [51.51, -0.13],
  "Europe/Paris": [48.86, 2.35],
  "Europe/Berlin": [52.52, 13.41],
  "Asia/Tokyo": [35.68, 139.69],
  "Australia/Sydney": [-33.87, 151.21],
};

function zonePoint(zone: string): [number, number] {
  if (ZONE_MAP[zone]) return ZONE_MAP[zone];
  const lon = (-new Date().getTimezoneOffset() / 60) * 15;
  return [/Australia|Auckland|Johannesburg|Sao_Paulo/.test(zone) ? -33 : 40, lon];
}

function describeWeather(code: number, isDay: boolean): { kind: SkyKind; label: string } {
  let kind: SkyKind = "clear";
  let label = "Clear";
  if (code <= 1) {
    kind = "clear";
    label = "Clear";
  } else if (code <= 3) {
    kind = "cloud";
    label = code === 2 ? "Partly cloudy" : "Overcast";
  } else if (code === 45 || code === 48) {
    kind = "cloud";
    label = "Fog";
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    kind = "rain";
    label = "Rain";
  } else if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    kind = "snow";
    label = "Snow";
  } else if (code >= 95) {
    kind = "storm";
    label = "Storm";
  }
  if (!isDay && kind === "clear") return { kind: "night", label: "Clear night" };
  if (!isDay && kind === "cloud") return { kind: "night-cloud", label: "Cloudy night" };
  if (!isDay && kind === "rain") return { kind, label: "Night rain" };
  if (!isDay && kind === "snow") return { kind, label: "Night snow" };
  return { kind, label };
}

async function readWeather(): Promise<{ kind: SkyKind; label: string }> {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [lat, lon] = zonePoint(zone);
  const hour = new Date().getHours();
  const fallbackDay = hour >= 6 && hour < 20;
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=weather_code,is_day&timezone=${encodeURIComponent(zone)}`,
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { current?: { weather_code?: number; is_day?: number } };
    const code = Number(data.current?.weather_code ?? 1);
    const isDay = data.current?.is_day == null ? fallbackDay : data.current.is_day !== 0;
    return describeWeather(code, isDay);
  } catch {
    return fallbackDay ? { kind: "clear", label: "Clear" } : { kind: "night", label: "Night" };
  }
}

function hash(text: string) {
  return [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function dither(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, gap = 2) {
  const x0 = x | 0;
  const y0 = y | 0;
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = (yy + y0) % gap; xx < w; xx += gap) px(ctx, x0 + xx, y0 + yy, 1, 1, color);
  }
}

function outline(ctx: CanvasRenderingContext2D, r: Rect, color: string) {
  px(ctx, r.x, r.y, r.w, 1, color);
  px(ctx, r.x, r.y + r.h - 1, r.w, 1, color);
  px(ctx, r.x, r.y, 1, r.h, color);
  px(ctx, r.x + r.w - 1, r.y, 1, r.h, color);
}

function slotHint(ctx: CanvasRenderingContext2D, r: Rect) {
  const color = "rgba(244, 228, 196, 0.42)";
  for (let x = r.x + 3; x < r.x + r.w - 3; x += 4) {
    px(ctx, x, r.y + 3, 2, 1, color);
    px(ctx, x, r.y + r.h - 4, 2, 1, color);
  }
  for (let y = r.y + 3; y < r.y + r.h - 3; y += 4) {
    px(ctx, r.x + 3, y, 1, 2, color);
    px(ctx, r.x + r.w - 4, y, 1, 2, color);
  }
}

function hint(ctx: CanvasRenderingContext2D, r: Rect) {
  ctx.fillStyle = "rgba(90, 62, 36, 0.45)";
  for (let x = r.x; x < r.x + r.w; x += 3) {
    px(ctx, x, r.y, 2, 1, "rgba(90, 62, 36, 0.45)");
    px(ctx, x, r.y + r.h - 1, 2, 1, "rgba(90, 62, 36, 0.45)");
  }
  for (let y = r.y; y < r.y + r.h; y += 3) {
    px(ctx, r.x, y, 1, 2, "rgba(90, 62, 36, 0.45)");
    px(ctx, r.x + r.w - 1, y, 1, 2, "rgba(90, 62, 36, 0.45)");
  }
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const dx = Math.abs(Math.round(x1) - x);
  const dy = Math.abs(Math.round(y1) - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx - dy;
  for (let i = 0; i < 80; i += 1) {
    px(ctx, x, y, 1, 1, color);
    if (x === Math.round(x1) && y === Math.round(y1)) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function gilt(id: string) {
  return id.includes("gilt");
}

type ShelfGeom = {
  w: number;
  h: number;
  left: number;
  right: number;
  bays: { top: number; floor: number }[];
};

// Measured from each shelf PNG: inner plank span (left/right) and each open bay
// from the first cavity pixel (top) to the plank surface the book stands on (floor).
const SHELF_GEOM: Record<string, ShelfGeom> = {
  "/assets/readme/bookshelf.png": {
    w: 498,
    h: 879,
    left: 111,
    right: 418,
    bays: [
      { top: 142, floor: 286 },
      { top: 307, floor: 452 },
      { top: 474, floor: 631 },
    ],
  },
  "/assets/readme/shop/shelving/1-pine-plank-shelf-500pts.png": {
    w: 212,
    h: 380,
    left: 48,
    right: 171,
    bays: [
      { top: 46, floor: 96 },
      { top: 123, floor: 173 },
      { top: 202, floor: 251 },
      { top: 282, floor: 331 },
    ],
  },
  "/assets/readme/shop/starter/worn-pine-shelf.png": {
    w: 212,
    h: 380,
    left: 48,
    right: 171,
    bays: [
      { top: 46, floor: 96 },
      { top: 123, floor: 173 },
      { top: 202, floor: 251 },
      { top: 282, floor: 331 },
    ],
  },
  "/assets/readme/shop/shelving/2-white-cottage-shelf-1500pts.png": {
    w: 214,
    h: 380,
    left: 48,
    right: 171,
    bays: [
      { top: 46, floor: 96 },
      { top: 123, floor: 173 },
      { top: 202, floor: 251 },
      { top: 282, floor: 331 },
    ],
  },
  "/assets/readme/shop/shelving/3-oak-library-shelf-3500pts.png": {
    w: 216,
    h: 381,
    left: 47,
    right: 176,
    bays: [
      { top: 46, floor: 96 },
      { top: 123, floor: 173 },
      { top: 202, floor: 251 },
      { top: 282, floor: 331 },
    ],
  },
  "/assets/readme/shop/shelving/4-dark-walnut-shelf-6500pts.png": {
    w: 221,
    h: 404,
    left: 48,
    right: 186,
    bays: [
      { top: 70, floor: 132 },
      { top: 148, floor: 210 },
      { top: 224, floor: 289 },
      { top: 304, floor: 370 },
    ],
  },
  "/assets/readme/shop/shelving/5-gilded-heirloom-shelf-10000pts.png": {
    w: 218,
    h: 403,
    left: 49,
    right: 181,
    bays: [
      { top: 70, floor: 131 },
      { top: 147, floor: 209 },
      { top: 225, floor: 288 },
      { top: 307, floor: 370 },
    ],
  },
};

function shelfGeom(id: string): ShelfGeom {
  const src = id ? itemById(id)?.src : undefined;
  return (src && SHELF_GEOM[src]) || SHELF_GEOM[ART.shelf] || SHELF_GEOM["/assets/readme/bookshelf.png"]!;
}

function shelfPageSize(_id: string) {
  return 9;
}

function mapShelf(s: Rect, geom: ShelfGeom, sx: number, sy: number) {
  return {
    x: s.x + Math.round((sx * s.w) / geom.w),
    y: s.y + Math.round((sy * s.h) / geom.h),
  };
}

function shelfSlots(s: Rect, geom: ShelfGeom): Rect[] {
  const left = mapShelf(s, geom, geom.left, 0).x;
  const right = mapShelf(s, geom, geom.right, 0).x;
  const inner = Math.max(3, right - left);
  const base = Math.floor(inner / 3);
  const extra = inner - base * 3;
  const slots: Rect[] = [];
  for (const bay of geom.bays) {
    const top = mapShelf(s, geom, 0, bay.top).y;
    const floor = mapShelf(s, geom, 0, bay.floor).y;
    let x = left;
    for (let col = 0; col < 3; col += 1) {
      const w = base + (col < extra ? 1 : 0);
      slots.push({ x, y: top, w, h: Math.max(1, floor - top) });
      x += w;
    }
  }
  return slots;
}

function fitCover(slot: Rect, aspect: number): Rect {
  const w = Math.max(1, slot.w);
  const safe = aspect > 0.2 ? aspect : 2 / 3;
  const h = Math.max(1, Math.round(w / safe));
  return { x: slot.x, y: slot.y + slot.h - h, w, h };
}
const ARROW_PREV: Rect = { x: 322, y: 196, w: 68, h: 72 };
const ARROW_NEXT: Rect = { x: 322, y: 284, w: 68, h: 72 };
const ART = {
  wall: "/assets/readme/wall.png",
  floor: "/assets/readme/floor.png",
  shelf: "/assets/readme/bookshelf.png",
  window: "/assets/readme/window.png",
  male: "/assets/readme/avatar-male.png",
  female: "/assets/readme/avatar-female.png",
} as const;

const covers = new Map<string, HTMLImageElement>();
const sprites = new Map<string, HTMLImageElement>();
let requestDraw: () => void = () => {};

function loadCover(url: string) {
  const existing = covers.get(url);
  if (existing) return existing.complete && existing.naturalWidth > 0 ? existing : null;
  const image = new Image();
  image.onload = () => requestDraw();
  image.onerror = () => requestDraw();
  image.src = url;
  covers.set(url, image);
  return null;
}

function sprite(src: string) {
  let image = sprites.get(src);
  if (!image) {
    image = new Image();
    image.onload = () => requestDraw();
    image.src = src;
    sprites.set(src, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}

function blit(ctx: CanvasRenderingContext2D, src: string, rect: Rect, source?: Rect) {
  const image = sprite(src);
  ctx.imageSmoothingEnabled = false;
  if (!image) return;
  if (source) ctx.drawImage(image, source.x, source.y, source.w, source.h, rect.x, rect.y, rect.w, rect.h);
  else ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
}

function femaleLook(id: string) {
  return id === "outfit-berry" || id === "outfit-female";
}

function equipped(id: string) {
  const src = id ? itemById(id)?.src : undefined;
  if (!src) return null;
  return sprite(src);
}

let shelfKey = "";

function layoutShelf(id: string): Rect {
  shelfKey = id;
  const image = equipped(id) ?? sprite(ART.shelf);
  const aspect = image && image.naturalWidth ? image.naturalWidth / image.naturalHeight : 498 / 879;
  const frac = phoneMode ? 0.55 : 0.4;
  const w = Math.round(W * frac);
  const h = Math.round(w / aspect);
  const top = phoneMode ? 6 : 14;
  const avatarH = Math.round(h * (2 / 3));
  const floorBand = avatarH + (phoneMode ? 36 : 28);
  FLOOR = top + h;
  H = FLOOR + floorBand;
  return { x: 0, y: top, w, h };
}

function layoutWindow() {
  const clockH = phoneMode ? 164 : 152;
  const gap = Math.ceil(clockH * 0.82) + 12;
  const right = 8;
  const top = phoneMode ? 18 : 22;
  const x = Math.min(W - right - 120, SHELF.x + SHELF.w + gap);
  const w = Math.max(120, W - x - right);
  const maxH = Math.max(140, FLOOR - top - 16);
  const h = Math.min(maxH, Math.round(w * (700 / 633)));
  ZONES.window.x = x;
  ZONES.window.y = top;
  ZONES.window.w = w;
  ZONES.window.h = h;
}

type PropSlots = { chair: Rect; clock: Rect; rug: Rect; avatar: Rect };
let PROPS: PropSlots = {
  chair: { x: 0, y: 0, w: 0, h: 0 },
  clock: { x: 0, y: 0, w: 0, h: 0 },
  rug: { x: 0, y: 0, w: 0, h: 0 },
  avatar: { x: 0, y: 0, w: 0, h: 0 },
};

function layoutProps(state: RoomState) {
  const avatarImage = sprite(femaleLook(state.outfitId) ? ART.female : ART.male);
  const avatarAspect = avatarImage && avatarImage.naturalWidth ? avatarImage.naturalWidth / avatarImage.naturalHeight : 376 / 918;
  let avatarH = Math.max(48, Math.round(SHELF.h * (2 / 3)));
  let avatarW = Math.max(24, Math.round(avatarH * avatarAspect));
  const chairImage = equipped(state.chairId);
  const chairAspect = chairImage && chairImage.naturalWidth ? chairImage.naturalWidth / chairImage.naturalHeight : 231 / 288;
  let chairH = Math.max(40, Math.round(avatarH * 0.9));
  let chairW = Math.max(24, Math.round(chairH * chairAspect));
  const margin = 8;
  const pairGap = 8;
  const span = chairW + pairGap + avatarW;
  if (span > W - margin * 2) {
    const scale = (W - margin * 2) / span;
    avatarH = Math.max(48, Math.round(avatarH * scale));
    avatarW = Math.max(24, Math.round(avatarW * scale));
    chairH = Math.max(40, Math.round(chairH * scale));
    chairW = Math.max(24, Math.round(chairW * scale));
  }
  const bottom = H - 8;
  const avatar = { x: W - margin - avatarW, y: bottom - avatarH, w: avatarW, h: avatarH };
  const chair = { x: avatar.x - pairGap - chairW, y: bottom - chairH, w: chairW, h: chairH };

  const clockH = phoneMode ? 164 : 152;
  const colX = SHELF.x + SHELF.w + 6;
  const colW = Math.max(40, ZONES.window.x - 6 - colX);
  let clockY = ZONES.window.y + Math.round((ZONES.window.h - clockH) / 2);
  const maxClockY = Math.max(12, FLOOR - clockH - 12);
  clockY = Math.max(12, Math.min(clockY, maxClockY));
  const clock = { x: colX, y: clockY, w: colW, h: clockH };

  const rugImage = equipped(state.rugId);
  const rugAspect = rugImage && rugImage.naturalWidth ? rugImage.naturalHeight / rugImage.naturalWidth : 369 / 682;
  let rugW = Math.round(SHELF.w * 1.16);
  let rugH = Math.max(28, Math.round(rugW * rugAspect));
  const maxRugH = Math.max(48, Math.round((H - FLOOR) * 0.62));
  if (rugH > maxRugH) {
    rugH = maxRugH;
    rugW = Math.max(Math.round(SHELF.w * 1.08), Math.round(rugH / rugAspect));
  }
  let rugX = Math.round(SHELF.x + (SHELF.w - rugW) / 2);
  if (rugX < 0) rugX = 0;
  if (rugX + rugW > W) rugX = Math.max(0, W - rugW);
  const rug = { x: rugX, y: FLOOR - 8, w: rugW, h: rugH };
  PROPS = { chair, clock, rug, avatar };
}

function stamp(ctx: CanvasRenderingContext2D, image: HTMLImageElement, rect: Rect) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, rect.x | 0, rect.y | 0, rect.w | 0, rect.h | 0);
}

function stampClear(ctx: CanvasRenderingContext2D, image: HTMLImageElement, rect: Rect) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(SHELF.x, SHELF.y, SHELF.w, SHELF.h);
  ctx.rect(ZONES.window.x, ZONES.window.y, ZONES.window.w, ZONES.window.h);
  ctx.clip("evenodd");
  stamp(ctx, image, rect);
  ctx.restore();
}

function tileSwatch(ctx: CanvasRenderingContext2D, src: string, dest: Rect, sourceY: number, sourceH: number) {
  const image = sprite(src);
  if (!image) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(dest.x, dest.y, dest.w, dest.h);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  const scale = dest.h / sourceH;
  const tw = Math.max(1, Math.round(image.width * scale));
  for (let x = dest.x; x < dest.x + dest.w; x += tw) {
    const dw = Math.min(tw, dest.x + dest.w - x);
    const sw = (dw / tw) * image.width;
    ctx.drawImage(image, 0, sourceY, sw, sourceH, x, dest.y, dw, dest.h);
  }
  ctx.restore();
}

const CLOCK_FACE: Record<string, { cx: number; cy: number; r: number }> = {
  "wooden-wall-clock": { cx: 0.5, cy: 0.54, r: 0.28 },
  "cracked-wall-clock": { cx: 0.5, cy: 0.54, r: 0.28 },
  "cafe-clock": { cx: 0.5, cy: 0.46, r: 0.34 },
  "cuckoo-clock": { cx: 0.51, cy: 0.53, r: 0.2 },
  "grandfather-clock": { cx: 0.5, cy: 0.33, r: 0.2 },
  "gold-pocket-watch-clock": { cx: 0.5, cy: 0.67, r: 0.32 },
};

function disk(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string) {
  const r = Math.max(1, Math.round(radius));
  for (let y = -r; y <= r; y += 1) {
    const span = Math.sqrt(r * r - y * y);
    px(ctx, cx - span, cy + y, span * 2, 1, color);
  }
}

function drawLiveFace(ctx: CanvasRenderingContext2D, rect: Rect, face: { cx: number; cy: number; r: number }, now: Date) {
  const cx = rect.x + face.cx * rect.w;
  const cy = rect.y + face.cy * rect.h;
  const radius = face.r * rect.w * 0.9;
  disk(ctx, cx, cy, radius, "#e7d7b4");
  disk(ctx, cx, cy, radius * 0.9, "#fff8ee");
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const mark = i % 3 === 0 ? 3 : 2;
    px(ctx, cx + Math.sin(angle) * radius * 0.78, cy - Math.cos(angle) * radius * 0.78, mark, mark, "#2a211c");
  }
  const minutes = now.getMinutes();
  const hours = now.getHours() % 12;
  const hourAngle = ((hours + minutes / 60) / 12) * Math.PI * 2;
  const minuteAngle = (minutes / 60) * Math.PI * 2;
  for (let i = 0; i <= radius * 0.48; i += 1) px(ctx, cx + Math.sin(hourAngle) * i - 1, cy - Math.cos(hourAngle) * i - 1, 3, 3, "#2a211c");
  for (let i = 0; i <= radius * 0.72; i += 1) px(ctx, cx + Math.sin(minuteAngle) * i, cy - Math.cos(minuteAngle) * i, 2, 2, "#2a211c");
  disk(ctx, cx, cy, 3, "#c6a15e");
}

function tipCount(book: RoomBook) {
  if (typeof book.tips === "number") return Math.max(0, book.tips);
  return book.tipped ? 1 : 0;
}

const GLYPH: Record<string, string[]> = {
  A: ["010", "101", "111", "101", "101"],
  C: ["111", "100", "100", "100", "111"],
  E: ["111", "100", "111", "100", "111"],
  G: ["111", "100", "101", "101", "111"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "101", "101", "101"],
  N: ["110", "101", "101", "101", "101"],
  O: ["111", "101", "101", "101", "111"],
  P: ["111", "101", "111", "100", "100"],
  R: ["110", "101", "110", "101", "101"],
  V: ["101", "101", "101", "101", "010"],
};

function drawPixelWord(ctx: CanvasRenderingContext2D, x: number, y: number, word: string) {
  let cursor = x;
  for (const char of word) {
    const rows = GLYPH[char];
    if (!rows) continue;
    rows.forEach((row, yi) => {
      for (let xi = 0; xi < row.length; xi += 1) {
        if (row[xi] === "1") px(ctx, cursor + xi, y + yi, 1, 1, "#f8f1e2");
      }
    });
    cursor += 4;
  }
}

function drawFormatTag(ctx: CanvasRenderingContext2D, rect: Rect, format: RoomBook["format"]) {
  const word = format === "graphic" ? "GRAPHIC" : format === "manga" ? "MANGA" : format === "comic" ? "COMIC" : "NOVEL";
  const width = word.length * 4 + 1;
  if (width > rect.w || rect.h < 12) return;
  const x = rect.x + 1;
  const y = rect.y + rect.h - 8;
  px(ctx, x, y, width, 7, "#2a211c");
  drawPixelWord(ctx, x + 1, y + 1, word);
}

function orderedBooks(books: RoomBook[]) {
  return [...books].sort((a, b) => {
    const aGold = tipCount(a) >= 3 ? 0 : 1;
    const bGold = tipCount(b) >= 3 ? 0 : 1;
    if (aGold !== bGold) return aGold - bGold;
    if (aGold === 0 && tipCount(a) !== tipCount(b)) return tipCount(b) - tipCount(a);
    const aTime = a.finishedAt ? Date.parse(a.finishedAt) : Number.POSITIVE_INFINITY;
    const bTime = b.finishedAt ? Date.parse(b.finishedAt) : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return a.title.localeCompare(b.title);
  });
}

function wallColor(id: string, night: boolean) {
  if (night && !id) return "#3c342c";
  if (id === "wall-sage") return night ? "#3d4a40" : "#d5e0d2";
  if (id === "wall-stripe") return night ? "#4a3c38" : "#f0e0d2";
  if (id === "wall-brick") return night ? "#5a4038" : "#c48a72";
  if (id === "wall-gilt") return night ? "#5a4a32" : "#f3e6cc";
  if (id === "wall-plaster") return night ? "#4a4038" : "#f6efe4";
  return night ? "#4a4036" : "#f3e6d0";
}

function drawWall(ctx: CanvasRenderingContext2D, id: string, night: boolean) {
  const swatch = equipped(id);
  if (swatch) tileSwatch(ctx, itemById(id)?.src ?? "", { x: 0, y: 0, w: W, h: FLOOR }, 0, swatch.height);
  else {
    const image = sprite(ART.wall);
    ctx.imageSmoothingEnabled = false;
    if (image) {
      const scale = W / image.width;
      const srcH = Math.min(image.height, Math.round(FLOOR / scale));
      const sy = image.height - srcH;
      ctx.drawImage(image, 0, sy, image.width, srcH, 0, 0, W, FLOOR);
    }
  }
  if (night) px(ctx, 0, 0, W, FLOOR, "rgba(18, 22, 42, 0.38)");
}

function drawFloor(ctx: CanvasRenderingContext2D, id: string, night: boolean) {
  const swatch = equipped(id);
  if (swatch) {
    const sourceH = Math.max(1, Math.round(((H - FLOOR) * swatch.height) / FLOOR));
    const sourceY = Math.max(0, swatch.height - sourceH);
    tileSwatch(ctx, itemById(id)?.src ?? "", { x: 0, y: FLOOR, w: W, h: H - FLOOR }, sourceY, Math.min(sourceH, swatch.height - sourceY));
  } else {
    const image = sprite(ART.floor);
    ctx.imageSmoothingEnabled = false;
    if (image) {
      const scale = W / image.width;
      const srcH = Math.min(image.height, Math.max(1, Math.round((H - FLOOR) / scale)));
      const sy = Math.min(Math.max(0, image.height - srcH), Math.round(image.height * 0.36));
      ctx.drawImage(image, 0, sy, image.width, srcH, 0, FLOOR, W, H - FLOOR);
    }
  }
  if (night) px(ctx, 0, FLOOR, W, H - FLOOR, "rgba(8, 10, 18, 0.28)");
}

function glassBox() {
  const r = ZONES.window;
  return {
    x: r.x + Math.round(r.w * 0.256),
    y: r.y + Math.round(r.h * 0.174),
    w: Math.round(r.w * 0.488),
    h: Math.round(r.h * 0.617),
  };
}

function drawSky(ctx: CanvasRenderingContext2D, kind: SkyKind, tick: number) {
  const night = kind === "night" || kind === "night-cloud";
  const top = kind === "storm" ? "#4c5560" : night ? "#141a28" : kind === "rain" ? "#7f93a6" : kind === "snow" ? "#c9d4e0" : kind === "cloud" ? "#a9bccb" : "#6aa4cc";
  const bottom = night ? "#243044" : kind === "storm" ? "#7d858e" : kind === "rain" ? "#c5d0c8" : "#d5e2c8";
  const sky = glassBox();
  for (let y = 0; y < sky.h; y += 1) px(ctx, sky.x, sky.y + y, sky.w, 1, y / sky.h < 0.62 ? top : bottom);
  if (kind === "clear") {
    px(ctx, sky.x + sky.w - 36, sky.y + 16, 22, 22, "#f0d48a");
    px(ctx, sky.x + sky.w - 32, sky.y + 20, 14, 14, "#fff3c4");
    px(ctx, sky.x + 12, sky.y + sky.h - 28, 40, 10, "#7d9a62");
  }
  if (night) {
    px(ctx, sky.x + sky.w - 32, sky.y + 14, 16, 16, "#efe6c8");
    px(ctx, sky.x + sky.w - 24, sky.y + 16, 10, 10, top);
    for (let i = 0; i < 16; i += 1) {
      if ((tick + i * 3) % 18 > 3) px(ctx, sky.x + ((i * 19) % (sky.w - 6)), sky.y + ((i * 13) % Math.max(8, sky.h - 20)), 2, 2, "#fff");
    }
  }
  if (kind !== "clear" && !night) {
    px(ctx, sky.x + 16, sky.y + 18, 28, 12, "#f7fbff");
    px(ctx, sky.x + 36, sky.y + 14, 36, 14, "#f4f7fb");
  }
  if (kind === "rain" || kind === "storm") {
    for (let i = 0; i < 28; i += 1) {
      const x = sky.x + ((i * 11 + tick * 3) % sky.w);
      const y = sky.y + ((i * 17 + tick * 4) % (sky.h - 8));
      px(ctx, x, y, 2, 8, "#e7f2fb");
    }
  }
  if (kind === "snow") {
    for (let i = 0; i < 20; i += 1) {
      const x = sky.x + ((i * 13 + Math.floor(tick / 2)) % sky.w);
      const y = sky.y + ((i * 19 + Math.floor(tick / 2)) % sky.h);
      px(ctx, x, y, 3, 3, "#fff");
    }
  }
}

function drawWindow(ctx: CanvasRenderingContext2D, _kind: SkyKind, _tick: number) {
  blit(ctx, ART.window, ZONES.window);
}

function drawArrow(ctx: CanvasRenderingContext2D, rect: Rect, dir: 1 | -1) {
  px(ctx, rect.x, rect.y, rect.w, rect.h, "#3e2918");
  px(ctx, rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, "#8a5a32");
  px(ctx, rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6, "#c99558");
  px(ctx, rect.x + 3, rect.y + 3, rect.w - 6, 2, "#e7c48a");
  for (let y = rect.y + 8; y < rect.y + rect.h - 4; y += 5) px(ctx, rect.x + 4, y, rect.w - 8, 1, "rgba(90,48,16,0.28)");
  const mid = rect.y + Math.floor(rect.h / 2);
  const tip = dir < 0 ? rect.x + 8 : rect.x + rect.w - 14;
  for (let i = 0; i < 10; i += 1) {
    const spread = 11 - i;
    px(ctx, tip + dir * i, mid - spread, 4, spread * 2, "#2a211c");
  }
  px(ctx, rect.x + 4, rect.y + rect.h - 6, 3, 2, "#e2b23a");
}

function drawShelf(ctx: CanvasRenderingContext2D, id: string, books: RoomBook[], page: number, tick: number, hits: { id: string; rect: Rect }[]) {
  const s = SHELF;
  blit(ctx, itemById(id)?.src ?? ART.shelf, s);
  const geom = shelfGeom(id);
  const slots = shelfSlots(s, geom).slice(0, 9);
  if (books.length === 0) {
    slots.forEach((slot) => slotHint(ctx, slot));
    return;
  }
  const pageSize = 9;
  const ordered = orderedBooks(books);
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const safePage = Math.min(Math.max(0, page), pages - 1);
  const visible = ordered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  visible.forEach((book, index) => {
    const slot = slots[index];
    if (!slot) return;
    const image = book.coverUrl ? loadCover(book.coverUrl) : null;
    const aspect = image && image.naturalWidth > 0 ? image.naturalWidth / image.naturalHeight : 2 / 3;
    const rect = fitCover(slot, aspect);
    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, slot.w, slot.h);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    if (image) ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
    else {
      const color = SPINE[hash(book.title) % SPINE.length] ?? "#8d3d32";
      px(ctx, rect.x, rect.y, rect.w, rect.h, color);
      px(ctx, rect.x + 3, rect.y + 6, Math.max(1, rect.w - 6), 3, "rgba(255,248,230,0.8)");
    }
    ctx.restore();
    const foot = slot.y + slot.h;
    px(ctx, slot.x + 1, foot, Math.max(3, slot.w - 2), 2, "#120c08");
    const shadeTop = Math.max(slot.y, rect.y);
    const shadeH = Math.max(1, foot - shadeTop);
    px(ctx, slot.x + slot.w - 2, shadeTop, 2, shadeH, "rgba(0,0,0,0.28)");
    drawFormatTag(ctx, rect, book.format);
    const tips = tipCount(book);
    if (tips >= 3) {
      const gold = tips >= 8 ? "#fff4c4" : tips >= 5 ? "#ffe7a0" : "#e2b23a";
      outline(ctx, rect, gold);
      if (tips >= 5) outline(ctx, { x: rect.x - 1, y: rect.y - 1, w: rect.w + 2, h: rect.h + 2 }, gold);
      if (tips >= 8) outline(ctx, { x: rect.x - 2, y: rect.y - 2, w: rect.w + 4, h: rect.h + 4 }, "#fff6d0");
      const glint = Math.floor(tick / 8) % 4;
      px(ctx, rect.x + 3 + glint * 6, rect.y + 3, 2, 2, "#fff6d0");
      px(ctx, rect.x + rect.w - 7, rect.y + 6 + glint, 2, 2, "#fff1c4");
    }
    if (book.status === "reading") px(ctx, rect.x + rect.w - 6, rect.y, 3, 6, "#c46a52");
    const hitH = Math.max(slot.h, minTap);
    const hitY = Math.max(s.y, Math.min(slot.y, s.y + s.h - hitH));
    hits.push({ id: book.id, rect: { x: slot.x, y: hitY, w: slot.w, h: Math.min(hitH, s.y + s.h - hitY) } });
  });
  const gapRight = ZONES.window.x - 6;
  const gapLeft = SHELF.x + SHELF.w + 6;
  const aw = Math.min(Math.max(minTap, 48), Math.max(36, gapRight - gapLeft));
  const ax = gapLeft;
  const belowClock = PROPS.clock.y + PROPS.clock.h + 8;
  let prevY = Math.max(belowClock, SHELF.y + Math.round(SHELF.h * 0.28));
  let nextY = prevY + aw + 8;
  if (nextY + aw > FLOOR - 6) {
    nextY = FLOOR - aw - 6;
    prevY = Math.max(belowClock, nextY - aw - 8);
  }
  const prev = { x: ax, y: prevY, w: aw, h: aw };
  const next = { x: ax, y: nextY, w: aw, h: aw };
  if (pages > 1 && safePage > 0) {
    drawArrow(ctx, prev, -1);
    hits.push({ id: "__prev", rect: prev });
  }
  if (pages > 1 && safePage < pages - 1) {
    drawArrow(ctx, next, 1);
    hits.push({ id: "__next", rect: next });
  }
}

function drawChair(ctx: CanvasRenderingContext2D, id: string) {
  const image = equipped(id);
  if (!image) {
    hint(ctx, PROPS.chair);
    return;
  }
  stampClear(ctx, image, PROPS.chair);
}

function drawClock(ctx: CanvasRenderingContext2D, id: string, now: Date) {
  const image = equipped(id);
  if (!image) {
    hint(ctx, PROPS.clock);
    return;
  }
  const aspect = image.naturalWidth / Math.max(1, image.naturalHeight);
  let h = PROPS.clock.h;
  let w = Math.max(1, Math.round(h * aspect));
  if (w > PROPS.clock.w) {
    w = PROPS.clock.w;
    h = Math.max(1, Math.round(w / aspect));
  }
  const rect = {
    x: PROPS.clock.x + Math.floor((PROPS.clock.w - w) / 2),
    y: PROPS.clock.y + Math.floor((PROPS.clock.h - h) / 2),
    w,
    h,
  };
  stampClear(ctx, image, rect);
  const face = CLOCK_FACE[id];
  if (itemById(id)?.liveClock && face) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(SHELF.x, SHELF.y, SHELF.w, SHELF.h);
    ctx.rect(ZONES.window.x, ZONES.window.y, ZONES.window.w, ZONES.window.h);
    ctx.clip("evenodd");
    drawLiveFace(ctx, rect, face, now);
    ctx.restore();
  }
}

function drawRug(ctx: CanvasRenderingContext2D, id: string) {
  const image = equipped(id);
  if (!image) {
    hint(ctx, PROPS.rug);
    return;
  }
  stamp(ctx, image, PROPS.rug);
}

function drawSouvenir(ctx: CanvasRenderingContext2D, id: string) {
  const image = equipped(id);
  if (!image) {
    hint(ctx, { x: SHELF.x + Math.round(SHELF.w * 0.34), y: SHELF.y + 10, w: 72, h: 40 });
    return;
  }
  const geom = shelfGeom(shelfKey);
  const crown = mapShelf(SHELF, geom, 0, geom.bays[0]?.top ?? 40).y;
  const aspect = image.naturalWidth / image.naturalHeight;
  let h = Math.min(Math.max(28, crown - SHELF.y - 8), image.naturalHeight);
  let w = Math.round(h * aspect);
  const maxW = Math.round(SHELF.w * 0.5);
  if (w > maxW) {
    w = maxW;
    h = Math.round(w / aspect);
  }
  const rect = {
    x: SHELF.x + Math.round((SHELF.w - w) / 2),
    y: Math.max(SHELF.y + 4, crown - h - 4),
    w,
    h,
  };
  stamp(ctx, image, rect);
}

function drawAvatar(ctx: CanvasRenderingContext2D, id: string, tick: number) {
  const src = femaleLook(id) ? ART.female : ART.male;
  const image = sprite(src);
  if (!image) return;
  const sway = Math.floor(tick / 28) % 2;
  const rect = { ...PROPS.avatar, x: PROPS.avatar.x + sway * 2 };
  stampClear(ctx, image, rect);
}

function drawLight(ctx: CanvasRenderingContext2D, state: RoomState, kind: SkyKind, tick: number) {
  const day = kind === "clear" || kind === "cloud";
  const tint =
    kind === "night" || kind === "night-cloud"
      ? "rgba(120, 140, 190, 0.18)"
      : kind === "rain" || kind === "storm"
        ? "rgba(150, 168, 186, 0.18)"
        : kind === "snow"
          ? "rgba(230, 238, 246, 0.24)"
          : kind === "cloud"
            ? "rgba(220, 206, 176, 0.16)"
            : "rgba(255, 214, 140, 0.24)";
  const left = SHELF.x + SHELF.w + 16;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, FLOOR, W, Math.max(1, H - FLOOR));
  ctx.rect(PROPS.chair.x, PROPS.chair.y, PROPS.chair.w, PROPS.chair.h);
  ctx.rect(PROPS.avatar.x, PROPS.avatar.y, PROPS.avatar.w, PROPS.avatar.h);
  ctx.clip("evenodd");
  for (let y = FLOOR + 4; y < FLOOR + 70; y += 1) {
    const span = 50 + Math.floor(((y - FLOOR) / 70) * 200);
    px(ctx, left, y, Math.min(span, W - left - 12), 1, tint);
  }
  ctx.restore();
  if (day) {
    const sky = glassBox();
    for (let i = 0; i < 14; i += 1) {
      const x = sky.x + ((i * 23 + Math.floor(tick / 3)) % Math.max(8, sky.w - 4));
      const y = sky.y + ((i * 29 + Math.floor(tick / 2)) % Math.max(8, sky.h - 4));
      px(ctx, x, y, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1, "rgba(255,248,220,0.85)");
    }
  }
}


function paint(ctx: CanvasRenderingContext2D, state: RoomState, kind: SkyKind, tick: number, now: Date, page: number) {
  ctx.imageSmoothingEnabled = false;
  const view: RoomState = {
    ...state,
    outfitId: state.outfitId || "outfit-oatmeal",
    chairId: state.chairId || "patched-armchair",
    clockId: state.clockId || "cracked-wall-clock",
    rugId: state.rugId || "frayed-rug",
  };
  SHELF = layoutShelf(view.shelfId);
  layoutWindow();
  layoutProps(view);
  const hits: { id: string; rect: Rect }[] = [];
  const night = kind === "night" || kind === "night-cloud";
  drawWall(ctx, view.wallId, night);
  drawSky(ctx, kind, tick);
  drawWindow(ctx, kind, tick);
  drawFloor(ctx, view.floorId, night);
  drawRug(ctx, view.rugId);
  drawShelf(ctx, view.shelfId, view.books, page, tick, hits);
  drawChair(ctx, view.chairId);
  drawClock(ctx, view.clockId, now);
  if (view.souvenirId) drawSouvenir(ctx, view.souvenirId);
  else hint(ctx, { x: SHELF.x + Math.round(SHELF.w * 0.3), y: SHELF.y + 8, w: Math.round(SHELF.w * 0.4), h: Math.max(36, mapShelf(SHELF, shelfGeom(view.shelfId), 0, shelfGeom(view.shelfId).bays[0]?.top ?? 40).y - SHELF.y - 16) });
  drawAvatar(ctx, view.outfitId, tick);
  drawLight(ctx, view, kind, tick);
  return hits.filter((hit) => hit.id.startsWith("__") || overlaps(hit.rect, SHELF));
}

function paintPreview(ctx: CanvasRenderingContext2D, id: string) {
  ctx.imageSmoothingEnabled = false;
  px(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height, "#f3e6d0");
  const item = itemById(id);
  const image = item?.src ? sprite(item.src) : null;
  if (!image) return;
  if (item?.place === "wall-background" || item?.place === "floor-background") {
    ctx.drawImage(image, 0, 0, 160, 112);
    return;
  }
  const height = Math.min(104, image.height);
  const width = Math.min(148, Math.round(height * (image.width / image.height)));
  const drawnH = Math.round(width * (image.height / image.width));
  ctx.drawImage(image, Math.round((160 - width) / 2), Math.round((112 - drawnH) / 2), width, drawnH);
}

const previewCache = new Map<string, string>();

function whenReady(src: string) {
  if (!src) return Promise.resolve();
  const image = sprites.get(src) ?? sprite(src);
  if (image && image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const pending = sprites.get(src);
    if (!pending) {
      resolve();
      return;
    }
    pending.addEventListener("load", () => resolve(), { once: true });
    pending.addEventListener("error", () => resolve(), { once: true });
  });
}

export function previewItem(id: string): Promise<string> {
  const cached = previewCache.get(id);
  if (cached) return Promise.resolve(cached);
  const src = itemById(id)?.src ?? "";
  return whenReady(src).then(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 112;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    paintPreview(ctx, id);
    const url = canvas.toDataURL("image/png");
    if (url) previewCache.set(id, url);
    return url;
  });
}

export type RoomHandle = {
  update: (state: RoomState) => void;
  pick: (point: { clientX: number; clientY: number }) => string | null;
  hover: (point: { clientX: number; clientY: number }) => boolean;
  step: (dir: -1 | 1) => void;
  dispose: () => void;
};

export function mountRoom(
  canvas: HTMLCanvasElement,
  state: RoomState,
  onSky: (label: string) => void,
  onPager?: (info: { page: number; pages: number }) => void,
): RoomHandle {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { update() {}, pick: () => null, hover: () => false, step() {}, dispose() {} };
  }
  ctx.imageSmoothingEnabled = false;
  let current = state;
  let kind: SkyKind = new Date().getHours() >= 6 && new Date().getHours() < 20 ? "clear" : "night";
  let hits: { id: string; rect: Rect }[] = [];
  let tick = 0;
  let page = 0;
  let frame = 0;
  let disposed = false;
  let reported = "";

  function stage() {
    phoneMode = window.matchMedia("(max-width: 767px)").matches;
    const scale = canvas.clientWidth > 0 ? canvas.clientWidth / W : phoneMode ? 0.39 : 0.7;
    minTap = Math.max(44, Math.ceil(44 / Math.max(0.25, scale)));
    SHELF = layoutShelf(current.shelfId);
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const box = canvas.parentElement;
    if (box) {
      box.style.aspectRatio = `${W} / ${H}`;
      box.style.minHeight = "0";
      const chrome = phoneMode ? 176 : 140;
      const avail = Math.max(280, window.innerHeight - chrome);
      const host = box.parentElement;
      const fullW = host && host.clientWidth > 40 ? host.clientWidth : window.innerWidth;
      const naturalH = fullW * (H / W);
      if (naturalH > avail + 4) {
        const fitted = Math.max(220, Math.round(avail * (W / H)));
        box.style.width = `${fitted}px`;
        box.style.marginLeft = "auto";
        box.style.marginRight = "auto";
      } else {
        box.style.width = "";
        box.style.marginLeft = "";
        box.style.marginRight = "";
      }
    }
    ctx!.imageSmoothingEnabled = false;
  }

  function render() {
    stage();
    const now = new Date();
    const hour = now.getHours();
    const localNight = hour < 6 || hour >= 20;
    const sky = localNight && (kind === "clear" || kind === "cloud") ? (kind === "cloud" ? "night-cloud" : "night") : kind;
    const pages = Math.max(1, Math.ceil(orderedBooks(current.books).length / shelfPageSize(current.shelfId)));
    if (page > pages - 1) page = Math.max(0, pages - 1);
    if (page < 0) page = 0;
    hits = paint(ctx!, current, sky, tick, now, page);
    tick += 1;
    const key = `${page}/${pages}`;
    if (key !== reported) {
      reported = key;
      onPager?.({ page, pages });
    }
  }

  function turn(dir: -1 | 1) {
    page += dir;
    render();
  }

  requestDraw = () => {
    if (!disposed) render();
  };

  const loop = () => {
    if (disposed) return;
    frame = requestAnimationFrame(loop);
    if (tick % 2 === 0) render();
    else tick += 1;
  };
  render();
  loop();
  void readWeather().then((result) => {
    if (disposed) return;
    kind = result.kind;
    onSky(result.label);
    render();
  });

  function at(point: { clientX: number; clientY: number }) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((point.clientX - rect.left) / rect.width) * W,
      y: ((point.clientY - rect.top) / rect.height) * H,
    };
  }

  function hitId(point: { clientX: number; clientY: number }) {
    const p = at(point);
    const found = hits.filter((hit) => p.x >= hit.rect.x && p.x <= hit.rect.x + hit.rect.w && p.y >= hit.rect.y && p.y <= hit.rect.y + hit.rect.h);
    if (!found.length) return null;
    found.sort((a, b) => {
      const ac = Math.abs(p.x - (a.rect.x + a.rect.w / 2)) + Math.abs(p.y - (a.rect.y + a.rect.h / 2));
      const bc = Math.abs(p.x - (b.rect.x + b.rect.w / 2)) + Math.abs(p.y - (b.rect.y + b.rect.h / 2));
      return ac - bc;
    });
    return found[0]!.id;
  }

  return {
    update(next) {
      current = next;
      render();
    },
    pick(point) {
      const id = hitId(point);
      if (id === "__next") {
        turn(1);
        return null;
      }
      if (id === "__prev") {
        turn(-1);
        return null;
      }
      return id;
    },
    hover(point) {
      return Boolean(hitId(point));
    },
    step: turn,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
    },
  };
}
