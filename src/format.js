// Probability formatter that NEVER shows "100.00%" unless we're at a true
// hard guarantee. The math can give 0.9999999999999992 from floating point
// or genuinely close-to-1 values that should not be misrepresented as
// certainty.
//
// Hard guarantee thresholds:
//   - P(any 5★) is exactly 1 at wish 90 (hard pity).
//   - P(reach k copies of the limited) is exactly 1 at wish k * 180
//     (worst-case sequence: lose at hard pity, guarantee at next hard pity,
//     repeat k times).

export function hardGuaranteeWishForCopies(copies) {
  return copies * 180;
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
