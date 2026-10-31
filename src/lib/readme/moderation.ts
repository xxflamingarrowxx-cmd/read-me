import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  DAILY_POINT_CAP,
  REMOVALS_BEFORE_PAUSE,
  REPORTS_TO_HIDE,
  isReviewReason,
  type ReviewReason,
} from "@/lib/catalog";

export type ReviewCase = {
  reviewId: string;
  title: string;
  author: string;
  format: string;
  body: string;
  points: number;
  reviewDate: string;
  reviewer: string;
  hidden: boolean;
  removed: boolean;
  reports: { id: string; reason: ReviewReason; reporter: string; createdAt: string }[];
};

type Sql = Awaited<ReturnType<typeof import("@/lib/db").getSql>>;

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function normNote(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** True when the note is one sentence (or one phrase) pasted again. */
export function repeatedSentence(body: string): boolean {
  const parts = body
    .split(/[.!?]+/)
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
    .filter((part) => part.length > 0);
  if (parts.length >= 2 && parts.every((part) => part === parts[0])) return true;
  const words = body.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length >= 4 && words.every((word) => word === words[0])) return true;
  for (let size = 3; size <= Math.floor(words.length / 2); size += 1) {
    if (words.length % size !== 0) continue;
    const chunk = words.slice(0, size).join(" ");
    let same = true;
    for (let index = size; index < words.length; index += size) {
      if (words.slice(index, index + size).join(" ") !== chunk) {
        same = false;
        break;
      }
    }
    if (same) return true;
  }
  return false;
}

async function database(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

export async function zoneOrUtc(sql: Sql, zone: string): Promise<string> {
  const candidate = /^[A-Za-z0-9_+\-/]{1,64}$/.test(zone) ? zone : "UTC";
  try {
    await sql.query("select now() at time zone $1 as t", [candidate]);
    return candidate;
  } catch {
    return "UTC";
  }
}

export async function readingStanding(sql: Sql, userId: string, zone: string) {
  const safe = await zoneOrUtc(sql, zone);
  const earnedRows = await sql.query<{ n: number }>(
    `select (
       coalesce((
         select sum(points_earned) from reviews
         where user_id = $1
           and (created_at at time zone $2)::date = (now() at time zone $2)::date
       ), 0)
       + coalesce((
         select sum(points) from streak_awards
         where user_id = $1
           and (created_at at time zone $2)::date = (now() at time zone $2)::date
       ), 0)
     )::int as n`,
    [userId, safe],
  );
  const strikes = await sql.query<{ n: number }>(
    `select count(*)::int as n from review_strikes where user_id = $1`,
    [userId],
  );
  const earned = Number(earnedRows[0]?.n ?? 0);
  const paused = Number(strikes[0]?.n ?? 0) >= REMOVALS_BEFORE_PAUSE;
  return {
    zone: safe,
    earned,
    paused,
    left: paused ? 0 : Math.max(0, DAILY_POINT_CAP - earned),
  };
}

function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === "t" || value === "true";
}

function stamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : "";
}

async function isAdmin(sql: Sql, userId: string) {
  const rows = await sql<{ is_admin: boolean }>`select is_admin from profiles where user_id = ${userId}`;
  return rows[0]?.is_admin === true;
}

const REASON_LABEL: Record<ReviewReason, string> = {
  spam: "Spam or gibberish",
  copied: "Copied from somewhere else",
  "wrong-book": "Wrong or unrelated book",
  offensive: "Offensive",
  other: "Other",
};

export function reasonLabel(reason: string): string {
  return isReviewReason(reason) ? REASON_LABEL[reason] : "Other";
}

export const reportReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { reviewId?: string; reason?: string }) => ({
    reviewId: clip(input?.reviewId, 80),
    reason: clip(input?.reason, 20),
  }))
  .handler(async ({ context, data }): Promise<{ ok: true; note: string } | { ok: false; error: string }> => {
    if (!data.reviewId) return { ok: false, error: "That note is gone." };
    if (!isReviewReason(data.reason)) return { ok: false, error: "Pick a reason." };
    const sql = await database();
    const me = context.userId;
    const recent = await sql.query<{ n: number }>(
      `select count(*)::int as n from rate_events
       where user_id = $1 and kind = 'review-report'
         and created_at > now() - interval '10 minutes'`,
      [me],
    );
    if (Number(recent[0]?.n ?? 0) >= 20) {
      return { ok: false, error: "That’s a lot of reports. Try again in a little while." };
    }
    const rows = await sql.query<{
      id: string;
      userId: string;
      body: string;
      points: number;
      createdAt: string;
      pages: number;
      removed: string | null;
      title: string;
      author: string;
      status: string;
      reviewer: string;
    }>(
      `select r.id, r.user_id as "userId", r.body, r.points_earned as points,
              r.created_at as "createdAt", r.pages, r.removed_at as removed,
              b.title, b.author, b.status, p.display_name as reviewer
       from reviews r
       join books b on b.id = r.book_id
       join profiles p on p.user_id = r.user_id
       where r.id = $1`,
      [data.reviewId],
    );
    const review = rows[0];
    if (!review || review.removed) return { ok: false, error: "That note is gone." };
    if (review.userId === me) return { ok: false, error: "That’s your own note." };
    const format = `${review.pages} pages in this sitting · ${review.status === "finished" ? "finished" : "still reading"}`;
    const inserted = await sql.query<{ id: string }>(
      `insert into review_reports (
         id, review_id, reporter_id, reason, review_body, book_title, book_author,
         format, points_earned, review_created_at, reviewer_id, reviewer_name
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (review_id, reporter_id) do nothing
       returning id`,
      [
        crypto.randomUUID(),
        review.id,
        me,
        data.reason,
        review.body,
        review.title,
        review.author,
        format,
        Number(review.points) || 0,
        review.createdAt,
        review.userId,
        review.reviewer,
      ],
    );
    if (!inserted[0]) return { ok: false, error: "You already reported this note." };
    await sql`insert into rate_events (user_id, kind) values (${me}, 'review-report')`;
    await sql.query(
      `update reviews
       set hidden = true
       where id = $1
         and removed_at is null
         and (
           select count(distinct reporter_id)::int
           from review_reports
           where review_id = $1 and status = 'open'
         ) >= $2`,
      [review.id, REPORTS_TO_HIDE],
    );
    return { ok: true, note: "Sent to the librarian. They won’t tell the reader it was you." };
  });

export const loadReviewDesk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true; cases: ReviewCase[] } | { ok: false; error: string }> => {
    const sql = await database();
    if (!(await isAdmin(sql, context.userId))) return { ok: false, error: "The librarian’s desk is closed." };
    const rows = await sql.query<{
      id: string;
      reviewId: string;
      reason: string;
      body: string;
      title: string;
      author: string;
      format: string;
      points: number;
      reviewDate: string;
      reviewer: string;
      reporter: string;
      createdAt: string;
      hidden: boolean | null;
      removedAt: string | null;
    }>(
      `select rr.id, rr.review_id as "reviewId", rr.reason, rr.review_body as body,
              rr.book_title as title, rr.book_author as author, rr.format,
              rr.points_earned as points, rr.review_created_at as "reviewDate",
              rr.reviewer_name as reviewer, reporter.display_name as reporter,
              rr.created_at as "createdAt", r.hidden, r.removed_at as "removedAt"
       from review_reports rr
       join profiles reporter on reporter.user_id = rr.reporter_id
       left join reviews r on r.id = rr.review_id
       where rr.status = 'open'
       order by rr.created_at asc`,
    );
    const grouped = new Map<string, ReviewCase>();
    for (const row of rows) {
      const reason = isReviewReason(row.reason) ? row.reason : "other";
      let item = grouped.get(row.reviewId);
      if (!item) {
        item = {
          reviewId: row.reviewId,
          title: row.title,
          author: row.author,
          format: row.format,
          body: row.body,
          points: Number(row.points) || 0,
          reviewDate: stamp(row.reviewDate),
          reviewer: row.reviewer,
          hidden: asBool(row.hidden),
          removed: Boolean(row.removedAt),
          reports: [],
        };
        grouped.set(row.reviewId, item);
      }
      item.reports.push({
        id: row.id,
        reason,
        reporter: row.reporter,
        createdAt: stamp(row.createdAt),
      });
    }
    return { ok: true, cases: [...grouped.values()] };
  });

async function decide(
  userId: string,
  reviewId: string,
  takePoints: boolean,
): Promise<{ ok: true; note: string } | { ok: false; error: string }> {
  if (!reviewId) return { ok: false, error: "That note is gone." };
  const sql = await database();
  if (!(await isAdmin(sql, userId))) return { ok: false, error: "The librarian’s desk is closed." };
  const status = takePoints ? "removed-points" : "removed";
  const found = await sql.query<{ userId: string; points: number; title: string; bookId: string }>(
    `select r.user_id as "userId", r.points_earned as points, b.title, r.book_id as "bookId"
     from reviews r
     join books b on b.id = r.book_id
     where r.id = $1 and r.removed_at is null`,
    [reviewId],
  );
  const review = found[0];
  if (!review) return { ok: false, error: "That note was already removed." };
  const updated = await sql.query<{ id: string }>(
    `update reviews set removed_at = now(), hidden = true
     where id = $1 and removed_at is null
     returning id`,
    [reviewId],
  );
  if (!updated[0]) return { ok: false, error: "That note was already removed." };
  const taken = takePoints ? Math.max(0, Number(review.points) || 0) : 0;
  if (taken > 0) {
    await sql.query(
      `update profiles set points = greatest(0, points - $2) where user_id = $1`,
      [review.userId, taken],
    );
    await sql.query(
      `update books set points_earned = greatest(0, points_earned - $2) where id = $1`,
      [review.bookId, taken],
    );
  }
  await sql.query(
    `insert into review_strikes (id, user_id, review_id, book_title, points_taken)
     values ($1, $2, $3, $4, $5)
     on conflict (review_id) do nothing`,
    [crypto.randomUUID(), review.userId, reviewId, review.title || "A book", taken],
  );
  await sql.query(
    `update review_reports set status = $2 where review_id = $1 and status = 'open'`,
    [reviewId, status],
  );
  return {
    ok: true,
    note: takePoints ? "Review removed. Those points were taken back, not given to anyone." : "Review removed. The points stay.",
  };
}

export const dismissReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((reviewId: string) => clip(reviewId, 80))
  .handler(async ({ context, data }): Promise<{ ok: true; note: string } | { ok: false; error: string }> => {
    if (!data) return { ok: false, error: "That note is gone." };
    const sql = await database();
    if (!(await isAdmin(sql, context.userId))) return { ok: false, error: "The librarian’s desk is closed." };
    await sql.query(
      `update reviews set hidden = false where id = $1 and removed_at is null`,
      [data],
    );
    const rows = await sql.query<{ id: string }>(
      `update review_reports set status = 'dismissed' where review_id = $1 and status = 'open' returning id`,
      [data],
    );
    if (!rows[0]) return { ok: false, error: "Those reports were already decided." };
    return { ok: true, note: "Dismissed. The note is public again, and no points moved." };
  });

export const removeReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((reviewId: string) => clip(reviewId, 80))
  .handler(async ({ context, data }) => decide(context.userId, data, false));

export const removeReviewAndPoints = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((reviewId: string) => clip(reviewId, 80))
  .handler(async ({ context, data }) => decide(context.userId, data, true));
