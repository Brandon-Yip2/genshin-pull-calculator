import { useState, useMemo, useEffect, useDeferredValue } from "react";
import {
  computeCurves,
  MAX_COPIES,
  Q_BY_COUNTER_NO_CR,
} from "./probability.js";
import Backdrop from "./Backdrop.jsx";
import Calculator from "./Calculator.jsx";
import Explanation from "./Explanation.jsx";
import Stardust from "./Stardust.jsx";
import useRoster from "./useRoster.js";
import { economyReport } from "./starglitter.js";

const THEME_KEY = "gpc-theme";

const TABS = [
  { id: "calculator", label: "Calculator" },
  { id: "explanation", label: "How it works" },
];

function resolveTheme() {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

// Applies the theme as a side effect so the very first paint is already in the
// right palette. Doing this in an effect instead would flash the default theme
// for a frame.
function applyTheme(theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", `genshin-${theme}`);
  }
}

function initialTheme() {
  const theme = resolveTheme();
  applyTheme(theme);
  return theme;
}

// Absolute worst case to guarantee C6 from the post-5.0 default counter=1.
// Capturing Radiance caps consecutive losses at 2 from c=1, then forces a
// CR-win (90 pulls instead of another 180-pull L,G cycle). The
// pull-maximizing path is L,G | L,G | forced-W repeating: 3 promos per
// 450 pulls, plus a partial trailing L,G = 180 pulls.
// For C6 (7 promos): 2 full macros + 1 leftover L,G = 900 + 180 = 1080.
// This is the largest number the wish *input* accepts.
const MAX_WISHES = 1080;

// The chains are precomputed this far, which must cover the input PLUS the
// refund the input earns (~10-12% on top), so probabilities can be looked up
// at the "effective" wish count. Costs ~130 ms per model at this width.
const MAX_EFFECTIVE_PULLS = 1500;

const DEFAULT_START_STATE = {
  startingFivePity: 0,
  startingFourPity: 0,
  guaranteed: false,
  featuredFourGuaranteed: false,
  crCounter: 1,
};

export default function App() {
  const [tab, setTab] = useState("calculator");
  // The single wish count for the whole page: it drives both the
  // constellation odds and the Stardust / Starglitter refund below them.
  const [wishes, setWishes] = useState(80);
  // Pity / guarantee state of the banner you are pulling on. Shared, because
  // it changes both the constellation odds and the refund you earn.
  const [startState, setStartState] = useState(DEFAULT_START_STATE);
  // Whether the refund is folded into the wish count used for the odds.
  const [includeRefund, setIncludeRefund] = useState(true);
  const [theme, setTheme] = useState(initialTheme);
  const {
    roster,
    featured,
    setConstellation,
    setAll,
    setPromoFiveCopies,
    setFeaturedAt,
    resetRoster,
  } = useRoster();

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Pre-compute the live curves plus the no-CR pre-5.0 baseline used for
  // comparison. Each is ~1500 pulls x 5760 states; total compute time is well
  // under a second on mount, then it's just an array lookup per slider tick.
  const curvesNoCR = useMemo(
    () =>
      computeCurves(MAX_EFFECTIVE_PULLS, { qByCounter: Q_BY_COUNTER_NO_CR }),
    [],
  );
  // The "How it works" page explains the mechanic itself, so it always shows
  // fresh-banner curves (pity 0, no guarantee, default counter).
  const curvesFresh = useMemo(() => computeCurves(MAX_EFFECTIVE_PULLS), []);

  // The Calculator, on the other hand, answers "what happens to ME", so its
  // curves start from the real banner state you entered. Deferred so typing in
  // the pity box stays responsive instead of recomputing a 1500-pull chain per
  // keystroke.
  const deferredStartState = useDeferredValue(startState);
  const curves = useMemo(
    () =>
      computeCurves(MAX_EFFECTIVE_PULLS, {
        startingPity: deferredStartState.startingFivePity,
        guarantee: deferredStartState.guaranteed ? 1 : 0,
        crCounter: deferredStartState.crCounter,
      }),
    [deferredStartState],
  );

  // What these wishes earn back. Computed once here so the calculator's
  // headline probability and the refund section below can never disagree.
  const economy = useMemo(
    () => economyReport({ wishes, roster, featuredFour: featured, startState }),
    [wishes, roster, featured, startState],
  );

  // The refund is an EXPECTATION, so it is only an estimate of the extra pulls
  // you will really get. Floored to a whole number (and kept out of the
  // fraction) so "400 + 33 = 433" adds up on screen and matches the wish count
  // the odds were looked up at.
  const refundWishes = Math.floor(economy.selfFinancing.extraWishes);
  const creditedRefund = includeRefund ? refundWishes : 0;
  const effectiveWishes = Math.min(
    MAX_EFFECTIVE_PULLS,
    wishes + creditedRefund,
  );

  return (
    <>
      <Backdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="g-hero sticky top-0 z-40">
          <div className="mx-auto w-full max-w-5xl px-4 pb-5 pt-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="g-diamond shrink-0" aria-hidden="true" />
                  <span className="g-eyebrow">
                    Wish economy &amp; probability model
                  </span>
                </div>
                <h1 className="g-hero-title mt-2 text-2xl sm:text-[2rem]">
                  Genshin Pull Probability Calculator
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#f2ead9]/70">
                  Exact probabilities (no simulation) for getting C0 through C6
                  of a limited 5★ character, including the post-5.0 Capturing
                  Radiance mechanic — plus what your wishes earn back in
                  Masterless Stardust and Starglitter, credited straight back
                  into the odds.
                </p>
              </div>
              <button
                type="button"
                className="g-btn g-btn-icon shrink-0 text-base"
                onClick={() =>
                  setTheme((t) => (t === "dark" ? "light" : "dark"))
                }
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>
            </div>

            <div role="tablist" className="g-tabs mt-6">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={"g-tab" + (tab === t.id ? " active" : "")}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* max-w-5xl rather than 6xl: the blurred landscape needs room at the
          sides, the way the game's settings list leaves the world visible
          around it. */}
        <main className="mx-auto w-full max-w-5xl grow px-4 py-8">
          {tab === "calculator" && (
            <>
              <Calculator
                curves={curves}
                startState={startState}
                maxWishes={MAX_WISHES}
                maxCopies={MAX_COPIES}
                wishes={wishes}
                setWishes={setWishes}
                effectiveWishes={effectiveWishes}
                refundWishes={creditedRefund}
                totalRefundWishes={refundWishes}
                refundExact={economy.selfFinancing.extraWishes}
                includeRefund={includeRefund}
                setIncludeRefund={setIncludeRefund}
              />
              <Stardust
                wishes={wishes}
                startState={startState}
                setStartState={setStartState}
                roster={roster}
                featured={featured}
                setFeaturedAt={setFeaturedAt}
                setConstellation={setConstellation}
                setAll={setAll}
                setPromoFiveCopies={setPromoFiveCopies}
                resetRoster={resetRoster}
              />
            </>
          )}
          {tab === "explanation" && (
            <Explanation
              curves={curvesFresh}
              curvesNoCR={curvesNoCR}
              maxWishes={MAX_WISHES}
              theme={theme}
            />
          )}
        </main>

        <footer className="g-footer py-6">
          <div className="mx-auto max-w-5xl px-4 text-center text-xs">
            Pure-math model. Source on{" "}
            <a
              href="https://github.com/Brandon-Yip2/genshin-pull-calculator"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            . Not affiliated with HoYoverse.
          </div>
        </footer>
      </div>
    </>
  );
}
