// Masterless Stardust / Masterless Starglitter economy model.
//
// Answers: "if I make N wishes on a Character Event Wish, how much Stardust
// and Starglitter do I get back, and how many extra wishes can I buy?"
//
// ---------------------------------------------------------------------------
// PUBLISHED RULES (verified against the Genshin Impact Wiki, which cites
// HoYoverse's in-game "Details" text)
// ---------------------------------------------------------------------------
// Masterless Stardust:
//   15 per 3★ weapon. Nothing for 4★/5★ pulls. Spent at 75 Stardust per
//   Intertwined/Acquaint Fate, limit 5 each per month in Paimon's Bargains.
// Masterless Starglitter (awards the item OR glitter, never both):
//   4★ weapon                      -> 2
//   5★ weapon                      -> 10
//   4★ character, not owned        -> 0   (you get the character)
//   4★ character, owned, < C6      -> 2
//   4★ character, owned at C6      -> 5
//   5★ character, not owned        -> 0
//   5★ character, owned, < C6      -> 10
//   5★ character, owned at C6      -> 25
//   Spent at 5 Starglitter per Intertwined/Acquaint Fate, limit 5 each per
//   month.
//
// Wish rates on the Character Event Wish:
//   5★      0.6% base / 1.6% incl. pity, hard pity 90, no 5★ weapons in pool
//   4★      5.1% base / 13% incl. pity, guarantee within 10 wishes
//   3★      94.3% base / 85.4% incl. pity
//   ﹣ 4★ pity curve (bilibili 9.45M-wish community estimation):
//       1..8 wishes since last 4★ -> 5.1%
//       9 wishes                  -> 56.1%
//       10 wishes                 -> 100%
//   ﹣ of every 4★ item, 50% is one of the 3 featured 4★ characters; if the
//     4★ is not featured, the next 4★ is guaranteed featured.
//   ﹣ within the non-featured (standard) 4★ portion, characters and weapons
//     have equal base rates, i.e. a 50/50 split.
//
// The 5★ and 4★ processes are independent: each wish rolls them separately,
// and -- per the official note -- obtaining a 5★ satisfies the "4★ or higher"
// guarantee without resetting the 4★ counter. That is what makes this
// analytically tractable: the 5★ pity process feeds the 4★ model only through
// the per-wish probability that the wish is a 5★.

import { MAX_PITY, fiveStarRate } from './probability.js';
import { Q_BY_COUNTER } from './probability.js';
import {
  FOUR_STAR_CHARACTER_NAMES,
  STANDARD_FIVE_STAR_NAMES,
  NOT_OWNED,
} from './data/roster.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STARDUST_PER_THREE_STAR = 15;
export const STARDUST_PER_FATE = 75;
export const STARGLITTER_PER_FATE = 5;
export const MONTHLY_FATES_PER_SOURCE = 5;

export const FOUR_STAR_BASE_RATE = 0.051;
export const FOUR_STAR_SOFT_PITY_RATE = 0.561;
export const FOUR_STAR_PITY = 10;
export const FEATURED_FOUR_STAR_CHANCE = 0.5;
// Inside the standard (non-featured) 4★ portion.
export const STANDARD_CHARACTER_SHARE = 0.5;

// 4★ pity curve: wishes since the last 4★ -> chance of a 4★ on the next wish.
export function fourStarRate(pity) {
  if (pity >= FOUR_STAR_PITY) return 1;
  if (pity === FOUR_STAR_PITY - 1) return FOUR_STAR_SOFT_PITY_RATE;
  return FOUR_STAR_BASE_RATE;
}

// Starglitter awarded for a character pull, given how many copies the player
// already owns (`constellation` = -1 when not owned).
export const GLITTER_BY_STARS = {
  4: { duplicate: 2, maxed: 5 },
  5: { duplicate: 10, maxed: 25 },
};

export function glitterForCharacter(stars, constellation) {
  if (constellation === NOT_OWNED || constellation == null) return 0;
  const table = GLITTER_BY_STARS[stars];
  return constellation >= 6 ? table.maxed : table.duplicate;
}

export function glitterForWeapon(stars) {
  return stars >= 5 ? GLITTER_BY_STARS[5].duplicate : GLITTER_BY_STARS[4].duplicate;
}

// Average Starglitter per duplicate character, given the stored roster.
export function averageGlitter(names, rosterGroup, stars) {
  if (names.length === 0) return 0;
  let sum = 0;
  for (const name of names) {
    const c = rosterGroup?.[name];
    sum += glitterForCharacter(stars, c == null ? NOT_OWNED : c);
  }
  return sum / names.length;
}

// ---------------------------------------------------------------------------
// 5★ reward chain
// ---------------------------------------------------------------------------
// State: (5★ pity 1..90) x (guarantee) x (CR counter 0..3) x (promos 0..CAP)
//
// Tracking the promo count is what lets us award the correct Starglitter: the
// 1st copy of the limited 5★ is a new character (0), copies 2..7 are
// duplicates (10), and copies 8+ arrive at C6 (25).

const COPIES_CAP = 32; // promos beyond this are lumped; ~4 sd above the mean at 1600 pulls
const COPIES_DIM = COPIES_CAP + 1;
const GUAR_DIM = 2;
const CR_DIM = 4;
const FIVE_STATE_COUNT = MAX_PITY * GUAR_DIM * CR_DIM * COPIES_DIM;

function fiveIndex(pity, guar, cr, promos) {
  return (((pity - 1) * GUAR_DIM + guar) * CR_DIM + cr) * COPIES_DIM + promos;
}

function counterAfterWin(c) {
  return c <= 1 ? 0 : 1;
}

export const MAX_ECONOMY_PULLS = 1600;

/**
 * Expected cumulative rewards for 1..maxPulls wishes.
 *
 * Returns Float64Arrays indexed by wish count (index 0 is all-zero), plus
 * `promoTail[t][n]` = E[max(promos - t, 0)] for t = 0..7, which is what turns
 * the promo-count distribution into exact C6 Starglitter.
 */
export function computeRewardCurves(maxPulls, options = {}) {
  const {
    startingFivePity = 0,
    guaranteed = false,
    crCounter = 1,
    startingFourPity = 0,
    featuredFourGuaranteed = false,
    qByCounter = Q_BY_COUNTER,
  } = options;

  const threeStar = new Float64Array(maxPulls + 1);
  const featuredFourStar = new Float64Array(maxPulls + 1);
  const standardFourStarCharacter = new Float64Array(maxPulls + 1);
  const standardFourStarWeapon = new Float64Array(maxPulls + 1);
  const fiveStar = new Float64Array(maxPulls + 1);
  const promoFiveStar = new Float64Array(maxPulls + 1);
  const standardFiveStar = new Float64Array(maxPulls + 1);
  const promoTail = [];
  for (let t = 0; t <= 7; t++) promoTail.push(new Float64Array(maxPulls + 1));

  // --- 4★ process marginals (independent of the 5★ process) ---------------
  const fourPity = fourStarPityMarginals(
    startingFourPity,
    featuredFourGuaranteed,
    maxPulls
  );

  // --- 5★ process ---------------------------------------------------------
  const startPity = Math.min(Math.max(startingFivePity, 0), MAX_PITY - 1) + 1;
  let dist = new Float64Array(FIVE_STATE_COUNT);
  dist[fiveIndex(startPity, guaranteed ? 1 : 0, crCounter, 0)] = 1;
  const marginal = new Float64Array(COPIES_DIM);

  for (let n = 1; n <= maxPulls; n++) {
    const next = new Float64Array(FIVE_STATE_COUNT);
    let expectedFiveRate = 0; // E[P(this wish is a 5★)] -- feeds the 4★ model
    let expectedPromos = 0;
    let expectedStandardFives = 0;

    for (let p = 1; p <= MAX_PITY; p++) {
      const r = fiveStarRate(p);
      const noFive = 1 - r;
      const nextPity = p < MAX_PITY ? p + 1 : MAX_PITY;
      for (let g = 0; g < GUAR_DIM; g++) {
        for (let c = 0; c < CR_DIM; c++) {
          const q = qByCounter[c] ?? 0;
          const pWin = g === 1 ? 1 : q + (1 - q) * 0.5;
          const pLoss = 1 - pWin;
          const base = (((p - 1) * GUAR_DIM + g) * CR_DIM + c) * COPIES_DIM;
          for (let k = 0; k < COPIES_DIM; k++) {
            const m = dist[base + k];
            if (m === 0) continue;
            if (noFive > 0) {
              next[fiveIndex(nextPity, g, c, k)] += m * noFive;
            }
            if (r > 0) {
              expectedFiveRate += m * r;
              const kk = k < COPIES_CAP ? k + 1 : COPIES_CAP;
              const winMass = m * r * pWin;
              next[fiveIndex(1, 0, g === 1 ? c : counterAfterWin(c), kk)] += winMass;
              expectedPromos += winMass;
              if (pLoss > 0) {
                const lossMass = m * r * pLoss;
                const nc = c < 3 ? c + 1 : 3;
                next[fiveIndex(1, 1, nc, k)] += lossMass;
                expectedStandardFives += lossMass;
              }
            }
          }
        }
      }
    }

    dist = next;
    fiveStar[n] = fiveStar[n - 1] + expectedFiveRate;
    promoFiveStar[n] = promoFiveStar[n - 1] + expectedPromos;
    standardFiveStar[n] = standardFiveStar[n - 1] + expectedStandardFives;

    // Promo-count marginal -> E[max(promos - t, 0)] for t = 0..7.
    marginal.fill(0);
    for (let i = 0; i < FIVE_STATE_COUNT; i += COPIES_DIM) {
      for (let k = 0; k < COPIES_DIM; k++) marginal[k] += dist[i + k];
    }
    for (let t = 0; t <= 7; t++) {
      let acc = 0;
      for (let j = t + 1; j < COPIES_DIM; j++) {
        // P(promos >= j)
        let tail = 0;
        for (let k = j; k < COPIES_DIM; k++) tail += marginal[k];
        acc += tail;
      }
      promoTail[t][n] = acc;
    }

    // --- 4★ process -------------------------------------------------------
    // The 4★ counter is independent of the 5★ counter, so we advance it
    // separately and weight each outcome by the chance the wish is not a 5★.
    const notFive = 1 - expectedFiveRate;
    const rollP = fourPity.roll[n];
    threeStar[n] = threeStar[n - 1] + notFive * (1 - rollP);
    featuredFourStar[n] =
      featuredFourStar[n - 1] + notFive * fourPity.featured[n];
    const nonFeatured = notFive * fourPity.nonFeatured[n];
    standardFourStarCharacter[n] =
      standardFourStarCharacter[n - 1] + nonFeatured * STANDARD_CHARACTER_SHARE;
    standardFourStarWeapon[n] =
      standardFourStarWeapon[n - 1] + nonFeatured * (1 - STANDARD_CHARACTER_SHARE);
  }

  return {
    maxPulls,
    threeStar,
    featuredFourStar,
    standardFourStarCharacter,
    standardFourStarWeapon,
    fiveStar,
    promoFiveStar,
    standardFiveStar,
    promoTail,
  };
}

// ---------------------------------------------------------------------------
// 4★ pity bookkeeping
// ---------------------------------------------------------------------------
// The 4★ counter resets only when a 4★ is actually obtained (a 5★ satisfies
// the "4★ or higher" guarantee WITHOUT resetting it), so the 4★ process is a
// tiny 2-dimension chain: (wishes since last 4★ 1..10) x (featured guarantee).

const fourMarginCache = new Map();

function fourStarPityMarginals(startingFourPity, featuredFourGuaranteed, maxPulls) {
  const key = `${startingFourPity}:${featuredFourGuaranteed}:${maxPulls}`;
  const cached = fourMarginCache.get(key);
  if (cached) return cached;

  const roll = new Float64Array(maxPulls + 1);
  const featured = new Float64Array(maxPulls + 1);
  const nonFeatured = new Float64Array(maxPulls + 1);

  const startPity =
    Math.min(Math.max(startingFourPity, 0), FOUR_STAR_PITY - 1) + 1;
  let dist = new Float64Array(FOUR_STAR_PITY * 2);
  dist[(startPity - 1) * 2 + (featuredFourGuaranteed ? 1 : 0)] = 1;

  for (let n = 1; n <= maxPulls; n++) {
    let rollP = 0;
    let featuredP = 0;
    let nonFeaturedP = 0;
    const next = new Float64Array(FOUR_STAR_PITY * 2);
    for (let p = 1; p <= FOUR_STAR_PITY; p++) {
      const r = fourStarRate(p);
      const nextPity = p < FOUR_STAR_PITY ? p + 1 : FOUR_STAR_PITY;
      for (let g = 0; g < 2; g++) {
        const m = dist[(p - 1) * 2 + g];
        if (m === 0) continue;
        rollP += m * r;
        if (m * (1 - r) > 0) next[(nextPity - 1) * 2 + g] += m * (1 - r);
        if (r > 0) {
          const feat = g === 1 ? 1 : FEATURED_FOUR_STAR_CHANCE;
          featuredP += m * r * feat;
          nonFeaturedP += m * r * (1 - feat);
          // A featured 4★ clears the guarantee; a non-featured item
          // (standard character OR weapon) sets it.
          if (feat > 0) next[(1 - 1) * 2 + 0] += m * r * feat;
          if (1 - feat > 0) next[(1 - 1) * 2 + 1] += m * r * (1 - feat);
        }
      }
    }
    dist = next;
    roll[n] = rollP;
    featured[n] = featuredP;
    nonFeatured[n] = nonFeaturedP;
  }

  const out = { roll, featured, nonFeatured };
  fourMarginCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function glitterRates(roster, featuredFour = []) {
  return {
    featured: averageGlitter(featuredFour, roster.fourStar, 4),
    standardFourStarCharacter: averageGlitter(
      FOUR_STAR_CHARACTER_NAMES,
      roster.fourStar,
      4
    ),
    standardFourStarWeapon: glitterForWeapon(4),
    standardFiveStar: averageGlitter(
      STANDARD_FIVE_STAR_NAMES,
      roster.fiveStar,
      5
    ),
  };
}

/**
 * Expected Stardust / Starglitter earned by `wishes` pulls, split by source.
 */
export function rewardsAt(curves, wishes, roster, featuredFour = []) {
  // Must be an integer index -- a fractional look-up on a Float64Array
  // returns undefined and silently poisons the whole calculation.
  const n = Math.max(0, Math.min(Math.floor(wishes), curves.maxPulls));
  const rates = glitterRates(roster, featuredFour);
  const owned = Math.max(0, Math.min(roster.promoFiveCopies ?? 0, 7));

  const n3 = curves.threeStar[n];
  const n4Featured = curves.featuredFourStar[n];
  const n4Char = curves.standardFourStarCharacter[n];
  const n4Weapon = curves.standardFourStarWeapon[n];
  const nPromo = curves.promoFiveStar[n];
  const nStandard5 = curves.standardFiveStar[n];

  const stardust = STARDUST_PER_THREE_STAR * n3;

  const glitterFeatured = rates.featured * n4Featured;
  const glitterFourStarChar = rates.standardFourStarCharacter * n4Char;
  const glitterFourStarWeapon =
    rates.standardFourStarWeapon * n4Weapon;
  // The k-th copy overall is worth 0 (k = 1), 10 (2 <= k <= 7) or 25 (k >= 8),
  // and the promo 5★ may already be owned. Writing g(k) = 10*1{k>=2} +
  // 15*1{k>=8} and summing over the copies obtained this run:
  //   copies paying 10 = max(p - 1, 0)   when nothing is owned yet
  //                    = p               otherwise
  //   copies paying 25 = max(p - (7 - ownedCopies), 0)
  const tenCopyTier = curves.promoTail[owned === 0 ? 1 : 0][n];
  const maxedCopyTier = curves.promoTail[Math.max(0, Math.min(7 - owned, 7))][n];
  const glitterPromoFive =
    GLITTER_BY_STARS[5].duplicate * tenCopyTier +
    (GLITTER_BY_STARS[5].maxed - GLITTER_BY_STARS[5].duplicate) * maxedCopyTier;
  const glitterStandardFive = rates.standardFiveStar * nStandard5;

  const starglitter =
    glitterFeatured +
    glitterFourStarChar +
    glitterFourStarWeapon +
    glitterPromoFive +
    glitterStandardFive;

  return {
    wishes: n,
    stardust,
    starglitter,
    counts: {
      threeStar: n3,
      fourStar: n4Featured + n4Char + n4Weapon,
      fourStarFeatured: n4Featured,
      fourStarCharacter: n4Char,
      fourStarWeapon: n4Weapon,
      fiveStar: curves.fiveStar[n],
      promos: nPromo,
      standardFiveStars: nStandard5,
    },
    breakdown: {
      glitterFeatured,
      glitterFourStarChar,
      glitterFourStarWeapon,
      glitterPromoFive,
      glitterStandardFive,
    },
    rates: {
      stardustPerWish: n > 0 ? stardust / n : 0,
      starglitterPerWish: n > 0 ? starglitter / n : 0,
    },
  };
}

/**
 * Full economy report for a wish count: what you earn, and how many extra
 * wishes that buys.
 *
 * ONLY Starglitter is converted into wishes (5 per Intertwined Fate). Stardust
 * is reported but deliberately NOT spent here. Its Paimon's Bargains fates are
 * a flat 5 per month no matter how much you pull, so treating it as a wish
 * refund would credit a session with wishes that do not actually scale with
 * it. Stardust therefore stays a separate, unscaled line.
 */
export function economyReport({
  wishes,
  roster,
  featuredFour = [],
  startState = {},
  maxPulls = MAX_ECONOMY_PULLS,
}) {
  const curves = getCurves(maxPulls, startState);
  const direct = rewardsAt(curves, wishes, roster, featuredFour);

  // Extra wishes bought purely by the Starglitter from these `wishes` pulls.
  const fromStarglitter = direct.starglitter / STARGLITTER_PER_FATE;

  // Those bought wishes earn Starglitter of their own, so iterate to the fixed
  // point (Stardust never enters this loop).
  let total = wishes;
  let converged = false;
  for (let i = 0; i < 24; i++) {
    const r = rewardsAt(curves, total, roster, featuredFour);
    const next = wishes + r.starglitter / STARGLITTER_PER_FATE;
    if (Math.abs(next - total) < 1e-9) {
      converged = true;
      break;
    }
    total = next;
  }
  const clamped = total > curves.maxPulls;
  if (clamped) total = curves.maxPulls;
  const selfFinanced = rewardsAt(curves, total, roster, featuredFour);

  return {
    wishes,
    direct,
    selfFinancing: {
      // From the input wishes alone -- the headline number.
      fromStarglitter,
      // Starglitter the bought wishes earn in turn, and the fixed-point total.
      totalWishes: total,
      extraWishes: total - wishes,
      final: selfFinanced,
      converged: converged && !clamped,
      clamped,
    },
  };
}

// ---------------------------------------------------------------------------
// Curve cache
// ---------------------------------------------------------------------------

const curveCache = new Map();

export function getCurves(maxPulls, startState = {}) {
  const key = [
    maxPulls,
    startState.startingFivePity ?? 0,
    startState.guaranteed ? 1 : 0,
    startState.crCounter ?? 1,
    startState.startingFourPity ?? 0,
    startState.featuredFourGuaranteed ? 1 : 0,
  ].join(':');
  const cached = curveCache.get(key);
  if (cached) return cached;
  const curves = computeRewardCurves(maxPulls, startState);
  curveCache.set(key, curves);
  return curves;
}

// ---------------------------------------------------------------------------
// Simulation (for the reward distribution / percentiles)
// ---------------------------------------------------------------------------
// The expected-value engine above is exact. This seedable Monte Carlo exists
// only to answer "how likely am I to get at least X?" questions, which need a
// distribution rather than a mean.

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function rng() {
    // xorshift32 -- deterministic across runs, good enough for percentiles.
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function promoGlitter(totalCopies) {
  if (totalCopies <= 1) return 0;
  return totalCopies >= 8 ? 25 : 10;
}

export function simulateRewards({
  wishes,
  roster,
  featuredFour = [],
  startState = {},
  trials = 4000,
  seed = 20240911,
  qByCounter = Q_BY_COUNTER,
}) {
  const rng = makeRng(seed);
  const {
    startingFivePity = 0,
    guaranteed = false,
    crCounter = 1,
    startingFourPity = 0,
    featuredFourGuaranteed = false,
  } = startState;

  const featured = featuredFour.length ? featuredFour : FOUR_STAR_CHARACTER_NAMES.slice(0, 3);
  const stdFour = FOUR_STAR_CHARACTER_NAMES;
  const stdFive = STANDARD_FIVE_STAR_NAMES;

  const stardusts = new Float64Array(trials);
  const glitters = new Float64Array(trials);
  const fiveStars = new Float64Array(trials);

  for (let t = 0; t < trials; t++) {
    let sp = Math.min(Math.max(startingFivePity, 0), MAX_PITY - 1) + 1;
    let fp = Math.min(Math.max(startingFourPity, 0), FOUR_STAR_PITY - 1) + 1;
    let guar = guaranteed ? 1 : 0;
    let cr = crCounter;
    let fourGuar = featuredFourGuaranteed ? 1 : 0;
    let copies = Math.max(0, roster.promoFiveCopies ?? 0);
    let stardust = 0;
    let glitter = 0;
    let fiveCount = 0;

    for (let w = 0; w < wishes; w++) {
      const r5 = fiveStarRate(sp);
      const r4 = fourStarRate(fp);
      const isFive = rng() < r5;
      const fourRoll = rng() < r4;

      if (isFive) {
        fiveCount++;
        if (guar === 1) {
          copies++;
          glitter += promoGlitter(copies);
          guar = 0;
        } else {
          const q = qByCounter[cr] ?? 0;
          const win = rng() < q + (1 - q) * 0.5;
          if (win) {
            copies++;
            glitter += promoGlitter(copies);
            cr = cr <= 1 ? 0 : 1;
          } else {
            const name = stdFive[Math.floor(rng() * stdFive.length)];
            glitter += glitterForCharacter(5, roster.fiveStar?.[name] ?? NOT_OWNED);
            guar = 1;
            cr = Math.min(cr + 1, 3);
          }
        }
        sp = 1;
        continue;
      }

      sp = Math.min(sp + 1, MAX_PITY);

      if (fourRoll) {
        const featuredRoll =
          fourGuar === 1 ? true : rng() < FEATURED_FOUR_STAR_CHANCE;
        if (featuredRoll) {
          const name = featured[Math.floor(rng() * featured.length)];
          glitter += glitterForCharacter(4, roster.fourStar?.[name] ?? NOT_OWNED);
          fourGuar = 0;
        } else if (rng() < STANDARD_CHARACTER_SHARE) {
          const name = stdFour[Math.floor(rng() * stdFour.length)];
          glitter += glitterForCharacter(4, roster.fourStar?.[name] ?? NOT_OWNED);
          fourGuar = 1;
        } else {
          glitter += glitterForWeapon(4);
          fourGuar = 1;
        }
        fp = 1;
      } else {
        // The only source of Masterless Stardust: a 3★ weapon.
        stardust += STARDUST_PER_THREE_STAR;
        fp = Math.min(fp + 1, FOUR_STAR_PITY);
      }
    }

    stardusts[t] = stardust;
    glitters[t] = glitter;
    fiveStars[t] = fiveCount;
  }

  const quantile = (arr, p) => {
    const sorted = Array.from(arr).sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
    return sorted[idx];
  };
  const mean = (arr) => {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  };

  return {
    trials,
    stardust: {
      mean: mean(stardusts),
      p10: quantile(stardusts, 0.1),
      p50: quantile(stardusts, 0.5),
      p90: quantile(stardusts, 0.9),
    },
    starglitter: {
      mean: mean(glitters),
      p10: quantile(glitters, 0.1),
      p50: quantile(glitters, 0.5),
      p90: quantile(glitters, 0.9),
    },
    fiveStars: { mean: mean(fiveStars) },
    probabilityOf: (minStardust, minGlitter) => {
      let hit = 0;
      for (let i = 0; i < trials; i++) {
        if (stardusts[i] >= minStardust && glitters[i] >= minGlitter) hit++;
      }
      return hit / trials;
    },
  };
}
