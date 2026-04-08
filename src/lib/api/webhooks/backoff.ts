/**
 * Exponential backoff schedule for failed webhook deliveries.
 *
 * Schedule (attempts are 1-indexed — `attempt=1` is the FIRST retry, after
 * the initial attempt failed):
 *
 *   attempt 1 → +1 minute
 *   attempt 2 → +5 minutes
 *   attempt 3 → +30 minutes
 *   attempt 4 → +2 hours
 *   attempt 5 → +12 hours
 *   attempt ≥ 6 → null (give up)
 *
 * Total elapsed window before giving up: ~14h45m. Long enough to cover
 * most subscriber outages, short enough to avoid stale events sitting in
 * the outbox forever.
 */

export const MAX_ATTEMPTS = 5;

const SCHEDULE_MS = [
  1 * 60 * 1000, //  1 min
  5 * 60 * 1000, //  5 min
  30 * 60 * 1000, // 30 min
  2 * 60 * 60 * 1000, //  2 h
  12 * 60 * 60 * 1000, // 12 h
];

/**
 * Returns the next attempt timestamp after a failure, or `null` when the
 * caller should mark the row as `failed` (max attempts reached).
 *
 * @param attemptJustCompleted - The attempt number we just tried (1-indexed
 *   for the first try). Pass `1` after the first delivery failed → schedules
 *   the second attempt 1 minute from now.
 * @param now - Reference time. Defaults to `Date.now()` — accept override for tests.
 */
export function nextAttemptAt(
  attemptJustCompleted: number,
  now: number = Date.now(),
): Date | null {
  if (attemptJustCompleted < 1) return null;
  if (attemptJustCompleted >= MAX_ATTEMPTS) return null;
  // SCHEDULE_MS[0] is the delay BEFORE the second attempt (after attempt 1
  // failed). Index = attemptJustCompleted - 1.
  const delay = SCHEDULE_MS[attemptJustCompleted - 1];
  if (delay === undefined) return null;
  return new Date(now + delay);
}

/**
 * Returns true when an attempt should mark the outbox row as terminally
 * failed (the caller has exhausted all retries).
 */
export function isTerminalFailure(attemptJustCompleted: number): boolean {
  return attemptJustCompleted >= MAX_ATTEMPTS;
}
