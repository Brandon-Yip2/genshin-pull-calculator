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

// The order the game itself lists elements in, and the order the "Element"
// sort uses.
export const ELEMENT_ORDER = ['anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo'];

// ---------------------------------------------------------------------------
// Release data
// ---------------------------------------------------------------------------
// Debut date (ISO, so it sorts as a plain string) and version label for every
// character that can appear in these pools, taken from the Genshin Impact
// Wiki's character change history, which records the version each character was
// added in and on what date. 4★ and 5★ debuts are interleaved chronologically.
const RELEASE_EVENTS = [
  ['2020-09-28', '1.0', ['Amber', 'Barbara', 'Beidou', 'Bennett', 'Chongyun', 'Diluc', 'Fischl', 'Jean', 'Kaeya', 'Keqing', 'Lisa', 'Mona', 'Ningguang', 'Noelle', 'Qiqi', 'Razor', 'Sucrose', 'Xiangling', 'Xingqiu']],
  ['2020-11-11', '1.1', ['Diona']],
  ['2020-12-01', '1.1', ['Xinyan']],
  ['2021-04-06', '1.4', ['Rosaria']],
  ['2021-04-28', '1.5', ['Yanfei']],
  ['2021-08-10', '2.0', ['Sayu']],
  ['2021-09-01', '2.1', ['Kujou Sara']],
  ['2021-11-02', '2.2', ['Thoma']],
  ['2021-12-14', '2.3', ['Gorou']],
  ['2022-01-05', '2.4', ['Yun Jin']],
  ['2022-06-21', '2.7', ['Kuki Shinobu']],
  ['2022-07-13', '2.8', ['Shikanoin Heizou']],
  ['2022-08-24', '3.0', ['Collei', 'Tighnari']],
  ['2022-09-09', '3.0', ['Dori']],
  ['2022-09-28', '3.1', ['Candace']],
  ['2022-11-18', '3.2', ['Layla']],
  ['2022-12-07', '3.3', ['Faruzan']],
  ['2023-01-18', '3.4', ['Yaoyao']],
  ['2023-03-01', '3.5', ['Dehya']],
  ['2023-03-21', '3.5', ['Mika']],
  ['2023-05-02', '3.6', ['Kaveh']],
  ['2023-05-24', '3.7', ['Kirara']],
  ['2023-08-16', '4.0', ['Lynette']],
  ['2023-09-06', '4.0', ['Freminet']],
  ['2023-11-08', '4.2', ['Charlotte']],
  ['2024-01-09', '4.3', ['Chevreuse']],
  ['2024-01-31', '4.4', ['Gaming']],
  ['2024-06-05', '4.7', ['Sethos']],
  ['2024-08-28', '5.0', ['Kachina']],
  ['2024-11-20', '5.2', ['Ororon']],
  ['2025-01-21', '5.3', ['Lan Yan']],
  ['2025-02-12', '5.4', ['Yumemizuki Mizuki']],
  ['2025-03-26', '5.5', ['Iansan']],
  ['2025-05-07', '5.6', ['Ifa']],
  ['2025-06-18', '5.7', ['Dahlia']],
  ['2025-09-10', 'Luna I', ['Aino']],
  ['2025-12-03', 'Luna III', ['Jahoda']],
  ['2026-02-03', 'Luna IV', ['Illuga']],
  ['2026-05-20', 'Luna VII', ['Prune']],
];

const RELEASE_BY_NAME = new Map();
for (const [released, version, names] of RELEASE_EVENTS) {
  for (const name of names) RELEASE_BY_NAME.set(name, { released, version });
}

// Attaches `released` (ISO date) and `version` to a pool entry. Both are left
// empty for a name with no recorded debut, so a gap shows up as an obviously
// blank chip instead of silently sorting as the oldest character.
function withRelease(character) {
  return { ...character, ...(RELEASE_BY_NAME.get(character.name) ?? { released: '', version: '' }) };
}

// Standard 5★ characters available on Wanderlust Invocation and as the
// "lost 50/50" result on the Character Event Wish.
const STANDARD_FIVE_STAR_BASE = [
  { name: 'Dehya', element: 'pyro' },
  { name: 'Diluc', element: 'pyro' },
  { name: 'Jean', element: 'anemo' },
  { name: 'Keqing', element: 'electro' },
  { name: 'Mona', element: 'hydro' },
  { name: 'Qiqi', element: 'cryo' },
  { name: 'Tighnari', element: 'dendro' },
  { name: 'Yumemizuki Mizuki', element: 'anemo' },
];

export const STANDARD_FIVE_STAR_CHARACTERS = STANDARD_FIVE_STAR_BASE.map(withRelease);

// Every 4★ character reachable from the Character Event Wish: the 50
// standard-pool characters (all 4★ characters are added to the standard pool
// one update after debut) plus the 3 featured slots, which are drawn from
// this same set.
const FOUR_STAR_BASE = [
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

export const FOUR_STAR_CHARACTERS = FOUR_STAR_BASE.map(withRelease);

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
