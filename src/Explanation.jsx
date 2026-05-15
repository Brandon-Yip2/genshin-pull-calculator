import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { fiveStarRate, MAX_PITY, MAX_COPIES, CR_MODELS } from './probability.js';
import { formatProb, hardGuaranteeWishForCopies } from './format.js';

// Generic non-hard formatter for tooltips on the per-pull / per-wish-mass
// charts (these are NOT cumulative probabilities approaching 1 in any
// meaningful way, so the hard-guarantee logic isn't needed).
function pctFmt(v) {
  return formatProb(v, false);
}

const CONST_COLORS = [
  '#4f9cff', // C0
  '#7bc36b', // C1
  '#f0c419', // C2
  '#ec8c4b', // C3
  '#e25c5c', // C4
  '#b266d9', // C5
  '#5c5cd6', // C6
];

function PerPullRateChart() {
  const data = useMemo(() => {
    const rows = [];
    for (let p = 1; p <= MAX_PITY; p++) {
      rows.push({ pity: p, rate: fiveStarRate(p) });
    }
    return rows;
  }, []);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 30, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis
          dataKey="pity"
          stroke="var(--chart-axis)"
          label={{ value: 'Pity counter', position: 'insideBottom', offset: -5, fill: 'var(--chart-axis)' }}
        />
        <YAxis
          stroke="var(--chart-axis)"
          tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
        />
        <Tooltip
          contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          formatter={(v) => pctFmt(v)}
          labelFormatter={(p) => `Pity ${p}`}
        />
        <Line
          type="monotone"
          dataKey="rate"
          name="P(5★ this pull)"
          stroke="var(--chart-line-1)"
          dot={false}
          strokeWidth={2}
        />
        <ReferenceLine x={76} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: 'soft pity', fill: 'var(--accent)', position: 'top', offset: 12 }} />
        <ReferenceLine x={90} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: 'hard pity', fill: 'var(--danger)', position: 'top', offset: 12 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function FirstFiveStarChart({ curves, maxWishes }) {
  const data = useMemo(() => {
    const rows = [];
    const cap = Math.min(maxWishes, 100);
    for (let n = 0; n <= cap; n++) {
      rows.push({ wish: n, p: curves.firstFiveAt[n] });
    }
    return rows;
  }, [curves, maxWishes]);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="wish" stroke="var(--chart-axis)" />
        <YAxis
          stroke="var(--chart-axis)"
          tickFormatter={(v) => (v * 100).toFixed(1) + '%'}
        />
        <Tooltip
          contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          formatter={(v) => pctFmt(v)}
          labelFormatter={(n) => `Wish ${n}`}
        />
        <Line
          type="monotone"
          dataKey="p"
          name="P(first 5★ at exactly this wish)"
          stroke="var(--chart-line-2)"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function FirstFiveStarCumulativeChart({ curves }) {
  // Only wish 90 (hard pity) gives a true 100% guarantee. Below that,
  // values can be very close to 1 but not exactly 1.
  const data = useMemo(() => {
    const rows = [];
    let cum = 0;
    for (let n = 0; n <= 90; n++) {
      cum += curves.firstFiveAt[n];
      rows.push({ wish: n, cum, hard: n >= 90 });
    }
    return rows;
  }, [curves]);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 30, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="wish" stroke="var(--chart-axis)" />
        <YAxis
          stroke="var(--chart-axis)"
          tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
          domain={[0, 1]}
        />
        <Tooltip
          contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          formatter={(v, _name, item) => formatProb(v, item.payload.hard)}
          labelFormatter={(n) => `By wish ${n}`}
        />
        <Line
          type="monotone"
          dataKey="cum"
          name="P(any 5★ by this wish)"
          stroke="var(--chart-line-1)"
          dot={false}
          strokeWidth={2}
        />
        <ReferenceLine x={76} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: 'soft pity', fill: 'var(--accent)', position: 'top', offset: 12 }} />
        <ReferenceLine x={90} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: 'hard pity', fill: 'var(--danger)', position: 'top', offset: 12 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PromoDistChart({ curves, maxWishes }) {
  const data = useMemo(() => {
    const rows = [];
    const cap = Math.min(maxWishes, 200);
    for (let n = 0; n <= cap; n++) {
      rows.push({ wish: n, p: curves.firstPromoAt[n] });
    }
    return rows;
  }, [curves, maxWishes]);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="wish" stroke="var(--chart-axis)" />
        <YAxis
          stroke="var(--chart-axis)"
          tickFormatter={(v) => (v * 100).toFixed(1) + '%'}
        />
        <Tooltip
          contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          formatter={(v) => pctFmt(v)}
          labelFormatter={(n) => `Wish ${n}`}
        />
        <Line
          type="monotone"
          dataKey="p"
          name="P(first promo at exactly this wish)"
          stroke="var(--accent)"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PromoCumulativeChart({ curves }) {
  const data = useMemo(() => {
    const rows = [];
    for (let n = 0; n <= 180; n++) {
      rows.push({
        wish: n,
        cum: curves.atLeast[1][n],
        hard: n >= hardGuaranteeWishForCopies(1),
      });
    }
    return rows;
  }, [curves]);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 30, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="wish" stroke="var(--chart-axis)" />
        <YAxis
          stroke="var(--chart-axis)"
          tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
          domain={[0, 1]}
        />
        <Tooltip
          contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          formatter={(v, _name, item) => formatProb(v, item.payload.hard)}
          labelFormatter={(n) => `By wish ${n}`}
        />
        <Line
          type="monotone"
          dataKey="cum"
          name="P(promo by this wish)"
          stroke="var(--accent)"
          dot={false}
          strokeWidth={2}
        />
        <ReferenceLine x={90} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: 'first hard pity', fill: 'var(--danger)', position: 'top', offset: 12 }} />
        <ReferenceLine x={180} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: 'guaranteed', fill: 'var(--danger)', position: 'top', offset: 12 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ConstellationCurvesChart({ curves, curvesNoCR, maxWishes, showNoCR }) {
  const data = useMemo(() => {
    const rows = [];
    for (let n = 0; n <= maxWishes; n += 10) {
      const row = { wish: n };
      for (let k = 1; k <= MAX_COPIES; k++) {
        row['C' + (k - 1)] = curves.atLeast[k][n];
        if (curvesNoCR) {
          row['C' + (k - 1) + '_noCR'] = curvesNoCR.atLeast[k][n];
        }
      }
      rows.push(row);
    }
    return rows;
  }, [curves, curvesNoCR, maxWishes]);

  return (
    <ResponsiveContainer width="100%" height={380}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="wish" stroke="var(--chart-axis)" />
        <YAxis
          stroke="var(--chart-axis)"
          tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
          domain={[0, 1]}
        />
        <Tooltip
          contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          formatter={(v, name, item) => {
            // dataKey is 'C2' or 'C2_noCR'.
            const isNoCR = name.endsWith('_noCR');
            const cIndex = Number(name.slice(1).replace('_noCR', ''));
            // Hard guarantee only applies to the live (with-CR) system; the
            // pre-5.0 system has its own (looser) bounds — treat them as
            // never reaching a hard guarantee for display purposes.
            const hard = !isNoCR && item.payload.wish >= hardGuaranteeWishForCopies(cIndex + 1);
            return formatProb(v, hard);
          }}
          labelFormatter={(n) => `${n} wishes`}
        />
        <Legend wrapperStyle={{ color: 'var(--text)' }} />
        {[0, 1, 2, 3, 4, 5, 6].map((c) => (
          <Line
            key={c}
            type="monotone"
            dataKey={'C' + c}
            name={'C' + c}
            stroke={CONST_COLORS[c]}
            dot={false}
            strokeWidth={2}
          />
        ))}
        {showNoCR && [0, 1, 2, 3, 4, 5, 6].map((c) => (
          <Line
            key={'noCR' + c}
            type="monotone"
            dataKey={'C' + c + '_noCR'}
            name={'C' + c + ' (pre-5.0)'}
            stroke={CONST_COLORS[c]}
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            opacity={0.6}
            legendType="none"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function findThreshold(arr, target) {
  for (let n = 0; n < arr.length; n++) if (arr[n] >= target) return n;
  return -1;
}

function CRImpactTable({ curves, curvesNoCR }) {
  const rows = useMemo(() => {
    const out = [];
    for (let k = 1; k <= MAX_COPIES; k++) {
      const cn = 'C' + (k - 1);
      const get = (cum, t) => findThreshold(cum, t);
      out.push({
        cn,
        p50w: get(curves.atLeast[k], 0.5),
        p50n: get(curvesNoCR.atLeast[k], 0.5),
        p90w: get(curves.atLeast[k], 0.9),
        p90n: get(curvesNoCR.atLeast[k], 0.9),
        p99w: get(curves.atLeast[k], 0.99),
        p99n: get(curvesNoCR.atLeast[k], 0.99),
      });
    }
    return out;
  }, [curves, curvesNoCR]);

  return (
    <table className="results-table">
      <thead>
        <tr>
          <th rowSpan="2">Constellation</th>
          <th colSpan="2">50% wishes</th>
          <th colSpan="2">90% wishes</th>
          <th colSpan="2">99% wishes</th>
        </tr>
        <tr>
          <th>now</th><th>pre-5.0</th>
          <th>now</th><th>pre-5.0</th>
          <th>now</th><th>pre-5.0</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.cn}>
            <td>{r.cn}</td>
            <td>{r.p50w}</td><td className="dim">{r.p50n}</td>
            <td>{r.p90w}</td><td className="dim">{r.p90n}</td>
            <td>{r.p99w}</td><td className="dim">{r.p99n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ModelBreakdownBar({ q }) {
  const crWin = q;
  const naturalWin = (1 - q) * 0.5;
  const loss = (1 - q) * 0.5;
  const fmt = (v) => (v * 100).toFixed(1) + '%';
  return (
    <div className="cr-bar">
      <div className="cr-bar-seg cr-bar-natwin" style={{ width: `${naturalWin * 100}%` }}>
        <span>Win {fmt(naturalWin)}</span>
      </div>
      <div className="cr-bar-seg cr-bar-crwin" style={{ width: `${crWin * 100}%` }}>
        <span>CR {fmt(crWin)}</span>
      </div>
      <div className="cr-bar-seg cr-bar-loss" style={{ width: `${loss * 100}%` }}>
        <span>Loss {fmt(loss)}</span>
      </div>
    </div>
  );
}

function ModelComparisonChart({ curvesByModel, maxWishes }) {
  const data = useMemo(() => {
    const rows = [];
    const ids = Object.keys(curvesByModel);
    for (let n = 0; n <= maxWishes; n += 10) {
      const row = { wish: n };
      for (const id of ids) {
        // Show C2+ as the most CR-sensitive cumulative curve (CR doesn't
        // affect C0; barely affects C1; most visible in the middle range).
        row[id] = curvesByModel[id].atLeast[3][n];
      }
      rows.push(row);
    }
    return rows;
  }, [curvesByModel, maxWishes]);
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="wish" stroke="var(--chart-axis)" />
        <YAxis
          stroke="var(--chart-axis)"
          tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
          domain={[0, 1]}
        />
        <Tooltip
          contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          formatter={(v) => formatProb(v, false)}
          labelFormatter={(n) => `${n} wishes`}
        />
        <Legend wrapperStyle={{ color: 'var(--text)' }} />
        <Line type="monotone" dataKey="official" name="Conservative (q₂≈9%)" stroke="var(--chart-line-1)" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="community" name="Optimistic (q₂=50%)" stroke="var(--accent)" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function Explanation({ curves, curvesByModel, curvesNoCR, maxWishes, crModel }) {
  const [showNoCR, setShowNoCR] = useState(false);
  return (
    <div className="explanation">
      <section>
        <h2>Reading the calculator</h2>
        <p>
          The big number is <em>P(reach Cn or higher)</em> — the cumulative
          probability that with the given number of wishes you end up with{' '}
          <em>at least</em> that many copies. So <code>P(C2+) = 35%</code> means
          there's a 35% chance you have C2, C3, C4, C5, or C6 — not "exactly C2".
        </p>
        <p>
          For "exactly Cn", subtract: P(exactly C2) = P(C2+) − P(C3+).
        </p>
      </section>

      <section>
        <h2>The base wish system</h2>
        <p>Three official numbers define everything:</p>
        <ul>
          <li><strong>0.6%</strong> — base chance of a 5★ on every pull</li>
          <li><strong>1.6%</strong> — long-run "consolidated" rate including pity</li>
          <li><strong>90 pulls</strong> — hard pity: a 5★ is guaranteed</li>
        </ul>
        <p>
          The curve between the base rate and the hard pity wall — "soft pity" —
          is <em>not</em> officially published. The community has reverse-engineered
          it from large datasets. We use a model fitted to a 1B+ pull dataset
          (the spreadsheet you may have seen): the per-pull rate stays at 0.6%
          through pity 75, then jumps sharply at pity 76 and ramps to 100% at
          pity 90.
        </p>
        <PerPullRateChart />
        <p className="caption">
          Per-pull P(5★) as a function of pity counter. Note the sharp step at
          pity 76 — that's where most 5★s land.
        </p>
      </section>

      <section>
        <h2>Distribution of "wishes to first 5★"</h2>
        <p>
          Even though the per-pull rate climbs smoothly, the <em>distribution</em>{' '}
          of when your 5★ actually arrives looks bumpy. Most pulls before pity 76
          have only a 0.6% chance, so the early region is a slow-growing bump.
          Then the soft pity step at 76 dumps a huge mass of probability into a
          narrow window.
        </p>
        <FirstFiveStarChart curves={curves} maxWishes={maxWishes} />
        <p className="caption">
          P(your first 5★ lands at exactly wish N), starting from a fresh
          pity counter.
        </p>
        <p>
          The same data viewed cumulatively — <em>P(any 5★ by wish N)</em>:
        </p>
        <FirstFiveStarCumulativeChart curves={curves} />
        <p className="caption">
          The curve is essentially flat through pity 75, then climbs fast once
          soft pity kicks in, hitting 100% at the hard pity wall (wish 90).
        </p>
      </section>

      <section>
        <h2>The 50/50 and the guarantee</h2>
        <p>
          On the limited banner, when you win a 5★ it's a coin flip: 50% chance
          it's the promotional character (a "win"), 50% chance it's a random
          standard 5★ (a "loss"). If you lose, the next 5★ you pull is{' '}
          <strong>guaranteed</strong> to be the promo. So in the worst case you
          need 2 5★s — at most 90 + 90 = 180 pulls — to guarantee one promo.
        </p>
      </section>

      <section>
        <h2>Capturing Radiance (post-5.0)</h2>
        <p>
          Capturing Radiance ("CR") is a counter, 0–3, that tracks how many
          50/50s you've recently lost. It can override a loss into a win, but
          only when the counter is high enough. By default the counter starts
          at 1 (per the post-5.0 baseline diagram from CN community
          analysis).
        </p>
        <p><strong>Counter transitions</strong> (only when a 50/50 actually fires — guaranteed wins from a prior loss don't change the counter):</p>
        <ul>
          <li>Counter 0, win → stays 0; loss → 1</li>
          <li>Counter 1, win → 0; loss → 2</li>
          <li>Counter 2, natural win → 1; <em>CR triggers</em> with probability q₂ → 1; loss → 3</li>
          <li>Counter 3 — next 50/50 is forced into a CR-win → counter 1</li>
        </ul>

        <h3 style={{ marginTop: '1rem' }}>The q₂ debate — two competing models</h3>
        <p>
          The probability of CR triggering at counter 2 (q₂) is{' '}
          <strong>not officially published</strong>. Two main theories exist
          in the community, and the calculator lets you switch between them.
        </p>

        <div className="model-card-row">
          <div className={'model-card' + (crModel === 'official' ? ' active' : '')}>
            <div className="model-card-title">{CR_MODELS.official.label}</div>
            <div className="model-card-q">q₂ = 1/11 ≈ 9.09%</div>
            <ModelBreakdownBar q={CR_MODELS.official.q[2]} />
            <p className="model-card-body">
              Back-solved from HoYoverse's announced "55% consolidated promo
              rate." Assumes the official number is exact in steady state.
              Mathematically clean, matches the published 1.103% per-pull
              promo rate, but assumes infinite pulls.
            </p>
          </div>
          <div className={'model-card' + (crModel === 'community' ? ' active' : '')}>
            <div className="model-card-title">{CR_MODELS.community.label}</div>
            <div className="model-card-q">q₂ = 50%</div>
            <ModelBreakdownBar q={CR_MODELS.community.q[2]} />
            <p className="model-card-body">
              Player heuristic: "the third 50/50 is more like 75/25 in your
              favor." Steady-state promo rate works out to ~57.1%, which
              <em> disagrees</em> with the official 55%. Some community
              analysts argue HoYoverse's published rates run a few percent low
              (HSR's "50/50" is empirically ~56/44, etc.), so the true rate
              may be above 55%.
            </p>
          </div>
        </div>

        <p style={{ marginTop: '1rem' }}>
          The two models give the same answer for C0 and very nearly the same
          for C1, but the gap widens fast for C2+. Here's P(reach C2) under
          each model — the gap shows where CR's value most affects your real
          wishes:
        </p>
        <ModelComparisonChart curvesByModel={curvesByModel} maxWishes={maxWishes} />
        <p className="caption">
          The Calculator currently uses the <strong>{CR_MODELS[crModel].label}</strong>{' '}
          model ({CR_MODELS[crModel].short}). Switch at the top of the
          Calculator tab.
        </p>

        <h3 style={{ marginTop: '1.5rem' }}>What CR means for getting C0 (and other constellations)</h3>
        <p>
          <strong>For C0:</strong> CR has no effect, in either model. The C0
          path involves at most one 50/50 (at the starting counter, 0 or 1).
          Both models have q = 0 at counters 0 and 1, so CR can't trigger.
          Whether you win that 50/50 directly or lose and take the next 5★
          via the regular post-loss guarantee, you arrive at C0 the same way
          you would under the pre-5.0 system.
        </p>
        <p>
          <strong>For C1+:</strong> CR starts to matter. As you pull more,
          the counter can climb to 2 (where q₂ matters) or 3 (forced CR win).
          The two models disagree on how much CR helps in the q₂=2 region —
          which is exactly the region most "going for higher constellations"
          paths spend their time in.
        </p>
      </section>

      <section>
        <h2>Distribution of "wishes to first promo (C0)"</h2>
        <p>
          The first-promo distribution is the same shape as first 5★, but
          shifted and reweighted by the 50/50. The second hump around wish 152
          is the "I lost the first 50/50, now I need a second 5★" case — soft
          pity from the second cycle stacks on top of the first.
        </p>
        <PromoDistChart curves={curves} maxWishes={maxWishes} />
        <p>
          And cumulative — <em>P(have the promo by wish N)</em>:
        </p>
        <PromoCumulativeChart curves={curves} />
        <p className="caption">
          Reaches ~59% by wish 90 (one cycle), then continues climbing as
          post-loss guarantees fill in. Hits 100% by wish 180 — the absolute
          worst case is "lose at hard pity 90, then guarantee at next hard
          pity 180."
        </p>
      </section>

      <section>
        <h2>P(reach Cn) curves</h2>
        <p>
          Putting it all together — here's the cumulative probability of
          reaching each constellation as a function of wishes spent:
        </p>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={showNoCR}
            onChange={(e) => setShowNoCR(e.target.checked)}
          />
          <span>Overlay pre-5.0 curves (no Capturing Radiance) — for comparison only</span>
        </label>
        {showNoCR && (
          <div className="warning-box">
            ⚠️ The dashed lines show what the same probability calculation
            would look like under the <strong>pre-5.0 system</strong>, before
            Capturing Radiance was added. <strong>This is no longer how
            Genshin works</strong> — it's shown to illustrate how much CR
            shifted the odds. Many older simulations and calculators still
            use the pre-5.0 model and underreport your true chances.
          </div>
        )}

        <ConstellationCurvesChart
          curves={curves}
          curvesNoCR={showNoCR ? curvesNoCR : null}
          maxWishes={maxWishes}
          showNoCR={showNoCR}
        />
        <p className="caption">
          Each curve shifts right and flattens. Going from C5 to C6 takes
          almost as many wishes as the entire C0–C2 journey.
        </p>

        <h3 style={{ marginTop: '1.5rem' }}>How much does CR shift the threshold wishes?</h3>
        <p>
          Wishes needed to reach 50%, 90%, and 99% probability per
          constellation, current system vs. pre-5.0:
        </p>
        <CRImpactTable curves={curves} curvesNoCR={curvesNoCR} />
        <p className="caption">
          CR shaves 1–10+ wishes off the typical thresholds and grows in
          absolute size for higher constellations. The pre-5.0 numbers are
          what 1B-pull simulations from before patch 5.0 still report.
        </p>
      </section>
    </div>
  );
}
