import { describe, expect, it } from 'vitest';
import { calculateReward } from './reward.js';

describe('calculateReward', () => {
  it('returns gold when within window and close to plan', () => {
    expect(calculateReward(3600, 1800, 1850)).toBe('gold');
  });

  it('returns silver when over plan but within window', () => {
    expect(calculateReward(3600, 1800, 2500)).toBe('silver');
  });

  it('returns bronze when exceeding window', () => {
    expect(calculateReward(1800, 1200, 4000)).toBe('bronze');
  });
});
