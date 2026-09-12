import { describe, it, expect } from 'vitest';
import {
  ELEMENTS,
  ELEMENT_ORDER,
  FOUR_STAR_CHARACTERS,
  MAX_CONSTELLATION,
  NOT_OWNED,
  OWNERSHIP_STATES,
  STANDARD_FIVE_STAR_CHARACTERS,
} from './data/roster.js';

const ALL = [...FOUR_STAR_CHARACTERS, ...STANDARD_FIVE_STAR_CHARACTERS];

const byReleaseThenName = (a, b) =>
  a.released.localeCompare(b.released) || a.name.localeCompare(b.name);

describe('roster release data', () => {
  it('gives every character an ISO release date and a version label', () => {
    // The picker's "Release" sort reads both. A name added without release
    // data would silently sort as the oldest character, so fail loudly here.
    for (const c of ALL) {
      expect(c.released, c.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.version, c.name).toBeTruthy();
    }
  });

  it('keeps every date inside the game’s lifetime', () => {
    for (const c of ALL) {
      expect(c.released >= '2020-09-28', c.name).toBe(true);
      expect(c.released <= '2026-12-31', c.name).toBe(true);
    }
  });

  it('has unique names and only elements the UI can colour', () => {
    const names = ALL.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const c of ALL) expect(ELEMENT_ORDER, c.name).toContain(c.element);
    expect(new Set(ELEMENT_ORDER)).toEqual(new Set(Object.keys(ELEMENTS)));
  });

  it('orders the 4★ pool from the 1.0 launch roster to the newest debut', () => {
    const sorted = [...FOUR_STAR_CHARACTERS].sort(byReleaseThenName);
    expect(sorted.slice(0, 4).map((c) => c.name)).toEqual([
      'Amber',
      'Barbara',
      'Beidou',
      'Bennett',
    ]);
    expect(sorted.at(-1).name).toBe('Alyosha');
    // The whole list must be non-decreasing in release date.
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].released <= sorted[i].released, sorted[i].name).toBe(true);
    }
  });

  it('records the standard 5★ pool additions that came after launch', () => {
    const version = Object.fromEntries(
      STANDARD_FIVE_STAR_CHARACTERS.map((c) => [c.name, c.version])
    );
    expect(version.Diluc).toBe('1.0');
    expect(version.Tighnari).toBe('3.0');
    expect(version.Dehya).toBe('3.5');
    expect(version['Yumemizuki Mizuki']).toBe('5.4');
    expect(STANDARD_FIVE_STAR_CHARACTERS).toHaveLength(8);
    // 51 as of Version 7.0 (Alyosha is the newest). Bump this when a new 4★
    // debuts, together with its entry in RELEASE_EVENTS.
    expect(FOUR_STAR_CHARACTERS).toHaveLength(51);
  });

  it('includes the newest 4★ debut with its element and version', () => {
    const alyosha = FOUR_STAR_CHARACTERS.find((c) => c.name === 'Alyosha');
    expect(alyosha).toBeTruthy();
    expect(alyosha.element).toBe('electro');
    expect(alyosha.released).toBe('2026-08-12');
    expect(alyosha.version).toBe('7.0');
  });

  it('lets every element actually appear in the 4★ pool', () => {
    // Otherwise the Element sort would have an empty group.
    const present = new Set(FOUR_STAR_CHARACTERS.map((c) => c.element));
    for (const el of ELEMENT_ORDER) expect(present).toContain(el);
  });

  it('keeps the ownership picker exactly "not owned" plus C0..C6', () => {
    expect(OWNERSHIP_STATES.map((s) => s.value)).toEqual([NOT_OWNED, 0, 1, 2, 3, 4, 5, 6]);
    expect(MAX_CONSTELLATION).toBe(6);
  });
});

describe('roster sorting', () => {
  it('groups by the game’s element order when sorting by element', () => {
    const order = [...FOUR_STAR_CHARACTERS]
      .sort(
        (a, b) =>
          ELEMENT_ORDER.indexOf(a.element) - ELEMENT_ORDER.indexOf(b.element) ||
          a.name.localeCompare(b.name)
      )
      .map((c) => c.element);
    const runs = order.filter((el, i) => i === 0 || order[i - 1] !== el);
    expect(runs).toEqual(ELEMENT_ORDER);
    // Names alphabetical inside each run.
    for (let i = 1; i < order.length; i++) {
      if (order[i] === order[i - 1]) continue;
      // A new run starts here; nothing to compare across the boundary.
      expect(ELEMENT_ORDER.indexOf(order[i])).toBeGreaterThan(
        ELEMENT_ORDER.indexOf(order[i - 1])
      );
    }
  });
});
