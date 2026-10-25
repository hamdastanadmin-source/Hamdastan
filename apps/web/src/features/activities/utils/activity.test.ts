import { describe, expect, it } from 'vitest';

import { worldLabel } from './activity';

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
