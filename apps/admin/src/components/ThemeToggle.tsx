'use client';

import { Moon, Sun } from 'lucide-react';

import { Button } from '@hamdastan/ui';
import { setTheme, useTheme } from '@hamdastan/ui/tokens/theme.store';

/** Light/dark, through the same store and pre-paint script as the product. */
export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={next === 'dark' ? 'حالت تیره' : 'حالت روشن'}
    >
      {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}
