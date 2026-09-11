import { useMemo, useState } from 'react';
import { formatProb, hardGuaranteeWishForCopies } from './format.js';
import { CR_MODEL } from './probability.js';
import Info from './Info.jsx';

// Visual breakdown of what happens on a 50/50 at counter=2.
// The 50/50 itself is always a fair coin flip — natural win is always 50%.
// Capturing Radiance is a post-hoc rescue: when the coin lands on "loss",
// CR has a probability q to flip that loss into a win. So:
//   - natural win:  50%               (the coin landed on win)
//   - CR-rescued:   50% × q           (lost the coin, but CR saved it)
//   - final loss:   50% × (1 − q)     (lost the coin and CR didn't fire)
// This produces identical final probabilities to "roll CR first" framings
// but matches how players intuitively think about the mechanic.
function CounterTwoBreakdown({ q }) {
  const naturalWin = 0.5;
  const crWin = 0.5 * q;
  const loss = 0.5 * (1 - q);
  const fmt = (v) => (v * 100).toFixed(1) + '%';

  const segments = [
    {
      key: 'natural',
      width: naturalWin,
      cls: 'bg-success text-success-content',
      label: `Win ${fmt(naturalWin)}`,
      title: `Natural 50/50 win: ${fmt(naturalWin)}`,
    },
    {
      key: 'cr',
      width: crWin,
      cls: 'bg-primary text-primary-content',
      label: `CR win ${fmt(crWin)}`,
      title: `Capturing Radiance triggers (still a win): ${fmt(crWin)}`,
    },
    {
      key: 'loss',
      width: loss,
      cls: 'bg-error text-error-content',
      label: `Loss ${fmt(loss)}`,
      title: `Loss → next 5★ guaranteed: ${fmt(loss)}`,
    },
  ];

  return (
    <div className="flex h-8 w-full overflow-hidden rounded-field border border-base-300">
      {segments.map((s) => (
        <div
          key={s.key}
          className={
            'flex min-w-0 items-center justify-center text-[0.7rem] font-semibold ' +
            s.cls
          }
          style={{ width: `${s.width * 100}%` }}
          title={s.title}
        >
          <span className="truncate px-1">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

const PRIMOS_PER_WISH = 160;

const CONST_LABELS = ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
// k in atLeast[k] = number of copies. C0 = 1 copy, C6 = 7 copies.
const targetK = (cIndex) => cIndex + 1;

function fmtPrimos(n) {
  return n.toLocaleString();
}

export default function Calculator({
  curves,
  // The banner state you are really on. Both the odds above and the refund
  // below start from it, so the two can never disagree.
  startState,
  maxWishes,
  wishes,
  setWishes,
  effectiveWishes,
  refundWishes,
  totalRefundWishes,
  refundExact,
  includeRefund,
  setIncludeRefund,
}) {
  const [targetC, setTargetC] = useState(0); // 0..6 -> C0..C6
  const [inputStr, setInputStr] = useState(String(wishes));

  // When `wishes` changes from outside the input (slider, etc.), resync the
  // display string. We don't clobber the input while the user is typing a
  // value that already parses to the same `wishes` (so leading zeros they
  // accidentally typed get stripped on the next keystroke, not their own).
  //
  // Done during render (React's documented "adjust state when props change"
  // pattern) rather than in an effect, which would cause a cascading render.
  const [lastWishes, setLastWishes] = useState(wishes);
  if (wishes !== lastWishes) {
    setLastWishes(wishes);
    const parsed = inputStr === '' ? null : Number(inputStr);
    if (parsed !== wishes) setInputStr(String(wishes));
  }

  function handleInputChange(raw) {
    let s = raw.replace(/[^0-9]/g, '');
    s = s.replace(/^0+(?=\d)/, '');
    setInputStr(s);
    const v = s === '' ? 0 : Number(s);
    setWishes(Math.max(0, Math.min(maxWishes, v)));
  }

  function handleInputBlur() {
    setInputStr(String(wishes));
  }

  // Slider landmarks are the worst-case (hard guarantee) pull counts for each
  // constellation, so they slide left when you are already mid-pity. With the
  // default fresh banner they are 180 / 360 / 450 / 630 / 810 / 900 / 1080.
  const sliderTicks = useMemo(() => {
    const out = [{ v: 0, label: '0' }];
    CONST_LABELS.forEach((label, i) => {
      const v = hardGuaranteeWishForCopies(targetK(i), startState);
      if (v > maxWishes || out.some((t) => t.v === v)) return;
      out.push({ v, label });
    });
    return out;
  }, [startState, maxWishes]);

  const startBits = [];
  if (startState.startingFivePity > 0)
    startBits.push(`5★ pity already at ${startState.startingFivePity}`);
  if (startState.guaranteed) startBits.push('next 5★ already guaranteed');
  if (startState.crCounter !== 1)
    startBits.push(`Capturing Radiance counter ${startState.crCounter}`);

  const k = targetK(targetC);
  // The odds are looked up at the EFFECTIVE wish count: what you typed plus
  // the refund those wishes earn. Because the refund is an expectation rather
  // than a guarantee, this is an approximation -- see the note in the UI.
  const p = curves.atLeast[k][effectiveWishes];
  const isHardGuarantee =
    effectiveWishes >= hardGuaranteeWishForCopies(k, startState);
  const cost = wishes * PRIMOS_PER_WISH;

  const activeModel = CR_MODEL;

  return (
    <div className="flex flex-col gap-6">
      <section className="g-panel-parchment p-5">
        {/* leading-8 so the line box is exactly the height of the inline
            wish input below -- otherwise the box juts out of the sentence and
            the paragraph's lines are uneven. */}
        <div className="text-sm leading-8 opacity-85">
          Probability of reaching{' '}
          <strong className="text-primary">{CONST_LABELS[targetC]}</strong>
          <Info label="What is a constellation?">
            <strong>C0</strong> = first copy of the character.{' '}
            <strong>C1–C6</strong> = extra copies that unlock upgrades. You
            need 1+k copies of the limited 5★ to reach Ck.
          </Info>{' '}
          with{' '}
          <input
            type="text"
            inputMode="numeric"
            className="input input-sm h-8 w-24 text-center font-semibold tnum"
            value={inputStr}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={handleInputBlur}
            onFocus={(e) => e.target.select()}
          />{' '}
          wishes
          <span className="ml-1 text-xs opacity-60">
            ({fmtPrimos(cost)} primogems)
          </span>
        </div>

        <div className="g-stat mt-3 text-5xl font-bold tnum">
          {formatProb(p, isHardGuarantee)}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span
            className="g-equation py-1 tnum"
            data-wishes={wishes}
            data-refund={refundWishes}
            data-effective={effectiveWishes}
          >
            {wishes}
            {' + '}
            <strong>{refundWishes}</strong>
            {' = '}
            <strong>{effectiveWishes}</strong>
            {' wishes'}
          </span>

          <label className="flex cursor-pointer items-center gap-2 text-xs opacity-75">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={includeRefund}
              onChange={(e) => setIncludeRefund(e.target.checked)}
            />
            <span>
              {includeRefund
                ? 'including my expected refund'
                : `refund excluded (${totalRefundWishes} available)`}
            </span>
          </label>

          <Info label="Where does the refund come from?">
            Masterless Starglitter earned by your pulls buys extra Intertwined
            Fates at 5 each. How much you earn depends on your 4★ and standard
            5★ constellations, the three featured 4★ on the banner, and the
            number of wishes — all of which you can edit in the{' '}
            <strong>Stardust &amp; Starglitter</strong> section below.
            <br />
            <br />
            This is an <strong>estimate</strong>: the refund is an average, so
            real runs land a little above or below it. The odds above treat it
            as if the extra wishes were certain, which makes them slightly
            optimistic. (Stardust is not included — its fates are a flat 5 per
            month, so they do not scale with your pulls.)
          </Info>

          {refundExact > refundWishes && (
            <span className="text-[0.7rem] opacity-60">
              exactly {refundExact.toFixed(1)}
            </span>
          )}
        </div>

        {isHardGuarantee && (
          <div className="mt-4 rounded-field border border-success/40 bg-success/10 p-3 text-xs leading-relaxed">
            <strong className="text-success">Hard guarantee</strong>
            <Info label="What is a hard guarantee?">
              The wish count at which it&rsquo;s <em>mathematically impossible</em>{' '}
              to not have this constellation, even on the worst-case path
              through every 50/50, guarantee, and Capturing Radiance trigger.
            </Info>{' '}
            at {hardGuaranteeWishForCopies(k, startState)} wishes — even on the
            absolute
            worst-case path through the 50/50, guarantee, and Capturing
            Radiance chain, you cannot fail to reach this constellation by this
            many pulls.
          </div>
        )}
      </section>

      <section className="g-panel flex flex-col gap-6 p-5">
        <h3 className="g-head-bar -mx-5 -mt-5 flex items-center gap-3 text-sm font-semibold">
          <span className="g-diamond" aria-hidden="true" />
          <span className="g-title">Wishes &amp; target constellation</span>
        </h3>

        <div className="g-slider relative pb-7 pt-1">
          <input
            type="range"
            className="range g-range w-full"
            min="0"
            max={maxWishes}
            step="1"
            value={wishes}
            onChange={(e) => setWishes(Number(e.target.value))}
            aria-label="Wishes"
          />
          {sliderTicks.map(({ v, label }) => (
            // The thumb centre travels from thumb/2 to width - thumb/2, so the
            // label needs the same inset. `--t` is the 0..1 position and the
            // arithmetic lives in CSS next to the thumb size it depends on --
            // a hardcoded pixel value here silently drifts the moment the
            // thumb is resized.
            <span
              key={v}
              className="tick-marker"
              data-tick={v}
              style={{ '--t': String(v / maxWishes) }}
            >
              {label}
            </span>
          ))}
        </div>

        <div>
          <span className="text-xs uppercase tracking-wider opacity-60">
            Target constellation
          </span>
          <div role="tablist" className="g-tabs mt-2">
            {CONST_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={i === targetC}
                className={'g-tab' + (i === targetC ? ' active' : '')}
                onClick={() => setTargetC(i)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="g-panel-parchment p-5">
        <h3 className="g-head-bar -mx-5 -mt-5 mb-4 flex flex-wrap items-center gap-3 text-base font-semibold">
          <span className="g-diamond" aria-hidden="true" />
          <span className="g-title">
            All constellations at {effectiveWishes} wishes
          </span>
          {refundWishes > 0 && (
            <span className="text-sm font-normal opacity-70">
              ({wishes} + {refundWishes} refund)
            </span>
          )}
        </h3>
        <div className="g-rows flex flex-col gap-2">
          {CONST_LABELS.map((label, i) => {
            const kk = targetK(i);
            const pp = curves.atLeast[kk][effectiveWishes];
            const hard =
              effectiveWishes >= hardGuaranteeWishForCopies(kk, startState);
            const active = i === targetC;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => setTargetC(i)}
                className={'g-row' + (active ? ' g-row--selected' : '')}
              >
                <span className="min-w-0">
                  <span className="g-row-label">{label}</span>
                  <span className="g-row-sub">
                    {kk} {kk === 1 ? 'copy' : 'copies'} of the limited 5★
                  </span>
                </span>
                <span className="g-row-value tnum">
                  {formatProb(pp, hard)}
                  <span className="g-row-sub">
                    {hard ? 'guaranteed' : 'at ' + effectiveWishes + ' wishes'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <details className="collapse collapse-arrow g-panel">
        <summary className="collapse-title text-sm font-medium">
          <span className="mr-2">Advanced: Capturing Radiance model</span>
          <span className="text-xs font-normal opacity-60">
            using <strong>{activeModel.label}</strong> · {activeModel.short}
          </span>
        </summary>
        <div className="collapse-content flex flex-col gap-4 text-sm">
          <p className="text-xs leading-relaxed opacity-70">
            HoYoverse publishes the <em>outcome</em> of Capturing Radiance but
            not the trigger rate behind it: the in-game details give only the
            0.018%-per-wish base chance and the rule that three consecutive
            losses force a trigger. The <code>q₂</code> below is therefore
            inferred rather than measured — it is the one value that makes the
            long-run win rate of a non-guaranteed 5★ land on the published
            55.000%. The &ldquo;75/25&rdquo; figure you may see quoted is a
            different guess that works out to 57.1%, about two points above
            the official number, which is why it is not offered here.
          </p>
          <p className="text-xs leading-relaxed opacity-70">
            <strong>How to read the bar:</strong> the 50/50 itself is always a
            fair coin flip (50% win, 50% loss). Capturing Radiance is a{' '}
            <em>rescue</em>: when the coin lands on &ldquo;loss&rdquo;, CR has a
            probability q₂ to flip that loss into a win. So the bar shows:
            natural-win (50%) · CR-rescued (q₂ × 50%) · final loss
            ((1−q₂) × 50%).
          </p>

          <div className="flex flex-col gap-2">
            <div className="text-xs opacity-70">
              What happens on a 50/50 at <code>counter = 2</code> under{' '}
              <strong>{activeModel.label}</strong>:
            </div>
            <CounterTwoBreakdown q={activeModel.q[2]} />
            <div className="text-xs leading-relaxed opacity-70">
              {activeModel.summary}
            </div>
          </div>
        </div>
      </details>

      <div className="g-panel p-4 text-xs leading-relaxed opacity-70">
        <strong>Assumptions:</strong> the odds above start from{' '}
        {startBits.length === 0 ? (
          <strong>a fresh banner</strong>
        ) : (
          <strong>your current banner state</strong>
        )}
        {startBits.length > 0 && <> ({startBits.join(', ')})</>} — change that in
        the <em>Advanced: your current pity / guarantee</em> panel of the
        Stardust &amp; Starglitter section below. Soft pity uses the community
        model from the bilibili 9.45M-wish estimation (0.6% through pity 73,
        then +6pp per pull: 6.6% at 74, 18.6% at 76, 96.6% at 89, 100% at 90),
        which reproduces the official 1.6% consolidated rate. The
        &ldquo;100%&rdquo; threshold per constellation accounts for CR: from c=1
        the worst-case path is two L,G cycles followed by a forced CR-win (3
        promos in 450 pulls), repeated — and it shrinks when you already carry
        pity or a guarantee.
      </div>
    </div>
  );
}
