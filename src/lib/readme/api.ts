import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  DAILY_POINT_CAP,
  MAX_PAGES_PER_LOG,
  MIN_NOTE,
  POINTS,
  REMOVALS_BEFORE_PAUSE,
  SLOT_COLUMN,
  isBookFormat,
  itemById,
  type BookFormat,
} from "@/lib/catalog";
import { normNote, readingStanding, repeatedSentence } from "@/lib/readme/moderation";

export type BookRow = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  coverUrl: string | null;
  pageCount: number;
  pagesRead: number;
  status: "reading" | "finished";
  pointsEarned: number;
  finishedAt: string | null;
  format: BookFormat;
  seriesName: string;
};

export type ReviewRow = {
  id: string;
  bookId: string;
  userId: string;
  pages: number;
  body: string;
  pointsEarned: number;
  tips: number;
  hidden: boolean;
};

export type SimilarReview = {
  reviewId: string;
  userId: string;
  displayName: string;
  bookId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  body: string;
  tips: number;
  similar: boolean;
  format: BookFormat;
};

export type DiscussionPost = {
  id: string;
  userId: string;
  displayName: string;
  title: string;
  body: string;
  bookTitle: string;
  bookAuthor: string;
  coverUrl: string | null;
  bookFormat: BookFormat;
  createdAt: string;
  replyCount: number;
};

export type DiscussionReply = {
  id: string;
  userId: string;
  displayName: string;
  body: string;
  createdAt: string;
};

export type ShelfProfile = {
  userId: string;
  displayName: string;
  points: number;
  outfit: string;
  shelf: string;
  floor: string;
  wall: string;
  chair: string;
  clock: string;
  rug: string;
  souvenir: string;
  lamp: string;
  owned: string[];
  nameSet: boolean;
};

export type VisitShelf = {
  userId: string;
  displayName: string;
  outfit: string;
  shelf: string;
  floor: string;
  wall: string;
  chair: string;
  clock: string;
  rug: string;
  souvenir: string;
  lamp: string;
  books: BookRow[];
  reviews: ReviewRow[];
};

export type HomeData = {
  me: ShelfProfile;
  books: BookRow[];
  reviews: ReviewRow[];
  similar: SimilarReview[];
  visit: VisitShelf | null;
  awardedReviewIds: string[];
  reportedReviewIds: string[];
  pointsLeftToday: number;
  pointsPaused: boolean;
  isAdmin: boolean;
  streaks: StreakInfo;
};

export type StreakInfo = {
  login: number;
  shelf: number;
  freezeReady: boolean;
  loginBadges: number[];
  shelfBadges: number[];
};

const STREAK_MARKS = [3, 7, 30, 100];

export type Mutation = { ok: true } | { ok: false; error: string };

type Sql = Awaited<ReturnType<typeof import("@/lib/db").getSql>>;

function cleanName(value: unknown): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 24) : "";
  return text || "Reader";
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function cleanZone(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 64) : "UTC";
}

function shapeBook(row: BookRow): BookRow {
  const format = isBookFormat(String(row.format)) ? row.format : "novel";
  return {
    ...row,
    pageCount: Number(row.pageCount),
    pagesRead: Number(row.pagesRead),
    pointsEarned: Number(row.pointsEarned),
    format,
    seriesName: typeof row.seriesName === "string" ? row.seriesName : "",
  };
}

function shapeReview(row: ReviewRow): ReviewRow {
  return {
    ...row,
    pages: Number(row.pages),
    pointsEarned: Number(row.pointsEarned),
    tips: Number(row.tips),
    hidden: asBool(row.hidden),
  };
}

function cleanCover(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "covers.openlibrary.org") return null;
    return url.toString().slice(0, 300);
  } catch {
    return null;
  }
}

async function database(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function ensureProfile(sql: Sql, userId: string, displayName: string) {
  await sql`
    insert into profiles (user_id, display_name)
    values (${userId}, ${displayName})
    on conflict (user_id) do nothing
  `;
  await sql`
    insert into owned_items (user_id, item_id)
    values
      (${userId}, 'outfit-oatmeal'),
      (${userId}, 'outfit-berry')
    on conflict do nothing
  `;
}

function gapDays(prev: string | null, today: string) {
  if (!prev) return 99;
  const a = Date.parse(`${prev.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 99;
  return Math.round((b - a) / 86_400_000);
}

function weekMonday(today: string) {
  const date = new Date(`${today.slice(0, 10)}T00:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}

async function localToday(sql: Sql, zone: string) {
  try {
    const rows = await sql.query<{ today: string }>(`select (now() at time zone $1)::date::text as today`, [zone]);
    const today = String(rows[0]?.today ?? "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(today)) return today;
  } catch {
    /* invalid zone */
  }
  const rows = await sql.query<{ today: string }>(`select (now() at time zone 'UTC')::date::text as today`);
  return String(rows[0]?.today ?? "").slice(0, 10);
}

async function readStreak(sql: Sql, userId: string, zone: string): Promise<StreakInfo> {
  const today = await localToday(sql, zone);
  const rows = await sql<{ loginCount: number; shelfCount: number; freezeWeek: string | null }>`
    select login_count as "loginCount", shelf_count as "shelfCount", freeze_week::text as "freezeWeek"
    from streaks where user_id = ${userId}
  `;
  const login = Number(rows[0]?.loginCount ?? 0);
  const shelf = Number(rows[0]?.shelfCount ?? 0);
  return {
    login,
    shelf,
    freezeReady: String(rows[0]?.freezeWeek ?? "").slice(0, 10) !== weekMonday(today),
    loginBadges: STREAK_MARKS.filter((mark) => login >= mark),
    shelfBadges: STREAK_MARKS.filter((mark) => shelf >= mark),
  };
}

async function advanceStreak(sql: Sql, userId: string, zone: string, kind: "login" | "shelf") {
  const today = await localToday(sql, zone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return;
  const rows = await sql<{
    loginLast: string | null;
    loginCount: number;
    shelfLast: string | null;
    shelfCount: number;
    freezeWeek: string | null;
  }>`
    select login_last::text as "loginLast", login_count as "loginCount",
           shelf_last::text as "shelfLast", shelf_count as "shelfCount",
           freeze_week::text as "freezeWeek"
    from streaks where user_id = ${userId}
  `;
  const row = rows[0];
  const last = kind === "login" ? row?.loginLast ?? null : row?.shelfLast ?? null;
  const count = kind === "login" ? Number(row?.loginCount ?? 0) : Number(row?.shelfCount ?? 0);
  const gap = gapDays(last ? String(last) : null, today);
  if (gap === 0) return;
  const week = weekMonday(today);
  const freezeReady = String(row?.freezeWeek ?? "").slice(0, 10) !== week;
  const saved = gap === 2 && freezeReady;
  const next = gap === 1 || saved ? count + 1 : 1;
  const freezeWeek = saved ? week : (row?.freezeWeek ? String(row.freezeWeek).slice(0, 10) : null);
  if (!row) {
    await sql`
      insert into streaks (user_id, login_last, login_count, shelf_last, shelf_count, freeze_week)
      values (
        ${userId},
        ${kind === "login" ? today : null},
        ${kind === "login" ? next : 0},
        ${kind === "shelf" ? today : null},
        ${kind === "shelf" ? next : 0},
        ${freezeWeek}
      )
      on conflict (user_id) do nothing
    `;
  } else if (kind === "login") {
    await sql`update streaks set login_last = ${today}::date, login_count = ${next}, freeze_week = ${freezeWeek}::date where user_id = ${userId}`;
  } else {
    await sql`update streaks set shelf_last = ${today}::date, shelf_count = ${next}, freeze_week = ${freezeWeek}::date where user_id = ${userId}`;
  }
  const before = gap === 1 || saved ? count : 0;
  const hit = STREAK_MARKS.filter((mark) => before < mark && next >= mark);
  if (hit.length === 0) return;
  const standing = await readingStanding(sql, userId, zone);
  let room = Math.max(0, DAILY_POINT_CAP - standing.earned);
  for (const mark of hit) {
    const pay = Math.min(5, room);
    const savedAward = await sql<{ points: number }>`
      insert into streak_awards (user_id, kind, milestone, points)
      values (${userId}, ${kind}, ${mark}, ${pay})
      on conflict do nothing
      returning points
    `;
    if (savedAward[0] && pay > 0) {
      room -= pay;
      await sql`update profiles set points = points + ${pay} where user_id = ${userId}`;
    }
  }
}

export const loadStreak = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId?: string; timeZone?: string }) => ({
    userId: clip(input?.userId, 80),
    timeZone: cleanZone(input?.timeZone),
  }))
  .handler(async ({ context, data }): Promise<StreakInfo> => {
    const sql = await database();
    const userId = data.userId || context.userId;
    return readStreak(sql, userId, data.timeZone);
  });

export const loadHome = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { visitId?: string | null; displayName?: string | null; timeZone?: string | null } | undefined) => ({
    visitId: clip(input?.visitId, 80),
    displayName: cleanName(input?.displayName),
    timeZone: cleanZone(input?.timeZone),
  }))
  .handler(async ({ context, data }): Promise<HomeData> => {
    const sql = await database();
    const userId = context.userId;
    await ensureProfile(sql, userId, data.displayName);
    await advanceStreak(sql, userId, data.timeZone, "login");

    const meRows = await sql<{
      userId: string;
      displayName: string;
      points: number;
      outfit: string;
      shelf: string;
      floor: string;
      wall: string;
      chair: string;
      clock: string;
      rug: string;
      souvenir: string;
      lamp: string;
      nameSet: boolean;
      is_admin: boolean;
    }>`
      select user_id as "userId", display_name as "displayName", points,
             outfit, shelf, floor, wall, chair, clock, rug, souvenir, lamp,
             name_set as "nameSet", is_admin
      from profiles
      where user_id = ${userId}
    `;
    const me = meRows[0];
    if (!me) throw new Error("Profile missing");
    const ownedRows = await sql<{ item_id: string }>`
      select item_id from owned_items where user_id = ${userId}
    `;

    const myBooks = (await sql<BookRow>`
      select id, title, author, isbn, cover_url as "coverUrl",
             page_count as "pageCount", pages_read as "pagesRead",
             status, points_earned as "pointsEarned", finished_at as "finishedAt",
             format, series_name as "seriesName"
      from books
      where user_id = ${userId}
      order by case when status = 'finished' then 0 else 1 end, title asc
    `).map(shapeBook);
    const myReviews = (await sql<ReviewRow>`
      select id, book_id as "bookId", user_id as "userId", pages, body,
             points_earned as "pointsEarned", tips, hidden
      from reviews
      where user_id = ${userId} and removed_at is null
      order by created_at desc
    `).map(shapeReview);
    const similar = await sql.query<SimilarReview>(
      `select r.id as "reviewId",
              r.user_id as "userId",
              p.display_name as "displayName",
              b.id as "bookId",
              b.title,
              b.author,
              b.cover_url as "coverUrl",
              r.body,
              r.tips,
              b.format,
              exists (
                select 1 from books mine
                where mine.user_id = $1
                  and (
                    (mine.isbn <> '' and mine.isbn = b.isbn)
                    or lower(mine.title) = lower(b.title)
                  )
              ) as shared
       from reviews r
       join books b on b.id = r.book_id
       join profiles p on p.user_id = r.user_id
       where r.user_id <> $1
         and r.removed_at is null
         and r.hidden = false
       order by shared desc, r.tips desc, r.created_at desc
       limit 24`,
      [userId],
    );
    const awarded = await sql<{ review_id: string }>`
      select review_id from tips where from_user_id = ${userId}
    `;

    let visit: VisitShelf | null = null;
    if (data.visitId && data.visitId !== userId) {
      const host = await sql<{
        userId: string;
        displayName: string;
        outfit: string;
        shelf: string;
        floor: string;
        wall: string;
        chair: string;
        clock: string;
        rug: string;
        souvenir: string;
        lamp: string;
      }>`
        select user_id as "userId", display_name as "displayName",
               outfit, shelf, floor, wall, chair, clock, rug, souvenir, lamp
        from profiles
        where user_id = ${data.visitId}
          and is_private = false
          and suspended = false
          and not exists (
            select 1 from blocks
            where (blocker_id = ${userId} and blocked_id = ${data.visitId})
               or (blocker_id = ${data.visitId} and blocked_id = ${userId})
          )
      `;
      if (host[0]) {
        const visitBooks = (await sql<BookRow>`
          select id, title, author, isbn, cover_url as "coverUrl",
                 page_count as "pageCount", pages_read as "pagesRead",
                 status, points_earned as "pointsEarned", finished_at as "finishedAt",
                 format, series_name as "seriesName"
          from books
          where user_id = ${host[0].userId}
          order by case when status = 'finished' then 0 else 1 end, title asc
        `).map(shapeBook);
        const visitReviews = (await sql<ReviewRow>`
          select id, book_id as "bookId", user_id as "userId", pages, body,
                 points_earned as "pointsEarned", tips, hidden
          from reviews
          where user_id = ${host[0].userId}
            and removed_at is null
            and hidden = false
          order by created_at desc
        `).map(shapeReview);
        visit = { ...host[0], books: visitBooks, reviews: visitReviews };
      }
    }

    const reported = await sql<{ review_id: string }>`
      select review_id from review_reports where reporter_id = ${userId}
    `;
    const standing = await readingStanding(sql, userId, data.timeZone);
    const { is_admin: adminFlag, nameSet, ...profile } = me;

    return {
      me: {
        ...profile,
        nameSet: asBool(nameSet),
        points: Number(me.points),
        owned: ownedRows.map((row) => row.item_id),
      },
      books: myBooks,
      reviews: myReviews,
      similar: (() => {
        const ranked = similar.map((row) => ({
          reviewId: row.reviewId,
          userId: row.userId,
          displayName: row.displayName,
          bookId: row.bookId,
          title: row.title,
          author: row.author,
          coverUrl: row.coverUrl,
          body: row.body,
          tips: Number(row.tips),
          format: isBookFormat(String(row.format)) ? row.format : "novel",
          similar: asBool((row as { shared?: unknown }).shared),
        }));
        const shared = ranked.filter((row) => row.similar);
        return (shared.length > 0 ? shared : ranked).slice(0, 6);
      })(),
      visit,
      awardedReviewIds: awarded.map((row) => row.review_id),
      reportedReviewIds: reported.map((row) => row.review_id),
      pointsLeftToday: standing.left,
      pointsPaused: standing.paused,
      isAdmin: asBool(adminFlag),
      streaks: await readStreak(sql, userId, standing.zone),
    };
  });

export const setDisplayName = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((name: string) => (typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, 24) : ""))
  .handler(async ({ context, data }): Promise<Mutation> => {
    if (data.length < 2) return { ok: false, error: "Use at least 2 letters." };
    const sql = await database();
    await ensureProfile(sql, context.userId, data);
    await sql`update profiles set display_name = ${data}, name_set = true where user_id = ${context.userId}`;
    await sql`update "user" set name = ${data}, "updatedAt" = now() where id = ${context.userId}`;
    return { ok: true };
  });

export const addBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { title: string; author: string; isbn: string; pages: number; coverUrl: string | null; format?: string; seriesName?: string; timeZone?: string }) => ({
    title: clip(input?.title, 180),
    author: clip(input?.author, 120) || "Unknown author",
    isbn: clip(input?.isbn, 20).replace(/[^0-9Xx]/g, "").toUpperCase(),
    pages: Number.isFinite(input?.pages) ? Math.round(input.pages) : 0,
    coverUrl: cleanCover(input?.coverUrl),
    format: isBookFormat(String(input?.format ?? "")) ? (input?.format as BookFormat) : "novel",
    seriesName: clip(input?.seriesName, 80),
    timeZone: cleanZone(input?.timeZone),
  }))
  .handler(async ({ context, data }): Promise<Mutation & { id?: string; duplicate?: boolean }> => {
    if (!data.title) return { ok: false, error: "This book needs a title." };
    if (data.pages < 1 || data.pages > 5000) return { ok: false, error: "Page count should be between 1 and 5000." };
    const sql = await database();
    await ensureProfile(sql, context.userId, "Reader");
    const existing = await sql<{ id: string }>`
      select id from books
      where user_id = ${context.userId}
        and (
          (${data.isbn} <> '' and isbn = ${data.isbn})
          or lower(title) = lower(${data.title})
        )
      limit 1
    `;
    if (existing[0]) return { ok: true, id: existing[0].id, duplicate: true };
    const id = crypto.randomUUID();
    await sql`
      insert into books (id, user_id, isbn, title, author, cover_url, page_count, format, series_name)
      values (${id}, ${context.userId}, ${data.isbn}, ${data.title}, ${data.author}, ${data.coverUrl}, ${data.pages}, ${data.format}, ${data.seriesName})
    `;
    await advanceStreak(sql, context.userId, data.timeZone, "shelf");
    return { ok: true, id, duplicate: false };
  });

export const logReading = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bookId: string; pages: number; note: string; timeZone?: string }) => ({
    bookId: clip(input?.bookId, 80),
    pages: Number.isFinite(input?.pages) ? Math.round(input.pages) : 0,
    note: typeof input?.note === "string" ? input.note.trim().slice(0, 280) : "",
    timeZone: cleanZone(input?.timeZone),
  }))
  .handler(async ({ context, data }): Promise<Mutation & { points?: number; finished?: boolean; pages?: number; title?: string; left?: number; paused?: boolean; welcome?: boolean; series?: number }> => {
    if (!data.bookId) return { ok: false, error: "Pick a book first." };
    if (data.pages < 1) return { ok: false, error: "Log at least one page." };
    if (data.note.length < MIN_NOTE) return { ok: false, error: `Write at least ${MIN_NOTE} characters about what you read.` };
    if (repeatedSentence(data.note)) {
      return { ok: false, error: "That note repeats the same sentence. Write what you actually read." };
    }
    const sql = await database();
    const standing = await readingStanding(sql, context.userId, data.timeZone);
    const open = await sql<{ pageCount: number; pagesRead: number; status: string }>`
      select page_count as "pageCount", pages_read as "pagesRead", status
      from books
      where id = ${data.bookId} and user_id = ${context.userId}
    `;
    if (!open[0] || open[0].status !== "reading") return { ok: false, error: "That book isn’t open on your shelf." };
    const willFinish = Number(open[0].pagesRead) + Math.min(data.pages, MAX_PAGES_PER_LOG) >= Number(open[0].pageCount);
    if (willFinish && !standing.paused && standing.left <= 0) {
      return { ok: false, error: `You’ve used today’s ${DAILY_POINT_CAP} points. They come back tomorrow. Points aren’t for sale.` };
    }
    const copy = await sql.query<{ ok: boolean }>(
      `select true as ok
       from reviews r
       join books b on b.id = r.book_id
       join books mine on mine.id = $1 and mine.user_id = $2
       where r.user_id <> $2
         and lower(regexp_replace(btrim(r.body), '[[:space:]]+', ' ', 'g')) = $3
         and (
           (mine.isbn <> '' and b.isbn = mine.isbn)
           or lower(b.title) = lower(mine.title)
         )
       limit 1`,
      [data.bookId, context.userId, normNote(data.note)],
    );
    if (copy[0]) return { ok: false, error: "That note is already on this title. Write your own." };
    const reviewId = crypto.randomUUID();
    const novel = POINTS.byFormat.novel;
    const graphic = POINTS.byFormat.graphic;
    const manga = POINTS.byFormat.manga;
    const comic = POINTS.byFormat.comic;
    let rows: { pts: number; finishes: boolean; title: string; n: number; paused: boolean; leftToday: number; welcome: boolean; seriesPaid: number }[];
    try {
      rows = await sql.query<{ pts: number; finishes: boolean; title: string; n: number; paused: boolean; leftToday: number; welcome: boolean; seriesPaid: number }>(
      `with locked as (
         select user_id from profiles where user_id = $2 for update
       ),
       book as (
         select b.id, b.title, b.isbn, b.page_count, b.pages_read, b.format, b.series_name
         from books b
         join locked on locked.user_id = b.user_id
         where b.id = $1 and b.user_id = $2 and b.status = 'reading' and b.page_count > b.pages_read
       ),
       calc as (
         select id, title, isbn, page_count, pages_read, format, series_name,
           least($3::int, ${MAX_PAGES_PER_LOG}, page_count - pages_read) as n
         from book
         where least($3::int, ${MAX_PAGES_PER_LOG}, page_count - pages_read) >= 1
           and char_length(btrim($4::text)) >= ${MIN_NOTE}
       ),
       flags as (
         select
           coalesce((select count(*)::int >= ${REMOVALS_BEFORE_PAUSE} from review_strikes s where s.user_id = $2), false) as paused,
           coalesce((
             select sum(points_earned)::int from reviews r
             where r.user_id = $2
               and (r.created_at at time zone $6)::date = (now() at time zone $6)::date
           ), 0)
           + coalesce((
             select sum(points)::int from streak_awards a
             where a.user_id = $2
               and (a.created_at at time zone $6)::date = (now() at time zone $6)::date
           ), 0) as earned,
           exists (
             select 1 from reviews r
             join books b2 on b2.id = r.book_id
             join calc c on true
             where r.user_id <> $2
               and lower(regexp_replace(btrim(r.body), '[[:space:]]+', ' ', 'g')) = $7
               and (
                 (c.isbn <> '' and b2.isbn = c.isbn)
                 or lower(b2.title) = lower(c.title)
               )
           ) as copied
       ),
       priced as (
         select c.*, f.paused, f.earned,
           (c.pages_read + c.n) >= c.page_count as finishes,
           case c.format
             when 'graphic' then ${graphic}
             when 'manga' then ${manga}
             when 'comic' then ${comic}
             else ${novel}
           end as format_pts
         from calc c
         cross join flags f
         where not f.copied
           and (
             (c.pages_read + c.n) < c.page_count
             or f.paused
             or f.earned < ${DAILY_POINT_CAP}
           )
       ),
       history as (
         select p.*,
           exists (
             select 1 from books o
             where o.user_id = $2 and o.id <> p.id and o.status = 'finished'
           ) as had_finish,
           exists (
             select 1 from books o
             where o.user_id = $2 and o.id <> p.id and o.points_earned > 0
               and (
                 (p.isbn <> '' and o.isbn = p.isbn)
                 or lower(o.title) = lower(p.title)
               )
           ) as title_paid
         from priced p
       ),
       scored as (
         select h.*,
           case
             when h.paused or not h.finishes or h.title_paid then 0
             when not h.had_finish then ${POINTS.welcomeFinish}
             else h.format_pts
           end as base_pts,
           case
             when h.paused or not h.finishes or btrim(h.series_name) = '' then 0
             when exists (
               select 1 from series_bonuses sb
               where sb.user_id = $2 and sb.series_name = lower(btrim(h.series_name))
             ) then 0
             when (
               select count(*) from books s
               where s.user_id = $2 and lower(btrim(s.series_name)) = lower(btrim(h.series_name))
             ) < 2 then 0
             when exists (
               select 1 from books s
               where s.user_id = $2
                 and lower(btrim(s.series_name)) = lower(btrim(h.series_name))
                 and s.id <> h.id
                 and s.status <> 'finished'
             ) then 0
             else round((
               select sum(
                 case s.format
                   when 'graphic' then ${graphic}
                   when 'manga' then ${manga}
                   when 'comic' then ${comic}
                   else ${novel}
                 end
               )::numeric
               from books s
               where s.user_id = $2 and lower(btrim(s.series_name)) = lower(btrim(h.series_name))
             ) * ${POINTS.seriesRate})::int
           end as series_pts
         from history h
       ),
       grant_pts as (
         select *,
           case
             when paused then 0
             else least(base_pts + series_pts, ${DAILY_POINT_CAP} - earned)
           end as pts,
           (not paused and finishes and not title_paid and not had_finish) as welcome
         from scored
       ),
       upd as (
         update books
         set pages_read = books.pages_read + g.n,
             status = case when g.finishes then 'finished' else books.status end,
             finished_at = case when g.finishes then now() else books.finished_at end,
             points_earned = books.points_earned + g.pts,
             updated_at = now()
         from grant_pts g
         where books.id = g.id and books.user_id = $2
         returning g.n, g.finishes, g.title, g.pts, g.paused, g.welcome, g.base_pts, g.series_pts, g.series_name,
           (${DAILY_POINT_CAP} - g.earned - g.pts) as left_today
       ),
       series_save as (
         insert into series_bonuses (user_id, series_name, points)
         select $2, lower(btrim(series_name)), least(series_pts, greatest(0, pts - base_pts))
         from upd
         where finishes and series_pts > 0 and not paused
         on conflict (user_id, series_name) do nothing
         returning user_id
       ),
       rev as (
         insert into reviews (id, user_id, book_id, pages, body, points_earned)
         select $5, $2, $1, n, btrim($4::text), pts from upd
         returning id
       ),
       credit as (
         update profiles
         set points = points + upd.pts
         from upd
         where profiles.user_id = $2
           and exists (select 1 from rev)
         returning upd.pts, upd.finishes, upd.title, upd.n, upd.paused, upd.left_today, upd.welcome,
           least(upd.series_pts, greatest(0, upd.pts - upd.base_pts)) as series_paid
       )
       select pts, finishes, title, n, paused, left_today as "leftToday", welcome, series_paid as "seriesPaid" from credit`,
      [data.bookId, context.userId, data.pages, data.note, reviewId, standing.zone, normNote(data.note)],
    );
    } catch (err) {
      console.error(err);
      return { ok: false, error: "That sitting didn’t count. Try again in a moment." };
    }
    const row = rows[0];
    if (!row) return { ok: false, error: "That sitting didn’t count. Check the pages left and the note." };
    return {
      ok: true,
      points: Number(row.pts),
      finished: asBool(row.finishes),
      pages: Number(row.n),
      title: row.title,
      left: Math.max(0, Number(row.leftToday) || 0),
      paused: asBool(row.paused),
      welcome: asBool(row.welcome),
      series: Number(row.seriesPaid) || 0,
    };
  });

export const setPageCount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bookId: string; pages: number }) => ({
    bookId: clip(input?.bookId, 80),
    pages: Number.isFinite(input?.pages) ? Math.round(input.pages) : 0,
  }))
  .handler(async ({ context, data }): Promise<Mutation> => {
    if (data.pages < 1 || data.pages > 5000) return { ok: false, error: "Page count should be between 1 and 5000." };
    const sql = await database();
    const rows = await sql<{ id: string }>`
      update books
      set page_count = ${data.pages}, updated_at = now()
      where id = ${data.bookId}
        and user_id = ${context.userId}
        and status = 'reading'
        and pages_read <= ${data.pages}
      returning id
    `;
    if (!rows[0]) return { ok: false, error: "Page count has to stay at least the pages you’ve already logged." };
    return { ok: true };
  });

export const removeBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((bookId: string) => clip(bookId, 80))
  .handler(async ({ context, data }): Promise<Mutation> => {
    const sql = await database();
    await sql`delete from books where id = ${data} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const buyItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((itemId: string) => clip(itemId, 40))
  .handler(async ({ context, data }): Promise<Mutation> => {
    const item = itemById(data);
    if (!item) return { ok: false, error: "That isn’t in the shop." };
    if (item.price <= 0) return { ok: false, error: "You already have that." };
    const sql = await database();
    const sets = (Object.keys(SLOT_COLUMN) as (keyof typeof SLOT_COLUMN)[])
      .map((slot) => `${SLOT_COLUMN[slot]} = case when $4 = '${slot}' then $2 else ${SLOT_COLUMN[slot]} end`)
      .join(", ");
    const rows = await sql.query<{ item_id: string }>(
      `with own as (
         insert into owned_items (user_id, item_id)
         select $1, $2
         where exists (
           select 1 from profiles where user_id = $1 and points >= $3
         )
         and not exists (
           select 1 from owned_items where user_id = $1 and item_id = $2
         )
         returning user_id, item_id
       )
       update profiles p
       set points = points - $3, ${sets}
       from own
       where p.user_id = own.user_id
       returning own.item_id`,
      [context.userId, item.id, item.price, item.slot],
    );
    if (!rows[0]?.item_id) {
      const owned = await sql<{ item_id: string }>`
        select item_id from owned_items where user_id = ${context.userId} and item_id = ${item.id}
      `;
      if (owned[0]) return { ok: false, error: "You already have that." };
      return { ok: false, error: "Not enough points yet." };
    }
    return { ok: true };
  });

export const equipItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((itemId: string) => clip(itemId, 40))
  .handler(async ({ context, data }): Promise<Mutation> => {
    const item = itemById(data);
    if (!item) return { ok: false, error: "That item isn’t here." };
    const sql = await database();
    const column = SLOT_COLUMN[item.slot];
    const rows = await sql.query<{ user_id: string }>(
      `update profiles set ${column} = $2
       where user_id = $1
         and exists (select 1 from owned_items where user_id = $1 and item_id = $2)
       returning user_id`,
      [context.userId, item.id],
    );
    if (!rows[0]) return { ok: false, error: "Buy it before you wear it." };
    return { ok: true };
  });

export const awardReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: string | { reviewId?: string; timeZone?: string }) => ({
    reviewId: clip(typeof input === "string" ? input : input?.reviewId, 80),
    timeZone: cleanZone(typeof input === "string" ? "UTC" : input?.timeZone),
  }))
  .handler(async ({ context, data }): Promise<Mutation & { name?: string; total?: number }> => {
    if (!data.reviewId) return { ok: false, error: "That review is gone." };
    const sql = await database();
    const tipId = crypto.randomUUID();
    const standing = await readingStanding(sql, context.userId, data.timeZone);
    const rows = await sql.query<{ tip_id: string; name: string; total: number }>(
      `with age as (
         select "createdAt" as created_at
         from "user"
         where id = $3
           and "createdAt" <= now() - interval '24 hours'
       ),
       today as (
         select count(*)::int as n
         from tips
         where from_user_id = $3
           and (created_at at time zone $5)::date = (now() at time zone $5)::date
       ),
       target as (
         select r.id, r.user_id as author, p.display_name as name, r.tips
         from reviews r
         join profiles p on p.user_id = r.user_id
         where r.id = $1
           and r.removed_at is null
           and r.hidden = false
           and exists (select 1 from age)
           and (select n from today) < ${POINTS.tipsPerDay}
       ),
       credit as (
         update profiles
         set points = points + $2
         where user_id = (select author from target)
           and exists (select 1 from target t where t.author <> $3)
           and not exists (select 1 from tips where review_id = $1 and from_user_id = $3)
           and not exists (
             select 1 from "user" mine
             join "user" theirs on theirs.id = (select author from target)
             where mine.id = $3 and lower(mine.email) = lower(theirs.email)
           )
         returning user_id
       ),
       bumped as (
         update reviews
         set tips = tips + $2
         where id = $1 and exists (select 1 from credit)
         returning tips
       )
       insert into tips (id, review_id, from_user_id, to_user_id, amount)
       select $4, $1, $3, (select author from target), $2
       from credit
       where exists (select 1 from bumped)
       returning id as tip_id, (select name from target) as name, (select tips from bumped) as total`,
      [data.reviewId, POINTS.tip, context.userId, tipId, standing.zone],
    );
    if (rows[0]?.tip_id) return { ok: true, name: rows[0].name, total: Number(rows[0].total) };
    const why = await sql<{ author: string; already: boolean; young: boolean; used: number }>`
      select r.user_id as author,
             exists(select 1 from tips where review_id = ${data.reviewId} and from_user_id = ${context.userId}) as already,
             exists(select 1 from "user" u where u.id = ${context.userId} and u."createdAt" > now() - interval '24 hours') as young,
             (
               select count(*)::int from tips
               where from_user_id = ${context.userId}
                 and (created_at at time zone ${standing.zone})::date = (now() at time zone ${standing.zone})::date
             ) as used
      from reviews r
      where r.id = ${data.reviewId}
    `;
    if (!why[0]) return { ok: false, error: "That review is gone." };
    if (why[0].author === context.userId) return { ok: false, error: "That’s your own note." };
    if (why[0].already) return { ok: false, error: "You already tipped this one." };
    if (asBool(why[0].young)) return { ok: false, error: "Tips start counting after your shelf is a day old." };
    if (Number(why[0].used) >= POINTS.tipsPerDay) return { ok: false, error: `You have used today’s ${POINTS.tipsPerDay} tips.` };
    return { ok: false, error: "That tip didn’t count." };
  });

function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === "t" || value === "true";
}

function stamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : "";
}

export const loadDiscussions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async (): Promise<DiscussionPost[]> => {
    const sql = await database();
    const rows = await sql<DiscussionPost & { replyCount: number }>`
      select d.id, d.user_id as "userId", p.display_name as "displayName",
             d.title, d.body, d.book_title as "bookTitle", d.book_author as "bookAuthor",
             d.cover_url as "coverUrl", d.book_format as "bookFormat", d.created_at as "createdAt",
             (select count(*)::int from discussion_replies r where r.discussion_id = d.id) as "replyCount"
      from discussions d
      join profiles p on p.user_id = d.user_id
      order by d.created_at desc
      limit 40
    `;
    return rows.map((row) => ({
      ...row,
      createdAt: stamp(row.createdAt),
      bookFormat: isBookFormat(String(row.bookFormat)) ? row.bookFormat : "novel",
      replyCount: Number(row.replyCount),
    }));
  });

export const loadReplies = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((discussionId: string) => clip(discussionId, 80))
  .handler(async ({ data }): Promise<DiscussionReply[]> => {
    if (!data) return [];
    const sql = await database();
    const rows = await sql<DiscussionReply>`
      select r.id, r.user_id as "userId", p.display_name as "displayName",
             r.body, r.created_at as "createdAt"
      from discussion_replies r
      join profiles p on p.user_id = r.user_id
      where r.discussion_id = ${data}
      order by r.created_at asc
    `;
    return rows.map((row) => ({ ...row, createdAt: stamp(row.createdAt) }));
  });

export const createDiscussion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    title: string;
    body: string;
    bookTitle: string;
    bookAuthor: string;
    isbn: string;
    coverUrl: string | null;
    bookFormat?: string;
  }) => ({
    title: clip(input?.title, 80),
    body: typeof input?.body === "string" ? input.body.trim().slice(0, 600) : "",
    bookTitle: clip(input?.bookTitle, 180),
    bookAuthor: clip(input?.bookAuthor, 120) || "Unknown author",
    isbn: clip(input?.isbn, 20).replace(/[^0-9Xx]/g, "").toUpperCase(),
    coverUrl: cleanCover(input?.coverUrl),
    bookFormat: isBookFormat(String(input?.bookFormat ?? "")) ? (input?.bookFormat as BookFormat) : "novel",
  }))
  .handler(async ({ context, data }): Promise<Mutation> => {
    if (data.title.length < 3) return { ok: false, error: "Give the discussion a title." };
    if (!data.bookTitle) return { ok: false, error: "Choose the book this is about." };
    if (data.body.length < MIN_NOTE) return { ok: false, error: `Write at least ${MIN_NOTE} characters.` };
    const sql = await database();
    await ensureProfile(sql, context.userId, "Reader");
    await sql`
      insert into discussions (id, user_id, title, body, book_title, book_author, book_isbn, cover_url, book_format)
      values (
        ${crypto.randomUUID()}, ${context.userId}, ${data.title}, ${data.body},
        ${data.bookTitle}, ${data.bookAuthor}, ${data.isbn}, ${data.coverUrl}, ${data.bookFormat}
      )
    `;
    return { ok: true };
  });

export const replyToDiscussion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { discussionId: string; body: string }) => ({
    discussionId: clip(input?.discussionId, 80),
    body: typeof input?.body === "string" ? input.body.trim().slice(0, 400) : "",
  }))
  .handler(async ({ context, data }): Promise<Mutation> => {
    if (!data.discussionId) return { ok: false, error: "That discussion is gone." };
    if (data.body.length < 2) return { ok: false, error: "Write a reply." };
    const sql = await database();
    await ensureProfile(sql, context.userId, "Reader");
    const found = await sql<{ id: string }>`select id from discussions where id = ${data.discussionId}`;
    if (!found[0]) return { ok: false, error: "That discussion is gone." };
    await sql`
      insert into discussion_replies (id, discussion_id, user_id, body)
      values (${crypto.randomUUID()}, ${data.discussionId}, ${context.userId}, ${data.body})
    `;
    return { ok: true };
  });

export type ReaderHit = {
  userId: string;
  displayName: string;
  image: string | null;
};

export type ReaderSearch = {
  results: ReaderHit[];
  note?: string;
};

const searchTimes = new Map<string, number[]>();

function allowSearch(userId: string) {
  const now = Date.now();
  const recent = (searchTimes.get(userId) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 20) {
    searchTimes.set(userId, recent);
    return false;
  }
  recent.push(now);
  searchTimes.set(userId, recent);
  return true;
}

function safeImage(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("https://") || value.length > 300) return null;
  if (/[@\s]/.test(value)) return null;
  return value;
}

export const searchReaders = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((query: string) => clip(query, 24).replace(/[%_\\]/g, ""))
  .handler(async ({ context, data }): Promise<ReaderSearch> => {
    if (data.length < 1) return { results: [] };
    if (!allowSearch(context.userId)) return { results: [], note: "Search is busy. Try again in a moment." };
    const sql = await database();
    const rows = await sql.query<{ userId: string; displayName: string; image: string | null }>(
      `select p.user_id as "userId",
              p.display_name as "displayName",
              u.image as image
       from profiles p
       left join "user" u on u.id = p.user_id
       where p.user_id <> $1
         and p.is_private = false
         and p.suspended = false
         and p.display_name ilike $2
         and not exists (
           select 1 from blocks b
           where (b.blocker_id = $1 and b.blocked_id = p.user_id)
              or (b.blocker_id = p.user_id and b.blocked_id = $1)
         )
       order by case when p.display_name ilike $3 then 0 else 1 end,
                p.display_name asc
       limit 20`,
      [context.userId, `%${data}%`, `${data}%`],
    );
    return {
      results: rows.map((row) => ({
        userId: row.userId,
        displayName: row.displayName,
        image: safeImage(row.image),
      })),
    };
  });

