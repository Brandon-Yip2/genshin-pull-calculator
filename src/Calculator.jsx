import { useState, useEffect } from 'react';
import { formatProb, hardGuaranteeWishForCopies } from './format.js';

const PRIMOS_PER_WISH = 160;

const CONST_LABELS = ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
// k in atLeast[k] = number of copies. C0 = 1 copy, C6 = 7 copies.
const targetK = (cIndex) => cIndex + 1;

function fmtPrimos(n) {
  return n.toLocaleString();
}

export default function Calculator({ curves, maxWishes }) {
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
    // Allow only digits.
    let s = raw.replace(/[^0-9]/g, '');
    // Strip leading zeros while leaving "0" as-is and "" as-is.
    s = s.replace(/^0+(?=\d)/, '');
    setInputStr(s);
    const v = s === '' ? 0 : Number(s);
    setWishes(Math.max(0, Math.min(maxWishes, v)));
  }

  function handleInputBlur() {
    // Restore canonical display on blur (e.g. empty -> "0").
    setInputStr(String(wishes));
  }

  const k = targetK(targetC);
  const p = curves.atLeast[k][wishes];
  const isHardGuarantee = wishes >= hardGuaranteeWishForCopies(k);
  const cost = wishes * PRIMOS_PER_WISH;

  return (
    <div className="calculator">
      <div className="readout">
        <div className="readout-label">
          Probability of reaching <strong>{CONST_LABELS[targetC]}</strong> with{' '}
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
            Hard guarantee at {hardGuaranteeWishForCopies(k)} wishes — even on
            the absolute worst-case path through the 50/50, guarantee, and
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

      <div className="assumptions">
        <strong>Assumptions:</strong> fresh banner state (pity 0, no guarantee,
        Capturing Radiance counter starts at 1 per the post-5.0 default).
        Soft pity model is fitted to the empirical CSV (step at pity 76).
        The "100%" threshold per constellation accounts for CR: from c=1 the
        worst-case path is two L,G cycles followed by a forced CR-win
        (3 promos in 450 pulls), repeated.
      </div>
    </div>
  );
}
