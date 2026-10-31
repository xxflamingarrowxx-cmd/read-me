import { useEffect, useState } from "react";
import { REVIEW_REASONS, type ReviewReason } from "@/lib/catalog";
import {
  dismissReview,
  loadReviewDesk,
  reasonLabel,
  removeReview,
  removeReviewAndPoints,
  reportReview,
  type ReviewCase,
} from "@/lib/readme/moderation";

export function ReportReview({ reviewId, reported }: { reviewId: string; reported?: boolean }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(Boolean(reported));
  const [reason, setReason] = useState<ReviewReason | "">("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (reported) setSent(true);
  }, [reported]);

  if (sent) {
    return <span className="text-xs font-bold text-muted">Reported</span>;
  }

  return (
    <div className="report-note">
      <button
        type="button"
        className="btn btn-surface btn-report"
        onClick={() => {
          setOpen((value) => !value);
          setError(null);
        }}
      >
        Report
      </button>
      {open && (
        <form
          className="report-slip"
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason) {
              setError("Pick a reason.");
              return;
            }
            setBusy(true);
            setError(null);
            void reportReview({ data: { reviewId, reason } })
              .then((result) => {
                if (!result.ok) {
                  setError(result.error);
                  if (result.error.includes("already reported")) setSent(true);
                  return;
                }
                setSent(true);
                setOpen(false);
                setNote(result.note);
              })
              .catch(() => setError("That report didn’t send."))
              .finally(() => setBusy(false));
          }}
        >
          <p className="font-display text-xl leading-tight">Why this note?</p>
          <fieldset className="report-reasons">
            <legend className="sr-only">Report reason</legend>
            {REVIEW_REASONS.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name={`reason-${reviewId}`}
                  value={item.id}
                  checked={reason === item.id}
                  onChange={() => setReason(item.id)}
                />
                {item.label}
              </label>
            ))}
          </fieldset>
          {error && <p className="text-sm text-accent">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Sending…" : "Send to the librarian"}
          </button>
        </form>
      )}
      {note && !open && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ReviewDesk() {
  const [cases, setCases] = useState<ReviewCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const result = await loadReviewDesk();
    if (!result.ok) {
      setError(result.error);
      setCases([]);
      return;
    }
    setError(null);
    setCases(result.cases);
  }

  useEffect(() => {
    let live = true;
    loadReviewDesk()
      .then((result) => {
        if (!live) return;
        if (!result.ok) {
          setError(result.error);
          setCases([]);
          return;
        }
        setCases(result.cases);
      })
      .catch(() => {
        if (live) setError("The librarian’s desk didn’t open.");
      });
    return () => {
      live = false;
    };
  }, []);

  function act(reviewId: string, run: () => Promise<{ ok: true; note: string } | { ok: false; error: string }>) {
    setBusyId(reviewId);
    setToast(null);
    void run()
      .then(async (result) => {
        setToast(result.ok ? result.note : result.error);
        await refresh();
      })
      .catch(() => setToast("That didn’t go through."))
      .finally(() => setBusyId(null));
  }

  if (error && cases === null) return null;
  if (cases === null) return <p className="text-sm text-muted">Opening the librarian’s desk…</p>;

  return (
    <section className="catalog-card p-4" aria-label="Review reports">
      <h2 className="font-display text-3xl">Librarian’s desk</h2>
      <p className="mt-1 text-sm text-muted">
        Reports stay here. The reader never sees who sent them. Points are not given to the reporter.
      </p>
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
      {toast && <p className="mt-2 text-sm">{toast}</p>}
      {cases.length === 0 && <p className="mt-3 text-sm text-muted">No open reports.</p>}
      <ul className="mt-3 grid gap-3">
        {cases.map((item) => (
          <li key={item.reviewId} className="mod-case">
            <p className="text-xs font-bold tracking-wide text-accent uppercase">{item.title}</p>
            <p className="text-sm text-muted">{item.author}</p>
            <div className="mod-split">
              <blockquote className="text-sm">“{item.body}”</blockquote>
              <div>
                <p className="text-xs font-bold tracking-wide uppercase">Reasons</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {item.reports.map((report) => (
                    <li key={report.id} className="reason-chip">
                      <span>{reasonLabel(report.reason)}</span>
                      <span className="block font-normal text-muted">{report.reporter}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Format: {item.format}
              {" · "}
              {item.points} points earned
              {when(item.reviewDate) ? ` · ${when(item.reviewDate)}` : ""}
              {" · "}
              {item.reviewer}
              {item.hidden ? " · Hidden until you decide" : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-surface"
                disabled={busyId === item.reviewId}
                onClick={() => act(item.reviewId, () => dismissReview({ data: item.reviewId }))}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="btn btn-surface"
                disabled={busyId === item.reviewId}
                onClick={() => act(item.reviewId, () => removeReview({ data: item.reviewId }))}
              >
                Remove review
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busyId === item.reviewId}
                onClick={() => act(item.reviewId, () => removeReviewAndPoints({ data: item.reviewId }))}
              >
                Remove review and take back points
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
