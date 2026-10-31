import { useEffect, useState } from "react";
import { searchBooks, type BookHit } from "@/lib/openlibrary";
import { BOOK_FORMATS, formatTag, type BookFormat } from "@/lib/catalog";
import {
  createDiscussion,
  loadDiscussions,
  loadReplies,
  replyToDiscussion,
  searchReaders,
  type BookRow,
  type DiscussionPost,
  type DiscussionReply,
  type ReaderHit,
  type SimilarReview,
} from "@/lib/readme/api";
import { FriendsDesk } from "@/components/readme/friends";
import { cn } from "@/lib/cn";
import { ReportReview, ReviewDesk } from "@/components/readme/report-review";

type ChosenBook = {
  title: string;
  author: string;
  isbn: string;
  coverUrl: string | null;
  format: BookFormat;
};

export function FormatFilter({ value, onChange }: { value: BookFormat | "all"; onChange: (value: BookFormat | "all") => void }) {
  const options: { id: BookFormat | "all"; label: string }[] = [
    { id: "all", label: "All" },
    ...BOOK_FORMATS.map((format) => ({ id: format.id, label: format.tag })),
  ];
  return (
    <div className="format-filters mb-3" role="group" aria-label="Format">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={cn("format-chip", value === option.id && "is-on")}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ReaderSearch({ onProfile }: { onProfile: (userId: string, name: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReaderHit[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setStatus("idle");
      setNote(null);
      return;
    }
    setStatus("loading");
    let live = true;
    const handle = window.setTimeout(() => {
      void searchReaders({ data: q })
        .then((found) => {
          if (!live) return;
          setResults(found.results);
          setNote(found.note ?? null);
          setStatus("done");
        })
        .catch(() => {
          if (!live) return;
          setStatus("error");
        });
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  return (
    <div className="catalog-search catalog-card p-4">
      <h2 className="font-display text-3xl">Card catalog</h2>
      <label>
        <svg viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="none" stroke="#6b442c" strokeWidth="2" />
          <path d="M11 11 L16 16" stroke="#6b442c" strokeWidth="2" />
        </svg>
        <input
          value={query}
          aria-label="Search readers"
          placeholder="Search readers by name"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {status === "loading" && <p className="text-sm text-muted">Looking through the catalog…</p>}
      {status === "error" && <p className="text-sm">The catalog didn’t open. Try again in a moment.</p>}
      {note && <p className="text-sm">{note}</p>}
      {status === "done" && !note && results?.length === 0 && <p className="text-sm text-muted">No readers found</p>}
      {results && results.length > 0 && (
        <ul className="grid gap-2">
          {results.map((reader) => (
            <li key={reader.userId} className="reader-hit">
              <button type="button" className="person-hit" onClick={() => onProfile(reader.userId, reader.displayName)}>
                {reader.image ? (
                  <img src={reader.image} alt="" />
                ) : (
                  <span className="face">{reader.displayName.slice(0, 1).toUpperCase()}</span>
                )}
                <span className="min-w-0 font-bold">{reader.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Hub({
  books,
  meName,
  shelves,
  onVisit,
  onProfile,
  notices = { requests: 0, unread: 0 },
  onCounts,
  isAdmin = false,
  reportedReviewIds = [],
}: {
  books: BookRow[];
  meName: string;
  shelves: SimilarReview[];
  onVisit: (userId: string) => void;
  onProfile: (userId: string, name: string) => void;
  notices?: { requests: number; unread: number };
  onCounts?: (counts: { requests: number; unread: number }) => void;
  isAdmin?: boolean;
  reportedReviewIds?: string[];
}) {
  const [posts, setPosts] = useState<DiscussionPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pane, setPane] = useState<"room" | "friends">("room");
  const [format, setFormat] = useState<BookFormat | "all">("all");
  const badge = notices.requests + notices.unread;
  const reported = new Set(reportedReviewIds);

  async function refresh() {
    const next = await loadDiscussions();
    setPosts(next);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    loadDiscussions()
      .then((next) => {
        if (!cancelled) setPosts(next);
      })
      .catch(() => {
        if (!cancelled) setError("The hub didn’t open. Try again in a moment.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shownShelves = format === "all" ? shelves : shelves.filter((shelf) => shelf.format === format);
  const shownPosts = format === "all" ? posts : (posts ?? []).filter((post) => post.bookFormat === format);
  const patrons = new Map<string, string>();
  patrons.set("you", meName || "You");
  for (const shelf of shownShelves) patrons.set(shelf.userId, shelf.displayName);
  for (const post of shownPosts ?? []) patrons.set(post.userId, post.displayName);
  const boards = [...new Map(shownShelves.map((shelf) => [shelf.userId, shelf])).values()];

  return (
    <section className="grid min-w-0 gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Hub">
        <button
          type="button"
          role="tab"
          aria-selected={pane === "room"}
          className={cn("btn", pane === "room" ? "btn-primary" : "btn-surface")}
          onClick={() => setPane("room")}
        >
          Reading room
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === "friends"}
          className={cn("btn", pane === "friends" ? "btn-primary" : "btn-surface")}
          onClick={() => setPane("friends")}
        >
          Friends
          {badge > 0 && <span className="pixel-badge">{badge}</span>}
        </button>
      </div>
      {pane === "friends" ? (
        <FriendsDesk onVisit={onVisit} onProfile={onProfile} onCounts={onCounts} />
      ) : (
        <>
      {isAdmin && <ReviewDesk />}
      <ReaderSearch onProfile={onProfile} />
      <FormatFilter value={format} onChange={setFormat} />
      <div className="reading-room">
        <h2 className="font-display text-3xl">The reading room</h2>
        <p className="mt-1 text-sm text-muted">Who is around, and which shelves are open.</p>
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {[...patrons.entries()].map(([id, name]) => (
            <li key={id} className="shrink-0">
              {id === "you" ? (
                <span className="patron">
                  <i />
                  {name}
                </span>
              ) : (
                <button type="button" className="patron" onClick={() => onProfile(id, name)}>
                  <i />
                  {name}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {boards.length > 0 && (
        <div className="bulletin">
          <h2 className="font-display text-2xl">Bulletin board</h2>
          <p className="mt-1 text-sm text-muted">Friends’ shelves, pinned by the discussions you share.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {boards.map((shelf) => {
              const notes = shownShelves.filter((item) => item.userId === shelf.userId).slice(0, 6);
              return (
                <li key={shelf.userId} className="rounded-card border border-line bg-bg p-3">
                  <button type="button" className="person-hit w-full text-left" onClick={() => onProfile(shelf.userId, shelf.displayName)}>
                    <span className="text-xs font-bold tracking-wide text-sage uppercase">{shelf.displayName}</span>
                    <span className="cover-row mt-2">
                      {notes.map((item) =>
                        item.coverUrl ? (
                          <img key={item.reviewId} src={item.coverUrl} alt="" />
                        ) : (
                          <i key={item.reviewId}>{item.title.slice(0, 1)}</i>
                        ),
                      )}
                    </span>
                  </button>
                  <ul className="mt-3 grid gap-2">
                    {notes.map((item) => (
                      <li key={item.reviewId} className="border-t border-line pt-2">
                        <p className="text-xs font-bold tracking-wide text-accent uppercase">{item.title}</p>
                        <p className="mt-1 text-sm">“{item.body}”</p>
                        <div className="mt-2">
                          <ReportReview reviewId={item.reviewId} reported={reported.has(item.reviewId)} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">Discussions</h2>
          <p className="mt-1 text-sm text-muted">A title, a book, and what you want to talk about.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setWriting((open) => !open)}>
          {writing ? "Close" : "New discussion"}
        </button>
      </div>
      {writing && (
        <Composer
          books={books}
          onPosted={async () => {
            setWriting(false);
            await refresh();
          }}
        />
      )}
      {error && <p className="rounded-card border border-line bg-surface p-4 text-sm">{error}</p>}
      {posts === null && !error && <p className="text-sm text-muted">Opening the hub…</p>}
      {shownPosts?.length === 0 && (
        <p className="rounded-card border border-line bg-surface p-5 text-sm text-muted">
          No discussions in this format yet.
        </p>
      )}
      <ul className="grid gap-3">
        {shownPosts?.map((post) => (
          <li key={post.id} className="catalog-card p-4">
            <button
              type="button"
              className="flex w-full gap-3 text-left"
              onClick={() => setOpenId((current) => (current === post.id ? null : post.id))}
            >
              <Cover url={post.coverUrl} title={post.bookTitle} format={post.bookFormat} />
              <span className="min-w-0">
                <span className="text-xs font-bold tracking-wide text-accent uppercase">{post.bookTitle}</span>
                <span className="mt-1 block font-display text-2xl leading-tight">{post.title}</span>
                <span className="mt-1 block text-sm text-muted">
                  {when(post.createdAt) ? when(post.createdAt) : "Just now"}
                  {" · "}
                  {post.replyCount === 1 ? "1 reply" : `${post.replyCount} replies`}
                </span>
              </span>
            </button>
            <button type="button" className="person-hit mt-2 font-bold" onClick={() => onProfile(post.userId, post.displayName)}>
              {post.displayName}
            </button>
            <p className="mt-3 text-sm">{post.body}</p>
            {openId === post.id && <Thread discussionId={post.id} onProfile={onProfile} onReplied={refresh} />}
          </li>
        ))}
      </ul>
        </>
      )}
    </section>
  );
}

function Composer({ books, onPosted }: { books: BookRow[]; onPosted: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [chosen, setChosen] = useState<ChosenBook | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<BookHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-3 rounded-card border border-line bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!chosen) {
          setError("Choose the book this is about.");
          return;
        }
        setBusy(true);
        setError(null);
        void createDiscussion({
          data: {
            title,
            body,
            bookTitle: chosen.title,
            bookAuthor: chosen.author,
            isbn: chosen.isbn,
            coverUrl: chosen.coverUrl,
            bookFormat: chosen.format,
          },
        })
          .then(async (result) => {
            if (!result.ok) {
              setError(result.error);
              return;
            }
            await onPosted();
          })
          .catch(() => setError("That discussion didn’t post."))
          .finally(() => setBusy(false));
      }}
    >
      <label className="grid gap-1 text-sm">
        Title
        <input
          value={title}
          maxLength={80}
          required
          aria-label="Discussion title"
          placeholder="What do you want to talk about?"
          className="field"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div>
        <p className="text-sm">Which book?</p>
        {books.length > 0 && (
          <ul className="mt-2 flex min-w-0 gap-2 overflow-x-auto pb-1">
            {books.map((book) => {
              const selected = chosen?.title === book.title && chosen.isbn === book.isbn;
              return (
                <li key={book.id} className="shrink-0">
                  <button
                    type="button"
                    className={cn(
                      "flex w-28 flex-col gap-1 rounded-card border bg-bg p-2 text-left",
                      selected ? "border-accent" : "border-line",
                    )}
                    onClick={() =>
                      setChosen({ title: book.title, author: book.author, isbn: book.isbn, coverUrl: book.coverUrl, format: book.format })
                    }
                  >
                    <Cover url={book.coverUrl} title={book.title} format={book.format} />
                    <span className="line-clamp-2 text-xs font-bold">{book.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-2 flex gap-2">
          <input
            value={query}
            aria-label="Search for a book"
            placeholder="Or search a title"
            className="field"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-surface"
            disabled={searching}
            onClick={() => {
              const text = query.trim();
              if (!text) return;
              setSearching(true);
              void searchBooks(text)
                .then(setHits)
                .catch(() => setError("The catalog didn’t answer."))
                .finally(() => setSearching(false));
            }}
          >
            {searching ? "…" : "Search"}
          </button>
        </div>
        {hits.length > 0 && (
          <ul className="mt-2 grid gap-2">
            {hits.map((hit) => (
              <li key={`${hit.isbn}-${hit.title}`}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-card border p-2 text-left",
                    chosen?.title === hit.title && chosen.isbn === hit.isbn ? "border-accent" : "border-line",
                  )}
                  onClick={() => setChosen({ title: hit.title, author: hit.author, isbn: hit.isbn, coverUrl: hit.coverUrl, format: "novel" })}
                >
                  <Cover url={hit.coverUrl} title={hit.title} />
                  <span>
                    <span className="block font-bold">{hit.title}</span>
                    <span className="text-sm text-muted">{hit.author}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {chosen && (
          <label className="mt-2 grid gap-1 text-sm">
            Format for {chosen.title}
            <select
              className="field"
              value={chosen.format}
              onChange={(event) => {
                const next = BOOK_FORMATS.find((item) => item.id === event.target.value)?.id ?? "novel";
                setChosen({ ...chosen, format: next });
              }}
            >
              {BOOK_FORMATS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="grid gap-1 text-sm">
        The discussion
        <textarea
          value={body}
          rows={4}
          maxLength={600}
          aria-label="Discussion"
          placeholder="The question you actually want answered."
          className="field resize-none"
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      {error && <p className="text-sm text-accent">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Posting…" : "Post discussion"}
      </button>
    </form>
  );
}

function Thread({ discussionId, onProfile, onReplied }: { discussionId: string; onProfile: (userId: string, name: string) => void; onReplied: () => Promise<void> }) {
  const [replies, setReplies] = useState<DiscussionReply[] | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadReplies({ data: discussionId })
      .then((rows) => {
        if (!cancelled) setReplies(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Replies didn’t load.");
      });
    return () => {
      cancelled = true;
    };
  }, [discussionId]);

  return (
    <div className="mt-4 border-t border-line pt-3">
      {replies === null && !error && <p className="text-sm text-muted">Loading replies…</p>}
      {replies?.length === 0 && <p className="text-sm text-muted">No replies yet.</p>}
      <ul className="grid gap-2">
        {replies?.map((reply) => (
          <li key={reply.id} className="rounded-card bg-bg px-3 py-2">
            <p className="text-xs font-bold text-muted">
              <button type="button" className="person-hit" onClick={() => onProfile(reply.userId, reply.displayName)}>
                {reply.displayName}
              </button>
              {when(reply.createdAt) ? ` · ${when(reply.createdAt)}` : ""}
            </p>
            <p className="mt-1 text-sm">{reply.body}</p>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          void replyToDiscussion({ data: { discussionId, body } })
            .then(async (result) => {
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setBody("");
              const rows = await loadReplies({ data: discussionId });
              setReplies(rows);
              await onReplied();
            })
            .catch(() => setError("That reply didn’t send."))
            .finally(() => setBusy(false));
        }}
      >
        <label className="grid gap-1 text-sm">
          Reply
          <textarea
            value={body}
            rows={2}
            maxLength={400}
            aria-label="Reply"
            className="field resize-none"
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        {error && <p className="text-sm text-accent">{error}</p>}
        <button type="submit" className="btn btn-surface w-fit" disabled={busy}>
          {busy ? "Sending…" : "Reply"}
        </button>
      </form>
    </div>
  );
}

function Cover({ url, title, format = "novel" }: { url: string | null; title: string; format?: BookFormat }) {
  const [failed, setFailed] = useState(false);
  const tag = <span className="format-tag">{formatTag(format)}</span>;
  if (!url || failed) {
    return (
      <span className="cover-wrap grid h-16 w-11 shrink-0 place-items-center rounded-sm bg-line font-display text-lg">
        {title.slice(0, 1)}
        {tag}
      </span>
    );
  }
  return (
    <span className="cover-wrap">
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        className="h-16 w-11 shrink-0 rounded-sm object-cover"
        onError={() => setFailed(true)}
      />
      {tag}
    </span>
  );
}
