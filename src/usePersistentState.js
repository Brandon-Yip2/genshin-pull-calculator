import { useEffect, useState } from 'react';

// Small localStorage-backed state helper. Reads once on mount (falling back to
// `fallback` if the key is missing or unparseable) and writes on every change.
// `fallback` may be a value or a lazy factory returning one.
function resolve(fallback) {
  return typeof fallback === 'function' ? fallback() : fallback;
}

export default function usePersistentState(key, fallback, validate) {
  const [value, setValue] = useState(() => {
    const initial = resolve(fallback);
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initial;
      const parsed = JSON.parse(raw);
      return validate ? validate(parsed, initial) : parsed;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage disabled / full -- the app still works, it just won't persist.
    }
  }, [key, value]);

  return [value, setValue];
}
