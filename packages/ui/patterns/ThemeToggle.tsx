'use client';

import { useCallback } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '../primitives/button';
import { setTheme, useTheme } from '../tokens/theme.store';

/**
 * Switches the live token set and remembers the choice.
 *
 * `size="icon-touch"` rather than `icon`: at 36px this misses the 44px touch
 * minimum, and it is a control people reach for on a phone. The label is the
 * theme it switches *to*, which is what a screen reader should announce —
 * the glyph shows the same thing.
 */
export function ThemeToggle() {
  const theme = useTheme();
  const isDark = theme === 'dark';

  const toggle = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark]);

  return (
    <Button
      variant="ghost"
      size="icon-touch"
      onClick={toggle}
      aria-label={isDark ? 'حالت روشن' : 'حالت تاریک'}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
