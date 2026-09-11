// Genshin pull probability engine.
//
// Pure-math Markov chain over the state
//   (pity 1..90) x (guarantee 0/1) x (cr 0..3) x (copies 0..MAX_COPIES)
// MAX_COPIES = 7 (C6 = 7 copies of the limited 5-star).
//
// We track the full probability distribution as a Float64Array indexed by
// flatIndex(pity, guar, cr, copies) and apply one transition per "pull".
//
// All rates are derived from official wish details + the community
// soft-pity model (bilibili 9.45M-wish estimation, cited by the wiki):
//   - Base 5* rate: 0.6%/pull on pity 1..73 (official)
//   - Soft pity ramp: 0.6% + (X-73)*6% for pity 74..89 (community model,
//     6.6% at 74 ... 18.6% at 76 ... 42.6% at 80 ... 96.6% at 89). This
//     reproduces the official 1.6% consolidated rate.
//   - Hard pity at pull 90: 100% (official)
//   - On a 5* on the limited banner:
//       * if guarantee=1 -> automatically the promo character (official)
//       * else 50/50 base, with Capturing Radiance boost q_c at counter c:
//           q_0 = 0, q_1 = 0, q_2 = 1/11, q_3 = 1
//         q_2 is NOT published by HoYoverse; it is reverse-engineered so the
//         effective win rate of a non-guaranteed 50/50 averages exactly the
//         official 55%. Note the promo share of ALL 5* events is ~69% -- the
//         55% figure only describes the non-guaranteed branch.
//   - Counter transitions on a 50/50 event:
//       * win  at c=0 -> 0
//       * win  at c=1 -> 0
//       * win  at c>=2 -> 1   (incl. CR-triggered wins)
//       * loss        -> c+1
//   - Counter does NOT change on a guaranteed (post-loss) promo.
// NOTE: the counter's shape/start value is a community model. HoYoverse has
// never published a counter state diagram -- only the 0.018% base trigger
// chance and the "3 consecutive second-5* -> next is guaranteed" rule.

export const MAX_PITY = 90;
export const MAX_COPIES = 7; // 1 = C0, 7 = C6
export const COUNTER_MAX = 3;

// q_c: probability that Capturing Radiance triggers at counter=c on a 50/50 event.
// q_2 = 1/11 makes the average effective win rate of a non-guaranteed 50/50
// exactly 55% (the official "consolidated probability of 55.000%").
//
// This is a reverse-engineered model, not official: HoYoverse only publishes
// the 0.018% base trigger rate and the "second 5* three times in a row"
// guarantee rule. Do not present q_2 as a published number.
export const Q_BY_COUNTER = [0, 0, 1 / 11, 1];

// Per-pull P(get a 5*) given current pity (1-indexed).
//
// Community model based on 9.45M wishes (bilibili), cited by the wiki:
//   - Pity 1..73:  0.6% (official base rate)
//   - Pity 74..89: 0.6% + (X - 73) * 6%  -> 6.6% at 74, 18.6% at 76,
//                  42.6% at 80, 96.6% at 89
//   - Pity 90:     100% (official hard pity)
//
// This curve reproduces the official "average rate including pity" of 1.6%
// (the community estimate is 1.6052%) and the empirically observed soft-pity
// knee at 74. Do NOT describe this as fitted to a "1B+ pull dataset" -- no
// such public dataset exists.
const SOFT_PITY_START = 74; // first pity with an elevated rate
const SOFT_PITY_BASE = 0.006; // official base rate
const SOFT_PITY_STEP = 0.06; // +6 percentage points per pull after 73
export function fiveStarRate(pity) {
  if (pity >= MAX_PITY) return 1;
  if (pity < SOFT_PITY_START) return SOFT_PITY_BASE;
  return Math.min(1, SOFT_PITY_BASE + (pity - 73) * SOFT_PITY_STEP);
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
// guarantee=0, cr=1 (post-5.0 community baseline), copies=0.
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

// ---------------------------------------------------------------------------
// Worst case (hard guarantee)
// ---------------------------------------------------------------------------
// The fewest 5★ EVENTS that can possibly yield `copies` promotional copies,
// under the adversarial path through every 50/50 / guarantee / Capturing
// Radiance branch. Each event costs at most 90 pulls, so the pull count is
// events * 90 minus whatever pity you already carry.
//
// Why not just multiply: each loss costs an extra 5★ event (the lost 50/50)
// AND hands you a guarantee, and a guaranteed win leaves the CR counter
// untouched. So the adversary's optimal play is to lose as many 50/50s in a
// row as the counter allows, saving the counter for later — from counter 1
// that is `L,G | L,G | forced-W` = 5 events for 3 promos (450 pulls).
//
// DP over (promos needed, counter, guarantee). A loss is only available while
// q < 1, i.e. counter < COUNTER_MAX; at COUNTER_MAX the win is forced.
const worstCaseMemo = new Map();
export function worstCaseFiveStarEvents(
  copies,
  { crCounter = 1, guaranteed = false } = {}
) {
  if (copies <= 0) return 0;
  const c0 = Math.max(0, Math.min(COUNTER_MAX, crCounter));
  const solve = (m, c, g) => {
    if (m <= 0) return 0;
    const key = (m * CR_DIM + c) * 2 + g;
    const hit = worstCaseMemo.get(key);
    if (hit !== undefined) return hit;
    let best;
    if (g === 1) {
      // Guaranteed promo. The counter does not change.
      best = 1 + solve(m - 1, c, 0);
    } else {
      // Win: promo for one event, counter resets (0 from c<=1, else 1).
      const win = 1 + solve(m - 1, c <= 1 ? 0 : 1, 0);
      // Loss: no promo, counter +1, and the next 5★ is guaranteed.
      const loss = c < COUNTER_MAX ? 1 + solve(m, c + 1, 1) : -Infinity;
      best = Math.max(win, loss);
    }
    worstCaseMemo.set(key, best);
    return best;
  };
  return solve(copies, c0, guaranteed ? 1 : 0);
}

// Pulls at which `copies` promo copies become CERTAIN, from the given banner
// state. `startingPity` is the number of consecutive non-5★ pulls you have
// already made, so the first 5★ costs at most (90 - startingPity) pulls.
export function worstCasePullsForCopies(
  copies,
  { startingPity = 0, crCounter = 1, guaranteed = false } = {}
) {
  if (copies <= 0) return 0;
  const events = worstCaseFiveStarEvents(copies, { crCounter, guaranteed });
  const credit = Math.max(0, Math.min(startingPity, MAX_PITY - 1));
  return events * MAX_PITY - credit;
}

// q array representing the pre-5.0 system: no Capturing Radiance at all.
// Counter still tracks losses (for parity), but no probabilistic boost at
// counter=2 and no forced win at counter=3.
export const Q_BY_COUNTER_NO_CR = [0, 0, 0, 0];

// Only ONE Capturing Radiance model is shipped deliberately. An earlier
// version also offered the widely-quoted "75/25" heuristic (q₂ = 50%), and it
// was removed because it does not reproduce the figure HoYoverse actually
// published:
//
//   q₂       per-50/50 win at c=2   long-run win rate of a non-guaranteed 5★
//   1/11     54.55%                 55.00%   <- matches the published 55.000%
//   1/2      75.00%                 57.14%   <- "75/25", ~2.1pp too high
//
// The right-hand column is the quantity the official text describes: "when
// winning a 5-star character in the event wish, there is a consolidated
// probability of 55% it will be the promotional character" — with the 50/50
// read as "55/45" once CR is folded in. It is computed over the stationary
// distribution of the loss counter, and q₂ = 1/11 is the unique value that
// makes it land on 55.00%. The 75/25 variant pushes it to 57.14%, so it would
// overstate your odds; two other framings of the same mechanic (a flat 10%
// rescue after any loss, and 55/45 listed only for the second loss) both land
// within 0.05pp of 55% and are therefore indistinguishable from this one here.
//
// For reference, under the same accounting the pre-5.0 system gives 50.00%,
// and the promotional share of ALL 5★ events is 68.97% — the 55% figure only
// ever described the non-guaranteed branch.
export const CR_MODEL = {
  id: 'official',
  label: 'Back-solved from the published 55%',
  short: 'q₂ = 1/11 ≈ 9.09%',
  q: Q_BY_COUNTER,
  summary:
    'CR rescues a lost 50/50 about 9% of the time at counter 2, which makes ' +
    'the long-run win rate of a non-guaranteed 5★ exactly the 55.000% ' +
    'HoYoverse published. HoYoverse has never published q₂ itself, so this ' +
    'value is inferred from that headline number rather than measured.',
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
