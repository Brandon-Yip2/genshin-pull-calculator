import { useMemo, useState } from 'react';
import {
  ELEMENTS,
  ELEMENT_ORDER,
  FOUR_STAR_CHARACTERS,
  MAX_CONSTELLATION,
  NOT_OWNED,
  OWNERSHIP_STATES,
  STANDARD_FIVE_STAR_CHARACTERS,
  characterIconUrl,
  elementIconUrl,
} from './data/roster.js';
import { STARGLITTER_PER_FATE, glitterForCharacter } from './starglitter.js';

// The three ways the picker can be ordered.
const SORTS = [
  { id: 'name', label: 'Name' },
  { id: 'element', label: 'Element' },
  { id: 'release', label: 'Release' },
];

const byName = (a, b) => a.name.localeCompare(b.name);

/**
 * Orders a roster group. "Element" groups by the game's own element order
 * (Anemo -> Cryo) with names alphabetical inside each group; "Release" is
 * chronological by the ISO debut date recorded in the roster data.
 */
function sortRoster(list, mode) {
  const out = [...list];
  if (mode === 'element') {
    return out.sort(
      (a, b) =>
        ELEMENT_ORDER.indexOf(a.element) - ELEMENT_ORDER.indexOf(b.element) ||
        byName(a, b)
    );
  }
  if (mode === 'release') {
    return out.sort((a, b) => a.released.localeCompare(b.released) || byName(a, b));
  }
  return out.sort(byName);
}

// The element symbol, hidden entirely if the CDN does not have it (the chip
// still carries the element name, so nothing breaks).
function ElementIcon({ element }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      className="g-chip-icon"
      src={elementIconUrl(element)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function CharacterIcon({ name, element }) {
  const [failed, setFailed] = useState(false);
  const color = ELEMENTS[element]?.color;
  if (failed) {
    return (
      <span
        className="roster-icon roster-icon-fallback"
        style={{ borderColor: color }}
      >
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <img
      className="roster-icon"
      src={characterIconUrl(name)}
      alt=""
      loading="lazy"
      style={{ borderColor: color }}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * A character card, styled like a Genshin inventory entry: the saturated
 * quality gradient (purple 4★, gold 5★), an element-tinted portrait, a
 * parchment name strip carrying the Starglitter payout, and the C0–C6 picker
 * as the diamond constellation nodes from the constellation screen.
 */
function CharacterCard({ name, element, stars, value, version, showVersion, onChange }) {
  const unowned = value === NOT_OWNED;
  const glitter = glitterForCharacter(stars, value);
  const elementMeta = ELEMENTS[element];

  return (
    <div
      className={
        'rarity-card flex flex-col ' +
        (stars === 5 ? 'rarity-5' : 'rarity-4') +
        ' el-' +
        element +
        (unowned ? ' is-unowned' : '')
      }
    >
      <div className="relative flex flex-col items-center gap-1.5 px-2.5 pb-2 pt-3">
        <span className="g-chip absolute left-1.5 top-1.5" title={elementMeta?.label}>
          <ElementIcon element={element} />
          {elementMeta?.label}
        </span>
        {showVersion && version && (
          <span
            className="g-chip g-chip-version absolute right-1.5 top-1.5"
            title={`Debuted in version ${version}`}
          >
            {version}
          </span>
        )}
        <div className="w-16">
          <CharacterIcon name={name} element={element} />
        </div>
        <span className="g-stars" title={`${stars}★`}>
          {'★'.repeat(stars)}
        </span>
      </div>

      <div className="card-strip flex items-center justify-between gap-2 px-2.5 py-1.5">
        <span className="truncate text-xs font-bold" title={name}>
          {name}
        </span>
        <span
          className={'glitter-badge shrink-0 tnum' + (unowned ? ' is-none' : '')}
          title={
            unowned
              ? 'Not owned — no Starglitter for this duplicate'
              : `+${glitter} Starglitter per duplicate (${
                  glitter / STARGLITTER_PER_FATE
                } wishes at ${STARGLITTER_PER_FATE} each)`
          }
        >
          {unowned ? '—' : `+${glitter}`}
        </span>
      </div>

      <div className="card-nodes flex flex-wrap items-center justify-between gap-0.5 px-1.5 py-1.5">
        {OWNERSHIP_STATES.map((state) => (
          <button
            key={state.value}
            type="button"
            title={state.title}
            aria-label={`${name} ${state.label}`}
            aria-pressed={value === state.value}
            className={
              'g-node' +
              (value === state.value ? ' active' : '') +
              (state.value === NOT_OWNED ? ' unowned' : '')
            }
            onClick={() => onChange(state.value)}
          >
            <span className="g-node-shape" />
            <span className="g-node-label">{state.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const GROUPS = [
  { id: 'fourStar', label: '4★ characters', list: FOUR_STAR_CHARACTERS, stars: 4 },
  {
    id: 'fiveStar',
    // Named for what they are in practice: these are the characters a lost
    // 50/50 on the Character Event Wish can hand you.
    label: 'Standard 5★ (lose a 50/50 to)',
    list: STANDARD_FIVE_STAR_CHARACTERS,
    stars: 5,
  },
];

export default function RosterEditor({
  roster,
  setConstellation,
  setAll,
  setPromoFiveCopies,
  resetRoster,
}) {
  const [group, setGroup] = useState('fourStar');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name');

  const active = GROUPS.find((g) => g.id === group);
  const values = roster[group];

  const stats = useMemo(() => {
    let owned = 0;
    let maxed = 0;
    let glitterSum = 0;
    for (const c of active.list) {
      const v = values[c.name];
      if (v !== NOT_OWNED) owned++;
      if (v === MAX_CONSTELLATION) maxed++;
      glitterSum += glitterForCharacter(active.stars, v);
    }
    return {
      total: active.list.length,
      owned,
      maxed,
      avgGlitter: glitterSum / active.list.length,
    };
  }, [active, values]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = active.list;
    const matched = q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
    return sortRoster(matched, sort);
  }, [active, query, sort]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="g-tabs">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={group === g.id}
              data-count={g.list.length}
              className={'g-tab' + (group === g.id ? ' active' : '')}
              onClick={() => setGroup(g.id)}
            >
              {g.label}
              <span className="g-tab-count tnum">{g.list.length}</span>
            </button>
          ))}
        </div>

        <input
          className="input input-sm ml-auto w-full max-w-xs"
          type="search"
          placeholder="Search characters…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider opacity-60">Sort by</span>
          <div role="tablist" aria-label="Sort characters" className="g-tabs">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={sort === s.id}
                className={'g-tab g-tab-sm' + (sort === s.id ? ' active' : '')}
                onClick={() => setSort(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs opacity-70">
        <span>
          <strong className="opacity-100">{stats.owned}</strong>/{stats.total}{' '}
          owned
        </span>
        <span>
          <strong className="opacity-100">{stats.maxed}</strong> at C6
        </span>
        <span>
          avg{' '}
          <strong className="opacity-100">{stats.avgGlitter.toFixed(2)}</strong>{' '}
          Starglitter per duplicate
        </span>
        </div>
      </div>

      <p className="g-panel p-3 text-xs leading-relaxed opacity-80">
        {group === 'fourStar'
          ? 'Duplicates pay 2 Starglitter, or 5 once the character is C6. A character you do not own pays nothing — you just get the character.'
          : 'Duplicates pay 10 Starglitter, or 25 once C6 — 25 Starglitter is exactly 5 wishes.'}{' '}
        <strong>Stardust never comes from characters</strong>, only from 3★
        weapons (15 each), so no constellation on this page can change your
        Stardust.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="g-btn g-btn-ghost g-btn-sm"
          onClick={() => setAll(group, 0)}
        >
          All owned (C0)
        </button>
        <button
          type="button"
          className="g-btn g-btn-ghost g-btn-sm"
          onClick={() => setAll(group, MAX_CONSTELLATION)}
        >
          All at C6
        </button>
        <button
          type="button"
          className="g-btn g-btn-ghost g-btn-sm"
          onClick={() => setAll(group, NOT_OWNED)}
        >
          All unowned
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-3">
        {filtered.map((c) => (
          <CharacterCard
            key={c.name}
            name={c.name}
            element={c.element}
            stars={active.stars}
            value={values[c.name]}
            version={c.version}
            showVersion={sort === 'release'}
            onChange={(v) => setConstellation(group, c.name, v)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm opacity-60">
            No characters match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>

      {/* Always visible: it is a 5★ input, so hiding it behind the 4★ tab was
          confusing. */}
      <div className="g-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs opacity-60">
            Copies of the <em>limited</em> 5★ you already own
          </span>
          <select
            className="select select-sm max-w-md"
            value={roster.promoFiveCopies}
            onChange={(e) => setPromoFiveCopies(Number(e.target.value))}
          >
            <option value={0}>Not owned — first copy is new (0 Starglitter)</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                C{n - 1} — {n} cop{n === 1 ? 'y' : 'ies'}
                {n >= 7 ? ' (C6, +25 each)' : ' (+10 each)'}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="g-btn g-btn-ghost g-btn-sm g-btn-danger"
          onClick={resetRoster}
        >
          Reset roster
        </button>
      </div>
    </div>
  );
}
