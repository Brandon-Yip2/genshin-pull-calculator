import { describe, it, expect } from 'vitest';
import {
  computeCurves,
  fiveStarRate,
  Q_BY_COUNTER,
  freshDistribution,
  step,
  MAX_PITY,
  worstCaseFiveStarEvents,
  worstCasePullsForCopies,
} from './probability.js';

describe('fiveStarRate', () => {
  it('uses base 0.6% on pity 1..73 (no soft pity yet)', () => {
    expect(fiveStarRate(1)).toBeCloseTo(0.006, 10);
    expect(fiveStarRate(50)).toBeCloseTo(0.006, 10);
    expect(fiveStarRate(73)).toBeCloseTo(0.006, 10);
  });
  it('ramps by +6pp per pull from pity 74 (community 9.45M-wish model)', () => {
    expect(fiveStarRate(74)).toBeCloseTo(0.066, 10);
    expect(fiveStarRate(75)).toBeCloseTo(0.126, 10);
    expect(fiveStarRate(76)).toBeCloseTo(0.186, 10);
    expect(fiveStarRate(80)).toBeCloseTo(0.426, 10);
    expect(fiveStarRate(89)).toBeCloseTo(0.966, 10);
  });
  it('hits hard pity at 90', () => {
    expect(fiveStarRate(90)).toBe(1);
  });
});

describe('q_2 derivation', () => {
  it('uses 1/11 so a non-guaranteed 50/50 wins exactly 55% of the time', () => {
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

describe('agreement with the published rates', () => {
  // Sanity checks against numbers HoYoverse / the 9.45M-wish community
  // estimation actually publish. These replace a previous "CSV parity" block
  // that validated the model against a dataset which does not exist (and whose
  // wish-1 value, 0.352%, is incompatible with the real 0.6% base rate).
  it('~35.5% of 5★s arrive before soft pity (pity <= 73)', () => {
    const { firstFiveAt } = computeCurves(200);
    let early = 0;
    for (let n = 1; n <= 73; n++) early += firstFiveAt[n];
    expect(early).toBeCloseTo(0.3555, 2);
  });

  it('mean pulls per 5★ is ~62.3, i.e. a 1.605% consolidated rate', () => {
    // Renewal identity: mean wait = sum of the survival function.
    let survive = 1;
    let mean = 0;
    for (let i = 0; i < MAX_PITY; i++) {
      mean += survive;
      survive *= 1 - fiveStarRate(i + 1);
    }
    expect(mean).toBeCloseTo(62.3, 1);
    expect(1 / mean).toBeCloseTo(0.016052, 5);
  });

  it('P(C0 by 180) is exactly 1 (worst case: lose at 90, guaranteed at 180)', () => {
    const { atLeast } = computeCurves(180);
    expect(atLeast[1][180]).toBeCloseTo(1, 4);
  });
});

describe('worst case (hard guarantee)', () => {
  it('reproduces the closed form for a fresh banner at counter 1', () => {
    // Two of these are the community's familiar numbers: C0 is certain by 180
    // (lost 50/50 at 90, guaranteed promo at 180) and C6 by 1080.
    expect([1, 2, 3, 4, 5, 6, 7].map((k) => worstCasePullsForCopies(k))).toEqual([
      180, 360, 450, 630, 810, 900, 1080,
    ]);
  });

  it('needs fewer 5★ events when the counter is already advanced', () => {
    // From counter 3 the very next 5★ is a forced CR win, so everything is 90
    // pulls per promo; from counter 1 the adversary can buy an extra event.
    expect(worstCaseFiveStarEvents(1, { crCounter: 3 })).toBe(1);
    expect(worstCaseFiveStarEvents(1, { crCounter: 2 })).toBe(2);
    expect(worstCaseFiveStarEvents(1, { crCounter: 1 })).toBe(2);
    // After a forced win at counter 3 the counter drops back to 1, so only the
    // first promo is cheap — the rest pay the usual 2-events-per-promo worst case.
    expect(worstCaseFiveStarEvents(2, { crCounter: 3 })).toBe(3);
    expect(worstCaseFiveStarEvents(2, { crCounter: 1 })).toBe(4);
  });

  it('credits existing 5★ pity and an existing guarantee', () => {
    const fresh = worstCasePullsForCopies(1);
    expect(worstCasePullsForCopies(1, { startingPity: 60 })).toBe(fresh - 60);
    expect(worstCasePullsForCopies(1, { startingPity: 89 })).toBe(fresh - 89);
    // A guarantee turns the first 5★ straight into the promo: one event, not two.
    expect(worstCasePullsForCopies(1, { guaranteed: true })).toBe(90);
    expect(worstCasePullsForCopies(2, { guaranteed: true })).toBe(270);
  });

  it('is exactly where the chain first reaches probability 1', () => {
    // The DP is only useful if it agrees with the actual Markov chain, so check
    // both directions: certain at the threshold, not certain one pull earlier.
    const states = [
      { startingPity: 0, crCounter: 1, guaranteed: false },
      { startingPity: 0, crCounter: 0, guaranteed: false },
      { startingPity: 0, crCounter: 3, guaranteed: false },
      { startingPity: 40, crCounter: 1, guaranteed: false },
      { startingPity: 0, crCounter: 1, guaranteed: true },
      { startingPity: 20, crCounter: 2, guaranteed: true },
    ];
    for (const state of states) {
      // The chain needs `guarantee` (0/1); the worst-case solver takes a bool.
      const { atLeast } = computeCurves(worstCasePullsForCopies(7, state), {
        startingPity: state.startingPity,
        crCounter: state.crCounter,
        guarantee: state.guaranteed ? 1 : 0,
      });
      for (let k = 1; k <= 7; k++) {
        const n = worstCasePullsForCopies(k, state);
        expect(n).toBeGreaterThan(0);
        expect(atLeast[k][n], `${JSON.stringify(state)} k=${k}`).toBeCloseTo(1, 9);
      }
    }

    // Minimality: one pull BEFORE the threshold the chain must not be certain
    // yet. Only shapes this visible are worth asserting — deeper paths need two
    // improbable 90-pity events in a row, which is below double precision.
    const shallow = computeCurves(90, { crCounter: 3 });
    expect(shallow.atLeast[1][89]).toBeLessThan(1 - 1e-9);
    expect(shallow.atLeast[1][90]).toBeCloseTo(1, 9);
  });
});

describe('starting state shifts the odds', () => {
  it('mid-pity and an existing guarantee both raise P(C0) at a fixed wish count', () => {
    const N = 90;
    const fresh = computeCurves(N).atLeast[1][N];
    const midPity = computeCurves(N, { startingPity: 60 }).atLeast[1][N];
    const guaranteed = computeCurves(N, { guarantee: 1 }).atLeast[1][N];
    expect(midPity).toBeGreaterThan(fresh);
    // 60 pulls of pity leaves only 30 to hard pity, so C0 is a coin flip there.
    expect(midPity).toBeGreaterThan(0.4);
    // A guarantee means the very first 5★ IS the promo.
    expect(guaranteed).toBeGreaterThan(0.8);
  });
});

describe('long-run promo rate', () => {
  it('is ~1.10% per pull, i.e. ~93 wishes per promotional 5★', () => {
    // Use N where E[copies] is well below the cap of 7.
    const N = 300;
    const { atLeast } = computeCurves(N);
    let expectedPromos = 0;
    for (let k = 1; k <= 7; k++) expectedPromos += atLeast[k][N];
    const rate = expectedPromos / N;
    // The model's per-pull promo rate is ~1.10% (a 1.605% 5★ rate times the
    // ~69% promo share). Over 300 pulls the average is dragged down by the
    // first-5* transient (the first 5★ arrives at ~62 pulls on average), so
    // expect somewhere between 0.85% and 1.3%.
    expect(rate).toBeGreaterThan(0.0085);
    expect(rate).toBeLessThan(0.013);
  });
});
