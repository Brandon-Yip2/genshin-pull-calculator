import { useState, useEffect } from 'react';
import { formatProb, hardGuaranteeWishForCopies } from './format.js';
import { CR_MODELS } from './probability.js';
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
  return (
    <div className="cr-bar">
      <div
        className="cr-bar-seg cr-bar-natwin"
        style={{ width: `${naturalWin * 100}%` }}
        title={`Natural 50/50 win: ${fmt(naturalWin)}`}
      >
        <span>Win {fmt(naturalWin)}</span>
      </div>
      <div
        className="cr-bar-seg cr-bar-crwin"
        style={{ width: `${crWin * 100}%` }}
        title={`Capturing Radiance triggers (still a win): ${fmt(crWin)}`}
      >
        <span>CR win {fmt(crWin)}</span>
      </div>
      <div
        className="cr-bar-seg cr-bar-loss"
        style={{ width: `${loss * 100}%` }}
        title={`Loss → next 5★ guaranteed: ${fmt(loss)}`}
      >
        <span>Loss {fmt(loss)}</span>
      </div>
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

export default function Calculator({ curves, maxWishes, crModel, setCrModel }) {
  const [wishes, setWishes] = useState(80);
  const [targetC, setTargetC] = useState(0); // 0..6 -> C0..C6
  const [inputStr, setInputStr] = useState(String(wishes));

  // When `wishes` changes from outside the input (slider, etc.), resync the
  // display string. We don't clobber the input while the user is typing a
  // value that already parses to the same `wishes` (so leading zeros they
  // accidentally typed get stripped on the next keystroke, not their own).
  useEffect(() => {
    const parsed = inputStr === '' ? null : Number(inputStr);
    if (parsed !== wishes) setInputStr(String(wishes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishes]);

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

  const k = targetK(targetC);
  const p = curves.atLeast[k][wishes];
  const isHardGuarantee = wishes >= hardGuaranteeWishForCopies(k);
  const cost = wishes * PRIMOS_PER_WISH;

  const activeModel = CR_MODELS[crModel];
  return (
    <div className="calculator">
      <div className="readout">
        <div className="readout-label">
          Probability of reaching{' '}
          <strong>{CONST_LABELS[targetC]}</strong>
          <Info label="What is a constellation?">
            <strong>C0</strong> = first copy of the character.{' '}
            <strong>C1–C6</strong> = extra copies that unlock upgrades. You
            need 1+k copies of the limited 5★ to reach Ck.
          </Info>{' '}
          with{' '}
          <input
            type="text"
            inputMode="numeric"
            className="wish-input wish-input-inline"
            value={inputStr}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={handleInputBlur}
            onFocus={(e) => e.target.select()}
          />{' '}
          wishes
          <span className="primo-cost"> ({fmtPrimos(cost)} primogems)</span>
        </div>
        <div className="readout-value">{formatProb(p, isHardGuarantee)}</div>
        {isHardGuarantee && (
          <div className="readout-note">
            <strong>Hard guarantee</strong>
            <Info label="What is a hard guarantee?">
              The wish count at which it's <em>mathematically impossible</em>{' '}
              to not have this constellation, even on the worst-case path
              through every 50/50, guarantee, and Capturing Radiance trigger.
            </Info>
            {' '}at {hardGuaranteeWishForCopies(k)} wishes — even on the
            absolute worst-case path through the 50/50, guarantee, and
            Capturing Radiance chain, you cannot fail to reach this
            constellation by this many pulls.
          </div>
        )}
      </div>

      <div className="controls">
        <label className="control">
          <div className="slider-wrap">
            <input
              type="range"
              min="0"
              max={maxWishes}
              step="1"
              value={wishes}
              onChange={(e) => setWishes(Number(e.target.value))}
            />
            {[
              { v: 0,    label: '0' },
              { v: 180,  label: 'C0' },
              { v: 360,  label: 'C1' },
              { v: 450,  label: 'C2' },
              { v: 630,  label: 'C3' },
              { v: 810,  label: 'C4' },
              { v: 900,  label: 'C5' },
              { v: 1080, label: 'C6' },
            ].map(({ v, label }) => {
              // Compensate for the slider thumb's finite width (~16px).
              // The thumb center travels from `thumbHalfPx` to
              // `trackWidth - thumbHalfPx`, not 0..trackWidth.
              const ratio = v / maxWishes;
              const left = `calc(${ratio * 100}% + (0.5 - ${ratio}) * 16px)`;
              return (
                <span key={v} className="tick-marker" style={{ left }}>
                  {label}
                </span>
              );
            })}
          </div>
        </label>

        <label className="control">
          <span className="control-label">Target constellation</span>
          <div className="const-buttons">
            {CONST_LABELS.map((label, i) => (
              <button
                key={label}
                className={i === targetC ? 'const-btn active' : 'const-btn'}
                onClick={() => setTargetC(i)}
              >
                {label}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="table-wrap">
        <h3>All constellations at {wishes} wishes</h3>
        <table className="results-table">
          <thead>
            <tr>
              <th>Reach</th>
              <th>Copies</th>
              <th>Probability</th>
            </tr>
          </thead>
          <tbody>
            {CONST_LABELS.map((label, i) => {
              const kk = targetK(i);
              const pp = curves.atLeast[kk][wishes];
              const hard = wishes >= hardGuaranteeWishForCopies(kk);
              return (
                <tr key={label} className={i === targetC ? 'highlight' : ''}>
                  <td>{label}</td>
                  <td>{kk}</td>
                  <td>{formatProb(pp, hard)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="cr-settings">
        <summary>
          <span className="cr-settings-label">
            Advanced: Capturing Radiance model
            <Info label="What is Capturing Radiance?">
              A post-5.0 pity mechanic that can override a 50/50 loss into a
              win after consecutive losses. HoYoverse hasn't published the
              exact trigger probability, so the calculator offers two
              community estimates.
            </Info>
          </span>
          <span className="cr-settings-current">
            using <strong>{activeModel.label}</strong> · {activeModel.short}
          </span>
        </summary>
        <div className="cr-settings-body">
          <p className="cr-settings-note">
            <strong>Both options below are community estimates.</strong>{' '}
            HoYoverse hasn't published the exact Capturing Radiance trigger
            rate. The two models give very similar results for most wish
            counts — the difference is at most a few percent, and grows only
            for higher constellations (C2+). The default is fine for most
            users.
          </p>
          <p className="cr-settings-note">
            <strong>How to read the bar:</strong> the 50/50 itself is always
            a fair coin flip (50% win, 50% loss). Capturing Radiance is a{' '}
            <em>rescue</em>: when the coin lands on "loss", CR has a probability
            q₂ to flip that loss into a win. So the bar shows: natural-win{' '}
            (50%) · CR-rescued (q₂ × 50%) · final loss ((1−q₂) × 50%).
          </p>
          <div className="cr-picker-options">
            {Object.values(CR_MODELS).map((m) => (
              <button
                key={m.id}
                className={'cr-opt' + (crModel === m.id ? ' active' : '')}
                onClick={() => setCrModel(m.id)}
              >
                <div className="cr-opt-title">{m.label}</div>
                <div className="cr-opt-sub">{m.short}</div>
              </button>
            ))}
          </div>
          <div className="cr-picker-vis">
            <div className="cr-picker-vis-label">
              What happens on a 50/50 at <code>counter = 2</code> under{' '}
              <strong>{activeModel.label}</strong>:
            </div>
            <CounterTwoBreakdown q={activeModel.q[2]} />
            <div className="cr-picker-summary">{activeModel.summary}</div>
          </div>
        </div>
      </details>

      <div className="assumptions">
        <strong>Assumptions:</strong> fresh banner state (pity 0, no
        guarantee, Capturing Radiance counter starts at 1 per the post-5.0
        default). Soft pity model is fitted to a 1B-pull empirical dataset
        (step at pity 76). The "100%" threshold per constellation accounts
        for CR: from c=1 the worst-case path is two L,G cycles followed by a
        forced CR-win (3 promos in 450 pulls), repeated.
      </div>
    </div>
  );
}
