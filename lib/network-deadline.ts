// Own the entire network operation, including response parsing and SDK retries.
// Racing the deadline also lets callers recover if a transport ignores abort.
export async function withNetworkDeadline<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Network operation timed out."));
        // The Blob SDK recognizes AbortError as cancellation, not a retryable
        // failure. Use the default abort reason rather than TimeoutError.
        controller.abort();
      }, timeoutMs);
    });

    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
