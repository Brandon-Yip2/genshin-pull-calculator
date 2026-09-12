# Genshin Pull Probability Calculator

Interactive, exact-math calculator for Genshin Impact wishes:

1. **Calculator** — the probability of reaching each constellation (C0–C6) of a
   limited 5★ character with a given number of wishes.
2. **Stardust & Starglitter** — directly below it on the same page: what those
   wishes earn back in Masterless Stardust and Starglitter, how many extra
   wishes that buys, and a tracker for your 4★ and standard 5★ constellations
   (saved in your browser).

A single wish count drives the whole page — change it in the box at the top
and both the constellation odds and the refund below follow.

## The odds account for the refund

The headline probability is looked up at your **effective** wish count:

```
400 wishes  +  33 refunded wishes  =  433 wishes  ->  P(reach Ck) at 433
```

The refund is the Masterless Starglitter your pulls earn, converted at 5 per
Intertwined Fate. It depends on your 4★ and standard 5★ constellations, the
banner's three featured 4★, and the wish count — so filling in the roster
below changes the headline odds above. A checkbox turns the credit off if you
want the raw number.

Two honesty notes:

- The refund is an **expectation**, not a guarantee, so folding it in as if it
  were certain makes the odds **slightly optimistic**. Real runs land a little
to either side.
- **Stardust is excluded** from the credit. Its Paimon's Bargains fates are a
  flat 5 per month, so they do not scale with how much you pull.

The chains are precomputed to 1,500 pulls rather than 1,080 so that lookups
remain valid past the largest refund (1,080 + ~114).

## The odds start from your real banner state

Pity counters carry over between banners, so the calculator does not assume you
start from zero. The **Advanced: your current pity / guarantee** panel in the
Stardust & Starglitter section feeds all three of:

- the **odds** — the Markov chain is re-driven from your 5★ pity, existing
  guarantee, and Capturing Radiance counter;
- the **slider landmarks** — the C0–C6 ticks are the hard-guarantee pull counts,
  so they slide left when you already carry pity;
- the **currency** you earn from the pulls you have left.

The hard-guarantee ("100%") threshold per constellation is solved exactly
instead of with a closed form: `worstCasePullsForCopies` in `probability.js`
explores the adversarial path through every 50/50 / guarantee / Capturing
Radiance branch. From a fresh banner it reproduces the familiar
180 / 360 / 450 / 630 / 810 / 900 / 1080, and it shrinks by your banked pity
(e.g. C0 at 120 with 60 pity, 90 with an existing guarantee, 30 with both).

Only the *How it works* page keeps fresh-banner curves, because it explains the
mechanic itself rather than any particular account.

**No simulation** for the pity maths. A Markov chain over the full state
`(pity 1..90) × (guarantee) × (Capturing Radiance counter 0..3) × (copies 0..7)`
is propagated one pull at a time, and the currency model is an exact
expectation over its own chains. The one exception is the optional
"distribution" panel, which runs a seeded Monte Carlo (clearly labelled) to
show percentiles rather than just the mean.

## What's modeled

### 5★

- **Base rate** 0.6% per pull (official).
- **Soft pity** — community model from the bilibili 9.45M-wish estimation,
  which is what the wiki cites:

  | Wishes since last 5★ | Rate |
  | --- | --- |
  | 1–73 | 0.6% |
  | 74–89 | `0.6% + (X − 73) × 6%` → 6.6% @74, 18.6% @76, 42.6% @80, 96.6% @89 |
  | 90 | 100% (hard pity, official) |

  This curve averages out to the official **1.6%** consolidated rate exactly:
  the mean wait for a 5★ is 62.3 pulls (1/62.3 = 1.605%). About 35.5% of 5★s
  arrive before soft pity.
- **50/50 + guarantee.** On the Character Event Wish a 5★ is 50/50 promo vs. a
  standard-pool character (the banner contains no 5★ weapons); losing makes the
  next 5★ a guaranteed promo. Counters carry over between banners of the same
  type.
- **Capturing Radiance** (post-5.0). HoYoverse publishes only two things: the
  base trigger chance is **0.018% per wish**, and if the promo 5★ has been the
  second 5★ obtained on three consecutive occasions, the next is guaranteed to
  trigger it. Everything else — including the counter the calculator uses, and
  the value of `q₂` — is a community model. What *is* anchored is the published
  **"consolidated 55%"**: that figure describes the effective win rate of a
  **non-guaranteed 50/50**, and the default model is back-solved to reproduce it
  exactly. (Note the promo share of *all* 5★ events is ~69%, because a lost
  50/50 hands you a guarantee — the 55% is not that number.)

### 4★ and currencies

- **Rates**: 5.1% base, 13% including pity. Pity curve (community estimation):
  5.1% for 1–8 wishes since the last 4★, **56.1% at 9**, **100% at 10**.
  A 5★ satisfies the "4★ or higher" guarantee **without resetting** the 4★
  counter, which is what makes the 4★ process independent of the 5★ one.
- **Featured 4★**: every 4★ item has a 50% chance to be one of the banner's
  three featured characters, and a miss guarantees a featured one next. In
  steady state that makes **~2/3 of your 4★ items featured** characters.
- **The standard portion** of the 4★ pool splits 50/50 between characters and
  weapons (equal 2.55% base rates).
- **Masterless Stardust** — 15 per 3★ weapon. Since every non-4★/5★ item on the
  banner is a 3★ weapon, that is **~12.8 Stardust per wish**. It is spent at
  **75 per Intertwined Fate**, limited to 5 per month — but that purchase is
  *not* counted towards the extra-wishes figure (see below).
- **Masterless Starglitter** — awarded *instead of* the item:

  | Pull | Starglitter |
  | --- | --- |
  | 4★ weapon | 2 |
  | 5★ weapon | 10 |
  | 4★ character, not owned | 0 (you get the character) |
  | 4★ character, owned, below C6 | 2 |
  | 4★ character, owned at C6 | 5 |
  | 5★ character, not owned | 0 |
  | 5★ character, owned, below C6 | 10 |
  | 5★ character, owned at C6 | 25 |

  Spent at **5 per Intertwined Fate**, limited to 5 per month.
- **Stardust never comes from characters.** No character pull pays Stardust at
  any rarity or constellation — the 10/25 a 5★ duplicate pays is *Starglitter*
  (25 Starglitter = exactly 5 wishes). So the constellation selectors move the
  Starglitter line and the extra-wish count, and by design cannot move the
  Stardust line: a C6 standard 5★ changes your refund by 5 wishes per duplicate
  and changes your Stardust by zero.
- **Extra wishes are bought with Starglitter only**, at 5 per Intertwined
  Fate. Because those bought wishes earn Starglitter of their own, the
  calculator solves the fixed point rather than the one-shot total.
  **Stardust is deliberately not converted**: its Paimon's Bargains fates are a
  flat 5 per month regardless of how much you pull, so crediting them would
  claim a refund that does not scale with your session. Stardust is still
  reported in full — it is just not spendable in this model.
- For scale, Stardust is the much larger *return stream* (~12.8/wish at 75 per
  fate) than Starglitter (~0.3–0.6/wish at 5 per fate). Neither is called
  "a wish costs 5 stardust"; the two currencies are distinct.

## Your roster

The refund depends on **which 4★ and standard 5★ characters you own and at what
constellation**, because a duplicate only pays out if you already own the
character, and pays 5 (4★) or 25 (5★) instead of 2 or 10 at C6. The roster
editor stores your picks in `localStorage` (`gpc-roster-v1`), shows each
character's portrait, and exposes `—` (not owned) plus C0–C6 per character, with
quick "all owned / all C6 / all unowned" actions. It also tracks your copy count
of the current limited 5★ and the three featured 4★ on the banner.

The picker can be ordered by **Name**, **Element** (grouped in the game's own
Anemo → Cryo order) or **Release** (chronological by debut date, with the debut
version shown on each card). Release data lives in `src/data/roster.js` as a
single chronological table, and `roster.test.js` fails if a character is ever
added without it.

**All 51 of the 4★ characters** are listed, current to Version 7.0 (Alyosha,
Electro, the newest). The list is checked against the wiki's 4★ category, so
adding a character means adding one entry to `FOUR_STAR_BASE` and one to
`RELEASE_EVENTS`; the test asserts the count and the newest debut so a version
bump cannot quietly go unnoticed.

## Stack

- React + Vite, no backend
- **Tailwind CSS v4 + DaisyUI 5** for the UI, with two custom themes, both
  complete looks rather than one look dimmed: `genshin-light` is the game's
  **parchment** screens (`#fbf7ec` cream on `#e2d7ba`), and `genshin-dark` is its
  **night** screens -- the Wish details and battle pass -- slate `#313848` panels
  on a near-neutral `#191c26` backdrop, with the parchment layer turned into a
  dim warm brown (`#4b4437`) carrying light ink. Edit them in `src/index.css`.
- The look copies the in-game menu language rather than a generic dashboard, and
  it is built from **four layers**, because the contrast *between* them is what
  makes it read as Genshin rather than as one flat colour:

  | Layer | What it is |
  | --- | --- |
  | Chrome | dark slate header and footer in **both** themes, so light mode never becomes a single sheet of cream |
  | Slate panels | faintly blue (not saturated — over-saturating it turns the whole page one colour), with gold **L-brackets** at the corners |
  | **Parchment** | the surface for anything holding results or choices: the headline probability, the constellation rows, the reward readout, every panel header bar, every disclosure header. Cream with dark slate ink in light mode; **dim warm brown with light ink** in dark mode, so dark mode is a genuinely dark theme rather than a cream page with a slate header |
  | Quality + element | purple 4★ / gold 5★ card gradients, each leaning toward its own element hue, plus the element symbol on a chip |

  Other Genshin-specific touches: **cream buttons and tab fills with dark slate
  text** (the most recognisable trait of the UI — that inversion is fixed, not
  themed), gold hairline dividers and diamonds, cream header bars on panels,
  **star pips**, diamonds as bullets on every tab, and the C0–C6 picker drawn as
  the **diamond nodes** from the constellation screen (via `clip-path`, so a lit
  node can be outlined without the rotated box overflowing its cell). These are
  the `.g-*` classes in `src/index.css`.

### Dark mode

Dark mode gets the same warm parchment and gold trim, at night: the parchment
layer drops from L\* ~97 to L\* ~35 and its ink flips from dark slate to warm
cream, driven by tokens (`--g-parch-*`, `--g-row-*`) rather than by a pile of
selector overrides, so one block governs the readout panels, the reward rows,
the header bars, the collapsible summaries and the tables inside them.

Measured on a full-page render (1280×5900, the whole app):

| | before | after |
| --- | --- | --- |
| **Dark** mean L\* | 63.9 | **49.5** |
| **Dark** pixels above L\* 70 | 28.4% | **9.0%** |
| **Dark** cream-toned pixels | 25.5% | **7.1%** |
| **Light** (unchanged) | 68.0 / 36.2% / 28.3% | 68.0 / 36.2% / 28.3% |

Two things follow from going dark that are easy to miss, and the contrast audit
(`npm`-less; see below) caught both:

- **Reduced-opacity secondary text** needs more alpha on a dark surface than on
a cream one. Light ink at 60% over a mid-brown row lands near 3:1, so the muted
steps are raised inside the dark parchment layer only.
- **Translucent dark surfaces are not reliably dark.** A bright patch of the
landscape showing through a 0.8-alpha row lifts it into the mid-tones and the
row's own sub-labels fall to 2.8:1, so the dark surfaces are close to opaque.

Because the surfaces went dark, the "selected" row can no longer say so by being
much lighter -- that is what breaks the sub-label contrast. It is marked with a
gold ring and glow instead.

**Verified by pixel measurement, not by eye.** Text contrast was audited by
rendering the real app in a 1280×5900 frame and, for every text node, reading
the ink from computed style and measuring the actual background pixels inside
that node's box -- which resolves gradient-painted surfaces, translucency and
the world showing through in one go. The backdrop is pinned to each of its two
measured extremes (`#aebcb1`, `#142027`) and the worst result per label kept, so
the answer does not depend on image-load timing. Against the same audit on the
previous CSS: **dark failures 104 → 61, with none newly introduced and 43
fixed**; light mode unchanged at 104.

### The world behind the UI

The game renders its menus over a blurred view of wherever you are standing —
which is the main reason its cream rows read as parchment rather than as a slab
of yellow: the world shows through them. The app does the same, with three
stacked layers (`src/Backdrop.jsx`):

1. a painted gradient landscape, as a fallback so a missing image never breaks
   the look;
2. a real screenshot of the world — `public/backdrop.jpg`, committed with the
   app and layered over the painting;
3. the scrim, darkest at the top where the chrome sits and much lighter through
   the middle.

The screenshot is blurred only **slightly** (`blur(7px)`): enough to sit behind
the UI, not enough to turn the world into a coloured smear. Measured in a real
browser against the previous `blur(26px)` over the same image, that is **2.4×
more local detail** (4.02 vs 1.67) at the same mean brightness.

Surfaces above it are translucent with a `backdrop-filter` blur, so the
landscape tints every panel. Because a bright daylight scene lifts the backdrop
a long way, anything sitting *directly* on the world — section headings,
intros, small stat lines — carries a soft dark **halo** (`text-shadow`), exactly
as the game's menu labels do. The halo is applied to `main` and the chrome and
switched off again inside every painted surface, so panels and rows keep crisp
unshadowed type.

**To use your own screenshot**, overwrite `public/backdrop.jpg` (or point
`BACKDROP_IMAGE` in `src/data/backdrop.js` at another path or URL) — any
landscape will do, since it gets blurred either way and need not be high
resolution or free of UI. The default is a Genshin landscape from Wallhaven;
swap it for your own if you would rather.

Contrast is audited rather than assumed. A sweep of every text node on the page,
composited through the translucent panels against the actual backdrop pixels,
reports **zero failures for text on the world in both themes** and a worst case
of 3.9:1 for on-surface text. The remaining known cases are all pre-existing and
on tinted surfaces, not the backdrop: the 30px currency stats in light mode
(≈2.3:1) and the 12px fine print in dark mode (≈3.9:1).

Two rules keep the important cases legible: **dark ink on every cream surface,
bright gold on the dark backdrop.**

- Recharts for the explanation charts (its colours are bridged to the active
  theme via the semantic variables in `src/index.css`)
- Vitest for the math and render tests
- Pure client-side; deploy anywhere static

## Running locally

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run lint     # eslint
npm run build    # production bundle in dist/
```

## Deploy

The repo includes `vercel.json`. Push to GitHub, import on Vercel, done.

### Knowing which revision is live

The footer carries the build identity (`src/buildInfo.js`), e.g.
`v1.0.0 · build 19 · cb3a457`, linked to that exact commit and with the full
hash, branch, build time and a dirty-tree flag on hover.

The **commit hash is the source of truth**, and it is the better of the two
options: Vercel builds exactly one deployment per commit, so the hash both
identifies the code and proves the deploy is the one you pushed. A version
number cannot do that -- it can go stale, and two different builds can share
one. The number is still shown, because it is the readable one, with a commit
count as an automatically-incrementing build number beside it. Bump `version`
in `package.json` on notable releases; the hash needs no discipline at all.

`vite.config.js` injects it at build time via `define`, preferring Vercel's
`VERCEL_GIT_COMMIT_SHA` and falling back to reading git, so the hash shown on
the deployed site is exactly the deployed commit. Outside a git checkout the
badge degrades to `v… · dev` rather than breaking the build.

## Layout

```text
src/
  probability.js        # 5★ Markov chain (pure JS)
  probability.test.js   # curve shape, 55% 50/50 anchor, monotonicity
  starglitter.js        # Stardust/Starglitter economy + Monte Carlo
  starglitter.test.js   # published-rate checks, roster effects, sim cross-check
  verification.test.js  # triple-method verification (see below)
  roster.test.js        # pool sizes, element order, release-date coverage
  useRoster.js          # localStorage roster + featured-4★ state
  usePersistentState.js # small localStorage hook
  data/roster.js        # standard pools, elements, release dates, icon URLs
  data/backdrop.js      # backdrop image path (ships as public/backdrop.jpg)
  buildInfo.js          # build identity (commit hash / version), injected by Vite
  Backdrop.jsx          # the blurred landscape + scrim behind everything
  RosterEditor.jsx      # 4★ / standard 5★ constellation tracker
  Stardust.jsx          # refund section, rendered under the calculator
  App.jsx               # page container (calculator + how-it-works tabs)
  Calculator.jsx        # slider + targets + refund-aware results
  Explanation.jsx       # walkthrough + Recharts charts
  index.css             # Tailwind + DaisyUI themes + the .g-* Genshin chrome
  render.test.jsx       # render smoke tests
```

## Verification

`src/verification.test.js` recomputes every headline number **three ways** and
requires them to agree:

| | Method | What it is |
| --- | --- | --- |
| A | The shipped engine | the exact DP in `probability.js` / `starglitter.js` |
| B | Monte Carlo | written from scratch in the test file, its own RNG, no shared code |
| C | Independent exact derivation | different mathematics again: the 5★ process as a renewal process (wait-time convolutions and an event-indexed chain), the 4★ process as a two-state alternating renewal, the hard guarantee as a *forward* min-promo DP, the refund fixed point by bisection |

The published inputs (rate curves, Starglitter table, Fate prices) are re-typed
in the test from the wiki rather than imported, so a typo in `src/` cannot hide
behind itself. Covered: C0–C6 probabilities at three banner states, the 50/50
rate landing on 55%, the promo share of all 5★ events landing on 20/29,
Stardust/Starglitter totals and every breakdown line, the C6 payout tiers for an
owned or unowned limited 5★, the extra-wishes fixed point, and the hard-guarantee
solver against an exhaustive forward search in seven counter/guarantee states.

## Accuracy notes

- The soft-pity curve and the 4★ pity curve are **community
  reverse-engineering**, not official. The official text gives only the
  boundary conditions (0.6%/1.6%/100% at 90, and 5.1%/13%/100% within 10).
- The Capturing Radiance counter and its `q₂` are community models. Only the
  55% consolidated 50/50 rate and the 0.018% base trigger are official.
- The 4★ identity model assumes the standard pool is uniformly distributed
  within the character/weapon halves, and that the featured three are equally
  likely.
- The wiki's 4★ curve (5.1% through wish 8, 56.1% at 9, 100% at 10) makes the
  4★ counter fire on **13.07%** of wishes. Because a 5★ on the same wish
  displaces the 4★ item, the app's actual 4★ *item* rate lands at **12.86%**
  per wish, against the 13.00% HoYoverse prints, and the 3★ rate comes out at
  85.5% rather than the published 85.4%. The gap is about 1% relative and
  carries proportionally into Stardust. The counter shape is kept exactly as
  the wiki publishes it rather than tuned to close the gap, since that curve is
  the published estimate and the official 13.00% was not constructed from it.
- Whether a 5★ *freezes* the 4★ counter or *advances* it is immaterial either
  way: measured across 8M pulls the two readings differ by 0.007%.
- A long run of duplicates would push characters toward C6 mid-run (raising
  later payouts). The model uses your *current* constellations as a fixed
  snapshot, so it is slightly conservative at very high wish counts.
- The simulated percentiles are a seeded Monte Carlo (4,000 accounts) and carry
  ordinary sampling error.

Not affiliated with HoYoverse. Character portraits are loaded from
[paimon.moe](https://paimon.moe); if an image fails to load the card falls back
to a monogram.
