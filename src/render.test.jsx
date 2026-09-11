import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App.jsx';
import Stardust from './Stardust.jsx';
import Calculator from './Calculator.jsx';
import RosterEditor from './RosterEditor.jsx';
import { defaultRoster } from './data/roster.js';
import { computeCurves } from './probability.js';

const FEATURED = ['Bennett', 'Fischl', 'Xiangling'];
const noop = () => {};

const START_STATE = {
  startingFivePity: 0,
  startingFourPity: 0,
  guaranteed: false,
  featuredFourGuaranteed: false,
  crCounter: 1,
};

function renderStardust(roster, wishes = 160) {
  return renderToString(
    <Stardust
      wishes={wishes}
      startState={START_STATE}
      setStartState={noop}
      roster={roster}
      featured={FEATURED}
      setFeaturedAt={noop}
      setConstellation={noop}
      setAll={noop}
      setPromoFiveCopies={noop}
      resetRoster={noop}
    />
  );
}

// Smoke tests: these catch render-time crashes (bad prop shape, undefined
// lookups, bad number formatting) that a successful bundle would not.
describe('render smoke tests', () => {
  it('renders the app shell with two tabs, refund inline on the calculator', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Genshin Pull Probability Calculator');
    expect(html).toContain('How it works');
    // The landscape the panels float on. The painted mesh is the fallback and
    // the bundled screenshot layers on top of it, so a missing image degrades
    // to the painting rather than to a blank page.
    expect(html).toContain('g-backdrop-mesh');
    expect(html).toContain('g-backdrop-scrim');
    expect(html).toContain('/backdrop.jpg');
    // The refund is part of the calculator page, not a tab of its own.
    expect(html).toContain('Stardust &amp; Starglitter');
    expect(html).toContain('Extra wishes from Starglitter');
    expect(html).not.toContain('class="tab active">Stardust');
  });

  it('ships the backdrop image it points at', async () => {
    const { BACKDROP_IMAGE } = await import('./data/backdrop.js');
    const { existsSync } = await import('node:fs');
    // A missing file would silently fall back to the painted mesh, which is
    // exactly the regression this guards: the backdrop is part of the design.
    const file = new URL(`../public${BACKDROP_IMAGE}`, import.meta.url);
    expect(existsSync(file)).toBe(true);
  });

  it('renders the refund section with formatted currency', () => {
    const html = renderStardust(defaultRoster());
    expect(html).toContain('Masterless Stardust');
    expect(html).toContain('Masterless Starglitter');
    expect(html).toContain('Extra wishes from Starglitter');
    // The reward breakdown is a settings-style row list, not a table.
    expect(html).toContain('g-rows');
    expect(html).toContain('g-row-label');
    // A 160-wish run always earns thousands of Stardust.
    expect(html).toMatch(/[0-9],[0-9]{3}/);
  });

  it('folds the expected refund into the wish count the odds use', () => {
    const html = renderToString(<App />);
    const nums = (name) =>
      Number(html.match(new RegExp(`data-${name}="(\\d+)"`))[1]);
    const wishes = nums('wishes');
    const refund = nums('refund');
    const effective = nums('effective');
    // The refund is real, and the odds are looked up at wishes + refund.
    expect(refund).toBeGreaterThan(0);
    expect(effective).toBe(wishes + refund);
    expect(effective).toBeGreaterThan(wishes);
    // The refund can be switched off, and there is a control to do it.
    expect(html).toContain('including my expected refund');
  });

  it('follows the wish count it is given', () => {
    const small = renderStardust(defaultRoster(), 160);
    const large = renderStardust(defaultRoster(), 1080);
    expect(small).not.toBe(large);
    expect(large).toContain('1,080 wishes');
    expect(small).toContain('160 wishes');
  });

  it('renders an entirely unowned roster without crashing', () => {
    const roster = defaultRoster();
    for (const name of Object.keys(roster.fourStar)) roster.fourStar[name] = -1;
    for (const name of Object.keys(roster.fiveStar)) roster.fiveStar[name] = -1;
    expect(renderStardust(roster)).toContain('Masterless Starglitter');
  });

  it('drives the odds and the slider labels from the banner state', () => {
    const curvesFor = (startState) =>
      computeCurves(1500, {
        startingPity: startState.startingFivePity,
        guarantee: startState.guaranteed ? 1 : 0,
        crCounter: startState.crCounter,
      });
    const props = {
      startState: START_STATE,
      maxWishes: 1080,
      wishes: 90,
      setWishes: noop,
      effectiveWishes: 90,
      refundWishes: 0,
      totalRefundWishes: 0,
      refundExact: 0,
      includeRefund: true,
      setIncludeRefund: noop,
    };

    const fresh = renderToString(
      <Calculator {...props} curves={curvesFor(START_STATE)} />
    );
    expect(fresh).toContain('a fresh banner');
    // Fresh banner: the slider landmark for C0 is the familiar 180.
    expect(fresh).toContain('data-tick="180"');

    // Mid-pity + a guarantee: the odds rise and the landmarks slide left.
    const advanced = { ...START_STATE, startingFivePity: 60, guaranteed: true };
    const withState = renderToString(
      <Calculator {...props} startState={advanced} curves={curvesFor(advanced)} />
    );
    expect(withState).toContain('your current banner state');
    expect(withState).toContain('5★ pity already at 60');
    expect(withState).toContain('next 5★ already guaranteed');
    // The guarantee makes the very next 5★ the promo, and 60 pity is already
    // banked: C0 is certain 30 pulls from now instead of 180.
    expect(withState).toContain('data-tick="30"');
    expect(withState).not.toContain('data-tick="180"');
  });

  it('renders every 4★ roster card with a constellation picker', () => {
    const html = renderToString(
      <RosterEditor
        roster={defaultRoster()}
        setConstellation={noop}
        setAll={noop}
        setPromoFiveCopies={noop}
        resetRoster={noop}
      />
    );
    expect(html).toContain('Aino');
    expect(html).toContain('Yun Jin');
    expect(html).toContain('Search characters');
    expect(html).toContain('All at C6');
    // The standard 5★ (lost 50/50) selector must be reachable, not just 4★.
    // The grid only renders the active group, so assert on the tab itself.
    expect(html).toContain('Standard 5★ (lose a 50/50 to)');
    expect(html).toContain('data-count="8"');
    // ...and the currency rule must be spelled out on the card grid.
    expect(html).toContain('Stardust never comes from characters');
  });
});
