import { useEffect, useRef, useState } from "react";
import { mountRoom, previewItem, type RoomHandle, type RoomState } from "@/components/readme/room-pixel";

type BookStatus = "reading" | "finished";

export type SpineBook = {
  id: string;
  title: string;
  status: BookStatus;
  coverUrl?: string | null;
  tipped?: boolean;
  tips?: number;
  finishedAt?: string | null;
  format?: "novel" | "graphic" | "manga" | "comic";
};

export function LibraryScene({
  books,
  outfitId,
  shelfId,
  lampId,
  floorId = "",
  wallId = "",
  chairId = "",
  clockId = "",
  rugId = "",
  souvenirId = "",
  label,
  mine,
  onBook,
  onAdd,
}: {
  books: SpineBook[];
  outfitId: string;
  shelfId: string;
  lampId: string;
  floorId?: string;
  wallId?: string;
  chairId?: string;
  clockId?: string;
  rugId?: string;
  souvenirId?: string;
  label: string;
  mine?: boolean;
  onBook?: (id: string) => void;
  onAdd?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomRef = useRef<RoomHandle | null>(null);
  const [sky, setSky] = useState("");
  const [pager, setPager] = useState({ page: 0, pages: 1 });
  const pagerRef = useRef(setPager);
  pagerRef.current = setPager;
  const state: RoomState = {
    books,
    outfitId,
    shelfId,
    lampId,
    floorId,
    wallId,
    chairId,
    clockId,
    rugId,
    souvenirId,
  };
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const room = mountRoom(canvas, stateRef.current, setSky, (info) => pagerRef.current(info));
    roomRef.current = room;
    return () => {
      room.dispose();
      roomRef.current = null;
    };
  }, []);

  useEffect(() => {
    roomRef.current?.update(stateRef.current);
  }, [books, outfitId, shelfId, lampId, floorId, wallId, chairId, clockId, rugId, souvenirId]);

  return (
    <div className="grid gap-3">
      <section className="library library-px" aria-label={label}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        onPointerMove={(event) => {
          const canvas = canvasRef.current;
          if (!canvas || !roomRef.current) return;
          canvas.style.cursor = roomRef.current.hover(event) ? "pointer" : "default";
        }}
        onClick={(event) => {
          const id = roomRef.current?.pick(event);
          if (id) onBook?.(id);
        }}
      />
      {sky ? <p className="room-sky">{sky}</p> : null}
      {books.length > 0 && (
        <ul className="sr-only">
          {books.map((book) => (
            <li key={book.id}>
              <button type="button" onClick={() => onBook?.(book.id)}>
                {(book.tips ?? 0) > 0 ? `${book.title}. Tipped review.` : book.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
      {books.length === 0 && (
        <div className="catalog-card px-4 py-3">
          <p>{mine ? "The shelves are waiting." : "Nothing on these shelves yet."}</p>
          {mine && onAdd && (
            <button type="button" className="btn btn-primary mt-3" onClick={onAdd}>
              Add a book
            </button>
          )}
        </div>
      )}
      {pager.pages > 1 && (
        <div className="shelf-pager">
          <button type="button" className="btn btn-surface" disabled={pager.page === 0} onClick={() => roomRef.current?.step(-1)}>
            Earlier books
          </button>
          <span>
            {pager.page + 1} / {pager.pages}
          </span>
          <button type="button" className="btn btn-surface" disabled={pager.page >= pager.pages - 1} onClick={() => roomRef.current?.step(1)}>
            More books
          </button>
        </div>
      )}
    </div>
  );
}

export function ItemPreview({ itemId }: { itemId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void previewItem(itemId).then((url) => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [itemId]);
  if (!src) return <div className="room-swatch" />;
  return <img src={src} alt="" className="pixel-preview" />;
}
