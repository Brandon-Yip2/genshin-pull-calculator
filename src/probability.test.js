import { describe, it, expect } from 'vitest';
import {
  computeCurves,
  fiveStarRate,
  Q_BY_COUNTER,
  freshDistribution,
  probCopiesAtLeast,
  step,
  MAX_PITY,
} from './probability.js';

describe('fiveStarRate', () => {
  it('uses base 0.6% on pity 1..75 (no soft pity yet)', () => {
    expect(fiveStarRate(1)).toBeCloseTo(0.006, 10);
    expect(fiveStarRate(73)).toBeCloseTo(0.006, 10);
    expect(fiveStarRate(75)).toBeCloseTo(0.006, 10);
  });
  it('jumps sharply at pity 76 (~32%)', () => {
    expect(fiveStarRate(76)).toBeCloseTo(0.32, 2);
  });
  it('hits hard pity at 90', () => {
    expect(fiveStarRate(90)).toBe(1);
  });
});

describe('q_2 derivation', () => {
  it('uses 1/11 to give exactly 55% per-50/50 promo rate in steady state', () => {
    // Stationary distribution over the CR counter under 50/50 events.
    // pi_0 = pi_1, pi_2 = 0.5*pi_0, pi_3 = 0.25*(1-q_2)*pi_0
    const q = Q_BY_COUNTER[2];
    const pi0 = 1 / (2.75 - 0.25 * q);
    const pi1 = pi0;
    const pi2 = 0.5 * pi0;
    const pi3 = 0.25 * (1 - q) * pi0;
    const pWin =
      0.5 * pi0 + 0.5 * pi1 + (0.5 + 0.5 * q) * pi2 + 1 * pi3;
    expect(pWin).toBeCloseTo(0.55, 10);
  });
});

describe('Markov chain sanity', () => {
  it('preserves total probability', () => {
    let dist = freshDistribution();
    for (let i = 0; i < 200; i++) {
      dist = step(dist);
    }
    let total = 0;
    for (let i = 0; i < dist.length; i++) total += dist[i];
    expect(total).toBeCloseTo(1, 10);
  });

  it('P(C0 by 90 wishes) is at least 50% (hard pity guarantees a 5*, 50% to be promo)', () => {
    const { atLeast } = computeCurves(90);
    // Starting cr=1 default doesn't change C0 probabilities, since q_1=0.
    expect(atLeast[1][90]).toBeGreaterThanOrEqual(0.5);
    expect(atLeast[1][90]).toBeLessThan(0.6); // sanity upper bound
  });

  it('P(C0 by 180 wishes) = 100% (worst case is loss at 90 then guarantee by 180)', () => {
    const { atLeast } = computeCurves(180);
    expect(atLeast[1][180]).toBeCloseTo(1, 6);
  });

  it('atLeast[k] is monotonically non-decreasing in wishes', () => {
    const { atLeast } = computeCurves(500);
    for (let k = 1; k <= 7; k++) {
      for (let n = 1; n <= 500; n++) {
        expect(atLeast[k][n]).toBeGreaterThanOrEqual(atLeast[k][n - 1] - 1e-12);
      }
    }
  });

  it('atLeast[k] >= atLeast[k+1] (more copies is harder)', () => {
    const { atLeast } = computeCurves(500);
    for (let n = 0; n <= 500; n++) {
      for (let k = 1; k <= 6; k++) {
        expect(atLeast[k][n]).toBeGreaterThanOrEqual(atLeast[k + 1][n] - 1e-12);
      }
    }
  });
});

describe('CSV parity (C0 column)', () => {
  // The CSV has empirical C0 cumulative percentages from a 1B+ pull simulation.
  // Capturing Radiance does not affect C0 (counter never reaches 2 in the C0
  // path), so our computation should match the CSV closely (small error ~simulation noise + soft-pity-curve uncertainty).
  // We test specific wish counts where we have published values.
  const csvCumulative = {
    1: 0.00352,
    10: 0.03048,
    50: 0.14936,
    75: 0.22124,
    76: 0.32567,
    80: 0.50742,
    85: 0.5663,
    90: 0.59355,
    100: 0.63417,
    150: 0.79128,
    175: 0.99997,
    180: 1.0,
  };

  it('matches CSV C0 cumulative within 2.5 percentage points at every key wish', () => {
    const { atLeast } = computeCurves(180);
    const errors = [];
    for (const [n, expected] of Object.entries(csvCumulative)) {
      const got = atLeast[1][Number(n)];
      const diff = Math.abs(got - expected);
      if (diff > 0.025) {
        errors.push(
          `wish ${n}: expected ~${expected.toFixed(5)}, got ${got.toFixed(5)} (diff ${diff.toFixed(5)})`
        );
      }
    }
    expect(errors).toEqual([]);
  });

  it('matches CSV at wish 180 (must be 100%)', () => {
    const { atLeast } = computeCurves(180);
    expect(atLeast[1][180]).toBeCloseTo(1, 4);
  });
});

describe('long-run promo rate', () => {
  it('asymptotic per-pull promo rate ~ 1.10% (matches official 1.103%)', () => {
    // Use N where E[copies] is well below the cap of 7.
    const N = 300;
    const { atLeast } = computeCurves(N);
    let expectedPromos = 0;
    for (let k = 1; k <= 7; k++) expectedPromos += atLeast[k][N];
    const rate = expectedPromos / N;
    // Long-run rate is ~1.103% per pull; over 300 pulls the average is
    // dragged down by the first-5* transient (avg first 5* at ~pull 78), so
    // expect somewhere between 0.85% and 1.3%.
    expect(rate).toBeGreaterThan(0.0085);
    expect(rate).toBeLessThan(0.013);
  });
});
