import { useState, useMemo, useEffect } from 'react';
import {
  computeCurves,
  MAX_COPIES,
  Q_BY_COUNTER_NO_CR,
  CR_MODELS,
} from './probability.js';
import Calculator from './Calculator.jsx';
import Explanation from './Explanation.jsx';
import './App.css';

const THEME_KEY = 'gpc-theme';
const CR_MODEL_KEY = 'gpc-cr-model';

function initialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function initialCrModel() {
  if (typeof window === 'undefined') return 'official';
  const stored = localStorage.getItem(CR_MODEL_KEY);
  return CR_MODELS[stored] ? stored : 'official';
}

// Absolute worst case to guarantee C6 from the post-5.0 default counter=1.
// Capturing Radiance caps consecutive losses at 2 from c=1, then forces a
// CR-win (90 pulls instead of another 180-pull L,G cycle). The
// pull-maximizing path is L,G | L,G | forced-W repeating: 3 promos per
// 450 pulls, plus a partial trailing L,G = 180 pulls.
// For C6 (7 promos): 2 full macros + 1 leftover L,G = 900 + 180 = 1080.
const MAX_WISHES = 1080;

export default function App() {
  const [tab, setTab] = useState('calculator');
  const [theme, setTheme] = useState(initialTheme);
  const [crModel, setCrModel] = useState(initialCrModel);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(CR_MODEL_KEY, crModel);
  }, [crModel]);

  // Pre-compute curves for every supported CR model + the no-CR pre-5.0
  // baseline. Each is ~1080 pulls × 5760 states; total compute time well
  // under a second on mount, then it's just an array lookup per slider tick.
  const curvesByModel = useMemo(() => {
    const out = {};
    for (const id of Object.keys(CR_MODELS)) {
      out[id] = computeCurves(MAX_WISHES, { qByCounter: CR_MODELS[id].q });
    }
    return out;
  }, []);
  const curvesNoCR = useMemo(
    () => computeCurves(MAX_WISHES, { qByCounter: Q_BY_COUNTER_NO_CR }),
    []
  );
  const curves = curvesByModel[crModel];

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-row">
          <h1>Genshin Pull Probability Calculator</h1>
          <button
            className="theme-btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
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
          <Calculator
            curves={curves}
            maxWishes={MAX_WISHES}
            maxCopies={MAX_COPIES}
            crModel={crModel}
            setCrModel={setCrModel}
          />
        )}
        {tab === 'explanation' && (
          <Explanation
            curves={curves}
            curvesByModel={curvesByModel}
            curvesNoCR={curvesNoCR}
            maxWishes={MAX_WISHES}
            crModel={crModel}
          />
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
