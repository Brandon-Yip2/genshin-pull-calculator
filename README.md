# Genshin Pull Probability Calculator

Interactive, exact-math calculator for the probability of reaching each
constellation (C0–C6) of a limited 5★ character in Genshin Impact, given a
number of wishes.

**No simulation.** A Markov chain over the full state
`(pity 1..90) × (guarantee on/off) × (Capturing Radiance counter 0..3) × (copies 0..7)`
is propagated one pull at a time. Every number is deterministic.

## What's modeled

- **Base rate** 0.6% per pull (official).
- **Soft pity** — a step at pity 76 jumping to ~32%, ramping to 95% at pity 89.
  This curve is fitted to a 1B+ pull empirical dataset; it isn't officially
  published. With this curve our `P(C0 by N)` matches the dataset within ~2.5pp
  at every wish from 1–180.
- **Hard pity** at 90 (official).
- **50/50 + guarantee.** On the limited banner, a 5★ is 50/50 promo vs.
  standard; losing the 50/50 makes the next 5★ a guaranteed promo.
- **Capturing Radiance** (post-5.0 mechanic). A counter 0–3 tracks recent
  50/50 losses. At counter 2, CR can override a loss into a win with
  probability `q_2`. At counter 3, the next 50/50 is forced into a CR-win.
  We derive `q_2 = 1/11 ≈ 9.09%` analytically from the official
  "consolidated 55%" promo rate; this also matches the official 1.103%
  per-pull promo rate.
- **Counter starts at 1** by default (post-5.0 baseline per the official
  state diagram).

CR doesn't affect C0 (the counter never reaches 2 in the C0 path), but
it boosts C1+ probabilities by a small amount over many pulls.

## Stack

- React + Vite, no backend
- Recharts for the explanation charts
- Vitest for the math tests
- Pure client-side; deploy anywhere static

## Running locally

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run build    # production bundle in dist/
```

## Deploy

The repo includes `vercel.json`. Push to GitHub, import on Vercel, done.

## Layout

```text
src/
  probability.js      # math engine (pure JS, no React)
  probability.test.js # 12 tests; CSV parity, monotonicity, totals
  App.jsx             # tabs container
  Calculator.jsx      # slider + targets + results table
  Explanation.jsx     # walkthrough + Recharts charts
  App.css             # all styles
  index.css           # base reset
  main.jsx            # entry
```

## Disclaimer

Soft-pity numbers come from a community-reverse-engineered model fit to a
1B+ pull dataset. The official rules give only the boundary conditions
(0.6% base, 1.6% consolidated, 100% at 90). If the real curve differs,
output values will drift slightly; the structural math (50/50, guarantee,
CR) is exact per the official rules.

Not affiliated with HoYoverse.
