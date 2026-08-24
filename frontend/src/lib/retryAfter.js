/**
 * How long a rate-limited caller has to wait, in whole minutes.
 *
 * DRF answers a throttled request with 429 and a `Retry-After` header in
 * seconds. Its body carries `detail` — an English sentence reading "Request was
 * throttled. Expected available in 3513 seconds." Both auth screens used to
 * show that `detail` verbatim, so a Russian or Uzbek child hit a wall of
 * English that does not say what they did or what to do next.
 *
 * Returns null when the error is not a throttle, so callers keep their existing
 * message for everything else.
 */
export function retryAfterMinutes(error) {
  if (error?.response?.status !== 429) return null;

  const headers = error.response.headers || {};
  // Browsers lower-case header names; a mocked response might not.
  const raw = headers['retry-after'] ?? headers['Retry-After'];
  const seconds = Number(raw);

  // A missing or unparseable header still means "wait a bit" — never let a
  // header problem turn into a blank error box.
  if (!Number.isFinite(seconds) || seconds <= 0) return 1;
  return Math.max(1, Math.ceil(seconds / 60));
}
