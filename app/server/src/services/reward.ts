export type RewardTier = 'gold' | 'silver' | 'bronze';

export function calculateReward(windowSeconds: number, plannedTotal: number, actualTotal: number): RewardTier {
  if (actualTotal <= Math.min(windowSeconds, plannedTotal * 1.05)) {
    return 'gold';
  }
  if (actualTotal <= windowSeconds) {
    return 'silver';
  }
  return 'bronze';
}
