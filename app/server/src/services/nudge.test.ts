import { describe, expect, it } from 'vitest';
import { computeIdleThreshold, shouldNudge } from './nudge.js';

describe('computeIdleThreshold', () => {
  it('does not drop below the minimum idle threshold', () => {
    expect(computeIdleThreshold(10)).toBe(30);
  });

  it('scales with the planned seconds when above the minimum', () => {
    expect(computeIdleThreshold(200)).toBe(150);
  });
});

describe('shouldNudge', () => {
  const baseTime = new Date('2024-01-01T00:00:00Z');

  it('returns false when the task has not started', () => {
    expect(
      shouldNudge(null, null, 120, baseTime)
    ).toBe(false);
  });

  it('returns false when the task was already completed', () => {
    const startedAt = new Date(baseTime.getTime() - 120_000);
    const completedAt = new Date(baseTime.getTime() - 60_000);
    expect(
      shouldNudge(completedAt, startedAt, 120, baseTime)
    ).toBe(false);
  });

  it('returns false when within the idle threshold', () => {
    const startedAt = new Date(baseTime.getTime() - 60_000);
    expect(
      shouldNudge(null, startedAt, 200, baseTime)
    ).toBe(false);
  });

  it('returns false when nudged less than a minute ago', () => {
    const startedAt = new Date(baseTime.getTime() - 200_000);
    const lastNudgedAt = new Date(baseTime.getTime() - 30_000);
    expect(
      shouldNudge(null, startedAt, 120, baseTime, lastNudgedAt)
    ).toBe(false);
  });

  it('returns true when idle past the threshold without a recent nudge', () => {
    const startedAt = new Date(baseTime.getTime() - 200_000);
    expect(
      shouldNudge(null, startedAt, 120, baseTime)
    ).toBe(true);
  });
});
