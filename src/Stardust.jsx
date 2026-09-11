import { useState } from 'react';
import {
  STARGLITTER_PER_FATE,
  economyReport,
  simulateRewards,
} from './starglitter.js';
import { FOUR_STAR_CHARACTER_NAMES } from './data/roster.js';
import Info from './Info.jsx';
import RosterEditor from './RosterEditor.jsx';

const nf = (n, digits = 0) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

function StartingState({ state, setState, open, setOpen }) {
  return (
    <details
      className="collapse collapse-arrow g-panel"
      open={open}
      onToggle={(e) => setOpen(e.target.open)}
    >
      <summary className="collapse-title text-sm font-medium">
        Advanced: your current pity / guarantee
        <Info label="Why does this matter?">
          Your pull counters carry over between banners, so a returning player
          is not starting from zero. A 4★ pity already at 9 changes how many 4★
          items you get (and therefore how much Starglitter you earn), and an
          existing guarantee changes the 5★ mix.
          <br />
          <br />
          This feeds <strong>both</strong> halves of the page: the refund below
          and the constellation odds above, which start from the same state and
          so speed up to match. Only the <em>How it works</em> page keeps using
          fresh-banner curves, because it explains the mechanic itself rather
          than your account.
        </Info>
      </summary>
      <div className="collapse-content grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs opacity-60">5★ pity (0–89)</span>
          <input
            type="number"
            className="input input-sm"
            min="0"
            max="89"
            value={state.startingFivePity}
            onChange={(e) =>
              setState({
                ...state,
                startingFivePity: Math.max(
                  0,
                  Math.min(89, Number(e.target.value) || 0)
                ),
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs opacity-60">4★ pity (0–9)</span>
          <input
            type="number"
            className="input input-sm"
            min="0"
            max="9"
            value={state.startingFourPity}
            onChange={(e) =>
              setState({
                ...state,
                startingFourPity: Math.max(
                  0,
                  Math.min(9, Number(e.target.value) || 0)
                ),
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs opacity-60">Capturing Radiance counter</span>
          <select
            className="select select-sm"
            value={state.crCounter}
            onChange={(e) =>
              setState({ ...state, crCounter: Number(e.target.value) })
            }
          >
            {[0, 1, 2, 3].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs opacity-75">
          <input
            type="checkbox"
            className="checkbox checkbox-xs checkbox-primary"
            checked={state.guaranteed}
            onChange={(e) =>
              setState({ ...state, guaranteed: e.target.checked })
            }
          />
          <span>Next 5★ is guaranteed promotional</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs opacity-75">
          <input
            type="checkbox"
            className="checkbox checkbox-xs checkbox-primary"
            checked={state.featuredFourGuaranteed}
            onChange={(e) =>
              setState({ ...state, featuredFourGuaranteed: e.target.checked })
            }
          />
          <span>Next 4★ is guaranteed featured</span>
        </label>
      </div>
    </details>
  );
}

/**
 * Reward section, rendered underneath the calculator on the same page.
 *
 * `wishes` is owned by App, so the number in the calculator's wish box drives
 * both the constellation odds above and the refund below.
 */
export default function Stardust({
  wishes,
  // Owned by App: the same banner state feeds the calculator's odds and this
  // refund, so it lives in one place.
  startState,
  setStartState,
  roster,
  featured,
  setFeaturedAt,
  setConstellation,
  setAll,
  setPromoFiveCopies,
  resetRoster,
}) {
  const [showRoster, setShowRoster] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sim, setSim] = useState(null);
  const [minDust, setMinDust] = useState(5000);
  const [minGlitter, setMinGlitter] = useState(200);

  // The reward curves are cached by starting state, so re-running this on every
  // keystroke only costs the (tiny) fixed-point loop.
  const report = economyReport({
    wishes,
    roster,
    featuredFour: featured,
    startState,
  });

  const extraWishes = report.selfFinancing.fromStarglitter;
  const glitterWishes = report.selfFinancing.totalWishes - wishes;
  const breakdown = report.direct.breakdown;
  const counts = report.direct.counts;

  const rows = [
    {
      key: 'dust',
      label: '3★ weapons',
      detail: `15 Stardust each · ${nf(counts.threeStar, 0)} of them`,
      value: report.direct.stardust,
      unit: 'Stardust',
    },
    {
      key: 'feat',
      label: 'Featured 4★ characters',
      detail: `${nf(counts.fourStarFeatured, 1)} duplicates`,
      value: breakdown.glitterFeatured,
      unit: 'Starglitter',
    },
    {
      key: 'std4',
      label: 'Standard 4★ characters',
      detail: `${nf(counts.fourStarCharacter, 1)} duplicates`,
      value: breakdown.glitterFourStarChar,
      unit: 'Starglitter',
    },
    {
      key: 'wep4',
      label: '4★ weapons',
      detail: `${nf(counts.fourStarWeapon, 1)} × 2`,
      value: breakdown.glitterFourStarWeapon,
      unit: 'Starglitter',
    },
    {
      key: 'promo5',
      label: 'Limited 5★ copies',
      detail: `${nf(counts.promos, 1)} copies · 10 each, 25 from the 8th`,
      value: breakdown.glitterPromoFive,
      unit: 'Starglitter',
    },
    {
      key: 'std5',
      label: 'Standard 5★ characters',
      detail: `${nf(counts.standardFiveStars, 1)} lost 50/50s`,
      value: breakdown.glitterStandardFive,
      unit: 'Starglitter',
    },
  ];

  const cards = [
    {
      key: 'dust',
      label: 'Masterless Stardust',
      value: nf(report.direct.stardust),
      sub: `${nf(
        report.direct.rates.stardustPerWish,
        2
      )}/wish · earned, but not counted towards the wishes below`,
      tone: 'dust',
    },
    {
      key: 'glitter',
      label: 'Masterless Starglitter',
      value: nf(report.direct.starglitter),
      sub: `${nf(
        report.direct.rates.starglitterPerWish,
        2
      )}/wish · ${STARGLITTER_PER_FATE} per Intertwined Fate`,
      tone: 'glitter',
    },
    {
      key: 'extra',
      label: 'Extra wishes from Starglitter',
      value: nf(Math.floor(extraWishes)),
      sub: (
        <>
          ≈ <strong>{nf(extraWishes, 1)}</strong> from these{' '}
          <strong>{`${nf(wishes)} wishes`}</strong>; ≈{' '}
          <strong>{nf(glitterWishes, 1)}</strong> more once those bought
          wishes earn their own Starglitter
        </>
      ),
      tone: 'gold',
    },
  ];

  const TONE = {
    dust: { panel: 'g-card-dust', value: 'g-num-dust' },
    glitter: { panel: 'g-card-glitter', value: 'g-num-glitter' },
    gold: { panel: 'g-panel-gold', value: 'g-stat' },
  };

  return (
    <section className="mt-10 flex flex-col gap-6 border-t border-primary/25 pt-8">
      <div>
        <h2 className="g-title flex items-center gap-3 text-xl">
          <span className="g-diamond" aria-hidden="true" />
          <span>Stardust &amp; Starglitter</span>
        </h2>
        <p className="mt-2 text-sm opacity-70">
          What your{' '}
          <strong className="opacity-100">{`${nf(wishes)} wishes`}</strong> above
          hand back. Change the wish count in the box at the top and everything
          here follows — the refund is already credited into the odds above.
        </p>
      </div>

      <p className="max-w-4xl text-sm leading-relaxed opacity-75">
        Every wish earns currency back. <strong>Masterless Stardust</strong>{' '}
        comes from 3★ weapons (15 each).{' '}
        <strong>Masterless Starglitter</strong> comes from duplicates, and how
        much you get depends on which 4★ and standard 5★ characters you own and
        whether they are already C6.{' '}
        <em>Only Starglitter is turned into extra wishes</em> (5 per Intertwined
        Fate). Stardust is reported but not spent here, because its fates are a
        flat 5 per month at Paimon&rsquo;s Bargains rather than something your
        wish count changes.
      </p>

      <StartingState
        state={startState}
        setState={setStartState}
        open={advancedOpen}
        setOpen={setAdvancedOpen}
      />

      <div className="g-panel-parchment flex flex-col gap-2 p-4">
        <div className="text-sm font-semibold">
          Featured 4★ on this banner (pick 3)
          <Info label="Why does this matter?">
            Every 4★ item has a 50% chance to be one of the three featured
            characters, and a miss makes the next 4★ guaranteed featured. So
            about two thirds of your 4★ items are these three characters —
            their constellation status drives a big chunk of your Starglitter.
          </Info>
        </div>
        <div className="flex flex-wrap gap-3">
          {featured.map((name, i) => (
            <select
              key={i}
              className="select select-sm max-w-[16rem]"
              value={name}
              aria-label={`Featured 4★ number ${i + 1}`}
              onChange={(e) => setFeaturedAt(i, e.target.value)}
            >
              {FOUR_STAR_CHARACTER_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.key} className={'g-panel p-4 ' + TONE[c.tone].panel}>
            <div className="text-[0.7rem] uppercase tracking-wider opacity-60">
              {c.label}
            </div>
            <div
              className={'mt-1 text-3xl font-bold tnum ' + TONE[c.tone].value}
            >
              {c.value}
            </div>
            <div className="mt-1 text-xs leading-relaxed opacity-60">
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm opacity-70">
        These wishes are counted as pulls: {nf(counts.threeStar)} 3★ weapons,{' '}
        {nf(counts.fourStar, 1)} 4★ items and {nf(counts.fiveStar, 1)} 5★
        characters, of which {nf(counts.promos, 1)} are the promotional
        character.
      </p>

      <div className="g-panel-parchment p-5">
        <h3 className="g-head-bar -mx-5 -mt-5 mb-4 flex items-center gap-3 text-base font-semibold">
          <span className="g-diamond" aria-hidden="true" />
          <span className="g-title">Where it comes from</span>
        </h3>
        <div className="g-rows flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.key} className="g-row">
              <span className="min-w-0">
                <span className="g-row-label">{r.label}</span>
                <span className="g-row-sub">{r.detail}</span>
              </span>
              <span className="g-row-value tnum">
                {nf(r.value, 1)} {r.unit}
                <span className="g-row-sub">
                  {r.unit === 'Stardust'
                    ? 'not spent on wishes'
                    : `${nf(r.value / STARGLITTER_PER_FATE, 2)} wishes`}
                </span>
              </span>
            </div>
          ))}
          <div className="g-row g-row--selected">
            <span className="min-w-0">
              <span className="g-row-label">Total</span>
              <span className="g-row-sub">from {nf(wishes)} wishes</span>
            </span>
            <span className="g-row-value tnum">
              {nf(report.direct.stardust)} dust + {nf(report.direct.starglitter)}{' '}
              glitter
              <span className="g-row-sub">
                {nf(extraWishes, 1)} extra wishes from Starglitter
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="g-panel flex flex-col gap-4 p-5">
        <div className="g-head-bar -mx-5 -mt-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="g-title text-base">Distribution, not just the average</h3>
          <button
            type="button"
            className="g-btn g-btn-sm g-btn-gold"
            onClick={() =>
              setSim(
                simulateRewards({
                  wishes,
                  roster,
                  featuredFour: featured,
                  startState,
                  trials: 4000,
                })
              )
            }
          >
            Run 4,000 simulated accounts
          </button>
        </div>

        {sim && (
          <>
            <div className="overflow-x-auto">
              <table className="table table-sm g-table">
                <thead>
                  <tr>
                    <th>Percentile</th>
                    <th className="text-right">Stardust</th>
                    <th className="text-right">Starglitter</th>
                    <th className="text-right">Extra wishes</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Worst 10%', sim.stardust.p10, sim.starglitter.p10],
                    ['Median', sim.stardust.p50, sim.starglitter.p50],
                    ['Best 10%', sim.stardust.p90, sim.starglitter.p90],
                  ].map(([label, d, g]) => (
                    <tr key={label}>
                      <td className="font-medium">{label}</td>
                      <td className="text-right tnum">{nf(d)}</td>
                      <td className="text-right tnum">{nf(g)}</td>
                      <td className="text-right tnum">
                        {nf(g / STARGLITTER_PER_FATE, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="g-well flex flex-wrap items-center gap-2 p-3 text-sm">
              <span className="opacity-70">Chance of getting at least</span>
              <input
                type="number"
                className="input input-sm w-28"
                min="0"
                step="100"
                value={minDust}
                aria-label="Minimum Stardust"
                onChange={(e) => setMinDust(Number(e.target.value) || 0)}
              />
              <span className="opacity-70">Stardust and</span>
              <input
                type="number"
                className="input input-sm w-28"
                min="0"
                step="10"
                value={minGlitter}
                aria-label="Minimum Starglitter"
                onChange={(e) => setMinGlitter(Number(e.target.value) || 0)}
              />
              <span className="opacity-70">Starglitter:</span>
              <strong className="g-stat tnum">
                {nf(sim.probabilityOf(minDust, minGlitter) * 100, 1)}%
              </strong>
            </div>
          </>
        )}

        {!sim && (
          <p className="text-sm opacity-70">
            The math above is exact but only gives an average. Running the
            simulation also shows the spread — how much you get in a bad run
            versus a good one.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-primary/20 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="g-title text-base">
            Your 4★ and 5★ constellations
          </h3>
          <button
            type="button"
            className="g-btn g-btn-ghost g-btn-sm"
            onClick={() => setShowRoster((v) => !v)}
          >
            {showRoster ? 'Hide roster' : 'Edit roster'}
          </button>
        </div>
        <p className="max-w-4xl text-sm leading-relaxed opacity-70">
          Stored in your browser. Duplicates give 2 Starglitter (5 at C6), and
          nothing at all if you don&rsquo;t own the character yet — so this is
          the single biggest input to the numbers above. The standard 5★ list
          covers what you can lose a 50/50 to; the limited 5★ is the banner
          character itself.
        </p>
        {showRoster && (
          <RosterEditor
            roster={roster}
            setConstellation={setConstellation}
            setAll={setAll}
            setPromoFiveCopies={setPromoFiveCopies}
            resetRoster={resetRoster}
          />
        )}
      </div>
    </section>
  );
}
