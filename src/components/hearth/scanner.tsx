import { useEffect, useRef, useState } from "react";
import { normalizeIsbn } from "@/lib/openlibrary";

export function Scanner({ onIsbn }: { onIsbn: (isbn: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onIsbnRef = useRef(onIsbn);
  onIsbnRef.current = onIsbn;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    let stopped = false;
    let controls: { stop: () => void } | undefined;

    const stopTracks = () => {
      controls?.stop();
      const stream = video?.srcObject;
      if (stream instanceof MediaStream) {
        for (const track of stream.getTracks()) track.stop();
      }
    };

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (stopped || !video) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (!result || stopped) return;
          const isbn = normalizeIsbn(result.getText());
          if (!isbn) return;
          stopped = true;
          stopTracks();
          onIsbnRef.current(isbn);
        });
        if (stopped) stopTracks();
      } catch {
        if (!stopped) {
          setError("The camera didn't open. Type the ISBN instead — it's usually above the barcode.");
        }
      }
    })();

    return () => {
      stopped = true;
      stopTracks();
    };
  }, []);

  return (
    <div className="grid gap-3">
      <video ref={videoRef} className="scan-video" muted playsInline autoPlay />
      <p className="text-sm text-muted">
        {error ?? "Point at the barcode on the back cover. Hold it steady until it catches."}
      </p>
    </div>
  );
}
