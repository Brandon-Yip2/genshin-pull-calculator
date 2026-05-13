import { useState } from 'react';

const PRIMOS_PER_WISH = 160;

const CONST_LABELS = ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
// k in atLeast[k] = number of copies. C0 = 1 copy, C6 = 7 copies.
const targetK = (cIndex) => cIndex + 1;

function pct(x) {
  return (x * 100).toFixed(2) + '%';
}

function fmtPrimos(n) {
  return n.toLocaleString();
}

export default function Calculator({ curves, maxWishes }) {
  const [wishes, setWishes] = useState(80);
  const [targetC, setTargetC] = useState(0); // 0..6 -> C0..C6

  const k = targetK(targetC);
  const p = curves.atLeast[k][wishes];
  const cost = wishes * PRIMOS_PER_WISH;

  return (
    <div className="calculator">
      <div className="readout">
        <div className="readout-label">
          Probability of reaching <strong>{CONST_LABELS[targetC]}</strong> with{' '}
          <strong>{wishes}</strong> wishes
          <span className="primo-cost"> ({fmtPrimos(cost)} primogems)</span>
        </div>
        <div className="readout-value">{pct(p)}</div>
      </div>

      <div className="controls">
        <label className="control">
          <span className="control-label">Wishes available: {wishes}</span>
          <input
            type="range"
            min="0"
            max={maxWishes}
            value={wishes}
            onChange={(e) => setWishes(Number(e.target.value))}
          />
          <div className="range-ticks">
            <span>0</span>
            <span>180 (C0 max)</span>
            <span>540</span>
            <span>900</span>
            <span>{maxWishes} (C6 max)</span>
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
              return (
                <tr key={label} className={i === targetC ? 'highlight' : ''}>
                  <td>{label}</td>
                  <td>{kk}</td>
                  <td>{pct(pp)}</td>
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
      </div>
    </div>
  );
}
