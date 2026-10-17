import { describe, expect, it } from 'vitest';

import { parseDiscovery, sheetFilterCount, toListQuery, toSearch } from './filters';

describe('discovery in the address', () => {
  it('reads what it knows and drops the rest', () => {
    const state = parseDiscovery({ category: 'music,books', type: 'online,teleport', sort: 'bogus', date: 'yesterday', page: '3' });
    expect(state).toMatchObject({ category: ['music', 'books'], type: ['online'], date: undefined, page: 3 });
    expect(state).not.toHaveProperty('sort');
  });

  it('round-trips through the address', () => {
    const state = parseDiscovery({ q: 'موسیقی', category: 'music', price: 'free', available: 'true', date: '2026-10-17' });
    expect(parseDiscovery(Object.fromEntries(new URLSearchParams(toSearch(state).slice(1))))).toEqual(state);
  });

  it('asks the API for a chosen day as a one-day range', () => {
    expect(toListQuery(parseDiscovery({ date: '2026-10-17' }))).toMatchObject({ from: '2026-10-17', to: '2026-10-17', sort: 'newest' });
  });

  it('counts only the sheet’s own filters', () => {
    expect(sheetFilterCount(parseDiscovery({ category: 'music', q: 'x', city: 'تهران', interested: 'true' }))).toBe(2);
  });
});
