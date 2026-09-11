import { worstCasePullsForCopies } from './probability.js';

// Probability formatter that NEVER shows "100.00%" unless we're at a true
// hard guarantee. The math can give 0.9999999999999992 from floating point
// or genuinely close-to-1 values that should not be misrepresented as
// certainty.
//
// Hard guarantee thresholds (default state: fresh banner, CR counter = 1):
//   - P(any 5★) is exactly 1 at wish 90 (hard pity).
//   - P(reach k copies) is exactly 1 at the hardest possible path through
//     the Capturing Radiance chain. From counter=1, the maximum-pulls path
//     is `L,G | L,G | forced CR-W` repeating — 3 promos per "macro" in
//     5 5★ events × 90 = 450 pulls. Trailing partial macro: each leftover
//     promo is at most 1 more L,G = 180 pulls.
//
// So for copies n: hardWish(n) = floor(n/3)*450 + (n%3)*180.
//   n=1 (C0): 180     n=5 (C4): 810
//   n=2 (C1): 360     n=6 (C5): 900
//   n=3 (C2): 450     n=7 (C6): 1080
//   n=4 (C3): 630
//
// Without CR, this would naively be n*180; CR caps consecutive losses at 2
// (from c=1) before forcing a W, which costs only 90 instead of 180,
// shortening the worst case for C2 and beyond.
//
// If you pass the banner state you are really on, the threshold shrinks:
// `startingFivePity` is credited to the first 5★, an existing guarantee makes
// the first 5★ a free promo, and a higher CR counter caps the losses the
// adversary can string together. `probability.js` solves that exactly (see
// worstCasePullsForCopies) instead of using the closed form above.
export function hardGuaranteeWishForCopies(copies, startState = {}) {
  if (copies <= 0) return 0;
  return worstCasePullsForCopies(copies, {
    startingPity: startState.startingFivePity ?? 0,
    crCounter: startState.crCounter ?? 1,
    guaranteed: Boolean(startState.guaranteed),
  });
}

// `hard` = caller has determined the displayed value represents a true hard
// guarantee (i.e., wishes >= the threshold). Only then do we show 100%.
export function formatProb(p, hard = false) {
  if (hard) return '100.00%';
  if (p === 0) return '0.00%';

  if (p >= 0.9999) {
    // We're very close to 1 but NOT at hard guarantee — show enough precision
    // that the value can be visually distinguished from 100%.
    const epsilon = Math.max(1 - p, Number.EPSILON);
    if (epsilon < 1e-12) {
      // At the limit of double precision. Show a bound rather than risk
      // displaying spurious digits.
      return '>99.9999999999%';
    }
    // Enough decimal places to expose the leading non-9 digit of (1 - p).
    // Round (not ceil/floor) so floating-point noise in epsilon doesn't
    // give us spurious extra precision.
    const nines = Math.round(-Math.log10(epsilon));
    const decimals = Math.min(11, nines + 1);
    return (p * 100).toFixed(decimals) + '%';
  }

  if (p < 0.005) {
    // Small probabilities — 2 decimals would round to 0.00%, which is
    // misleading. Use 4 decimals, or scientific notation for very tiny.
    if (p < 1e-6) return (p * 100).toExponential(2) + '%';
    return (p * 100).toFixed(4) + '%';
  }

  return (p * 100).toFixed(2) + '%';
}
