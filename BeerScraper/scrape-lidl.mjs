import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const TILE_SELECTOR = '[data-gridbox-impression]';
const SCROLL_PAUSE_MS = 700;
const STABLE_ROUNDS_REQUIRED = 3;
const MAX_SCROLL_ATTEMPTS = 40;

function parseArgs(argv) {
  let url;
  let out = 'beers.json';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url') {
      url = argv[++i];
    } else if (arg === '--out') {
      out = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  if (!url) {
    console.error('Error: --url is required.\n');
    printUsage();
    process.exit(1);
  }

  return { url, out };
}

function printUsage() {
  console.log(`Usage: npm run scrape -- --url "<LIDL_LISTING_URL>" [--out beers.json]

Options:
  --url   Lidl product listing URL (required)
  --out   Output JSON path (default: beers.json)
`);
}

async function scrollUntilAllTilesLoaded(page) {
  let previousCount = 0;
  let stableRounds = 0;

  for (let attempt = 1; attempt <= MAX_SCROLL_ATTEMPTS; attempt++) {
    const count = await page.locator(TILE_SELECTOR).count();
    console.log(`Scroll ${attempt}: ${count} tile(s)`);

    if (count === previousCount) {
      stableRounds++;
      if (stableRounds >= STABLE_ROUNDS_REQUIRED) {
        return count;
      }
    } else {
      stableRounds = 0;
      previousCount = count;
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(SCROLL_PAUSE_MS);
  }

  return page.locator(TILE_SELECTOR).count();
}

async function extractBeers(page) {
  return page.$$eval(TILE_SELECTOR, (tiles) =>
    tiles.map((tile) => {
      const rawData = tile.getAttribute('data-gridbox-impression');
      let productData = {};
      try {
        productData = JSON.parse(decodeURIComponent(rawData));
      } catch {
        // skip invalid tile data
      }

      const productUrl = tile.querySelector('a.odsc-tile__link')?.href || '';

      const images = Array.from(tile.querySelectorAll('img'));
      let packaging = 'Unknown';
      for (const img of images) {
        const alt = (img.alt || '').toLowerCase();
        if (alt.includes('puszka')) {
          packaging = 'Can';
          break;
        }
        if (alt.includes('butelka')) {
          packaging = 'Bottle';
          break;
        }
      }

      return {
        Name: productData.name || 'Unknown',
        Brewery: productData.brand || 'Unknown',
        Packaging: packaging,
        Price: productData.price,
        URL: productUrl,
      };
    })
  );
}

async function main() {
  const { url, out } = parseArgs(process.argv.slice(2));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log(`Opening: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector(TILE_SELECTOR, { timeout: 60_000 });

    const title = await page.title();
    console.log(`Page title: ${title}`);

    const tileCount = await scrollUntilAllTilesLoaded(page);
    const beers = await extractBeers(page);

    const result = {
      url: page.url(),
      scrapedAt: new Date().toISOString(),
      totalCount: beers.length,
      beers,
    };

    await writeFile(out, JSON.stringify(result, null, 2), 'utf8');
    console.log(`Wrote ${beers.length} beer(s) to ${out} (tiles after scroll: ${tileCount})`);

    if (beers.length === 0) {
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
