import { useEffect, useRef } from "react";

/**
 * Conditional polling: runs `callback` immediately, then every `intervalMs`
 * while the browser tab is visible, and pauses the moment the tab is hidden.
 * When the tab becomes visible again it fires once right away, so the UI is
 * always current after a return — without burning background requests (and
 * background CPU for re-renders) on tabs nobody is watching.
 *
 * Pass `intervalMs = 0` (or a negative value) to disable polling entirely;
 * the effect then does nothing, which is handy for "poll only on this step"
 * conditions.
 */
export function useVisibilityPolling(callback: () => void, intervalMs: number) {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return;
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      // Immediate refresh on (re)appear, then keep polling while visible.
      cbRef.current();
      if (timer) return;
      timer = setInterval(() => cbRef.current(), intervalMs);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}