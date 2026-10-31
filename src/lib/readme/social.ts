import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type SocialResult = { ok: true; note?: string } | { ok: false; error: string };

export type ReaderCard = {
  userId: string;
  displayName: string;
  outfit: string;
  image: string | null;
};

export type FriendCard = ReaderCard & { unread: number };

export type LoungeNote = {
  id: string;
  fromUserId: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

export type ReportRow = {
  id: string;
  reporter: string;
  target: string;
  reason: string;
  place: string;
  createdAt: string;
};

export type FriendsDeskData = {
  policy: "anyone" | "friends-of-friends";
  incoming: ReaderCard[];
  outgoing: ReaderCard[];
  friends: FriendCard[];
  isAdmin: boolean;
  reports: ReportRow[];
};

export type NoticeCounts = { requests: number; unread: number };

type Sql = Awaited<ReturnType<typeof import("@/lib/db").getSql>>;

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function cleanMessage(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").replace(/\r\n/g, "\n").trim().slice(0, 500);
}

function safeImage(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("https://") || value.length > 300) return null;
  if (/[@\s]/.test(value)) return null;
  return value;
}

async function database(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function ensureProfile(sql: Sql, userId: string) {
  await sql`
    insert into profiles (user_id, display_name)
    values (${userId}, 'Reader')
    on conflict (user_id) do nothing
  `;
}

async function isBlocked(sql: Sql, a: string, b: string) {
  const rows = await sql.query<{ ok: boolean }>(
    `select true as ok from blocks
     where (blocker_id = $1 and blocked_id = $2)
        or (blocker_id = $2 and blocked_id = $1)
     limit 1`,
    [a, b],
  );
  return Boolean(rows[0]);
}

async function isFriend(sql: Sql, a: string, b: string) {
  const rows = await sql.query<{ ok: boolean }>(
    `select true as ok from friend_requests
     where status = 'accepted'
       and (
         (from_user_id = $1 and to_user_id = $2)
         or (from_user_id = $2 and to_user_id = $1)
       )
     limit 1`,
    [a, b],
  );
  return Boolean(rows[0]);
}

async function sharesAFriend(sql: Sql, me: string, target: string) {
  const rows = await sql.query<{ ok: boolean }>(
    `with pals as (
       select from_user_id as user_id, to_user_id as friend_id
       from friend_requests where status = 'accepted'
       union
       select to_user_id, from_user_id
       from friend_requests where status = 'accepted'
     )
     select true as ok
     from pals mine
     join pals theirs on theirs.friend_id = mine.friend_id
     where mine.user_id = $1 and theirs.user_id = $2
     limit 1`,
    [me, target],
  );
  return Boolean(rows[0]);
}

async function tooFast(sql: Sql, userId: string, kind: string, limit: number, seconds: number) {
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from rate_events
     where user_id = $1 and kind = $2
       and created_at > now() - ($3::int * interval '1 second')`,
    [userId, kind, seconds],
  );
  return Number(rows[0]?.n ?? 0) >= limit;
}

async function stamp(sql: Sql, userId: string, kind: string) {
  await sql`insert into rate_events (user_id, kind) values (${userId}, ${kind})`;
}

function card(row: { userId: string; displayName: string; outfit: string; image: string | null }): ReaderCard {
  return {
    userId: row.userId,
    displayName: row.displayName,
    outfit: row.outfit || "",
    image: safeImage(row.image),
  };
}

export const loadNotices = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<NoticeCounts> => {
    const sql = await database();
    const me = context.userId;
    const requests = await sql.query<{ n: number }>(
      `select count(*)::int as n from friend_requests r
       where r.to_user_id = $1 and r.status = 'pending'
         and not exists (
           select 1 from blocks b
           where (b.blocker_id = $1 and b.blocked_id = r.from_user_id)
              or (b.blocker_id = r.from_user_id and b.blocked_id = $1)
         )`,
      [me],
    );
    const unread = await sql.query<{ n: number }>(
      `select count(*)::int as n from messages m
       where m.to_user_id = $1 and m.read_at is null
         and not exists (
           select 1 from blocks b
           where (b.blocker_id = $1 and b.blocked_id = m.from_user_id)
              or (b.blocker_id = m.from_user_id and b.blocked_id = $1)
         )
         and exists (
           select 1 from friend_requests f
           where f.status = 'accepted'
             and (
               (f.from_user_id = $1 and f.to_user_id = m.from_user_id)
               or (f.from_user_id = m.from_user_id and f.to_user_id = $1)
             )
         )`,
      [me],
    );
    return { requests: Number(requests[0]?.n ?? 0), unread: Number(unread[0]?.n ?? 0) };
  });

export const loadFriends = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<FriendsDeskData> => {
    const sql = await database();
    const me = context.userId;
    await ensureProfile(sql, me);
    const policyRows = await sql<{ request_policy: string; is_admin: boolean }>`
      select request_policy, is_admin from profiles where user_id = ${me}
    `;
    const policy = policyRows[0]?.request_policy === "friends-of-friends" ? "friends-of-friends" : "anyone";
    const isAdmin = Boolean(policyRows[0]?.is_admin);

    const people = await sql.query<{
      userId: string;
      displayName: string;
      outfit: string;
      image: string | null;
      direction: string;
    }>(
      `select p.user_id as "userId", p.display_name as "displayName", p.outfit, u.image,
              case when f.to_user_id = $1 then 'in' else 'out' end as direction
       from friend_requests f
       join profiles p on p.user_id = case when f.to_user_id = $1 then f.from_user_id else f.to_user_id end
       left join "user" u on u.id = p.user_id
       where f.status = 'pending'
         and (f.to_user_id = $1 or f.from_user_id = $1)
         and not exists (
           select 1 from blocks b
           where (b.blocker_id = $1 and b.blocked_id = p.user_id)
              or (b.blocker_id = p.user_id and b.blocked_id = $1)
         )
       order by f.created_at desc`,
      [me],
    );

    const friends = await sql.query<{
      userId: string;
      displayName: string;
      outfit: string;
      image: string | null;
      unread: number;
    }>(
      `select p.user_id as "userId", p.display_name as "displayName", p.outfit, u.image,
              (
                select count(*)::int from messages m
                where m.to_user_id = $1 and m.from_user_id = p.user_id and m.read_at is null
              ) as unread
       from friend_requests f
       join profiles p on p.user_id = case when f.from_user_id = $1 then f.to_user_id else f.from_user_id end
       left join "user" u on u.id = p.user_id
       where f.status = 'accepted'
         and (f.from_user_id = $1 or f.to_user_id = $1)
         and not exists (
           select 1 from blocks b
           where (b.blocker_id = $1 and b.blocked_id = p.user_id)
              or (b.blocker_id = p.user_id and b.blocked_id = $1)
         )
       order by p.display_name asc`,
      [me],
    );

    let reports: ReportRow[] = [];
    if (isAdmin) {
      reports = await sql<ReportRow>`
        select r.id,
               reporter.display_name as reporter,
               target.display_name as target,
               r.reason,
               r.place,
               r.created_at as "createdAt"
        from reports r
        join profiles reporter on reporter.user_id = r.reporter_id
        join profiles target on target.user_id = r.target_user_id
        order by r.created_at desc
        limit 40
      `;
    }

    return {
      policy,
      incoming: people.filter((row) => row.direction === "in").map(card),
      outgoing: people.filter((row) => row.direction === "out").map(card),
      friends: friends.map((row) => ({ ...card(row), unread: Number(row.unread ?? 0) })),
      isAdmin,
      reports,
    };
  });

export const setRequestPolicy = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((policy: string) => (policy === "friends-of-friends" ? "friends-of-friends" : "anyone"))
  .handler(async ({ context, data }): Promise<SocialResult> => {
    const sql = await database();
    await ensureProfile(sql, context.userId);
    await sql`update profiles set request_policy = ${data} where user_id = ${context.userId}`;
    return { ok: true };
  });

export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => clip(userId, 80))
  .handler(async ({ context, data }): Promise<SocialResult> => {
    const me = context.userId;
    const target = data;
    if (!target) return { ok: false, error: "Choose a reader." };
    if (target === me) return { ok: false, error: "That’s your own shelf." };
    const sql = await database();
    await ensureProfile(sql, me);
    if (await tooFast(sql, me, "friend-request", 6, 600)) {
      return { ok: false, error: "Slow down. Friend requests are limited so nobody gets spammed." };
    }
    if (await isBlocked(sql, me, target)) return { ok: false, error: "That reader isn’t available." };
    const host = await sql<{ user_id: string; request_policy: string; suspended: boolean }>`
      select user_id, request_policy, suspended from profiles where user_id = ${target}
    `;
    if (!host[0] || host[0].suspended) return { ok: false, error: "That reader isn’t available." };
    if (host[0].request_policy === "friends-of-friends" && !(await sharesAFriend(sql, me, target))) {
      return { ok: false, error: "They only take requests from friends of friends." };
    }
    await stamp(sql, me, "friend-request");
    const rows = await sql.query<{ id: string; from_user_id: string; to_user_id: string; status: string }>(
      `select id, from_user_id, to_user_id, status from friend_requests
       where (from_user_id = $1 and to_user_id = $2)
          or (from_user_id = $2 and to_user_id = $1)`,
      [me, target],
    );
    const forward = rows.find((row) => row.from_user_id === me && row.to_user_id === target);
    const reverse = rows.find((row) => row.from_user_id === target && row.to_user_id === me);
    if (forward?.status === "accepted" || reverse?.status === "accepted") {
      return { ok: false, error: "You’re already friends." };
    }
    if (reverse?.status === "pending") {
      await sql`
        update friend_requests
        set status = 'accepted', responded_at = now()
        where id = ${reverse.id} and to_user_id = ${me} and status = 'pending'
      `;
      return { ok: true, note: "They already asked. You’re friends now." };
    }
    if (forward?.status === "pending") return { ok: false, error: "You already asked." };
    if (forward) {
      await sql`
        update friend_requests
        set status = 'pending', created_at = now(), responded_at = null
        where id = ${forward.id} and from_user_id = ${me}
      `;
      return { ok: true, note: "Request sent. They have to accept." };
    }
    await sql`
      insert into friend_requests (id, from_user_id, to_user_id, status)
      values (${crypto.randomUUID()}, ${me}, ${target}, 'pending')
    `;
    return { ok: true, note: "Request sent. They have to accept." };
  });

export const answerFriendRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId?: string; accept?: boolean }) => ({
    userId: clip(input?.userId, 80),
    accept: Boolean(input?.accept),
  }))
  .handler(async ({ context, data }): Promise<SocialResult> => {
    if (!data.userId) return { ok: false, error: "That request is gone." };
    const sql = await database();
    const status = data.accept ? "accepted" : "declined";
    const rows = await sql<{ id: string }>`
      update friend_requests
      set status = ${status}, responded_at = now()
      where from_user_id = ${data.userId}
        and to_user_id = ${context.userId}
        and status = 'pending'
      returning id
    `;
    if (!rows[0]) return { ok: false, error: "That request is gone." };
    return { ok: true, note: data.accept ? "You’re friends." : "Request declined." };
  });

export const loadThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((friendId: string) => clip(friendId, 80))
  .handler(async ({ context, data }): Promise<{ ok: true; notes: LoungeNote[] } | { ok: false; error: string }> => {
    const me = context.userId;
    if (!data || data === me) return { ok: false, error: "That chat isn’t yours." };
    const sql = await database();
    if (await isBlocked(sql, me, data)) return { ok: false, error: "Notes are stopped." };
    if (!(await isFriend(sql, me, data))) return { ok: false, error: "Only friends can open this chat." };
    const notes = await sql.query<{ id: string; fromUserId: string; body: string; createdAt: string }>(
      `select id, from_user_id as "fromUserId", body, created_at as "createdAt"
       from messages
       where (from_user_id = $1 and to_user_id = $2)
          or (from_user_id = $2 and to_user_id = $1)
       order by created_at asc
       limit 200`,
      [me, data],
    );
    return {
      ok: true,
      notes: notes.map((note) => ({
        id: note.id,
        fromUserId: note.fromUserId,
        body: note.body,
        createdAt: String(note.createdAt),
        mine: note.fromUserId === me,
      })),
    };
  });

export const sendNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { friendId?: string; body?: string }) => ({
    friendId: clip(input?.friendId, 80),
    body: cleanMessage(input?.body),
  }))
  .handler(async ({ context, data }): Promise<SocialResult> => {
    const me = context.userId;
    if (!data.friendId || data.friendId === me) return { ok: false, error: "That chat isn’t yours." };
    if (data.body.length < 1) return { ok: false, error: "Write a note." };
    const sql = await database();
    if (await tooFast(sql, me, "message", 12, 60) || (await tooFast(sql, me, "message", 80, 3600))) {
      return { ok: false, error: "Slow down. The lounge only takes a few notes a minute." };
    }
    if (await isBlocked(sql, me, data.friendId)) return { ok: false, error: "Notes are stopped." };
    if (!(await isFriend(sql, me, data.friendId))) return { ok: false, error: "Only friends can send notes." };
    await stamp(sql, me, "message");
    await sql`
      insert into messages (id, from_user_id, to_user_id, body)
      values (${crypto.randomUUID()}, ${me}, ${data.friendId}, ${data.body})
    `;
    return { ok: true };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => clip(id, 80))
  .handler(async ({ context, data }): Promise<SocialResult> => {
    if (!data) return { ok: false, error: "That note is already gone." };
    const sql = await database();
    const rows = await sql<{ id: string }>`
      delete from messages
      where id = ${data} and from_user_id = ${context.userId}
      returning id
    `;
    if (!rows[0]) return { ok: false, error: "You can only tear out your own notes." };
    return { ok: true };
  });

export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((friendId: string) => clip(friendId, 80))
  .handler(async ({ context, data }): Promise<SocialResult> => {
    if (!data) return { ok: true };
    const sql = await database();
    if (!(await isFriend(sql, context.userId, data))) return { ok: true };
    await sql`
      update messages set read_at = now()
      where to_user_id = ${context.userId} and from_user_id = ${data} and read_at is null
    `;
    return { ok: true };
  });

export const blockReader = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => clip(userId, 80))
  .handler(async ({ context, data }): Promise<SocialResult> => {
    const me = context.userId;
    if (!data || data === me) return { ok: false, error: "You can’t block yourself." };
    const sql = await database();
    await ensureProfile(sql, me);
    await sql`
      insert into blocks (blocker_id, blocked_id)
      values (${me}, ${data})
      on conflict do nothing
    `;
    await sql`
      delete from friend_requests
      where (from_user_id = ${me} and to_user_id = ${data})
         or (from_user_id = ${data} and to_user_id = ${me})
    `;
    return { ok: true, note: "Blocked. The friendship is gone, and notes stop both ways." };
  });

export const reportReader = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId?: string; reason?: string; place?: string }) => ({
    userId: clip(input?.userId, 80),
    reason: clip(input?.reason, 280),
    place: input?.place === "chat" ? "chat" : "profile",
  }))
  .handler(async ({ context, data }): Promise<SocialResult> => {
    const me = context.userId;
    if (!data.userId || data.userId === me) return { ok: false, error: "Pick someone else to report." };
    if (data.reason.length < 8) return { ok: false, error: "Tell the librarian a little more." };
    const sql = await database();
    await ensureProfile(sql, me);
    if (await tooFast(sql, me, "report", 8, 3600)) {
      return { ok: false, error: "The librarian already has several notes from you. Try later." };
    }
    const host = await sql<{ user_id: string }>`select user_id from profiles where user_id = ${data.userId}`;
    if (!host[0]) return { ok: false, error: "That reader isn’t available." };
    await stamp(sql, me, "report");
    await sql`
      insert into reports (id, reporter_id, target_user_id, reason, place)
      values (${crypto.randomUUID()}, ${me}, ${data.userId}, ${data.reason}, ${data.place})
    `;
    return { ok: true, note: "Sent to the librarian’s list." };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((confirm: string) => clip(confirm, 12))
  .handler(async ({ context, data }): Promise<SocialResult> => {
    if (data !== "DELETE") return { ok: false, error: "Type DELETE to erase the shelf." };
    const sql = await database();
    const me = context.userId;
    await sql`delete from rate_events where user_id = ${me}`;
    await sql`delete from profiles where user_id = ${me}`;
    await sql`delete from "user" where id = ${me}`;
    return { ok: true };
  });
