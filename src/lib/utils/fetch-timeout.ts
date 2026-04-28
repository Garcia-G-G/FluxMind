/**
 * fetch() with a hard timeout via AbortController.
 *
 * Vanilla `fetch` has no built-in timeout — a hung upstream (fal.ai,
 * ElevenLabs, Serper, Firecrawl, R2, etc.) will block indefinitely,
 * which means a stuck worker job never releases its BullMQ slot and a
 * stuck route handler never returns.
 *
 * This helper wraps fetch with a default 30s timeout. Callers can pass
 * `timeoutMs` for upstreams that legitimately take longer (e.g. fal.ai
 * generation which can need 60–120s). An outer `signal` is forwarded so
 * caller cancellation (request abort, BullMQ shutdown) still wins.
 *
 * On timeout the AbortController throws an `AbortError` with a clear
 * message; the call site can identify it via `error?.name === "AbortError"`.
 */
export const fetchWithTimeout = async (
  url: string | URL | Request,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> => {
  const { timeoutMs = 30_000, signal: outerSignal, ...rest } = init;
  const controller = new AbortController();
  const timeoutErr = new Error(
    `fetch timed out after ${timeoutMs}ms: ${typeof url === "string" ? url : url.toString()}`,
  );
  timeoutErr.name = "AbortError";
  const timer = setTimeout(() => controller.abort(timeoutErr), timeoutMs);

  // Forward outer cancellation (e.g. client disconnect, worker shutdown).
  const onOuterAbort = (): void => {
    controller.abort(outerSignal?.reason);
  };
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort(outerSignal.reason);
    else outerSignal.addEventListener("abort", onOuterAbort, { once: true });
  }

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener("abort", onOuterAbort);
  }
};

/**
 * Promise.race a long-running operation against a timeout. Useful when the
 * underlying call doesn't accept an AbortSignal (e.g. third-party SDKs like
 * `fal.subscribe` that swallow signals internally).
 *
 * Note: this only releases the awaiter — the underlying promise keeps
 * running in the background. For a true cancel, the caller must close the
 * resource themselves (e.g. abort an open WebSocket).
 */
export const withDeadline = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${timeoutMs}ms`);
      err.name = "TimeoutError";
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};
