import { QUICK_PICKS, type QuickPick } from "@/lib/catalog";

export type BookHit = {
  title: string;
  author: string;
  isbn: string;
  pages: number;
  coverUrl: string | null;
};

type Doc = {
  title?: string;
  author_name?: string[];
  number_of_pages_median?: number;
  cover_i?: number;
  isbn?: string[];
};

export function normalizeIsbn(raw: string): string | null {
  const cleaned = raw.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(cleaned) || /^97[89]\d{10}$/.test(cleaned)) return cleaned;
  const embedded = cleaned.match(/97[89]\d{10}/);
  return embedded ? embedded[0] : null;
}

export function coverFor(isbn: string | undefined, coverId?: number): string | null {
  if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg?default=false`;
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
  return null;
}

function pagesOf(value: number | undefined): number {
  if (!value || value < 8 || value > 2000) return 0;
  return Math.round(value);
}

function pickIsbn(isbns: string[] | undefined): string {
  if (!isbns?.length) return "";
  return isbns.find((code) => /^97[89]\d{10}$/.test(code)) ?? isbns.find((code) => /^\d{10}$/.test(code)) ?? "";
}

function toHit(doc: Doc): BookHit | null {
  if (!doc.title) return null;
  const isbn = pickIsbn(doc.isbn);
  return {
    title: doc.title,
    author: doc.author_name?.[0] ?? "Unknown author",
    isbn,
    pages: pagesOf(doc.number_of_pages_median),
    coverUrl: coverFor(isbn || undefined, doc.cover_i),
  };
}

export function hitFromQuick(pick: QuickPick): BookHit {
  return {
    title: pick.title,
    author: pick.author,
    isbn: pick.isbn,
    pages: pick.pages,
    coverUrl: coverFor(pick.isbn),
  };
}

export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookHit[]> {
  const isbn = normalizeIsbn(query);
  const params = new URLSearchParams({
    limit: "8",
    fields: "title,author_name,number_of_pages_median,cover_i,isbn",
  });
  if (isbn) params.set("isbn", isbn);
  else {
    params.set("q", query);
    params.set("language", "eng");
  }
  const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("catalog");
  const json = (await response.json()) as { docs?: Doc[] };
  const seen = new Set<string>();
  const hits: BookHit[] = [];
  for (const doc of json.docs ?? []) {
    const hit = toHit(doc);
    if (!hit) continue;
    const key = `${hit.title.toLowerCase()}|${hit.author.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(hit);
  }
  if (hits.length === 0) {
    const local = QUICK_PICKS.filter((pick) => {
      const blob = `${pick.title} ${pick.author} ${pick.isbn}`.toLowerCase();
      return blob.includes(query.trim().toLowerCase());
    }).map(hitFromQuick);
    return local;
  }
  return hits;
}
