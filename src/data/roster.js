// Static wish-pool data for the Genshin economy model.
//
// Sources (all cross-checked against the Genshin Impact Wiki, which in turn
// cites HoYoverse's in-game "Details" text and the bilibili 9.45M-wish
// community rate estimation):
//   - Wanderlust Invocation item pool  -> standard 4★ characters,
//     standard 5★ characters, and the 4★ weapon count.
//   - Character Event Wish             -> 1 promo 5★ + 3 featured 4★,
//     no 5★ weapons in the pool.
//
// The Character Event Wish draws its non-featured 4★ items from the standard
// pool, where 4★ characters and 4★ weapons have equal base rates (2.55%
// each), i.e. a 50/50 character-vs-weapon split inside the standard portion.

// Element metadata, used for badge colours in the UI.
export const ELEMENTS = {
  anemo: { label: 'Anemo', color: '#74c2a8' },
  geo: { label: 'Geo', color: '#fab632' },
  electro: { label: 'Electro', color: '#b08fc7' },
  dendro: { label: 'Dendro', color: '#a5c83b' },
  hydro: { label: 'Hydro', color: '#4cc2f1' },
  pyro: { label: 'Pyro', color: '#ef7938' },
  cryo: { label: 'Cryo', color: '#9fd6e9' },
};

// Standard 5★ characters available on Wanderlust Invocation and as the
// "lost 50/50" result on the Character Event Wish.
export const STANDARD_FIVE_STAR_CHARACTERS = [
  { name: 'Dehya', element: 'pyro' },
  { name: 'Diluc', element: 'pyro' },
  { name: 'Jean', element: 'anemo' },
  { name: 'Keqing', element: 'electro' },
  { name: 'Mona', element: 'hydro' },
  { name: 'Qiqi', element: 'cryo' },
  { name: 'Tighnari', element: 'dendro' },
  { name: 'Yumemizuki Mizuki', element: 'anemo' },
];

// Every 4★ character reachable from the Character Event Wish: the 50
// standard-pool characters (all 4★ characters are added to the standard pool
// one update after debut) plus the 3 featured slots, which are drawn from
// this same set.
export const FOUR_STAR_CHARACTERS = [
  { name: 'Aino', element: 'hydro' },
  { name: 'Amber', element: 'pyro' },
  { name: 'Barbara', element: 'hydro' },
  { name: 'Beidou', element: 'electro' },
  { name: 'Bennett', element: 'pyro' },
  { name: 'Candace', element: 'hydro' },
  { name: 'Charlotte', element: 'cryo' },
  { name: 'Chevreuse', element: 'pyro' },
  { name: 'Chongyun', element: 'cryo' },
  { name: 'Collei', element: 'dendro' },
  { name: 'Dahlia', element: 'hydro' },
  { name: 'Diona', element: 'cryo' },
  { name: 'Dori', element: 'electro' },
  { name: 'Faruzan', element: 'anemo' },
  { name: 'Fischl', element: 'electro' },
  { name: 'Freminet', element: 'cryo' },
  { name: 'Gaming', element: 'pyro' },
  { name: 'Gorou', element: 'geo' },
  { name: 'Iansan', element: 'electro' },
  { name: 'Ifa', element: 'anemo' },
  { name: 'Illuga', element: 'geo' },
  { name: 'Jahoda', element: 'anemo' },
  { name: 'Kachina', element: 'geo' },
  { name: 'Kaeya', element: 'cryo' },
  { name: 'Kaveh', element: 'dendro' },
  { name: 'Kirara', element: 'dendro' },
  { name: 'Kujou Sara', element: 'electro' },
  { name: 'Kuki Shinobu', element: 'electro' },
  { name: 'Lan Yan', element: 'anemo' },
  { name: 'Layla', element: 'cryo' },
  { name: 'Lisa', element: 'electro' },
  { name: 'Lynette', element: 'anemo' },
  { name: 'Mika', element: 'cryo' },
  { name: 'Ningguang', element: 'geo' },
  { name: 'Noelle', element: 'geo' },
  { name: 'Ororon', element: 'electro' },
  { name: 'Prune', element: 'anemo' },
  { name: 'Razor', element: 'electro' },
  { name: 'Rosaria', element: 'cryo' },
  { name: 'Sayu', element: 'anemo' },
  { name: 'Sethos', element: 'electro' },
  { name: 'Shikanoin Heizou', element: 'anemo' },
  { name: 'Sucrose', element: 'anemo' },
  { name: 'Thoma', element: 'pyro' },
  { name: 'Xiangling', element: 'pyro' },
  { name: 'Xingqiu', element: 'hydro' },
  { name: 'Xinyan', element: 'pyro' },
  { name: 'Yanfei', element: 'pyro' },
  { name: 'Yaoyao', element: 'dendro' },
  { name: 'Yun Jin', element: 'geo' },
];

// The 31 standard 4★ weapons. They always award a flat 2 Starglitter each, so
// only the count matters for the economy model.
export const STANDARD_FOUR_STAR_WEAPON_COUNT = 31;

export const FOUR_STAR_CHARACTER_NAMES = FOUR_STAR_CHARACTERS.map((c) => c.name);
export const STANDARD_FIVE_STAR_NAMES = STANDARD_FIVE_STAR_CHARACTERS.map((c) => c.name);

// paimon.moe serves character portraits at lowercase-underscore slugs.
export function characterSlug(name) {
  return name
    .toLowerCase()
    .replace(/['’.:]/g, '')
    .replace(/\s+/g, '_');
}

export function characterIconUrl(name) {
  return `https://paimon.moe/images/characters/${characterSlug(name)}.png`;
}

// paimon.moe also serves the seven element symbols as full-colour PNGs, which
// the character cards use on their element chip.
export function elementIconUrl(element) {
  return `https://paimon.moe/images/elements/${element}.png`;
}

// Constellation state per character: -1 = not owned, 0..6 = C0..C6.
export const NOT_OWNED = -1;
export const MAX_CONSTELLATION = 6;

// "Not owned" placeholder glyph, so the model can be built without claiming a
// character is owned.
export const OWNERSHIP_STATES = [
  { value: NOT_OWNED, label: '—', title: 'Not owned (no Starglitter on duplicate)' },
  { value: 0, label: 'C0', title: 'Owned at C0 (duplicates award Starglitter)' },
  { value: 1, label: 'C1', title: 'C1' },
  { value: 2, label: 'C2', title: 'C2' },
  { value: 3, label: 'C3', title: 'C3' },
  { value: 4, label: 'C4', title: 'C4' },
  { value: 5, label: 'C5', title: 'C5' },
  { value: 6, label: 'C6', title: 'C6 — max constellation (duplicates award the boosted Starglitter)' },
];

// Default roster:
//   - standard characters default to C0 (owned, no constellations), which is
//     what most established accounts look like. New accounts should use the
//     "All unowned" quick action.
//   - the limited 5★ defaults to unowned, because it is banner-specific.
export function defaultRoster() {
  const fourStar = {};
  for (const name of FOUR_STAR_CHARACTER_NAMES) fourStar[name] = 0;
  const fiveStar = {};
  for (const name of STANDARD_FIVE_STAR_NAMES) fiveStar[name] = 0;
  return {
    fourStar,
    fiveStar,
    promoFiveCopies: 0, // copies already owned of the current promo 5★ (0..7)
  };
}
