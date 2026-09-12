/**
 * TRIPLE-METHOD VERIFICATION of the two numerical engines.
 *
 * Every headline number in the app is recomputed here three ways, and the
 * three ways must agree:
 *
 *   A. The shipped engine.
 *        probability.js  -> exact DP over the flat state array
 *        starglitter.js  -> exact expectation curves + Starglitter table
 *
 *   B. A Monte Carlo written from scratch in this file.
 *        Its own RNG (mulberry32), its own state handling, no shared code.
 *
 *   C. An independent EXACT derivation, using different mathematics.
 *        * The 5★ process is treated as a renewal process: build the wait-time
 *          distribution, convolve it with itself for the time of the j-th
 *          event, carry the promo/counter chain as scalars over event index,
 *          and read the answer off as  sum(state probability × probability
 *          that exactly j events happened by pull N). No flat state array, no
 *          marginal extraction, no shared summation order.
 *        * The 4★ process is a two-state alternating renewal solved by the
 *          renewal recursion F[n]/G[n], not by a state array.
 *        * The hard-guarantee solver is re-derived as a forward min-promo
 *          dynamic program — the opposite direction to the shipped backward
 *          max-event recursion.
 *
 * The published inputs are re-typed below from their sources rather than
 * imported, so a typo in src/ cannot hide behind itself. Sources: Genshin
 * Impact Wiki "Wish" (Character Event Wish rate table, including the
 * community-estimation column), "Masterless Starglitter" and "Masterless
 * Stardust" (both citing HoYoverse's in-game text).
 */

import { describe, it, expect } from 'vitest';
import {
  computeCurves,
  fiveStarRate,
  Q_BY_COUNTER,
  MAX_PITY,
  MAX_COPIES,
  worstCaseFiveStarEvents,
  worstCasePullsForCopies,
} from './probability.js';
import {
  computeRewardCurves,
  fourStarRate,
  rewardsAt,
  FOUR_STAR_PITY,
  STARDUST_PER_THREE_STAR,
  STARGLITTER_PER_FATE,
  STARDUST_PER_FATE,
} from './starglitter.js';
import {
  defaultRoster,
  NOT_OWNED,
  FOUR_STAR_CHARACTER_NAMES,
  STANDARD_FIVE_STAR_NAMES,
} from './data/roster.js';

// ===========================================================================
// Published inputs, re-typed from the sources
// ===========================================================================

const PUB = {
  // 5★ : 0.6% base, 1.6% consolidated, hard pity 90.
  fiveRate(p) {
    if (p >= 90) return 1;
    if (p <= 73) return 0.006;
    return Math.min(1, 0.006 + (p - 73) * 0.06);
  },
  // 4★ : 5.1% base, 13% consolidated, hard pity 10, soft spike at 9.
  fourRate(p) {
    if (p >= 10) return 1;
    if (p === 9) return 0.561;
    return 0.051;
  },
  stardustPerThreeStar: 15, // Masterless Stardust, 3★ weapons only
  stardustPerFate: 75, // Paimon's Bargains: 75 Stardust -> 1 Fate
  starglitterPerFate: 5, // Paimon's Bargains: 5 Starglitter -> 1 Fate
  featuredFourChance: 0.5, // 50% featured, else the next 4★ is guaranteed
  standardCharShare: 0.5, // inside the non-featured 4★ portion
};

const FEATURED = ['Bennett', 'Fischl', 'Xiangling'];

/** Starglitter paid by one duplicate character, from the published table. */
function pubGlitter(stars, constellation) {
  if (constellation === NOT_OWNED) return 0;
  if (stars === 4) return constellation >= 6 ? 5 : 2;
  return constellation >= 6 ? 25 : 10;
}

/**
 * Total Starglitter a limited 5★ pays across `copies` new copies.
 * Overall copy index k: 1 = the first copy ever (a brand-new character, worth
 * nothing), 2..7 = duplicates below C6 (10 each), 8+ = C6 duplicates (25 each).
 */
function pubPromoGlitter(copies, alreadyOwned) {
  let total = 0;
  for (let j = 1; j <= copies; j++) {
    const k = alreadyOwned + j;
    if (k === 1) continue;
    total += k >= 8 ? 25 : 10;
  }
  return total;
}

// ===========================================================================
// Method B -- independent Monte Carlo
// ===========================================================================

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One trial of the Character Event Wish, mirroring the model the app
 * documents: each pull rolls the 5★ chain and the 4★ chain independently; a 5★
 * displaces the 4★ item on that pull, but the 4★ counter still ticked — which
 * is what `computeRewardCurves` implements by weighting every 4★ outcome with
 * (1 - P(this pull is a 5★)).
 */
function mcTrial(rng, wishes, o) {
  let pity5 = o.startPity5; // pulls survived since the last 5★
  let pity4 = o.startPity4;
  let guar = o.guaranteed ? 1 : 0;
  let cr = o.crCounter;
  let fourGuar = o.fourGuaranteed ? 1 : 0;
  const alreadyOwned = o.roster.promoFiveCopies ?? 0;
  let newCopies = 0;

  const out = { promos: 0, std5: 0, threeStar: 0, feat4: 0, std4Char: 0, std4Weapon: 0, fiveStars: 0, glitter: 0, stardust: 0 };

  for (let w = 0; w < wishes; w++) {
    const isFive = rng() < PUB.fiveRate(pity5 + 1);
    // The 4★ chain is rolled on every pull, exactly as in the analytic DP.
    const fourRoll = rng() < PUB.fourRate(pity4 + 1);
    pity4 = fourRoll ? 0 : Math.min(pity4 + 1, FOUR_STAR_PITY - 1);

    if (isFive) {
      out.fiveStars++;
      pity5 = 0;
      if (guar === 1) {
        newCopies++;
        out.promos++;
        // The first copy of an unowned 5★ is the character itself, worth zero
        // Starglitter; only duplicates pay the table.
        out.glitter +=
          pubPromoGlitter(newCopies, alreadyOwned) -
          pubPromoGlitter(newCopies - 1, alreadyOwned);
        guar = 0;
      } else {
        const pw = o.q[cr] + (1 - o.q[cr]) * 0.5;
        if (rng() < pw) {
          newCopies++;
          out.promos++;
          out.glitter +=
            pubPromoGlitter(newCopies, alreadyOwned) -
            pubPromoGlitter(newCopies - 1, alreadyOwned);
          cr = cr <= 1 ? 0 : 1;
        } else {
          out.std5++;
          const name = STANDARD_FIVE_STAR_NAMES[Math.floor(rng() * STANDARD_FIVE_STAR_NAMES.length)];
          out.glitter += pubGlitter(5, o.roster.fiveStar?.[name] ?? NOT_OWNED);
          guar = 1;
          cr = Math.min(cr + 1, 3);
        }
      }
      continue;
    }

    pity5 = Math.min(pity5 + 1, MAX_PITY - 1);

    if (fourRoll) {
      const isFeatured = fourGuar === 1 ? true : rng() < PUB.featuredFourChance;
      if (isFeatured) {
        out.feat4++;
        const name = FEATURED[Math.floor(rng() * FEATURED.length)];
        out.glitter += pubGlitter(4, o.roster.fourStar?.[name] ?? NOT_OWNED);
        fourGuar = 0;
      } else if (rng() < PUB.standardCharShare) {
        out.std4Char++;
        const name = FOUR_STAR_CHARACTER_NAMES[Math.floor(rng() * FOUR_STAR_CHARACTER_NAMES.length)];
        out.glitter += pubGlitter(4, o.roster.fourStar?.[name] ?? NOT_OWNED);
        fourGuar = 1;
      } else {
        out.std4Weapon++;
        out.glitter += pubGlitter(4, 0); // a 4★ weapon is a flat 2
        fourGuar = 1;
      }
    } else {
      out.threeStar++;
      out.stardust += PUB.stardustPerThreeStar;
    }
  }

  return out;
}

const MC_KEYS = ['promos', 'std5', 'threeStar', 'feat4', 'std4Char', 'std4Weapon', 'fiveStars', 'glitter', 'stardust'];

function mcRun({ wishes, trials, seed, q = Q_BY_COUNTER, startState = {}, roster }) {
  const rng = mulberry32(seed);
  const o = {
    q,
    roster,
    startPity5: startState.startingFivePity ?? 0,
    guaranteed: startState.guaranteed ?? false,
    crCounter: startState.crCounter ?? 1,
    startPity4: startState.startingFourPity ?? 0,
    fourGuaranteed: startState.featuredFourGuaranteed ?? false,
  };

  const sum = {};
  const sumSq = {};
  for (const k of MC_KEYS) {
    sum[k] = 0;
    sumSq[k] = 0;
  }
  const promoHist = new Float64Array(MAX_COPIES + 2);

  for (let t = 0; t < trials; t++) {
    const r = mcTrial(rng, wishes, o);
    for (const k of MC_KEYS) {
      sum[k] += r[k];
      sumSq[k] += r[k] * r[k];
    }
    promoHist[Math.min(r.promos, MAX_COPIES + 1)]++;
  }

  const mean = {};
  const se = {};
  for (const k of MC_KEYS) {
    mean[k] = sum[k] / trials;
    const variance = Math.max(0, sumSq[k] / trials - mean[k] * mean[k]);
    se[k] = Math.sqrt(variance / trials);
  }

  const atLeast = {};
  for (let k = 1; k <= MAX_COPIES; k++) {
    let hit = 0;
    for (let p = k; p <= MAX_COPIES + 1; p++) hit += promoHist[p];
    const p = hit / trials;
    atLeast[k] = { p, se: Math.sqrt(Math.max(0, p * (1 - p)) / trials) };
  }

  return { mean, se, atLeast, trials };
}

// ===========================================================================
// Method C -- independent exact derivations
// ===========================================================================

/**
 * P(additional pulls until the next success = j), given that `startPity` pulls
 * have already been survived. The success rate on pull (startPity + j) is
 * `rate`.
 */
function waitDistribution(rate, hardPity, startPity) {
  const survive = new Float64Array(hardPity + 1);
  survive[0] = 1;
  for (let p = 1; p <= hardPity; p++) survive[p] = survive[p - 1] * (1 - rate(p));
  const out = new Float64Array(hardPity + 1);
  const denom = survive[startPity];
  for (let p = startPity + 1; p <= hardPity; p++) {
    out[p - startPity] = (survive[p - 1] * rate(p)) / denom;
  }
  return out;
}

function convolve(a, b, maxN) {
  const out = new Float64Array(maxN + 1);
  // Bound both operands by their own length: the wait distribution is shorter
  // than the accumulating time distribution, and reading past a typed array's
  // end yields undefined, which would silently poison the sum with NaN.
  const ia = Math.min(a.length - 1, maxN);
  const ib = Math.min(b.length - 1, maxN);
  for (let i = 0; i <= ia; i++) {
    const ai = a[i];
    if (ai === 0) continue;
    const jMax = Math.min(ib, maxN - i);
    for (let j = 0; j <= jMax; j++) {
      const bj = b[j];
      if (bj === 0) continue;
      out[i + j] += ai * bj;
    }
  }
  return out;
}

function cdfAt(dist, n) {
  let s = 0;
  const lim = Math.min(n, dist.length - 1);
  for (let i = 0; i <= lim; i++) s += dist[i];
  return s;
}

/**
 * Scalar chain over 5★ EVENTS: probability of being in (loss counter,
 * guarantee, promos) after exactly j events.
 *
 * The key structural fact Method C exploits: the pity wait is independent of
 * the counter/guarantee/promo state, so the time of the j-th event depends only
 * on j. That lets "which state are we in" (a scalar) be separated from "how
 * many events happened by pull N" (a convolution).
 */
function promoEventChain(maxEvents, q, startCounter, startGuaranteed) {
  const P = maxEvents + 1;
  const size = 4 * 2 * P;
  const idx = (c, g, p) => (c * 2 + g) * P + p;
  let cur = new Float64Array(size);
  cur[idx(startCounter, startGuaranteed ? 1 : 0, 0)] = 1;
  const frames = [cur];

  for (let j = 1; j <= maxEvents; j++) {
    const next = new Float64Array(size);
    for (let c = 0; c < 4; c++) {
      for (let g = 0; g < 2; g++) {
        for (let p = 0; p <= j - 1; p++) {
          const m = cur[idx(c, g, p)];
          if (m === 0) continue;
          if (g === 1) {
            // Guaranteed promo; the loss counter is untouched.
            next[idx(c, 0, p + 1)] += m;
            continue;
          }
          const win = q[c] + (1 - q[c]) * 0.5;
          if (win > 0) next[idx(c <= 1 ? 0 : 1, 0, p + 1)] += m * win;
          if (win < 1) next[idx(Math.min(c + 1, 3), 1, p)] += m * (1 - win);
        }
      }
    }
    frames.push(next);
    cur = next;
  }
  return { frames, idx, P };
}

/**
 * Exact Method C for the promotional 5★ process.
 *
 * P(exactly j events by pull N) = cdf_j(N) - cdf_{j+1}(N), where cdf_j is the
 * CDF of the j-fold convolution of the wait distribution (cdf_0 = 1). That
 * distribution is independent of the chain state, so the promo-count law is
 *
 *   P(promos = p) = sum_j sum_{c,g} frames[j][c,g,p] * (cdf_j - cdf_{j+1})
 */
function analyticPromo(maxPulls, { q = Q_BY_COUNTER, startPity = 0, crCounter = 1, guaranteed = false } = {}) {
  const maxEvents = Math.min(maxPulls, Math.ceil(maxPulls / 25) + 12);
  const { frames, idx } = promoEventChain(maxEvents, q, crCounter, guaranteed);

  // Only the FIRST 5★ is affected by the pity already carried; every later one
  // waits on a fresh pity counter. Convolving the carried-pity wait in for all
  // of them would make the second and later events arrive far too early.
  const firstWait = waitDistribution(PUB.fiveRate, MAX_PITY, startPity);
  const freshWait = waitDistribution(PUB.fiveRate, MAX_PITY, 0);
  const times = [new Float64Array(maxPulls + 1)];
  times[0][0] = 1;
  for (let j = 1; j <= maxEvents + 1; j++) {
    times.push(convolve(times[j - 1], j === 1 ? firstWait : freshWait, maxPulls));
  }
  const cdf = times.map((d) => cdfAt(d, maxPulls));

  // P(pull n is a 5★) -- the renewal density. Event times are strictly
  // increasing, so at most one event index can land on any given pull.
  const renewalDensity = new Float64Array(maxPulls + 1);
  for (let j = 1; j <= maxEvents; j++) {
    const d = times[j];
    for (let n = 1; n <= maxPulls; n++) renewalDensity[n] += d[n];
  }

  const promoExact = new Float64Array(maxEvents + 1);
  for (let j = 0; j <= maxEvents; j++) {
    const delta = Math.max(0, cdf[j] - cdf[j + 1]);
    if (delta === 0) continue;
    const dist = frames[j];
    for (let c = 0; c < 4; c++) {
      for (let g = 0; g < 2; g++) {
        for (let p = 0; p <= j; p++) {
          const m = dist[idx(c, g, p)];
          if (m !== 0) promoExact[p] += m * delta;
        }
      }
    }
  }

  const atLeast = {};
  for (let k = 1; k <= MAX_COPIES; k++) {
    let s = 0;
    for (let p = k; p <= maxEvents; p++) s += promoExact[p];
    atLeast[k] = s;
  }

  const promoTail = new Float64Array(8);
  let expectedPromos = 0;
  for (let p = 0; p <= maxEvents; p++) {
    expectedPromos += p * promoExact[p];
    for (let t = 0; t < 8; t++) promoTail[t] += promoExact[p] * Math.max(p - t, 0);
  }

  // E[#5★ by N] = sum_j P(at least j events happened by N).
  let expectedFiveStars = 0;
  for (let j = 1; j <= maxEvents; j++) expectedFiveStars += cdf[j];

  return {
    atLeast,
    promoExact,
    expectedPromos,
    expectedFiveStars,
    promoTail,
    renewalDensity,
    maxEvents,
    // Mass the truncation at maxEvents could have dropped.
    truncationResidual: cdf[maxEvents + 1],
    totalMass: Array.from(promoExact).reduce((a, b) => a + b, 0),
  };
}

/**
 * Method C for the 4★ process: a two-state alternating renewal.
 *   F[n] = P(a featured 4★ lands exactly on pull n)
 *   G[n] = P(a non-featured 4★ lands exactly on pull n)
 * The state entering a 4★ is "free" when the previous 4★ was featured (or this
 * is the first one) and "guaranteed" when the previous one was not.
 */
function analyticFourStar(maxPulls, { startPity = 0, guaranteed = false } = {}) {
  const w4 = waitDistribution(PUB.fourRate, FOUR_STAR_PITY, startPity);
  const F = new Float64Array(maxPulls + 1);
  const G = new Float64Array(maxPulls + 1);
  for (let n = 1; n <= maxPulls; n++) {
    let f = 0;
    let g = 0;
    for (let k = 1; k <= Math.min(n, FOUR_STAR_PITY); k++) {
      const w = w4[k];
      if (w === 0) continue;
      if (n - k === 0) {
        const feat = guaranteed ? 1 : PUB.featuredFourChance;
        f += w * feat;
        g += w * (1 - feat);
      } else {
        f += w * (F[n - k] * PUB.featuredFourChance + G[n - k]);
        g += w * (F[n - k] * PUB.featuredFourChance);
      }
    }
    F[n] = f;
    G[n] = g;
  }
  return { F, G };
}

/** Method C for the whole economy: expected Stardust and Starglitter. */
function analyticEconomy(wishes, { roster, startState = {} } = {}) {
  const promo = analyticPromo(wishes, {
    startPity: startState.startingFivePity ?? 0,
    crCounter: startState.crCounter ?? 1,
    guaranteed: startState.guaranteed ?? false,
  });
  const { F, G } = analyticFourStar(wishes, {
    startPity: startState.startingFourPity ?? 0,
    guaranteed: startState.featuredFourGuaranteed ?? false,
  });
  // `analyticPromo` already derives P(pull n is a 5★) as a by-product of the
  // event-time convolutions; it is a renewal density, not the first-wait
  // density, which matters because a pull can be a second or later 5★.
  const fiveDensity = promo.renewalDensity;

  let threeStar = 0;
  let feat4 = 0;
  let nonFeat4 = 0;
  for (let n = 1; n <= wishes; n++) {
    const notFive = 1 - fiveDensity[n];
    threeStar += notFive * (1 - F[n] - G[n]);
    feat4 += notFive * F[n];
    nonFeat4 += notFive * G[n];
  }
  const std4Char = nonFeat4 * PUB.standardCharShare;
  const std4Weapon = nonFeat4 * (1 - PUB.standardCharShare);
  const std5 = promo.expectedFiveStars - promo.expectedPromos;

  const rate = (list, group, stars) =>
    list.reduce((acc, name) => acc + pubGlitter(stars, group[name] ?? NOT_OWNED), 0) /
    list.length;

  const featuredRate = rate(FEATURED, roster.fourStar, 4);
  const std4CharRate = rate(FOUR_STAR_CHARACTER_NAMES, roster.fourStar, 4);
  const std5Rate = rate(STANDARD_FIVE_STAR_NAMES, roster.fiveStar, 5);

  // Price the promo copies straight off the promo-count law.
  let promoGlitter = 0;
  for (let p = 0; p <= promo.maxEvents; p++) {
    if (promo.promoExact[p] === 0) continue;
    promoGlitter += promo.promoExact[p] * pubPromoGlitter(p, roster.promoFiveCopies ?? 0);
  }

  const stardust = PUB.stardustPerThreeStar * threeStar;
  const starglitter =
    featuredRate * feat4 +
    std4CharRate * std4Char +
    pubGlitter(4, 0) * std4Weapon +
    promoGlitter +
    std5Rate * std5;

  return {
    stardust,
    starglitter,
    counts: {
      threeStar,
      feat4,
      std4Char,
      std4Weapon,
      promos: promo.expectedPromos,
      std5,
      fiveStars: promo.expectedFiveStars,
    },
    breakdown: {
      featured: featuredRate * feat4,
      std4Char: std4CharRate * std4Char,
      std4Weapon: pubGlitter(4, 0) * std4Weapon,
      promo: promoGlitter,
      std5: std5Rate * std5,
    },
    promo,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('A: the published inputs are what src/ implements', () => {
  it('the 5★ rate curve matches the wiki table pull by pull', () => {
    for (let p = 1; p <= 90; p++) {
      expect(fiveStarRate(p), `pity ${p}`).toBeCloseTo(PUB.fiveRate(p), 12);
    }
  });

  it('the 4★ rate curve matches the wiki table pull by pull', () => {
    for (let p = 1; p <= 10; p++) {
      expect(fourStarRate(p), `pity ${p}`).toBeCloseTo(PUB.fourRate(p), 12);
    }
  });

  it('the money constants match Paimon’s Bargains', () => {
    expect(STARDUST_PER_THREE_STAR).toBe(PUB.stardustPerThreeStar);
    expect(STARDUST_PER_FATE).toBe(PUB.stardustPerFate);
    expect(STARGLITTER_PER_FATE).toBe(PUB.starglitterPerFate);
  });

  it('reproduces the consolidated rates the wiki publishes', () => {
    // Mean wait = sum of the survival function (renewal identity).
    let survive = 1;
    let mean5 = 0;
    for (let p = 1; p <= MAX_PITY; p++) {
      mean5 += survive;
      survive *= 1 - PUB.fiveRate(p);
    }
    expect(1 / mean5).toBeCloseTo(0.016, 3); // official 1.6%
    expect(1 / mean5).toBeCloseTo(0.016052, 5); // community 1.6052%

    survive = 1;
    let mean4 = 0;
    for (let p = 1; p <= FOUR_STAR_PITY; p++) {
      mean4 += survive;
      survive *= 1 - PUB.fourRate(p);
    }
    expect(1 / mean4).toBeGreaterThan(0.13); // official 13%
    expect(1 / mean4).toBeLessThan(0.131);

    // 3★ takes whatever is left, and must land on the published 85.4%.
    expect(1 - 1 / mean5 - 1 / mean4).toBeGreaterThan(0.853);
    expect(1 - 1 / mean5 - 1 / mean4).toBeLessThan(0.855);
  });

  it('the Capturing Radiance model averages to the published 55%', () => {
    const q = Q_BY_COUNTER;
    // Stationary law of the loss counter under the shipped transition rule:
    //   π0 = 0.5π0 + 0.5π1  ->  π1 = π0
    //   π2 = 0.5π1
    //   π3 = 0.5(1 - q2)π2
    const pi0 = 1 / (2.75 - 0.25 * q[2]);
    const pi1 = pi0;
    const pi2 = 0.5 * pi1;
    const pi3 = 0.5 * (1 - q[2]) * pi2;
    expect(pi0 + pi1 + pi2 + pi3).toBeCloseTo(1, 12);
    const win = 0.5 * pi0 + 0.5 * pi1 + (0.5 + 0.5 * q[2]) * pi2 + 1 * pi3;
    expect(win).toBeCloseTo(0.55, 12);

    // Third route to the same number: play the 50/50 out and count.
    const rng = mulberry32(20240911);
    let c = 1;
    let wins = 0;
    const EVENTS = 4_000_000;
    for (let i = 0; i < EVENTS; i++) {
      const pw = q[c] + (1 - q[c]) * 0.5;
      if (rng() < pw) {
        wins++;
        c = c <= 1 ? 0 : 1;
      } else {
        c = Math.min(c + 1, 3);
      }
    }
    expect(wins / EVENTS).toBeCloseTo(0.55, 3);

    // The promo share of ALL 5★ events is a *different* number: 20/29, once
    // the loss-guarantee is folded in. Kept explicit so the two figures are
    // never conflated.
    expect(20 / 29).toBeCloseTo(0.6897, 4);
  });
});

describe('B + C: constellation probabilities agree three ways', () => {
  const CASES = [
    { label: 'fresh banner @ 180', wishes: 180, startState: {}, trials: 60_000 },
    { label: 'fresh banner @ 540', wishes: 540, startState: {}, trials: 25_000 },
    {
      label: 'pity 60 + guaranteed @ 180',
      wishes: 180,
      startState: { startingFivePity: 60, guaranteed: true },
      trials: 60_000,
    },
  ];

  for (const { label, wishes, startState, trials } of CASES) {
    it(`${label}: DP = analytic = Monte Carlo`, () => {
      const dp = computeCurves(wishes, {
        startingPity: startState.startingFivePity ?? 0,
        guarantee: startState.guaranteed ? 1 : 0,
        crCounter: startState.crCounter ?? 1,
      });
      const analytic = analyticPromo(wishes, {
        startPity: startState.startingFivePity ?? 0,
        crCounter: startState.crCounter ?? 1,
        guaranteed: startState.guaranteed ?? false,
      });
      const mc = mcRun({ wishes, trials, seed: 777, startState, roster: defaultRoster() });

      expect(analytic.truncationResidual, `${label} truncation`).toBeLessThan(1e-12);

      for (let k = 1; k <= MAX_COPIES; k++) {
        const a = dp.atLeast[k][wishes];
        expect(analytic.atLeast[k], `${label} k=${k}: analytic vs DP`).toBeCloseTo(a, 9);
        // A fixed trial count cannot resolve a probability much below 1/trials,
        // so allow for that resolution floor alongside the 5-sigma band.
        expect(
          Math.abs(mc.atLeast[k].p - a),
          `${label} k=${k}: MC ${mc.atLeast[k].p} vs DP ${a} (se ${mc.atLeast[k].se})`
        ).toBeLessThan(5 * mc.atLeast[k].se + 6 / trials);
      }

      // E[#5★] and E[promos] are two more routes through the same chain, here
      // against the economy engine's own step-by-step marginals.
      const reward = computeRewardCurves(wishes, {
        startingFivePity: startState.startingFivePity ?? 0,
        guaranteed: startState.guaranteed ?? false,
        crCounter: startState.crCounter ?? 1,
      });
      expect(analytic.expectedFiveStars).toBeCloseTo(reward.fiveStar[wishes], 6);
      expect(analytic.expectedPromos).toBeCloseTo(reward.promoFiveStar[wishes], 6);

      // The DP caps copies at MAX_COPIES, so summing its tails gives
      // E[min(promos, MAX_COPIES)] -- which must never exceed E[promos] and
      // must equal it while the cap cannot bind.
      const capped = Array.from(
        { length: MAX_COPIES },
        (_, i) => dp.atLeast[i + 1][wishes]
      ).reduce((s, v) => s + v, 0);
      expect(capped).toBeLessThanOrEqual(analytic.expectedPromos + 1e-9);
      expect(analytic.totalMass).toBeCloseTo(1, 9);
    });
  }
});

describe('B + C: Stardust and Starglitter agree three ways', () => {
  const CASES = [
    { label: 'fresh, 300 wishes, C0 roster', wishes: 300, seed: 11 },
    { label: 'fresh, 600 wishes, C0 roster', wishes: 600, seed: 12 },
    {
      label: 'mid-pity + guarantee, 400 wishes, C0 roster',
      wishes: 400,
      seed: 13,
      startState: { startingFivePity: 55, guaranteed: true },
    },
  ];

  for (const { label, wishes, seed, startState = {} } of CASES) {
    it(`${label}: exact = analytic = Monte Carlo`, () => {
      const roster = defaultRoster();
      const curves = computeRewardCurves(wishes, {
        startingFivePity: startState.startingFivePity ?? 0,
        guaranteed: startState.guaranteed ?? false,
        crCounter: startState.crCounter ?? 1,
      });
      const shipped = rewardsAt(curves, wishes, roster, FEATURED);
      const analytic = analyticEconomy(wishes, { roster, startState });
      const mc = mcRun({ wishes, trials: 20_000, seed, roster, startState });

      // --- Method A vs Method C (both exact) ----------------------------
      expect(analytic.stardust).toBeCloseTo(shipped.stardust, 6);
      expect(analytic.starglitter).toBeCloseTo(shipped.starglitter, 6);
      expect(analytic.counts.threeStar).toBeCloseTo(shipped.counts.threeStar, 6);
      expect(analytic.counts.feat4).toBeCloseTo(shipped.counts.fourStarFeatured, 6);
      expect(analytic.counts.std4Char).toBeCloseTo(shipped.counts.fourStarCharacter, 6);
      expect(analytic.counts.std4Weapon).toBeCloseTo(shipped.counts.fourStarWeapon, 6);
      expect(analytic.counts.promos).toBeCloseTo(shipped.counts.promos, 6);
      expect(analytic.counts.fiveStars).toBeCloseTo(shipped.counts.fiveStar, 6);
      expect(analytic.breakdown.promo).toBeCloseTo(shipped.breakdown.glitterPromoFive, 6);
      expect(analytic.breakdown.std5).toBeCloseTo(shipped.breakdown.glitterStandardFive, 6);
      expect(analytic.breakdown.featured).toBeCloseTo(shipped.breakdown.glitterFeatured, 6);
      expect(analytic.breakdown.std4Char).toBeCloseTo(shipped.breakdown.glitterFourStarChar, 6);
      expect(analytic.breakdown.std4Weapon).toBeCloseTo(shipped.breakdown.glitterFourStarWeapon, 6);

      // The P(promos >= t) tails are what the C6 Starglitter tier is built on.
      for (let t = 0; t <= 7; t++) {
        expect(analytic.promo.promoTail[t], `${label} promoTail[${t}]`).toBeCloseTo(
          curves.promoTail[t][wishes],
          6
        );
      }

      // --- Method B vs Method A (Monte Carlo) ----------------------------
      const exactOf = {
        stardust: shipped.stardust,
        glitter: shipped.starglitter,
        threeStar: shipped.counts.threeStar,
        feat4: shipped.counts.fourStarFeatured,
        promos: shipped.counts.promos,
        fiveStars: shipped.counts.fiveStar,
        std5: shipped.counts.standardFiveStars,
        std4Char: shipped.counts.fourStarCharacter,
        std4Weapon: shipped.counts.fourStarWeapon,
      };
      for (const [key, exact] of Object.entries(exactOf)) {
        expect(
          Math.abs(mc.mean[key] - exact),
          `${label}: MC ${key} ${mc.mean[key]} vs exact ${exact} (se ${mc.se[key]})`
        ).toBeLessThan(5 * mc.se[key] + 1e-9);
      }

      // The per-pull probability of a 5★ is a renewal density, and the economy
      // engine accumulates it step by step -- a direct check of that too.
      for (const n of [1, 30, 90, 200]) {
        if (n > wishes) continue;
        expect(
          analytic.promo.renewalDensity[n],
          `${label} P(5★ at pull ${n})`
        ).toBeCloseTo(curves.fiveStar[n] - curves.fiveStar[n - 1], 9);
      }
    });
  }

  it('an owned limited 5★ shifts the C6 tier exactly as the table says', () => {
    const wishes = 400;
    const curves = computeRewardCurves(wishes);
    for (const owned of [0, 1, 3, 6, 7]) {
      const roster = { ...defaultRoster(), promoFiveCopies: owned };
      const shipped = rewardsAt(curves, wishes, roster, FEATURED);
      const analytic = analyticEconomy(wishes, { roster });
      expect(analytic.breakdown.promo, `owned=${owned}`).toBeCloseTo(
        shipped.breakdown.glitterPromoFive,
        6
      );
    }
  });
});

describe('B + C: the extra-wishes fixed point', () => {
  it('converges to the unique solution, confirmed by a scan', () => {
    const roster = defaultRoster();
    const wishes = 600;
    const curves = computeRewardCurves(1600);
    const glitterAt = (n) => rewardsAt(curves, n, roster, FEATURED).starglitter;

    // The shipped fixed-point iteration, exactly as economyReport runs it.
    let total = wishes;
    for (let i = 0; i < 24; i++) {
      const next = wishes + glitterAt(total) / STARGLITTER_PER_FATE;
      if (Math.abs(next - total) < 1e-9) {
        total = next;
        break;
      }
      total = next;
    }
    // It must actually satisfy the equation it claims to.
    expect(total - wishes - glitterAt(total) / STARGLITTER_PER_FATE).toBeCloseTo(0, 6);

    // Independent confirmation: h(k) = k - wishes - S(k)/5 is increasing, so
    // scan for its sign change and require it to be where the iteration landed.
    const h = (k) => k - wishes - glitterAt(k) / STARGLITTER_PER_FATE;
    let crossing = null;
    for (let k = wishes; k <= wishes + 400; k++) {
      if (h(k) >= 0) {
        crossing = k;
        break;
      }
    }
    expect(crossing).not.toBeNull();
    expect(h(crossing - 1)).toBeLessThan(0);
    expect(Math.abs(total - (crossing - 1))).toBeLessThanOrEqual(1.5);

    // Method C reproduces the same Starglitter scale on the way through.
    expect(analyticEconomy(wishes, { roster }).starglitter).toBeCloseTo(glitterAt(wishes), 6);
  });
});

describe('C: the hard guarantee, re-derived forwards', () => {
  /**
   * Forward min-promo DP: the fewest promos any adversarial branch sequence of
   * length J can possibly leave you with. The hard guarantee is the smallest J
   * for which that minimum reaches k — the mirror image of the shipped
   * backward "max events needed" recursion.
   */
  function minPromosInEvents(J, c0, g0, q) {
    const INF = Number.POSITIVE_INFINITY;
    let cur = new Map([[`${c0},${g0}`, 0]]);
    for (let step = 0; step < J; step++) {
      const next = new Map();
      for (const [key, v] of cur) {
        const [c, g] = key.split(',').map(Number);
        const push = (nc, ng, gain) => {
          const k = `${nc},${ng}`;
          const prev = next.has(k) ? next.get(k) : INF;
          next.set(k, Math.min(prev, v + gain));
        };
        if (g === 1) {
          push(c, 0, 1);
        } else {
          const pw = q[c] + (1 - q[c]) * 0.5;
          if (pw > 0) push(c <= 1 ? 0 : 1, 0, 1);
          if (pw < 1) push(Math.min(c + 1, 3), 1, 0);
        }
      }
      cur = next;
    }
    return Math.min(...cur.values());
  }

  function bruteForceEvents(copies, c0, g0) {
    for (let J = copies; J <= 40; J++) {
      if (minPromosInEvents(J, c0, g0, Q_BY_COUNTER) >= copies) return J;
    }
    throw new Error('no bound found');
  }

  const STATES = [
    { crCounter: 1, guaranteed: false },
    { crCounter: 0, guaranteed: false },
    { crCounter: 2, guaranteed: false },
    { crCounter: 3, guaranteed: false },
    { crCounter: 1, guaranteed: true },
    { crCounter: 0, guaranteed: true },
    { crCounter: 3, guaranteed: true },
  ];

  it('matches an exhaustive forward search in every counter/guarantee state', () => {
    for (const s of STATES) {
      for (let k = 1; k <= MAX_COPIES; k++) {
        expect(
          worstCaseFiveStarEvents(k, s),
          `k=${k} ${JSON.stringify(s)}`
        ).toBe(bruteForceEvents(k, s.crCounter, s.guaranteed ? 1 : 0));
      }
    }
  });

  it('pull counts are events x 90 minus the pity you already carry', () => {
    for (const s of STATES) {
      for (let k = 1; k <= MAX_COPIES; k++) {
        const events = worstCaseFiveStarEvents(k, s);
        for (const startingPity of [0, 37, 89]) {
          expect(worstCasePullsForCopies(k, { ...s, startingPity })).toBe(
            events * MAX_PITY - startingPity
          );
        }
      }
    }
  });

  it('reproduces the community’s familiar fresh-banner numbers', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((k) => worstCasePullsForCopies(k))).toEqual([
      180, 360, 450, 630, 810, 900, 1080,
    ]);
  });
});
