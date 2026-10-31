import { useEffect, useState } from "react";
import { Minus, Plus, ScanLine, X } from "lucide-react";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState, type AppUser } from "@/lib/auth/use-current-user";
import {
  BOOK_FORMATS,
  ITEMS,
  MAX_PAGES_PER_LOG,
  MIN_NOTE,
  POINTS,
  QUICK_PICKS,
  SHOP_SLOTS,
  formatPoints,
  formatTag,
  isBookFormat,
  plannedFinish,
  spineIndex,
  type BookFormat,
  type Slot,
} from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { hitFromQuick, searchBooks, type BookHit } from "@/lib/openlibrary";
import {
  addBook,
  awardReview,
  buyItem,
  equipItem,
  loadHome,
  loadStreak,
  logReading,
  removeBook,
  setDisplayName,
  setPageCount,
  type BookRow,
  type HomeData,
  type ReviewRow,
  type StreakInfo,
} from "@/lib/readme/api";
import { loadNotices } from "@/lib/readme/social";
import { EmailAuth } from "@/components/readme/email-auth";
import { SafetyActions } from "@/components/readme/friends";
import { Hub, FormatFilter } from "@/components/readme/hub";
import { LibraryScene, ItemPreview, type SpineBook } from "@/components/readme/library-scene";
import { ReadMeLogo } from "@/components/readme/logo";
import { ReportReview } from "@/components/readme/report-review";
import { Scanner } from "@/components/hearth/scanner";

const SHELF_DEMO = 7;

function readerZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const SAMPLE: SpineBook[] = [
  {
    id: "sample-prince",
    title: "The Little Prince",
    status: "finished",
    tips: 2,
    format: "novel",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780156012195-M.jpg",
  },
  {
    id: "sample-piranesi",
    title: "Piranesi",
    status: "finished",
    format: "graphic",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9781635575637-M.jpg",
  },
  {
    id: "sample-pride",
    title: "Pride and Prejudice",
    status: "reading",
    format: "novel",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780141439518-M.jpg",
  },
  {
    id: "sample-hobbit",
    title: "The Hobbit",
    status: "reading",
    format: "manga",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780547928227-M.jpg",
  },
  {
    id: "sample-emma",
    title: "Emma",
    status: "finished",
    format: "comic",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780141439587-M.jpg",
  },
  {
    id: "sample-frank",
    title: "Frankenstein",
    status: "finished",
    format: "graphic",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780141439471-M.jpg",
  },
  {
    id: "sample-jane",
    title: "Jane Eyre",
    status: "finished",
    format: "manga",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780141441146-M.jpg",
  },
  {
    id: "sample-dune",
    title: "Dune",
    status: "reading",
    format: "comic",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780441172719-M.jpg",
  },
  {
    id: "sample-1984",
    title: "Nineteen Eighty-Four",
    status: "finished",
    format: "novel",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780451524935-M.jpg",
  },
  {
    id: "sample-circe",
    title: "Circe",
    status: "finished",
    format: "graphic",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780316556347-M.jpg",
  },
];

const DEMO_BOOKS = SAMPLE.slice(0, SHELF_DEMO);

export function ReadMeApp() {
  const [mounted, setMounted] = useState(false);
  const { user, isPending } = useCurrentUserState();
  const [accountName, setAccountName] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);
  const pending = !mounted || isPending;

  return (
    <div className="library-app min-h-dvh">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-4">
        <div>
          <ReadMeLogo className="brand-logo" />
          <p className="mt-1 text-sm text-muted">Read the pages. Share the shelf.</p>
        </div>
        <div className="who shrink-0">
          {pending ? (
            <span className="block size-8 rounded-full bg-line" />
          ) : user ? (
            <UserButton name={accountName} />
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-28 md:pb-10">
        {pending ? (
          <LibraryScene books={DEMO_BOOKS} outfitId="" shelfId="" lampId="" label="The library" />
        ) : user ? (
          <LibraryHome user={user} onName={setAccountName} />
        ) : (
          <Lobby />
        )}
      </main>
    </div>
  );
}

function Lobby() {
  return (
    <div className="grid gap-4">
      <LibraryScene
        books={DEMO_BOOKS}
        outfitId=""
        shelfId=""
        lampId=""
        label="A preview of the library"
        onBook={() => document.getElementById("sign-in")?.scrollIntoView({ behavior: "smooth" })}
      />
      <section id="sign-in" className="rounded-card border border-line bg-surface p-5">
        <h1 className="font-display text-3xl">Open a shelf.</h1>
        <p className="mt-2 text-muted">
          Sign in, log the books you actually sit with, and leave a short note. Other readers can open
          your shelf and award you points when they agree.
        </p>
        <div className="mt-4 grid gap-2 sm:max-w-sm">
          {GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              className="btn btn-primary"
              onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
            >
              Continue with {provider.label}
            </button>
          ))}
          <EmailAuth />
        </div>
      </section>
    </div>
  );
}

function LibraryHome({ user, onName }: { user: AppUser; onName?: (name: string) => void }) {
  const [visitId, setVisitId] = useState<string | null>(null);
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"library" | "hub" | "shop">("library");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notices, setNotices] = useState({ requests: 0, unread: 0 });
  const [shelfFormat, setShelfFormat] = useState<BookFormat | "all">("all");
  const [person, setPerson] = useState<{ userId: string; name: string; from: "library" | "hub" | "shop" } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const noticeCount = notices.requests + notices.unread;

  useEffect(() => {
    let cancelled = false;
    loadHome({ data: { visitId, displayName: user.displayName, timeZone: readerZone() } })
      .then((home) => {
        if (!cancelled) {
          setData(home);
          onName?.(home.me.displayName);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("The shelves didn’t load. Try again in a moment.");
      });
    return () => {
      cancelled = true;
    };
  }, [visitId, user.id, user.displayName]);

  useEffect(() => {
    let live = true;
    const pull = () => {
      if (document.hidden) return;
      void loadNotices()
        .then((counts) => {
          if (live) setNotices(counts);
        })
        .catch(() => undefined);
    };
    pull();
    const timer = window.setInterval(pull, 4000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [user.id]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function refresh() {
    const home = await loadHome({ data: { visitId, displayName: user.displayName, timeZone: readerZone() } });
    setData(home);
    onName?.(home.me.displayName);
    setError(null);
  }

  const shelfBooks = data?.visit?.books ?? data?.books ?? [];
  const shelfReviews = data?.visit?.reviews ?? data?.reviews ?? [];
  const outfitId = data?.visit?.outfit ?? data?.me.outfit ?? "outfit-oatmeal";
  const shelfId = data?.visit?.shelf ?? data?.me.shelf ?? "shelf-honey";
  const lampId = data?.visit?.lamp ?? data?.me.lamp ?? "";
  const floorId = data?.visit?.floor ?? data?.me.floor ?? "";
  const wallId = data?.visit?.wall ?? data?.me.wall ?? "";
  const chairId = data?.visit?.chair ?? data?.me.chair ?? "";
  const clockId = data?.visit?.clock ?? data?.me.clock ?? "";
  const rugId = data?.visit?.rug ?? data?.me.rug ?? "";
  const souvenirId = data?.visit?.souvenir ?? data?.me.souvenir ?? "";
  const shelfName = data?.visit?.displayName ?? data?.me.displayName ?? "Your";
  const openBook = shelfBooks.find((book) => book.id === openId) ?? null;

  return (
    <div>
      {data && !data.me.nameSet && (
        <NameAccount
          suggested={data.me.displayName}
          onSaved={async (message) => {
            await refresh();
            setToast(message);
          }}
          onError={setToast}
        />
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button type="button" className={cn("btn", tab === "library" ? "btn-primary" : "btn-surface")} onClick={() => setTab("library")}>
            Library
          </button>
          <button type="button" className={cn("btn", tab === "hub" ? "btn-primary" : "btn-surface")} onClick={() => setTab("hub")}>
            Hub
            {noticeCount > 0 && <span className="pixel-badge">{noticeCount}</span>}
          </button>
          <button type="button" className={cn("btn", tab === "shop" ? "btn-primary" : "btn-surface")} onClick={() => setTab("shop")}>
            Shop
          </button>
        </div>
        <p className="rounded-card border border-line bg-surface px-3 py-2 text-sm font-bold tabular-nums">
          {data ? (
            data.pointsPaused ? (
              <span>Points paused</span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <span>
                  {data.me.points} points
                  <span className="mt-0.5 block font-normal text-muted">{data.pointsLeftToday} left today</span>
                </span>
                <Flame count={data.streaks.login} label="Login streak" />
                <Flame count={data.streaks.shelf} label="Shelf streak" />
                {data.streaks.freezeReady && <span className="font-normal text-muted">Freeze</span>}
              </span>
            )
          ) : (
            "– points"
          )}
        </p>
      </div>

      {error && (
        <p className="mb-3 rounded-card border border-line bg-surface p-4 text-sm">
          {error}{" "}
          <button type="button" className="font-bold text-accent" onClick={() => void refresh().catch(() => setError("Still couldn’t load."))}>
            Retry
          </button>
        </p>
      )}

      {tab === "shop" && data ? (
        <Shop data={data} onDone={async (message) => { await refresh(); setToast(message); }} onToast={setToast} />
      ) : tab === "hub" && data ? (
        <Hub
          books={data.books}
          meName={data.me.displayName}
          shelves={data.similar}
          notices={notices}
          onCounts={setNotices}
          isAdmin={data.isAdmin}
          reportedReviewIds={data.reportedReviewIds}
          onVisit={(userId) => { setVisitId(userId); setOpenId(null); setProfileOpen(false); setTab("library"); }}
          onProfile={(userId, name) => { setPerson({ userId, name, from: tab }); setProfileOpen(true); }}
        />
      ) : (
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.72fr)]">
          <div className="min-w-0">
            {data?.visit && (
              <div className="visit-bar mb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" className="person-hit font-display text-2xl" onClick={() => {
                    const host = data.visit;
                    if (!host) return;
                    setPerson((current) => current?.userId === host.userId ? current : { userId: host.userId, name: host.displayName, from: "library" });
                    setProfileOpen(true);
                  }}>
                    {data.visit.displayName}’s room
                  </button>
                  <button type="button" className="btn btn-surface" onClick={() => {
                    setVisitId(null);
                    setOpenId(null);
                    if (person) {
                      setTab(person.from);
                      setProfileOpen(true);
                    }
                  }}>
                    Back
                  </button>
                </div>
                <SafetyActions
                  userId={data.visit.userId}
                  name={data.visit.displayName}
                  place="profile"
                  onBlocked={() => {
                    const who = data.visit?.displayName ?? "them";
                    setVisitId(null);
                    setOpenId(null);
                    setToast(`Blocked ${who}. Notes stop both ways.`);
                  }}
                />
              </div>
            )}
            {data?.pointsPaused && (
              <p className="mb-3 rounded-card border border-line bg-surface p-4 text-sm">
                Points are paused. Three of your reviews were removed, so new pages don’t earn points.
                Nothing was sold, and nobody else received them.
              </p>
            )}
            <FormatFilter value={shelfFormat} onChange={setShelfFormat} />
            <LibraryScene
              books={
                data
                  ? shelfBooks
                      .filter((book) => shelfFormat === "all" || book.format === shelfFormat)
                      .map((book) => ({
                      id: book.id,
                      title: book.title,
                      status: book.status,
                      coverUrl: book.coverUrl,
                      finishedAt: book.finishedAt,
                      format: book.format,
                      tips: shelfReviews
                        .filter((review) => review.bookId === book.id)
                        .reduce((sum, review) => sum + Math.round(review.tips / POINTS.tip), 0),
                    }))
                  : DEMO_BOOKS.filter((book) => shelfFormat === "all" || book.format === shelfFormat)
              }
              outfitId={outfitId}
              shelfId={shelfId}
              lampId={lampId}
              floorId={floorId}
              wallId={wallId}
              chairId={chairId}
              clockId={clockId}
              rugId={rugId}
              souvenirId={souvenirId}
              label={`${shelfName}'s library`}
              mine={!data?.visit}
              onBook={(id) => setOpenId(id)}
              onAdd={() => setAdding(true)}
            />
            {data && (
              <SimilarReviews
                reviews={data.similar}
                activeId={data.visit?.userId ?? null}
                reported={new Set(data.reportedReviewIds)}
                onOpen={(userId, bookId) => { setVisitId(userId); setOpenId(bookId); setProfileOpen(false); setTab("library"); }}
                onProfile={(userId, name) => { setPerson({ userId, name, from: tab }); setProfileOpen(true); }}
              />
            )}
          </div>
          {data && (
            <SidePanel
              data={data}
              onAdd={() => setAdding(true)}
              onOpen={(id) => setOpenId(id)}
              onToast={setToast}
              onRefresh={refresh}
            />
          )}
        </div>
      )}

      <nav className="dock" aria-label="Sections">
        <button type="button" className={cn("btn", tab === "library" ? "btn-primary" : "btn-surface")} onClick={() => setTab("library")}>
          Library
        </button>
        <button type="button" className={cn("btn", tab === "hub" ? "btn-primary" : "btn-surface")} onClick={() => setTab("hub")}>
          Hub
          {noticeCount > 0 && <span className="pixel-badge">{noticeCount}</span>}
        </button>
        <button type="button" className={cn("btn", tab === "shop" ? "btn-primary" : "btn-surface")} onClick={() => setTab("shop")}>
          Shop
        </button>
      </nav>

      {openBook && data && (
        <BookDialog
          book={openBook}
          books={data.visit ? data.visit.books : data.books}
          reviews={shelfReviews.filter((review) => review.bookId === openBook.id)}
          mine={!data.visit}
          points={data.me.points}
          awarded={new Set(data.awardedReviewIds)}
          reported={new Set(data.reportedReviewIds)}
          onClose={() => setOpenId(null)}
          onChanged={async (message) => {
            await refresh();
            if (message) setToast(message);
          }}
        />
      )}
      {profileOpen && person && (
        <div className="dialog-back" onClick={() => setProfileOpen(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-label={person.name} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl">{person.name}</h2>
              <button type="button" className="btn btn-surface" onClick={() => { setProfileOpen(false); setPerson(null); }}>
                Back
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">A reader’s shelf. You can look and tip. You can’t move their books.</p>
            <StreakBadges userId={person.userId} />
            <button
              type="button"
              className="btn btn-primary mt-4"
              onClick={() => {
                setVisitId(person.userId);
                setOpenId(null);
                setProfileOpen(false);
                setTab("library");
              }}
            >
              Visit shelf
            </button>
          </div>
        </div>
      )}
      {adding && (
        <AddDialog
          onClose={() => setAdding(false)}
          onAdded={async (message) => {
            setAdding(false);
            await refresh();
            setToast(message);
          }}
        />
      )}
      {toast && <p className="toast">{toast}</p>}
    </div>
  );
}

function SimilarReviews({
  reviews,
  activeId,
  reported,
  onOpen,
  onProfile,
}: {
  reviews: HomeData["similar"];
  activeId: string | null;
  reported: Set<string>;
  onOpen: (userId: string, bookId: string) => void;
  onProfile: (userId: string, name: string) => void;
}) {
  const shared = reviews.some((review) => review.similar);
  return (
    <section className="mt-4 min-w-0">
      <h2 className="font-display text-2xl">Similar reviews</h2>
      <p className="mt-1 text-sm text-muted">
        {shared
          ? "Readers who wrote about a book you have. Highest tips first."
          : "No shared books yet. These are the notes other readers tipped the most."}
      </p>
      {reviews.length === 0 ? (
        <p className="mt-3 rounded-card border border-line bg-surface p-4 text-sm text-muted">No notes from other readers yet.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {reviews.map((review) => (
            <li key={review.reviewId} className={cn("rounded-card border bg-surface p-3", activeId === review.userId ? "border-accent" : "border-line")}>
              <div className="flex w-full gap-3 text-left">
                <span className={cn("block h-16 w-11 shrink-0 overflow-hidden rounded-sm border-2 bg-line", review.tips >= POINTS.tip * 3 ? "border-gold" : "border-transparent")}>
                  {review.coverUrl ? (
                    <img src={review.coverUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full place-items-center font-display text-lg">{review.title.slice(0, 1)}</span>
                  )}
                </span>
                <span className="min-w-0">
                  <button type="button" className="person-hit text-xs font-bold tracking-wide text-accent uppercase" onClick={() => onProfile(review.userId, review.displayName)}>
                    {review.displayName}
                  </button>
                  <button type="button" className="block w-full text-left" onClick={() => onOpen(review.userId, review.bookId)}>
                    <span className="mt-0.5 block truncate font-bold">{review.title}</span>
                    <span className="mt-1 line-clamp-2 block text-sm">“{review.body}”</span>
                    <span className="mt-1 block text-xs font-bold text-gold-deep tabular-nums">
                      {review.tips > 0 ? `Tip total ${review.tips}` : "No tips yet"}
                    </span>
                  </button>
                </span>
              </div>
              <div className="mt-2 flex justify-end">
                <ReportReview reviewId={review.reviewId} reported={reported.has(review.reviewId)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function publishName(next: string): Promise<string | null> {
  const name = next.replace(/\s+/g, " ").trim();
  if (name.length < 2) return "Use at least 2 letters.";
  const saved = await setDisplayName({ data: name });
  if (!saved.ok) return saved.error;
  await authClient.updateUser({ name }).catch(() => undefined);
  return null;
}

function NameAccount({
  suggested,
  onSaved,
  onError,
}: {
  suggested: string;
  onSaved: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(suggested);
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(suggested), [suggested]);

  return (
    <form
      className="catalog-card mb-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void publishName(name)
          .then(async (error) => {
            if (error) {
              onError(error);
              setBusy(false);
              return;
            }
            await onSaved("That’s the name on your shelf.");
            setBusy(false);
          })
          .catch(() => {
            onError("Couldn’t save that name.");
            setBusy(false);
          });
      }}
    >
      <h2 className="font-display text-2xl">Name your account</h2>
      <p className="mt-2 text-sm text-muted">
        Google, X, or email only gets you in. The name other readers see is the one you choose.
      </p>
      <label className="mt-3 grid gap-1 text-sm text-muted">
        Your name
        <input
          value={name}
          maxLength={24}
          required
          autoComplete="nickname"
          aria-label="Your name"
          className="field font-display text-xl text-fg"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button type="submit" className="btn btn-primary mt-3" disabled={busy}>
        {busy ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

function SidePanel({
  data,
  onAdd,
  onOpen,
  onToast,
  onRefresh,
}: {
  data: HomeData;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onToast: (message: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const visiting = data.visit;
  const [name, setName] = useState(data.me.displayName);
  useEffect(() => setName(data.me.displayName), [data.me.displayName]);

  if (visiting) {
    return (
      <aside className="grid gap-3">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="font-display text-2xl">{visiting.displayName}’s notes</h2>
          <p className="mt-2 text-sm text-muted">
            Award a note that sounds true. It pays them {POINTS.tip} points, and it does not cost you any. Three tips a day.
          </p>
        </section>
        <ReviewList
          reviews={visiting.reviews}
          books={visiting.books}
          mine={false}
          points={data.me.points}
          awarded={new Set(data.awardedReviewIds)}
          reported={new Set(data.reportedReviewIds)}
          onOpen={onOpen}
          onAwarded={async (who) => {
            await onRefresh();
            onToast(`Tipped ${who}.`);
          }}
          onToast={onToast}
        />
      </aside>
    );
  }

  const logged = data.books.reduce((sum, book) => sum + book.pagesRead, 0);
  const finished = data.books.filter((book) => book.status === "finished").length;
  const reading = data.books.find((book) => book.status === "reading");
  return (
    <aside className="grid min-w-0 gap-3">
      <section className="catalog-card p-5">
        <label className="grid gap-1 text-sm text-muted">
          Your name on the shelf
          <input
            value={name}
            maxLength={24}
            autoComplete="off"
            suppressHydrationWarning
            aria-label="Your name"
            className="field font-display text-xl text-fg"
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              const next = name.trim();
              if (!next || next === data.me.displayName) return;
              void publishName(next).then(async (error) => {
                if (error) {
                  onToast(error);
                  setName(data.me.displayName);
                  return;
                }
                await onRefresh();
              });
            }}
          />
        </label>
        <p className="mt-3 text-sm text-muted">
          This is the name on your shelf, whichever way you signed in. {logged} pages logged · {finished === 1 ? "1 book finished" : `${finished} finished`}
        </p>
      </section>
      {reading ? (
        <LogCard
          book={reading}
          books={data.books}
          pointsLeft={data.pointsLeftToday}
          pointsPaused={data.pointsPaused}
          onDone={async (message) => {
            await onRefresh();
            onToast(message);
          }}
        />
      ) : data.books.length > 0 ? (
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="font-display text-2xl">Nothing open on the desk.</h2>
          <p className="mt-2 text-sm text-muted">The shelf is holding what you finished. Add the next book when you sit down again.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={onAdd}>
            <Plus className="size-4" aria-hidden="true" />
            Add a book
          </button>
        </section>
      ) : (
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="font-display text-2xl">The shelf is quiet.</h2>
          <p className="mt-2 text-sm text-muted">Add a book, then log the pages you got through and one sentence about them.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={onAdd}>
            <Plus className="size-4" aria-hidden="true" />
            Add a book
          </button>
        </section>
      )}
      {data.reviews.length > 0 && (
        <ReviewList
          reviews={data.reviews.slice(0, 3)}
          books={data.books}
          mine
          points={data.me.points}
          awarded={new Set()}
          reported={new Set()}
          onOpen={onOpen}
          onAwarded={async () => {}}
          onToast={onToast}
        />
      )}
    </aside>
  );
}

function ReviewList({
  reviews,
  books,
  mine,
  points,
  awarded,
  reported,
  onOpen,
  onAwarded,
  onToast,
}: {
  reviews: ReviewRow[];
  books: BookRow[];
  mine: boolean;
  points: number;
  awarded: Set<string>;
  reported: Set<string>;
  onOpen: (id: string) => void;
  onAwarded: (name: string) => Promise<void>;
  onToast: (message: string) => void;
}) {
  if (reviews.length === 0) {
    return <p className="rounded-card border border-line bg-surface p-5 text-sm text-muted">No notes on this shelf yet.</p>;
  }
  return (
    <ul className="grid gap-3">
      {reviews.map((review) => {
        const book = books.find((item) => item.id === review.bookId);
        const done = awarded.has(review.id);
        return (
          <li key={review.id} className="rounded-card border border-line bg-surface p-4">
            <button type="button" className="text-left" onClick={() => onOpen(review.bookId)}>
              <p className="text-xs font-bold tracking-wide text-accent uppercase">{book?.title ?? "A book"}</p>
              <p className="mt-1">“{review.body}”</p>
            </button>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted tabular-nums">
              <span>{review.pages} pages</span>
              {review.tips > 0 && (
                <span className="inline-flex items-center gap-1 font-bold text-gold-deep">
                  <span className="gold-book" aria-hidden="true" />
                  Tip total {review.tips}
                </span>
              )}
            </p>
            {mine && review.hidden && (
              <p className="mt-2 text-sm">This note is hidden while a librarian looks. Your points stay.</p>
            )}
            {!mine && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={done}
                  onClick={() => {
                    void awardReview({ data: { reviewId: review.id, timeZone: readerZone() } }).then(async (result) => {
                      if (!result.ok) {
                        onToast(result.error);
                        return;
                      }
                      await onAwarded(result.name ?? "them");
                    });
                  }}
                >
                  {done ? "Tipped" : `Tip · +${POINTS.tip}`}
                </button>
                <ReportReview reviewId={review.id} reported={reported.has(review.id)} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function LogCard({
  book,
  books,
  pointsLeft,
  pointsPaused,
  onDone,
}: {
  book: BookRow;
  books: BookRow[];
  pointsLeft: number;
  pointsPaused: boolean;
  onDone: (message: string) => Promise<void>;
}) {
  const [pages, setPages] = useState(20);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remaining = Math.max(0, book.pageCount - book.pagesRead);
  const count = Math.min(Math.max(1, pages || 1), Math.max(1, Math.min(MAX_PAGES_PER_LOG, remaining)));
  const finishes = count >= remaining && remaining > 0;
  const plan = plannedFinish(book, books);
  const preview = pointsPaused ? 0 : Math.min(plan.points, pointsLeft);

  return (
    <form
      className="rounded-card border border-line bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void logReading({ data: { bookId: book.id, pages: count, note, timeZone: readerZone() } })
          .then(async (result) => {
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setNote("");
            setError(null);
            const left = typeof result.left === "number" ? ` ${result.left} left today.` : "";
            const welcome = result.welcome ? " Welcome bonus." : "";
            const series = result.series ? ` Series bonus +${result.series}.` : "";
            await onDone(
              result.paused
                ? `Saved ${result.pages} pages. Points are paused because three of your reviews were removed.`
                : result.finished
                  ? `Finished ${result.title}. +${result.points} points.${welcome}${series}${left}`
                  : `Saved ${result.pages} pages. Points land when you finish the title.${left}`,
            );
          })
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-xs font-bold tracking-wide text-accent uppercase">Reading</p>
      <h2 className="font-display text-2xl leading-tight">{book.title}</h2>
      <p className="text-sm text-muted">{book.author}</p>
      <p className="mt-1 text-sm">
        {BOOK_FORMATS.find((item) => item.id === book.format)?.label ?? "Novel"} earns {formatPoints(book.format)} when you finish.
        {plan.welcome > 0 ? ` Welcome bonus brings the first finish to ${plan.points - plan.series}.` : ""}
        {plan.series > 0 ? ` Series bonus +${plan.series}.` : ""}
      </p>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted tabular-nums">
          <span>{book.pagesRead} of {book.pageCount}</span>
          <span>{Math.round((book.pagesRead / book.pageCount) * 100)}%</span>
        </div>
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (book.pagesRead / book.pageCount) * 100)}%` }} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm">Pages this sitting</span>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-surface size-11 px-0" aria-label="Fewer pages" onClick={() => setPages((value) => Math.max(1, value - 5))}>
            <Minus className="size-4" />
          </button>
          <input
            inputMode="numeric"
            aria-label="Pages read"
            value={pages}
            onChange={(event) => setPages(Number(event.target.value.replace(/[^\d]/g, "")) || 0)}
            className="field w-16 px-0 text-center tabular-nums"
          />
          <button type="button" className="btn btn-surface size-11 px-0" aria-label="More pages" onClick={() => setPages((value) => value + 5)}>
            <Plus className="size-4" />
          </button>
        </div>
      </div>
      <label className="mt-3 grid gap-2 text-sm">
        What happened?
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={280}
          placeholder="One sentence only you would write."
          className="field resize-none"
        />
        <span className="text-right text-xs text-muted tabular-nums">{note.trim().length}/{MIN_NOTE}</span>
      </label>
      {pointsPaused ? (
        <p className="mt-2 text-sm">Points are paused. Three of your reviews were removed, so this sitting won’t earn any.</p>
      ) : (
        <p className="mt-2 text-sm tabular-nums">{pointsLeft} points left today. Points aren’t for sale.</p>
      )}
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
      <button type="submit" className="btn btn-primary mt-3 w-full" disabled={busy || remaining === 0 || (finishes && !pointsPaused && pointsLeft <= 0)}>
        {pointsPaused ? "Save pages · no points" : finishes && pointsLeft <= 0 ? "No points left today" : finishes ? `Finish the book · +${preview}` : "Save pages"}
      </button>
    </form>
  );
}

function BookDialog({
  book,
  books,
  reviews,
  mine,
  points,
  awarded,
  reported,
  onClose,
  onChanged,
}: {
  book: BookRow;
  books: BookRow[];
  reviews: ReviewRow[];
  mine: boolean;
  points: number;
  awarded: Set<string>;
  reported: Set<string>;
  onClose: () => void;
  onChanged: (message?: string) => Promise<void>;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pages, setPages] = useState(String(book.pageCount));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="dialog-back" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={book.title} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <Cover url={book.coverUrl} title={book.title} format={book.format} />
            <div>
              <p className="text-xs font-bold tracking-wide text-accent uppercase">{book.status === "finished" ? "Finished" : "Reading"}</p>
              <h2 className="font-display text-2xl leading-tight">{book.title}</h2>
              <p className="text-sm text-muted">{book.author}</p>
              <p className="mt-1 text-sm tabular-nums text-muted">{book.pagesRead} / {book.pageCount} pages</p>
              {mine && book.status === "reading" && (
                <FinishPreview book={book} books={books} />
              )}
            </div>
          </div>
          <button type="button" className="btn btn-surface size-11 shrink-0 px-0" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <div className="meter mt-4" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (book.pagesRead / book.pageCount) * 100)}%` }} />
        </div>
        {mine && book.status === "reading" && (
          <form
            className="mt-4 flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void setPageCount({ data: { bookId: book.id, pages: Number(pages) } }).then(async (result) => {
                if (!result.ok) {
                  await onChanged(result.error);
                  return;
                }
                await onChanged("Page count updated.");
              });
            }}
          >
            <label className="grid flex-1 gap-1 text-sm text-muted">
              Total pages
              <input value={pages} inputMode="numeric" className="field" onChange={(event) => setPages(event.target.value.replace(/[^\d]/g, ""))} />
            </label>
            <button type="submit" className="btn btn-surface">Save</button>
          </form>
        )}
        <div className="mt-4">
          <ReviewList
            reviews={reviews}
            books={[book]}
            mine={mine}
            points={points}
            awarded={awarded}
            reported={reported}
            onOpen={() => {}}
            onAwarded={async (who) => onChanged(`Tipped ${who}. They get ${POINTS.tip} points.`)}
            onToast={(message) => void onChanged(message)}
          />
        </div>
        {mine && (
          <div className="mt-4">
            {confirmRemove ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    void removeBook({ data: book.id }).then(async () => {
                      onClose();
                      await onChanged("Taken off the shelf. Points you already earned stay.");
                    });
                  }}
                >
                  Remove it
                </button>
                <button type="button" className="btn btn-surface" onClick={() => setConfirmRemove(false)}>
                  Keep it
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost px-0" onClick={() => setConfirmRemove(true)}>
                Take it off the shelf
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Flame({ count, label }: { count: number; label: string }) {
  return (
    <span className="flame" title={label}>
      <svg viewBox="0 0 8 10" width="12" height="16" aria-hidden="true">
        <rect x="3" y="0" width="2" height="2" fill="#f2c14e" />
        <rect x="2" y="2" width="4" height="2" fill="#e07a2f" />
        <rect x="1" y="4" width="6" height="4" fill="#c44820" />
        <rect x="2" y="8" width="4" height="2" fill="#8c3d32" />
      </svg>
      <span className="tabular-nums">{count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function StreakBadges({ userId }: { userId: string }) {
  const [info, setInfo] = useState<StreakInfo | null>(null);
  useEffect(() => {
    let live = true;
    void loadStreak({ data: { userId, timeZone: readerZone() } }).then((next) => {
      if (live) setInfo(next);
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [userId]);
  const marks = [3, 7, 30, 100];
  return (
    <div className="mt-3 grid gap-2">
      <p className="text-sm">Login {info?.login ?? "–"} · Shelf {info?.shelf ?? "–"}</p>
      <div className="flex flex-wrap gap-2">
        {marks.map((mark) => (
          <span key={`login-${mark}`} className={cn("streak-badge", info?.loginBadges.includes(mark) && "is-on")}>
            Login {mark}
          </span>
        ))}
        {marks.map((mark) => (
          <span key={`shelf-${mark}`} className={cn("streak-badge", info?.shelfBadges.includes(mark) && "is-on")}>
            Shelf {mark}
          </span>
        ))}
      </div>
    </div>
  );
}

function FinishPreview({ book, books }: { book: BookRow; books: BookRow[] }) {
  const plan = plannedFinish(book, books);
  return (
    <p className="mt-1 text-sm">
      Finishes at {plan.points} points.
      {plan.welcome > 0 ? " Welcome bonus." : ""}
      {plan.series > 0 ? ` Series bonus +${plan.series}.` : ""}
    </p>
  );
}

function Cover({ url, title, format = "novel" }: { url: string | null; title: string; format?: BookFormat }) {
  const [failed, setFailed] = useState(false);
  const tag = <span className="format-tag">{formatTag(format)}</span>;
  if (!url || failed) {
    return (
      <div className={cn("cover-wrap grid h-28 w-16 shrink-0 place-items-center rounded font-display text-2xl text-accent-ink", `spine-${spineIndex(title)}`)}>
        {title.slice(0, 1)}
        {tag}
      </div>
    );
  }
  return (
    <span className="cover-wrap">
      <img src={url} alt="" className="h-28 w-16 shrink-0 rounded object-cover" onError={() => setFailed(true)} />
      {tag}
    </span>
  );
}

function AddDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (message: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<BookHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [scan, setScan] = useState(false);
  const [pending, setPending] = useState<BookHit | null>(null);
  const [pages, setPages] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<BookFormat>("novel");
  const [seriesName, setSeriesName] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function choose(hit: BookHit, pageCount = hit.pages) {
    if (!pageCount) {
      setPending(hit);
      setPages("");
      setScan(false);
      return;
    }
    const result = await addBook({
      data: { title: hit.title, author: hit.author, isbn: hit.isbn, pages: pageCount, coverUrl: hit.coverUrl, format, seriesName, timeZone: readerZone() },
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await onAdded(result.duplicate ? `${hit.title} is already on your shelf.` : `${hit.title} is on the shelf.`);
  }

  async function runSearch(text: string) {
    const q = text.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      setHits(await searchBooks(q));
    } catch {
      setError("The catalog didn’t answer. Try a classic below, or type the page count yourself.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="dialog-back" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Add a book" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl">Add a book</h2>
          <button type="button" className="btn btn-surface size-11 px-0" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          A title earns its format points once, when you finish it. Your first finish includes a welcome bonus.
        </p>
        <label className="mt-3 grid gap-1 text-sm">
          Format
          <select className="field" value={format} onChange={(event) => setFormat(isBookFormat(event.target.value) ? event.target.value : "novel")}>
            {BOOK_FORMATS.map((item) => (
              <option key={item.id} value={item.id}>{item.label} · {formatPoints(item.id)}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 grid gap-1 text-sm">
          Series name
          <input value={seriesName} className="field" placeholder="Optional. Finishing every volume pays 25%." onChange={(event) => setSeriesName(event.target.value)} />
        </label>
        {pending ? (
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void choose(pending, Number(pages));
            }}
          >
            <p className="font-bold">{pending.title}</p>
            <label className="grid gap-1 text-sm">
              How many pages?
              <input value={pages} inputMode="numeric" className="field" onChange={(event) => setPages(event.target.value.replace(/[^\d]/g, ""))} />
            </label>
            {error && <p className="text-sm text-accent">{error}</p>}
            <button type="submit" className="btn btn-primary">Put it on the shelf</button>
          </form>
        ) : scan ? (
          <div className="mt-4">
            <Scanner
              onIsbn={(isbn) => {
                setScan(false);
                setSearching(true);
                setError(null);
                void searchBooks(isbn)
                  .then((found) => {
                    const hit = found.find((item) => item.isbn === isbn) ?? found[0];
                    if (!hit) {
                      setError("No book matched that barcode.");
                      return;
                    }
                    return choose(hit);
                  })
                  .catch(() => setError("The catalog didn’t answer."))
                  .finally(() => setSearching(false));
              }}
            />
            <button type="button" className="btn btn-surface mt-3" onClick={() => setScan(false)}>Type it instead</button>
          </div>
        ) : (
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch(query);
            }}
          >
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title or ISBN"
                aria-label="Title or ISBN"
                className="field"
              />
              <button type="submit" className="btn btn-primary" disabled={searching}>
                {searching ? "…" : "Search"}
              </button>
            </div>
            <button type="button" className="btn btn-surface" onClick={() => setScan(true)}>
              <ScanLine className="size-4" aria-hidden="true" />
              Scan a barcode
            </button>
            {error && <p className="text-sm text-accent">{error}</p>}
            <ul className="grid gap-2">
              {(hits.length > 0 ? hits : []).map((hit) => (
                <li key={`${hit.isbn}-${hit.title}`}>
                  <button type="button" className="flex w-full items-center gap-3 rounded-card border border-line p-2 text-left" onClick={() => void choose(hit)}>
                    <Cover url={hit.coverUrl} title={hit.title} />
                    <span>
                      <span className="block font-bold">{hit.title}</span>
                      <span className="text-sm text-muted">{hit.author}{hit.pages ? ` · ${hit.pages} pages` : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div>
              <p className="text-sm text-muted">Or start with a classic</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_PICKS.map((pick) => (
                  <button key={pick.isbn} type="button" className="btn btn-surface" onClick={() => void choose(hitFromQuick(pick))}>
                    {pick.title}
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Shop({
  data,
  onDone,
  onToast,
}: {
  data: HomeData;
  onDone: (message: string) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [slot, setSlot] = useState<Slot>("shelf");
  const items = ITEMS.filter((item) => item.slot === slot);
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-3xl">Souvenir counter</h2>
        <p className="text-sm text-muted">Points only. Nothing here costs cash. What you buy shows up in the room.</p>
      </div>
      <div className="mb-4">
        <h3 className="font-display text-2xl">Starter</h3>
        <ul className="mt-2 flex gap-3 overflow-x-auto pb-1">
          {ITEMS.filter((item) => item.tier === 0).map((item) => {
            const owned = data.me.owned.includes(item.id) || item.price === 0;
            const worn = data.me[item.slot] === item.id;
            return (
              <li key={item.id} className="catalog-card w-44 shrink-0 p-3">
                <ItemPreview itemId={item.id} />
                <h3 className="mt-2 font-display text-lg leading-tight">{item.name}</h3>
                <button
                  type="button"
                  className="btn btn-primary mt-2 w-full"
                  disabled={worn}
                  onClick={() => {
                    const action = owned ? equipItem({ data: item.id }) : buyItem({ data: item.id });
                    void action.then(async (result) => {
                      if (!result.ok) {
                        onToast(result.error);
                        return;
                      }
                      await onDone(owned ? `${item.name} is in the room.` : `Bought ${item.name}.`);
                    });
                  }}
                >
                  {worn ? "In the room" : owned ? "Put it in" : `${item.price.toLocaleString("en-US")} points`}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {SHOP_SLOTS.map((entry) => (
          <button key={entry.id} type="button" className={cn("btn", slot === entry.id ? "btn-primary" : "btn-surface")} onClick={() => setSlot(entry.id)}>
            {entry.label}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const owned = data.me.owned.includes(item.id) || item.price === 0;
          const worn = data.me[item.slot] === item.id;
          return (
            <li key={item.id} className="catalog-card p-4">
              <ItemPreview itemId={item.id} />
              <h3 className="mt-3 font-display text-xl">{item.name}</h3>
              {item.tier ? <p className="text-xs font-bold text-accent">Tier {item.tier}</p> : null}
              <p className="text-sm text-muted">{item.blurb}</p>
              <button
                type="button"
                className="btn btn-primary mt-3"
                disabled={worn}
                onClick={() => {
                  const action = owned ? equipItem({ data: item.id }) : buyItem({ data: item.id });
                  void action.then(async (result) => {
                    if (!result.ok) {
                      onToast(result.error);
                      return;
                    }
                    await onDone(owned ? `${item.name} is in the room.` : `Bought ${item.name}.`);
                  });
                }}
              >
                {worn ? "In the room" : owned ? "Put it in" : `${item.price.toLocaleString("en-US")} points`}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
