import { describe, it, expect } from 'vitest';
import { formatProb, hardGuaranteeWishForCopies } from './format.js';

describe('hardGuaranteeWishForCopies', () => {
  // Worst-case path from counter=1 is L,G | L,G | forced CR-W = 3 promos in
  // 450 pulls. Trailing partial L,G chains contribute 180 pulls per promo.
  it('matches the per-copies worst-case path', () => {
    expect(hardGuaranteeWishForCopies(0)).toBe(0);
    expect(hardGuaranteeWishForCopies(1)).toBe(180);  // C0
    expect(hardGuaranteeWishForCopies(2)).toBe(360);  // C1
    expect(hardGuaranteeWishForCopies(3)).toBe(450);  // C2
    expect(hardGuaranteeWishForCopies(4)).toBe(630);  // C3
    expect(hardGuaranteeWishForCopies(5)).toBe(810);  // C4
    expect(hardGuaranteeWishForCopies(6)).toBe(900);  // C5
    expect(hardGuaranteeWishForCopies(7)).toBe(1080); // C6
  });
});

describe('formatProb', () => {
  it('returns 100.00% only when caller asserts hard guarantee', () => {
    expect(formatProb(1, true)).toBe('100.00%');
    expect(formatProb(0.9999999999999992, true)).toBe('100.00%');
  });

  it('never returns 100.00% otherwise, even when value is mathematically 1', () => {
    expect(formatProb(1, false)).not.toContain('100.00%');
    expect(formatProb(0.9999999999999992, false)).not.toContain('100.00%');
  });

  it('shows enough nines for near-1 values to be distinguishable', () => {
    expect(formatProb(0.9999, false)).toBe('99.99000%');
    expect(formatProb(0.99999, false)).toBe('99.999000%');
    expect(formatProb(0.99999999, false)).toBe('99.999999000%');
    expect(formatProb(0.999999999, false)).toBe('99.9999999000%');
  });

  it('floors at 11 decimals and switches to a bound for ultra-tiny epsilons', () => {
    expect(formatProb(1 - 1e-15, false)).toBe('>99.9999999999%');
  });

  it('shows ordinary percentages with two decimals', () => {
    expect(formatProb(0.5304, false)).toBe('53.04%');
    expect(formatProb(0.99, false)).toBe('99.00%');
    expect(formatProb(0.005, false)).toBe('0.50%');
  });

  it('shows extra precision for small probabilities', () => {
    expect(formatProb(0.0001, false)).toBe('0.0100%');
    expect(formatProb(0.00005, false)).toBe('0.0050%');
  });

  it('uses scientific notation for tiny probabilities', () => {
    expect(formatProb(1e-7, false)).toMatch(/e-/);
    expect(formatProb(1e-10, false)).toMatch(/e-/);
  });

  it('exact zero is 0.00%', () => {
    expect(formatProb(0, false)).toBe('0.00%');
  });
});
