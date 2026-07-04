#!/usr/bin/env node
/**
 * Scroll test helper for Lidl beer listing page
 *
 * Purpose:
 *  - Reproduce lazy-loading behavior and experiment with scrolling strategies.
 *  - Quickly check how many tiles become "loaded" vs placeholders.
 *
 * Why it exists:
 *  - Some pages rely on realistic wheel/touch events to trigger IntersectionObservers
 *    and XHRs. `window.scrollTo` may be insufficient; this script helps iterate
 *    on strategies without changing the main scraper.
 *
 * Usage:
 *  - Run against the default Lidl kraft beers list:
 *      node BeerScraper/dev/scroll-test.mjs
 *  - Or pass a URL:
 *      node BeerScraper/dev/scroll-test.mjs "https://www.lidl.pl/c/piwa-kraftowe/a10072919"
 *
 * Notes:
 *  - This is a development helper; it is safe to keep in the repo under
 *    `BeerScraper/dev/` or remove if you prefer a cleaner tree.
 */

import { chromium } from 'playwright';

async function run() {
  const url = process.argv[2] || 'https://www.lidl.pl/c/piwa-kraftowe/a10072919';
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 900, height: 720 }, javaScriptEnabled: true });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  console.log('Initial counts:');
  console.log(await counts(page));

  // Method 1: full scroll to bottom repeatedly
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }));
    await page.waitForTimeout(500);
  }
  console.log('After full-page scrolls:');
  console.log(await counts(page));

  // Method 2: incremental small scrolls (wheel) — proved effective on this site
  await page.evaluate(() => window.scrollTo(0, 0));
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(200);
  }
  console.log('After wheel scrolls:');
  console.log(await counts(page));

  // Method 3: scroll main/documentElement
  await page.evaluate(() => {
    const el = document.querySelector('main') || document.documentElement;
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(1000);
  console.log('After main/documentElement scroll:');
  console.log(await counts(page));

  await browser.close();
}

async function counts(page) {
  return page.evaluate(() => {
    const loaded = document.querySelectorAll('[data-gridbox-impression]').length;
    const placeholder = document.querySelectorAll('[data-grid-data]').length;
    return { loaded, placeholder };
  });
}

run().catch(e => { console.error(e); process.exit(1); });
