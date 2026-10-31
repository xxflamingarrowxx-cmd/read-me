import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth/client";
import { searchReaders, type ReaderHit } from "@/lib/readme/api";
import {
  answerFriendRequest,
  blockReader,
  deleteAccount,
  deleteNote,
  loadFriends,
  loadThread,
  markThreadRead,
  reportReader,
  sendFriendRequest,
  sendNote,
  setRequestPolicy,
  type FriendCard,
  type FriendsDeskData,
  type LoungeNote,
  type ReaderCard,
} from "@/lib/readme/social";
import { cn } from "@/lib/cn";

function portrait(outfit: string, image: string | null) {
  if (image) return image;
  if (outfit === "outfit-berry" || outfit === "outfit-female") return "/assets/readme/avatar-female.png";
  return "/assets/readme/avatar-male.png";
}

export function ReaderPortrait({
  name,
  outfit,
  image,
  onClick,
}: {
  name: string;
  outfit: string;
  image?: string | null;
  onClick?: () => void;
}) {
  const face = <img src={portrait(outfit, image ?? null)} alt="" className="reader-portrait" />;
  if (!onClick) return face;
  return (
    <button type="button" className="person-hit" aria-label={name} onClick={onClick}>
      {face}
    </button>
  );
}

export function SafetyActions({
  userId,
  name,
  place,
  onBlocked,
}: {
  userId: string;
  name: string;
  place: "profile" | "chat";
  onBlocked?: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-surface" onClick={() => { setBlocking((open) => !open); setReporting(false); setError(null); }}>
          Block
        </button>
        <button type="button" className="btn btn-surface" onClick={() => { setReporting((open) => !open); setBlocking(false); setError(null); }}>
          Report
        </button>
      </div>
      {blocking && (
        <div className="rounded-card border border-line bg-bg p-3">
          <p className="text-sm">
            Blocking {name} ends the friendship and stops notes in both directions.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-2"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void blockReader({ data: userId })
                .then((result) => {
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setBlocking(false);
                  setNote(result.note ?? "Blocked.");
                  onBlocked?.();
                })
                .catch(() => setError("That didn’t go through."))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Blocking…" : `Block ${name}`}
          </button>
        </div>
      )}
      {reporting && (
        <form
          className="grid gap-2 rounded-card border border-line bg-bg p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError(null);
            void reportReader({ data: { userId, reason, place } })
              .then((result) => {
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setReason("");
                setReporting(false);
                setNote(result.note ?? "Sent to the librarian.");
              })
              .catch(() => setError("That didn’t go through."))
              .finally(() => setBusy(false));
          }}
        >
          <label className="grid gap-1 text-sm">
            Why are you reporting {name}?
            <textarea
              value={reason}
              rows={3}
              maxLength={280}
              required
              aria-label="Report reason"
              placeholder="What happened, in plain words."
              className="field resize-none"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary w-fit" disabled={busy}>
            {busy ? "Sending…" : "Send to the librarian"}
          </button>
        </form>
      )}
      {note && <p className="text-sm">{note}</p>}
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function FriendsDesk({
  onVisit,
  onProfile,
  onCounts,
}: {
  onVisit: (userId: string) => void;
  onProfile: (userId: string, name: string) => void;
  onCounts?: (counts: { requests: number; unread: number }) => void;
}) {
  const [desk, setDesk] = useState<FriendsDeskData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReaderHit[] | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);

  async function refresh() {
    const next = await loadFriends();
    setDesk(next);
    setError(null);
    const unread = next.friends.reduce((sum, friend) => sum + friend.unread, 0);
    onCounts?.({ requests: next.incoming.length, unread });
  }

  useEffect(() => {
    let live = true;
    loadFriends()
      .then((next) => {
        if (!live) return;
        setDesk(next);
        const unread = next.friends.reduce((sum, friend) => sum + friend.unread, 0);
        onCounts?.({ requests: next.incoming.length, unread });
      })
      .catch(() => {
        if (live) setError("The friends list didn’t open.");
      });
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void refresh().catch(() => undefined);
    }, 3000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearchNote(null);
      return;
    }
    let live = true;
    const handle = window.setTimeout(() => {
      void searchReaders({ data: q })
        .then((found) => {
          if (!live) return;
          setResults(found.results);
          setSearchNote(found.note ?? null);
        })
        .catch(() => {
          if (live) setSearchNote("The catalog didn’t open.");
        });
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  const chatFriend = desk?.friends.find((friend) => friend.userId === chatId) ?? null;

  return (
    <div className="grid gap-4">
      <div className="catalog-card p-4">
        <h2 className="font-display text-3xl">Friends</h2>
        <p className="mt-1 text-sm text-muted">Ask by name. Both of you have to accept before you’re friends.</p>
        <div className="catalog-search mt-3">
          <label>
            <svg viewBox="0 0 18 18" aria-hidden="true">
              <circle cx="7" cy="7" r="5" fill="none" stroke="#6b442c" strokeWidth="2" />
              <path d="M11 11 L16 16" stroke="#6b442c" strokeWidth="2" />
            </svg>
            <input
              value={query}
              aria-label="Find a reader"
              placeholder="Search a username"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        {searchNote && <p className="mt-2 text-sm">{searchNote}</p>}
        {results && results.length === 0 && !searchNote && <p className="mt-2 text-sm text-muted">No readers found</p>}
        {results && results.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {results.map((reader) => (
              <AskRow
                key={reader.userId}
                reader={reader}
                desk={desk}
                onDone={async (message) => {
                  setToast(message);
                  await refresh();
                }}
                onProfile={onProfile}
              />
            ))}
          </ul>
        )}
        {desk && (
          <fieldset className="mt-4 grid gap-2">
            <legend className="text-sm font-bold">Who can send you a request?</legend>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                name="request-policy"
                checked={desk.policy === "anyone"}
                onChange={() => {
                  void setRequestPolicy({ data: "anyone" }).then(() => refresh());
                }}
              />
              Anyone
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                name="request-policy"
                checked={desk.policy === "friends-of-friends"}
                onChange={() => {
                  void setRequestPolicy({ data: "friends-of-friends" }).then(() => refresh());
                }}
              />
              Friends of friends
            </label>
          </fieldset>
        )}
      </div>

      {error && <p className="rounded-card border border-line bg-surface p-4 text-sm">{error}</p>}
      {toast && <p className="rounded-card border border-line bg-surface p-3 text-sm">{toast}</p>}

      {desk && desk.incoming.length > 0 && (
        <div className="catalog-card p-4">
          <h3 className="flex items-center gap-2 font-display text-2xl">
            Requests
            <span className="pixel-badge">{desk.incoming.length}</span>
          </h3>
          <ul className="mt-3 grid gap-2">
            {desk.incoming.map((reader) => (
              <li key={reader.userId} className="friend-row">
                <ReaderPortrait name={reader.displayName} outfit={reader.outfit} image={reader.image} onClick={() => onProfile(reader.userId, reader.displayName)} />
                <button type="button" className="person-hit font-bold" onClick={() => onProfile(reader.userId, reader.displayName)}>
                  {reader.displayName}
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      void answerFriendRequest({ data: { userId: reader.userId, accept: true } }).then(async (result) => {
                        setToast(result.ok ? (result.note ?? "You’re friends.") : result.error);
                        await refresh();
                      });
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn-surface"
                    onClick={() => {
                      void answerFriendRequest({ data: { userId: reader.userId, accept: false } }).then(async (result) => {
                        setToast(result.ok ? (result.note ?? "Declined.") : result.error);
                        await refresh();
                      });
                    }}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={cn("grid gap-4", chatFriend && "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)]")}>
        <div className={cn("catalog-card p-4", chatFriend && "max-lg:hidden")}>
          <h3 className="font-display text-2xl">Your friends</h3>
          {desk && desk.outgoing.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              Waiting on {desk.outgoing.map((reader) => reader.displayName).join(", ")}.
            </p>
          )}
          {desk && desk.friends.length === 0 && (
            <p className="mt-3 text-sm text-muted">No friends yet. Search a name and ask.</p>
          )}
          <ul className="mt-3 grid gap-2">
            {desk?.friends.map((friend) => (
              <li key={friend.userId} className="friend-row">
                <ReaderPortrait name={friend.displayName} outfit={friend.outfit} image={friend.image} onClick={() => onProfile(friend.userId, friend.displayName)} />
                <span className="min-w-0">
                  <button type="button" className="person-hit font-bold" onClick={() => onProfile(friend.userId, friend.displayName)}>
                    {friend.displayName}
                  </button>
                  {friend.unread > 0 && <span className="pixel-badge mt-1">{friend.unread} new</span>}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-surface" onClick={() => onVisit(friend.userId)}>
                    Visit their room
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setChatId(friend.userId)}>
                    Open the lounge
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {chatFriend && (
          <ReadingLounge
            friend={chatFriend}
            onBack={() => setChatId(null)}
            onVisit={() => onVisit(chatFriend.userId)}
            onProfile={() => onProfile(chatFriend.userId, chatFriend.displayName)}
            onBlocked={() => {
              setChatId(null);
              setToast("Blocked. Notes stop both ways.");
              void refresh();
            }}
            onChanged={() => void refresh()}
          />
        )}
      </div>

      {desk?.isAdmin && (
        <div className="catalog-card p-4">
          <h3 className="font-display text-2xl">Librarian’s list</h3>
          <p className="mt-1 text-sm text-muted">Reports from readers. Only the librarian sees this.</p>
          {desk.reports.length === 0 && <p className="mt-3 text-sm text-muted">No reports.</p>}
          <ul className="mt-3 grid gap-2">
            {desk.reports.map((report) => (
              <li key={report.id} className="rounded-card border border-line bg-bg p-3 text-sm">
                <p className="font-bold">
                  {report.reporter} reported {report.target}
                  <span className="font-normal text-muted"> · {report.place}</span>
                </p>
                <p className="mt-1">{report.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="catalog-card p-4">
        <h3 className="font-display text-2xl">Close this shelf</h3>
        <p className="mt-1 text-sm text-muted">
          Deletes your account, your books, and every note you sent or received. Points and items are erased, not given away.
        </p>
        {!erasing ? (
          <button type="button" className="btn btn-surface mt-3" onClick={() => setErasing(true)}>
            Delete my account
          </button>
        ) : (
          <EraseShelf
            onCancel={() => setErasing(false)}
            onDone={() => {
              void signOut()
                .catch(() => undefined)
                .finally(() => window.location.assign("/"));
            }}
          />
        )}
      </div>
    </div>
  );
}

function AskRow({
  reader,
  desk,
  onDone,
  onProfile,
}: {
  reader: ReaderHit;
  desk: FriendsDeskData | null;
  onDone: (message: string) => Promise<void>;
  onProfile: (userId: string, name: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const friend = desk?.friends.some((row) => row.userId === reader.userId);
  const asked = desk?.outgoing.some((row) => row.userId === reader.userId);
  const incoming = desk?.incoming.some((row) => row.userId === reader.userId);
  return (
    <li className="friend-row">
      <ReaderPortrait name={reader.displayName} outfit="" image={reader.image} onClick={() => onProfile(reader.userId, reader.displayName)} />
      <button type="button" className="person-hit min-w-0 font-bold" onClick={() => onProfile(reader.userId, reader.displayName)}>
        {reader.displayName}
      </button>
      {friend ? (
        <span className="text-sm text-muted">Friends</span>
      ) : asked ? (
        <span className="text-sm text-muted">Waiting for them</span>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            const call = incoming
              ? answerFriendRequest({ data: { userId: reader.userId, accept: true } })
              : sendFriendRequest({ data: reader.userId });
            void call
              .then(async (result) => {
                await onDone(result.ok ? (result.note ?? "Sent.") : result.error);
              })
              .catch(async () => {
                await onDone("That didn’t send.");
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "…" : incoming ? "Accept" : "Ask to be friends"}
        </button>
      )}
    </li>
  );
}

function ReadingLounge({
  friend,
  onBack,
  onVisit,
  onProfile,
  onBlocked,
  onChanged,
}: {
  friend: FriendCard;
  onBack: () => void;
  onVisit: () => void;
  onProfile: () => void;
  onBlocked: () => void;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState<LoungeNote[] | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const lastId = useRef("");

  async function pull() {
    const result = await loadThread({ data: friend.userId });
    if (!result.ok) {
      setError(result.error);
      setNotes([]);
      return;
    }
    setError(null);
    setNotes(result.notes);
    const newest = result.notes[result.notes.length - 1]?.id ?? "";
    if (newest !== lastId.current) {
      lastId.current = newest;
      requestAnimationFrame(() => {
        const node = scroller.current;
        if (node) node.scrollTop = node.scrollHeight;
      });
    }
    if (result.notes.some((note) => !note.mine)) {
      await markThreadRead({ data: friend.userId });
      onChanged();
    }
  }

  useEffect(() => {
    let live = true;
    void loadThread({ data: friend.userId }).then(async (result) => {
      if (!live) return;
      if (!result.ok) {
        setError(result.error);
        setNotes([]);
        return;
      }
      setNotes(result.notes);
      lastId.current = result.notes[result.notes.length - 1]?.id ?? "";
      await markThreadRead({ data: friend.userId });
      onChanged();
      requestAnimationFrame(() => {
        const node = scroller.current;
        if (node) node.scrollTop = node.scrollHeight;
      });
    });
    const timer = window.setInterval(() => {
      if (!document.hidden) void pull().catch(() => undefined);
    }, 2500);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [friend.userId]);

  return (
    <section className="lounge" aria-label="Reading Lounge">
      <header className="lounge-head">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className="btn btn-surface lg:hidden" onClick={onBack}>
              Back
            </button>
            <ReaderPortrait name={friend.displayName} outfit={friend.outfit} image={friend.image} onClick={onProfile} />
            <div className="min-w-0">
              <p className="font-display text-2xl leading-none">Reading Lounge</p>
              <button type="button" className="person-hit truncate text-sm" onClick={onProfile}>{friend.displayName}</button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-surface" onClick={onVisit}>
            Visit their room
          </button>
        </div>
        <div className="mt-3">
          <SafetyActions userId={friend.userId} name={friend.displayName} place="chat" onBlocked={onBlocked} />
        </div>
      </header>
      <div ref={scroller} className="lounge-scroll">
        {notes === null && !error && <p className="text-sm text-muted">Opening the lounge…</p>}
        {notes?.length === 0 && <p className="text-sm text-muted">No notes yet. Words only. Nothing here moves points or items.</p>}
        <ul className="grid gap-2">
          {notes?.map((note) => (
            <li key={note.id} className={cn("note", note.mine ? "note-mine" : "note-theirs")}>
              <p className="text-xs font-bold text-muted">{note.mine ? "You" : friend.displayName}{when(note.createdAt) ? ` · ${when(note.createdAt)}` : ""}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{note.body}</p>
              {note.mine && (
                <button
                  type="button"
                  className="btn btn-ghost mt-1 px-0"
                  onClick={() => {
                    void deleteNote({ data: note.id }).then(async (result) => {
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      await pull();
                    });
                  }}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <form
        className="grid gap-2 border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          void sendNote({ data: { friendId: friend.userId, body } })
            .then(async (result) => {
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setBody("");
              await pull();
            })
            .catch(() => setError("That note didn’t send."))
            .finally(() => setBusy(false));
        }}
      >
        <label className="grid gap-1 text-sm">
          A note, just words
          <textarea
            value={body}
            rows={2}
            maxLength={500}
            aria-label="Message"
            placeholder="Write a note. No pictures."
            className="field resize-none"
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        {error && <p className="text-sm text-accent">{error}</p>}
        <button type="submit" className="btn btn-primary w-fit" disabled={busy}>
          {busy ? "Sending…" : "Send note"}
        </button>
      </form>
    </section>
  );
}

function EraseShelf({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-3 grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        void deleteAccount({ data: phrase.trim() })
          .then((result) => {
            if (!result.ok) {
              setError(result.error);
              setBusy(false);
              return;
            }
            onDone();
          })
          .catch(() => {
            setError("The shelf didn’t close.");
            setBusy(false);
          });
      }}
    >
      <label className="grid gap-1 text-sm">
        Type DELETE to erase everything
        <input
          value={phrase}
          aria-label="Type DELETE"
          className="field"
          autoComplete="off"
          onChange={(event) => setPhrase(event.target.value)}
        />
      </label>
      {error && <p className="text-sm text-accent">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy || phrase.trim() !== "DELETE"}>
          {busy ? "Erasing…" : "Erase everything"}
        </button>
        <button type="button" className="btn btn-surface" onClick={onCancel}>
          Keep my shelf
        </button>
      </div>
    </form>
  );
}
