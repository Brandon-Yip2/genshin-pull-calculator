import { useCallback } from 'react';
import usePersistentState from './usePersistentState.js';
import {
  FOUR_STAR_CHARACTER_NAMES,
  MAX_CONSTELLATION,
  NOT_OWNED,
  STANDARD_FIVE_STAR_NAMES,
  defaultRoster,
} from './data/roster.js';

const ROSTER_KEY = 'gpc-roster-v1';
const FEATURED_KEY = 'gpc-featured-4star-v1';

const DEFAULT_FEATURED = ['Bennett', 'Fischl', 'Xiangling'];

function isValidState(v) {
  return Number.isInteger(v) && v >= NOT_OWNED && v <= MAX_CONSTELLATION;
}

// Merge a stored roster over the current defaults so that adding a new
// character to the roster data never invalidates an existing save.
function validateRoster(parsed, fallback) {
  const merged = {
    fourStar: { ...fallback.fourStar },
    fiveStar: { ...fallback.fiveStar },
    promoFiveCopies: fallback.promoFiveCopies,
  };
  if (!parsed || typeof parsed !== 'object') return merged;
  for (const name of FOUR_STAR_CHARACTER_NAMES) {
    const v = parsed.fourStar?.[name];
    if (isValidState(v)) merged.fourStar[name] = v;
  }
  for (const name of STANDARD_FIVE_STAR_NAMES) {
    const v = parsed.fiveStar?.[name];
    if (isValidState(v)) merged.fiveStar[name] = v;
  }
  const copies = parsed.promoFiveCopies;
  if (Number.isInteger(copies) && copies >= 0 && copies <= 7) {
    merged.promoFiveCopies = copies;
  }
  return merged;
}

function validateFeatured(parsed, fallback) {
  if (!Array.isArray(parsed)) return fallback;
  const names = FOUR_STAR_CHARACTER_NAMES;
  const cleaned = parsed.filter((n) => names.includes(n)).slice(0, 3);
  while (cleaned.length < 3) cleaned.push(names[cleaned.length]);
  return cleaned;
}

export default function useRoster() {
  const [roster, setRoster] = usePersistentState(
    ROSTER_KEY,
    defaultRoster,
    validateRoster
  );
  const [featured, setFeatured] = usePersistentState(
    FEATURED_KEY,
    DEFAULT_FEATURED,
    validateFeatured
  );

  const setConstellation = useCallback(
    (group, name, value) => {
      setRoster((prev) => ({
        ...prev,
        [group]: { ...prev[group], [name]: value },
      }));
    },
    [setRoster]
  );

  const setAll = useCallback(
    (group, value) => {
      const names =
        group === 'fourStar'
          ? FOUR_STAR_CHARACTER_NAMES
          : STANDARD_FIVE_STAR_NAMES;
      setRoster((prev) => {
        const next = { ...prev[group] };
        for (const name of names) next[name] = value;
        return { ...prev, [group]: next };
      });
    },
    [setRoster]
  );

  const setPromoFiveCopies = useCallback(
    (copies) => {
      setRoster((prev) => ({ ...prev, promoFiveCopies: copies }));
    },
    [setRoster]
  );

  const resetRoster = useCallback(() => {
    setRoster(defaultRoster());
    setFeatured(DEFAULT_FEATURED);
  }, [setRoster, setFeatured]);

  const setFeaturedAt = useCallback(
    (index, name) => {
      setFeatured((prev) => {
        const next = [...prev];
        next[index] = name;
        return next;
      });
    },
    [setFeatured]
  );

  return {
    roster,
    featured,
    setConstellation,
    setAll,
    setPromoFiveCopies,
    setFeaturedAt,
    resetRoster,
  };
}
