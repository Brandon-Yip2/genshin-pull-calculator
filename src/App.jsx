import { useState, useMemo } from 'react';
import { computeCurves, MAX_COPIES } from './probability.js';
import Calculator from './Calculator.jsx';
import Explanation from './Explanation.jsx';
import './App.css';

// Absolute worst case to guarantee C6 from the post-5.0 default counter=1.
// Capturing Radiance caps consecutive losses at 2 from c=1, then forces a
// CR-win (90 pulls instead of another 180-pull L,G cycle). The
// pull-maximizing path is L,G | L,G | forced-W repeating: 3 promos per
// 450 pulls, plus a partial trailing L,G = 180 pulls.
// For C6 (7 promos): 2 full macros + 1 leftover L,G = 900 + 180 = 1080.
const MAX_WISHES = 1080;

export default function App() {
  const [tab, setTab] = useState('calculator');

  // Compute the curves once and pass them to both tabs.
  // ~2000 pulls × 5760 states is ~11M operations; runs in well under a second.
  const curves = useMemo(() => computeCurves(MAX_WISHES), []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Genshin Pull Probability Calculator</h1>
        <p className="subtitle">
          Exact probabilities (no simulation) for getting C0 through C6 of a
          limited 5★ character, including the post-5.0 Capturing Radiance
          mechanic.
        </p>
        <nav className="tabs">
          <button
            className={tab === 'calculator' ? 'tab active' : 'tab'}
            onClick={() => setTab('calculator')}
          >
            Calculator
          </button>
          <button
            className={tab === 'explanation' ? 'tab active' : 'tab'}
            onClick={() => setTab('explanation')}
          >
            How it works
          </button>
        </nav>
      </header>
      <main className="app-main">
        {tab === 'calculator' && (
          <Calculator curves={curves} maxWishes={MAX_WISHES} maxCopies={MAX_COPIES} />
        )}
        {tab === 'explanation' && (
          <Explanation curves={curves} maxWishes={MAX_WISHES} />
        )}
      </main>
      <footer className="app-footer">
        Pure-math model. Source on{' '}
        <a
          href="https://github.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        . Not affiliated with HoYoverse.
      </footer>
    </div>
  );
}
