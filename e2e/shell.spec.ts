import { expect, test } from '@playwright/test';

import { MOBILE_SHELL_MAX_WIDTH } from '@hamdastan/config';

/**
 * The product is a mobile app wherever it is opened.
 *
 * On a laptop that means the same phone screen, centred in a column — not a
 * wider layout. This is the one rule a stray `md:` in a page would break
 * silently, so it is checked rather than reviewed.
 */

test('renders right-to-left in Persian', async ({ page }) => {
  await page.goto('/welcome');

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  // Light by default (PRD §Theme); dark is opt-in from settings.
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('keeps the content in a centred column and never scrolls sideways', async ({
  page,
}, testInfo) => {
  await page.goto('/welcome');

  const column = page.locator('[data-shell]');
  const box = await column.boundingBox();
  expect(box).not.toBeNull();

  const viewport = page.viewportSize()!;
  expect(box!.width).toBeLessThanOrEqual(MOBILE_SHELL_MAX_WIDTH);

  if (testInfo.project.name === 'desktop') {
    // Centred: the gap on each side of the column is the same.
    const start = box!.x;
    const end = viewport.width - (box!.x + box!.width);
    expect(Math.abs(start - end)).toBeLessThanOrEqual(2);
    expect(box!.width).toBe(MOBILE_SHELL_MAX_WIDTH);
  }

  const scrollsSideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(scrollsSideways).toBe(false);
});

test('is installable: the manifest asks for a standalone window', async ({
  page,
  request,
}) => {
  await page.goto('/welcome');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest'
  );

  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.dir).toBe('rtl');
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512'])
  );
  expect(
    manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')
  ).toBe(true);
});

test('stays a phone at any desktop width', async ({ page }) => {
  await page.goto('/welcome');

  // The widest screen anyone will open this on is still the same column. A
  // breakpoint added to a page by accident shows up here as a wider box.
  for (const width of [1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });

    const box = await page.locator('[data-shell]').boundingBox();
    expect(box!.width, `at ${width}px`).toBe(MOBILE_SHELL_MAX_WIDTH);
    expect(Math.round(box!.x), `at ${width}px`).toBe(
      Math.round((width - MOBILE_SHELL_MAX_WIDTH) / 2)
    );
  }
});
