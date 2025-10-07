const MIN_IDLE_THRESHOLD = 30;
const IDLE_RATIO = 0.75;

export function computeIdleThreshold(plannedSeconds: number) {
  return Math.max(MIN_IDLE_THRESHOLD, Math.floor(plannedSeconds * IDLE_RATIO));
}

export function shouldNudge(lastCompletedAt: Date | null, startedAt: Date | null, plannedSeconds: number, now: Date, lastNudgedAt?: Date | null) {
  if (!startedAt) {
    return false;
  }
  if (lastCompletedAt && lastCompletedAt > startedAt) {
    return false;
  }
  const threshold = computeIdleThreshold(plannedSeconds);
  const elapsed = (now.getTime() - startedAt.getTime()) / 1000;
  if (elapsed < threshold) {
    return false;
  }
  if (lastNudgedAt) {
    const sinceNudge = (now.getTime() - lastNudgedAt.getTime()) / 1000;
    if (sinceNudge < 60) {
      return false;
    }
  }
  return true;
}
