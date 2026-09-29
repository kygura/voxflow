import { useEffect, useRef, useState } from "react";
import { api, events } from "./api";
import { isSupportedAudio } from "./audio";

export type DropState = "ready" | "unsupported" | "busy";

/**
 * Tracks an audio file dragged over the window. `dropState` is null when nothing is
 * being dragged. Only the first path is used; a drop while busy or with an unsupported
 * extension never reaches Rust and reports through `onError` instead.
 */
export function useFileDrop(busy: boolean, onError: (message: string) => void): DropState | null {
  const [dropState, setDropState] = useState<DropState | null>(null);
  const latest = useRef({ busy, onError });
  latest.current = { busy, onError };

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    events
      .onFileDrop((e) => {
        if (e.type === "leave") return setDropState(null);
        const path = e.paths[0];
        if (!path) return setDropState(null); // not a file drag (text, link, …)
        if (e.type === "enter") {
          setDropState(
            latest.current.busy ? "busy" : isSupportedAudio(path) ? "ready" : "unsupported",
          );
          return;
        }
        setDropState(null);
        if (latest.current.busy) return;
        if (!isSupportedAudio(path)) {
          latest.current.onError("Unsupported file type. Use wav, mp3, m4a, ogg or flac.");
          return;
        }
        api.transcribePath(path).catch((err) => latest.current.onError(String(err)));
      })
      .then((u) => (cancelled ? u() : (unlisten = u)));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return dropState;
}
