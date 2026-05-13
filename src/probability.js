// Genshin pull probability engine.
//
// Pure-math Markov chain over the state
//   (pity 1..90) x (guarantee 0/1) x (cr 0..3) x (copies 0..MAX_COPIES)
// MAX_COPIES = 7 (C6 = 7 copies of the limited 5-star).
//
// We track the full probability distribution as a Float64Array indexed by
// flatIndex(pity, guar, cr, copies) and apply one transition per "pull".
//
// All rates are derived from official wish details + community-reverse-engineered
// soft-pity slope:
//   - Base 5* rate: 0.6%/pull on pity 1..73 (official)
//   - Soft pity ramp: linear +6%/pull on pity 74..89 (community model that
//     reproduces the 1.6% consolidated rate in the official text)
//   - Hard pity at pull 90: 100% (official)
//   - On a 5* on the limited banner:
//       * if guarantee=1 -> automatically the promo character (official)
//       * else 50/50 base, with Capturing Radiance boost q_c at counter c:
//           q_0 = 0, q_1 = 0, q_2 = 1/11, q_3 = 1
//         where q_2 is derived analytically from the official 55%
//         consolidated promo rate (see derivation in README).
//   - Counter transitions on a 50/50 event:
//       * win  at c=0 -> 0
//       * win  at c=1 -> 0
//       * win  at c>=2 -> 1   (incl. CR-triggered wins)
//       * loss        -> c+1
//   - Counter does NOT change on a guaranteed (post-loss) promo.

export const MAX_PITY = 90;
export const MAX_COPIES = 7; // 1 = C0, 7 = C6
export const COUNTER_MAX = 3;

// q_c: probability that Capturing Radiance triggers at counter=c on a 50/50 event.
// q_2 = 1/11 makes the long-run promo rate per 50/50 event exactly 55%
// (matches the official "consolidated probability of 55.000%").
export const Q_BY_COUNTER = [0, 0, 1 / 11, 1];

// Per-pull P(get a 5*) given current pity (1-indexed).
//
// Model fit to the empirical CSV (1B+ pull simulation):
//   - Pity 1..75: base rate 0.6% (official)
//   - Pity 76:    sharp step to ~32%
//   - Pity 76..89: linear ramp from 32% to ~95%, with hard pity = 100% at 90
//   - Pity 90:    100% (official hard pity)
//
// The community sometimes models soft pity as starting at pity 74 with slope
// 6%/pull, but the CSV (and most empirical wish-tracking sites) shows a step
// at pity 76 instead. We use the step model so our outputs match the CSV's
// C0 column to within ~1pp at every wish from 1..180.
const SOFT_PITY_START = 76; // first pity with elevated rate
const SOFT_PITY_STEP = 0.32; // p at SOFT_PITY_START
const SOFT_PITY_TOP = 0.95; // p at MAX_PITY - 1 (pity 89)
export function fiveStarRate(pity) {
  if (pity >= MAX_PITY) return 1;
  if (pity < SOFT_PITY_START) return 0.006;
  const span = MAX_PITY - 1 - SOFT_PITY_START; // 89 - 76 = 13
  return Math.min(
    1,
    SOFT_PITY_STEP + (SOFT_PITY_TOP - SOFT_PITY_STEP) * (pity - SOFT_PITY_START) / span
  );
}

// Counter transition on a WIN (natural or CR-triggered).
function nextCounterOnWin(c) {
  if (c <= 1) return 0;
  return 1; // c=2 win or c=3 forced CR win
}

// State indexing.
// pity:     1..90  (0-indexed slot = pity - 1)
// guar:     0..1
// cr:       0..3
// copies:   0..MAX_COPIES (cap copies at MAX_COPIES; further wins absorb)
const PITY_DIM = MAX_PITY;
const GUAR_DIM = 2;
const CR_DIM = COUNTER_MAX + 1;
const COPIES_DIM = MAX_COPIES + 1;
export const STATE_COUNT = PITY_DIM * GUAR_DIM * CR_DIM * COPIES_DIM;

export function flatIndex(pity, guar, cr, copies) {
  const p = pity - 1;
  return (
    p * (GUAR_DIM * CR_DIM * COPIES_DIM) +
    guar * (CR_DIM * COPIES_DIM) +
    cr * COPIES_DIM +
    copies
  );
}

// Build a fresh starting distribution (1.0 mass at the given starting state).
// Default: pity=0 means "just used 0 pulls so the next pull is at pity=1".
// guarantee=0, cr=1 (post-5.0 default per official diagram), copies=0.
export function freshDistribution({
  startingPity = 0,
  guarantee = 0,
  crCounter = 1,
  copies = 0,
} = {}) {
  if (startingPity < 0 || startingPity > MAX_PITY - 1) {
    throw new Error(`startingPity out of range: ${startingPity}`);
  }
  const dist = new Float64Array(STATE_COUNT);
  // startingPity = number of consecutive non-5* pulls already done since last 5*.
  // Stored "pity" in our state = the pity counter going INTO the next pull.
  // So if you've already done N pulls without a 5*, the next pull is at pity = N+1.
  const pity = startingPity + 1;
  dist[flatIndex(pity, guarantee, crCounter, copies)] = 1;
  return dist;
}

// Apply one pull. Returns a new distribution.
//
// For each non-zero source state (p, g, c, k):
//   - With prob (1 - r), no 5*:
//       -> (min(p+1, MAX_PITY), g, c, k)   (pity advances; clamp keeps it valid)
//          (Note: pity MAX_PITY with no 5* is impossible since rate=1, so the clamp never fires.)
//   - With prob r, get a 5*. Then pity resets to 0 (next pull = pity 1):
//       If g == 1 (on guarantee from prior loss):
//         -> (1, 0, c, min(k+1, MAX_COPIES))  // counter unchanged
//       Else (50/50 with CR boost):
//         q = Q_BY_COUNTER[c]
//         pWin = q + (1 - q) * 0.5
//         pLoss = (1 - q) * 0.5
//         on win  -> (1, 0, nextCounterOnWin(c), min(k+1, MAX_COPIES))
//         on loss -> (1, 1, c + 1,                k)   // c<=2 always; c=3 path can't loss (q_3=1)
//
// Copies are capped at MAX_COPIES; once you've reached C6 the constellation
// state stays at MAX_COPIES (we still keep simulating in case the user wants
// joint stats, but for our outputs only "reach k+" is needed).
export function step(dist, qByCounter = Q_BY_COUNTER) {
  const next = new Float64Array(STATE_COUNT);
  for (let p = 1; p <= MAX_PITY; p++) {
    const r = fiveStarRate(p);
    const noFive = 1 - r;
    for (let g = 0; g < GUAR_DIM; g++) {
      for (let c = 0; c < CR_DIM; c++) {
        for (let k = 0; k < COPIES_DIM; k++) {
          const mass = dist[flatIndex(p, g, c, k)];
          if (mass === 0) continue;

          // No 5*: pity advances.
          if (noFive > 0) {
            const nextPity = Math.min(p + 1, MAX_PITY);
            next[flatIndex(nextPity, g, c, k)] += mass * noFive;
          }

          if (r > 0) {
            const newCopies = Math.min(k + 1, MAX_COPIES);
            if (g === 1) {
              // Guaranteed promo. Counter unchanged.
              next[flatIndex(1, 0, c, newCopies)] += mass * r;
            } else {
              const q = qByCounter[c];
              const pWin = q + (1 - q) * 0.5;
              const pLoss = 1 - pWin; // = (1 - q) * 0.5
              // Win
              if (pWin > 0) {
                next[flatIndex(1, 0, nextCounterOnWin(c), newCopies)] +=
                  mass * r * pWin;
              }
              // Loss (only possible if q < 1, i.e., c < 3)
              if (pLoss > 0) {
                const nextC = Math.min(c + 1, COUNTER_MAX);
                next[flatIndex(1, 1, nextC, k)] += mass * r * pLoss;
              }
            }
          }
        }
      }
    }
  }
  return next;
}

// q array representing the pre-5.0 system: no Capturing Radiance at all.
// Counter still tracks losses (for parity), but no probabilistic boost at
// counter=2 and no forced win at counter=3.
export const Q_BY_COUNTER_NO_CR = [0, 0, 0, 0];

// Community "75/25" theory for the CR mechanic: at counter=2 there's a 50%
// chance CR triggers (giving a 75% overall win at c=2). Doesn't match the
// official 55% consolidated rate (steady-state long-run promo is ~57%) but
// matches some short-run empirical observations and the community heuristic
// that "you can't lose three in a row, the third tries 75/25".
export const Q_BY_COUNTER_COMMUNITY = [0, 0, 0.5, 1];

// Catalog of available CR models, exposed to the UI.
export const CR_MODELS = {
  official: {
    id: 'official',
    label: 'Official-derived',
    short: 'q₂ ≈ 9.09%',
    q: Q_BY_COUNTER,
    pWin: 0.5455,
    summary:
      'Solves q₂ backward from HoYoverse’s announced 55% consolidated ' +
      'promo rate. Matches the published number exactly in steady state.',
  },
  community: {
    id: 'community',
    label: 'Community 75/25',
    short: 'q₂ = 50%',
    q: Q_BY_COUNTER_COMMUNITY,
    pWin: 0.75,
    summary:
      'Player-community theory: at counter 2 the game runs a 75/25 in your ' +
      'favor. Disagrees with the announced 55% (gives ~57%) but matches the ' +
      'heuristic that you can’t lose three in a row.',
  },
};

// Marginal P(copies >= k) given a distribution.
export function probCopiesAtLeast(dist, k) {
  if (k <= 0) return 1;
  if (k > MAX_COPIES) return 0;
  let s = 0;
  for (let p = 1; p <= MAX_PITY; p++) {
    for (let g = 0; g < GUAR_DIM; g++) {
      for (let c = 0; c < CR_DIM; c++) {
        for (let copies = k; copies <= MAX_COPIES; copies++) {
          s += dist[flatIndex(p, g, c, copies)];
        }
      }
    }
  }
  return s;
}

// Marginal P(copies == k).
export function probCopiesEquals(dist, k) {
  if (k < 0 || k > MAX_COPIES) return 0;
  let s = 0;
  for (let p = 1; p <= MAX_PITY; p++) {
    for (let g = 0; g < GUAR_DIM; g++) {
      for (let c = 0; c < CR_DIM; c++) {
        s += dist[flatIndex(p, g, c, k)];
      }
    }
  }
  return s;
}

// Run the chain for `maxPulls` steps and return per-step P(copies >= k) for
// all k = 1..MAX_COPIES, plus the increment-distribution P(first 5* at exactly N)
// (useful for the Explanation charts).
//
// Returns an object:
//   {
//     wishes: [0, 1, ..., maxPulls],
//     atLeast: { 1: Float64Array(maxPulls+1), ..., 7: ... },  // P(copies >= k)
//     firstFiveAt: Float64Array(maxPulls+1),                  // P(first 5* at exactly N)
//     firstPromoAt: Float64Array(maxPulls+1),                 // P(first promo at exactly N)
//   }
export function computeCurves(maxPulls, options = {}) {
  const { qByCounter = Q_BY_COUNTER, ...freshOpts } = options;
  let dist = freshDistribution(freshOpts);
  const atLeast = {};
  for (let k = 1; k <= MAX_COPIES; k++) {
    atLeast[k] = new Float64Array(maxPulls + 1);
    atLeast[k][0] = probCopiesAtLeast(dist, k);
  }
  const firstFiveAt = new Float64Array(maxPulls + 1);
  const firstPromoAt = new Float64Array(maxPulls + 1);
  // To compute "first 5*" / "first promo", track cumulative P(no 5* yet) /
  // P(no promo yet) at each step.
  // Easier: cumulative P(any 5* obtained) is 1 - P(state still has no 5*),
  // but our chain doesn't distinguish "had a 5*" from "is back to pity 1 after a 5*".
  // Trick: P(any 5* by N) = 1 - P(pity == N+1 at step N AND copies == 0 AND guar == 0 AND cr == cr0).
  // But once you've gotten any 5*, your pity drops to 1, so pity > 1 means no 5* yet.
  // Specifically pity at step N == N+1 iff no 5* has dropped yet.
  // We'll compute it directly by saving the cumulative copies>=1 (= P(any promo by N))
  // and the marginal "no 5* yet" via a separate counter.
  // Simpler: also run a parallel counter for P(any 5* by N), tracking pity > 1 means a 5* was seen
  // ... actually pity advances each non-5* pull; a 5* drops you to pity=1. So at step N (after N pulls):
  //   - "no 5* yet" iff current pity == N+1 (because we started at pity=1 with copies=0 etc.)
  // We'll record this.
  let cumAnyFive = 0;
  let cumAnyPromo = 0;

  for (let n = 1; n <= maxPulls; n++) {
    dist = step(dist, qByCounter);
    for (let k = 1; k <= MAX_COPIES; k++) {
      atLeast[k][n] = probCopiesAtLeast(dist, k);
    }
    // P(any 5* by n) = 1 - P(no 5* yet at step n)
    // No 5* yet iff current pity == n+1 AND copies == 0 AND guar == 0 AND cr unchanged from start.
    // Easier: P(no 5* yet at step n) = mass at (n+1, 0, cr0, 0) IF n+1 <= MAX_PITY,
    // else 0 (since pity caps at MAX_PITY).
    let noFiveYet = 0;
    if (n + 1 <= MAX_PITY) {
      // Sum across cr0 since we only seeded one cr0; the only un-touched state
      // is the original starting cr counter.
      for (let cr = 0; cr < CR_DIM; cr++) {
        noFiveYet += dist[flatIndex(n + 1, 0, cr, 0)];
      }
    }
    const newCumAnyFive = 1 - noFiveYet;
    firstFiveAt[n] = Math.max(0, newCumAnyFive - cumAnyFive);
    cumAnyFive = newCumAnyFive;

    const newCumAnyPromo = atLeast[1][n];
    firstPromoAt[n] = Math.max(0, newCumAnyPromo - cumAnyPromo);
    cumAnyPromo = newCumAnyPromo;
  }

  const wishes = new Array(maxPulls + 1);
  for (let i = 0; i <= maxPulls; i++) wishes[i] = i;

  return { wishes, atLeast, firstFiveAt, firstPromoAt };
}
