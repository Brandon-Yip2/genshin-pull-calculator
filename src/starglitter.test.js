import { describe, it, expect } from 'vitest';
import {
  computeRewardCurves,
  economyReport,
  fourStarRate,
  glitterForCharacter,
  glitterForWeapon,
  rewardsAt,
  simulateRewards,
  STARDUST_PER_FATE,
  STARDUST_PER_THREE_STAR,
  STARGLITTER_PER_FATE,
} from './starglitter.js';
import {
  defaultRoster,
  FOUR_STAR_CHARACTER_NAMES,
  NOT_OWNED,
  STANDARD_FIVE_STAR_NAMES,
} from './data/roster.js';

const FEATURED = ['Bennett', 'Fischl', 'Xiangling'];

describe('fourStarRate', () => {
  it('is 5.1% for 1..8 wishes since the last 4★', () => {
    for (const p of [1, 4, 8]) expect(fourStarRate(p)).toBeCloseTo(0.051, 10);
  });
  it('steps to 56.1% at 9 and 100% at 10 (community estimation)', () => {
    expect(fourStarRate(9)).toBeCloseTo(0.561, 10);
    expect(fourStarRate(10)).toBe(1);
  });
});

describe('Starglitter table (published values)', () => {
  it('awards 4★ weapons 2 and 5★ weapons 10', () => {
    expect(glitterForWeapon(4)).toBe(2);
    expect(glitterForWeapon(5)).toBe(10);
  });
  it('awards nothing for a character you do not own', () => {
    expect(glitterForCharacter(4, NOT_OWNED)).toBe(0);
    expect(glitterForCharacter(5, NOT_OWNED)).toBe(0);
  });
  it('awards 2 / 10 for duplicates below C6', () => {
    expect(glitterForCharacter(4, 0)).toBe(2);
    expect(glitterForCharacter(4, 5)).toBe(2);
    expect(glitterForCharacter(5, 0)).toBe(10);
    expect(glitterForCharacter(5, 5)).toBe(10);
  });
  it('awards the boosted 5 / 25 at C6', () => {
    expect(glitterForCharacter(4, 6)).toBe(5);
    expect(glitterForCharacter(5, 6)).toBe(25);
  });
});

describe('reward curves vs published rates', () => {
  const N = 800;
  const SKIP = 400;
  const curves = computeRewardCurves(N);
  const roster = defaultRoster();
  const report = rewardsAt(curves, N, roster, FEATURED);
  const window = (arr) => arr[N] - arr[SKIP];
  const pulls = N - SKIP;

  it('earns ~12.8 Stardust per wish (15 per 3★ at the 85.4% 3★ rate)', () => {
    const stardustPerWish = (STARDUST_PER_THREE_STAR * window(curves.threeStar)) / pulls;
    expect(stardustPerWish).toBeGreaterThan(12.5);
    expect(stardustPerWish).toBeLessThan(13.1);
    expect(report.stardust).toBeGreaterThan(0);
  });

  it('4★ item rate incl. pity is ~13.06%', () => {
    const fours =
      window(curves.featuredFourStar) +
      window(curves.standardFourStarCharacter) +
      window(curves.standardFourStarWeapon);
    const rate = fours / pulls;
    expect(rate).toBeGreaterThan(0.128);
    expect(rate).toBeLessThan(0.133);
  });

  it('the 4★ featured guarantee pushes the featured share to ~2/3', () => {
    const featured = window(curves.featuredFourStar);
    const total =
      featured +
      window(curves.standardFourStarCharacter) +
      window(curves.standardFourStarWeapon);
    expect(featured / total).toBeGreaterThan(0.65);
    expect(featured / total).toBeLessThan(0.68);
  });

  it('the standard portion of 4★ items splits 50/50 character vs weapon', () => {
    const chars = window(curves.standardFourStarCharacter);
    const weapons = window(curves.standardFourStarWeapon);
    expect(chars / weapons).toBeCloseTo(1, 2);
  });

  it('5★ rate incl. pity is ~1.6%', () => {
    const fiveRate = window(curves.fiveStar) / pulls;
    expect(fiveRate).toBeGreaterThan(0.0155);
    expect(fiveRate).toBeLessThan(0.0166);
  });

  it('~69% of 5★s are promotional (official 55% is the *50/50* win rate)', () => {
    // The published "consolidated 55%" is the effective win rate of a
    // NON-guaranteed 50/50 once Capturing Radiance is averaged in -- it is not
    // the promo share of all 5★s. Because a lost 50/50 makes the next 5★ a
    // guaranteed promo, the promo share of 5★ events works out to ~69%:
    //   1 - lossShare, lossShare = 0.5*m(c0) + 0.5*m(c1) + (10/22)*m(c2)
    const promoShare = window(curves.promoFiveStar) / window(curves.fiveStar);
    expect(promoShare).toBeGreaterThan(0.68);
    expect(promoShare).toBeLessThan(0.70);
  });
});

describe('Starglitter depends on your roster', () => {
  const N = 800;
  const curves = computeRewardCurves(N);

  it('unowned 4★ characters earn nothing, owned ones earn 2', () => {
    const allUnowned = defaultRoster();
    for (const name of FOUR_STAR_CHARACTER_NAMES) allUnowned.fourStar[name] = NOT_OWNED;
    const owned = defaultRoster();
    const low = rewardsAt(curves, N, allUnowned, FEATURED).starglitter;
    const high = rewardsAt(curves, N, owned, FEATURED).starglitter;
    expect(low).toBeLessThan(high);
    // Every featured 4★ is unowned in the first roster, and 25% of 4★ items
    // are weapons (always 2), so the drop is large but not total.
    expect(low).toBeGreaterThan(0);
  });

  it('C6 4★ characters earn 5 instead of 2', () => {
    const c6 = defaultRoster();
    for (const name of FOUR_STAR_CHARACTER_NAMES) c6.fourStar[name] = 6;
    const c0 = defaultRoster();
    const c6Glitter = rewardsAt(curves, N, c6, FEATURED).starglitter;
    const c0Glitter = rewardsAt(curves, N, c0, FEATURED).starglitter;
    // 4★ character glitter should rise by 3/2 = 50%.
    expect(c6Glitter).toBeGreaterThan(c0Glitter);
  });

  it('the first copy of an unowned limited 5★ awards nothing', () => {
    // At 90 pulls you expect well under one 5★, so an unowned promo 5★ can
    // only ever pay out on a second copy. Owning it at C0 pays 10 per copy.
    const notOwned = defaultRoster();
    const owned = defaultRoster();
    owned.promoFiveCopies = 1;
    const base = rewardsAt(curves, 90, notOwned, FEATURED);
    const dupes = rewardsAt(curves, 90, owned, FEATURED);
    expect(dupes.breakdown.glitterPromoFive).toBeGreaterThan(0.5);
    expect(base.breakdown.glitterPromoFive).toBeLessThan(
      0.5 * dupes.breakdown.glitterPromoFive
    );
  });

  it('a limited 5★ already at C6 makes every new copy worth exactly 25', () => {
    const maxed = defaultRoster();
    maxed.promoFiveCopies = 7;
    const report = rewardsAt(curves, N, maxed, FEATURED);
    expect(report.breakdown.glitterPromoFive).toBeCloseTo(
      25 * report.counts.promos,
      6
    );
  });

  it('an owned C0 limited 5★ pays 10 per copy until C6', () => {
    // 90 pulls: too few for 7 promos, so the 25-tier never applies.
    const owned = defaultRoster();
    owned.promoFiveCopies = 1;
    const report = rewardsAt(curves, 90, owned, FEATURED);
    expect(report.breakdown.glitterPromoFive).toBeCloseTo(
      10 * report.counts.promos,
      6
    );
  });

  it('unowned promo glitter follows 10*max(p-1,0) + 15*max(p-7,0)', () => {
    const report = rewardsAt(curves, N, defaultRoster(), FEATURED);
    const expected =
      10 * curves.promoTail[1][N] + 15 * curves.promoTail[7][N];
    expect(report.breakdown.glitterPromoFive).toBeCloseTo(expected, 8);
  });
});

describe('standard 5★ constellations (the 50/50 losses)', () => {
  const N = 600;
  const curves = computeRewardCurves(N);
  const allUnownedFive = () => {
    const r = defaultRoster();
    for (const name of STANDARD_FIVE_STAR_NAMES) r.fiveStar[name] = NOT_OWNED;
    return r;
  };
  const allC6Five = () => {
    const r = defaultRoster();
    for (const name of STANDARD_FIVE_STAR_NAMES) r.fiveStar[name] = 6;
    return r;
  };

  it('pays 25 Starglitter at C6, which is exactly 5 wishes', () => {
    expect(glitterForCharacter(5, 6)).toBe(25);
    expect(glitterForCharacter(5, 6) / STARGLITTER_PER_FATE).toBe(5);
    // ...and 10 before C6, i.e. 2 wishes.
    expect(glitterForCharacter(5, 5)).toBe(10);
    expect(glitterForCharacter(5, 5) / STARGLITTER_PER_FATE).toBe(2);
  });

  it('feeds the selector into the refund: a C6 loss pays 25 each', () => {
    const none = rewardsAt(curves, N, allUnownedFive(), FEATURED);
    const maxed = rewardsAt(curves, N, allC6Five(), FEATURED);

    // Unowned: you keep the character, so the 50/50 loss pays nothing.
    expect(none.breakdown.glitterStandardFive).toBe(0);
    // C6: exactly 25 per lost 50/50, with no averaging guesswork.
    expect(maxed.breakdown.glitterStandardFive).toBeCloseTo(
      25 * maxed.counts.standardFiveStars,
      6
    );
    expect(maxed.counts.standardFiveStars).toBeGreaterThan(0);
  });

  it('cannot change Stardust, which only ever comes from 3★ weapons', () => {
    const none = rewardsAt(curves, N, allUnownedFive(), FEATURED);
    const maxed = rewardsAt(curves, N, allC6Five(), FEATURED);
    // Identical star dust: the 5★ constellation cannot touch it.
    expect(maxed.stardust).toBe(none.stardust);
    expect(maxed.stardust).toBeCloseTo(
      STARDUST_PER_THREE_STAR * none.counts.threeStar,
      6
    );
  });

  it('raises the extra-wishes refund by 5 wishes per C6 loss', () => {
    const base = economyReport({
      wishes: N,
      roster: defaultRoster(), // standard 5★ at C0 => 10 each
      featuredFour: FEATURED,
    });
    const maxed = economyReport({
      wishes: N,
      roster: allC6Five(),
      featuredFour: FEATURED,
    });

    const deltaGlitter =
      maxed.direct.breakdown.glitterStandardFive -
      base.direct.breakdown.glitterStandardFive;
    const losses = base.direct.counts.standardFiveStars;
    expect(deltaGlitter).toBeCloseTo(15 * losses, 6); // 25 instead of 10
    expect(maxed.selfFinancing.fromStarglitter).toBeGreaterThan(
      base.selfFinancing.fromStarglitter
    );
    expect(
      maxed.selfFinancing.fromStarglitter -
        base.selfFinancing.fromStarglitter
    ).toBeCloseTo((15 * losses) / STARGLITTER_PER_FATE, 6);
  });
});

describe('extra wishes are bought with Starglitter only', () => {
  it('quotes exactly Starglitter / 5, with no Stardust contribution', () => {
    const report = economyReport({
      wishes: 600,
      roster: defaultRoster(),
      featuredFour: FEATURED,
    });
    const fromGlitter = report.direct.starglitter / STARGLITTER_PER_FATE;
    const ifStardustCounted =
      fromGlitter + report.direct.stardust / STARDUST_PER_FATE;

    expect(report.selfFinancing.fromStarglitter).toBeCloseTo(fromGlitter, 8);
    // Stardust is still *earned* -- it is just not spendable in this model.
    expect(report.direct.stardust).toBeGreaterThan(0);
    expect(report.selfFinancing.fromStarglitter).not.toBeCloseTo(
      ifStardustCounted,
      1
    );
  });

  it('is self-financing on Starglitter and stays modest (~9% of 600 wishes)', () => {
    const report = economyReport({
      wishes: 600,
      roster: defaultRoster(),
      featuredFour: FEATURED,
    });
    expect(report.selfFinancing.converged).toBe(true);
    // The bought wishes earn Starglitter of their own, but only from
    // Starglitter -- so the boost is small, not the old Stardust-inflated one.
    expect(report.selfFinancing.extraWishes).toBeGreaterThan(
      report.selfFinancing.fromStarglitter
    );
    expect(report.selfFinancing.extraWishes).toBeGreaterThan(0.06 * 600);
    expect(report.selfFinancing.extraWishes).toBeLessThan(0.12 * 600);
  });

  it('scales the refund with the wish count', () => {
    const small = economyReport({
      wishes: 160,
      roster: defaultRoster(),
      featuredFour: FEATURED,
    });
    const large = economyReport({
      wishes: 1080,
      roster: defaultRoster(),
      featuredFour: FEATURED,
    });
    expect(large.selfFinancing.fromStarglitter).toBeGreaterThan(
      5 * small.selfFinancing.fromStarglitter
    );
  });
});

describe('Monte Carlo cross-check', () => {
  it('the simulated mean matches the analytic mean within 5%', () => {
    const roster = defaultRoster();
    const curves = computeRewardCurves(400);
    const analytic = rewardsAt(curves, 400, roster, FEATURED);
    const sim = simulateRewards({
      wishes: 400,
      roster,
      featuredFour: FEATURED,
      trials: 2000,
    });
    expect(sim.stardust.mean).toBeGreaterThan(analytic.stardust * 0.95);
    expect(sim.stardust.mean).toBeLessThan(analytic.stardust * 1.05);
    expect(sim.starglitter.mean).toBeGreaterThan(analytic.starglitter * 0.95);
    expect(sim.starglitter.mean).toBeLessThan(analytic.starglitter * 1.05);
  });
});
