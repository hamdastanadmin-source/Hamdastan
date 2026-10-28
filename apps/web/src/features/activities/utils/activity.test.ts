import { describe, expect, it } from 'vitest';

import { resultHeading, worldLabel } from './activity';

describe('worldLabel', () => {
  it('is null when the activity is filed under no world', () => {
    expect(worldLabel([])).toBeNull();
  });

  it('names the world', () => {
    expect(worldLabel([{ id: 'a', name: 'GTA' }])).toBe('GTA');
  });

  it('names the first world and counts the rest', () => {
    expect(
      worldLabel([
        { id: 'a', name: 'GTA' },
        { id: 'b', name: 'هاگوارتز' },
        { id: 'c', name: 'لیورپول' },
      ])
    ).toBe('GTA +۲');
  });
});

describe('resultHeading', () => {
  it('names the test and the person', () => {
    expect(resultHeading('شخصیت‌شناسی', { firstName: 'سارا', lastName: 'احمدی' })).toBe('نتیجه تست شخصیت‌شناسی - سارا احمدی');
  });

  it('names only the test when the person has no name yet', () => {
    expect(resultHeading('شخصیت‌شناسی', { firstName: null, lastName: null })).toBe('نتیجه تست شخصیت‌شناسی');
    expect(resultHeading('شخصیت‌شناسی', null)).toBe('نتیجه تست شخصیت‌شناسی');
  });
});
