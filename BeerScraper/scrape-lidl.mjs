import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const LOADED_SELECTOR = '[data-gridbox-impression]';
const PLACEHOLDER_SELECTOR = '[data-grid-data]';
const BASE_URL = 'https://www.lidl.pl';

function parseArgs(argv) {
  let url;
  let out = 'beers.json';
  let debugInfo = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url') {
      url = argv[++i];
    } else if (arg === '--out') {
      out = argv[++i];
    } else if (arg === '--debug-info' || arg === '--debug') {
      debugInfo = true;
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

  return { url, out, debugInfo };
}

function printUsage() {
  console.log(`Usage: npm run scrape -- --url "<LIDL_LISTING_URL>" [--out beers.json]

Options:
  --url   Lidl product listing URL (required)
  --out   Output JSON path (default: beers.json)
  --debug-info  Write raw product payloads to <out>-raw-data.json for debugging
`);
}

async function extractBeers(page) {
  return page.evaluate(({ baseUrl, loadedSelector, placeholderSelector }) => {
    function parseGridAttribute(raw) {
      if (!raw) return {};
      try {
        return JSON.parse(decodeURIComponent(raw));
      } catch {
        return JSON.parse(
          raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
        );
      }
    }

    function toAbsoluteUrl(path) {
      if (!path) return '';
      if (path.startsWith('http')) return path;
      return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    }

    function packagingFromImages(tile) {
      for (const img of tile.querySelectorAll('img')) {
        const alt = (img.alt || '').toLowerCase();
        if (alt.includes('puszka')) return 'Can';
        if (alt.includes('butelka')) return 'Bottle';
      }
      return 'Unknown';
    }

    function packagingFromAccessibility(productData) {
      const text = [
        productData.image_V1?.accessibility,
        productData.imageList_V1?.[0]?.accessibility,
        productData.image?.accessibility,
        productData.imageList?.[0]?.accessibility,
        productData.accessibility,
      ].find(Boolean) || '';

      const value = text.toLowerCase();
      if (value.includes('puszka')) return 'Can';
      if (value.includes('butelka')) return 'Bottle';
      return 'Unknown';
    }

    function normalizePackaging(tile, productData) {
      const imagePackaging = packagingFromImages(tile);
      if (imagePackaging !== 'Unknown') return imagePackaging;
      return packagingFromAccessibility(productData);
    }

    function parseBeerTile(tile, source) {
      const raw = tile.getAttribute(
        source === 'loaded' ? 'data-gridbox-impression' : 'data-grid-data'
      );
      const productData = parseGridAttribute(raw);
      const isLoaded = source === 'loaded';

      return {
        id:
          productData.id ||
          productData.productId ||
          productData.itemId ||
          productData.name ||
          productData.title ||
          'Unknown',
        Name:
          productData.name ||
          productData.title ||
          productData.fullTitle ||
          'Unknown',
        Brewery: productData.brand?.name || productData.brand || 'Unknown',
        Packaging: normalizePackaging(tile, productData),
        Price: isLoaded ? productData.price : productData.price?.price,
        URL: isLoaded
          ? tile.querySelector('a.odsc-tile__link')?.href || ''
          : toAbsoluteUrl(productData.canonicalUrl || productData.canonicalPath || ''),
      };
    }

    function parseLoadedTile(tile) {
      return parseBeerTile(tile, 'loaded');
    }

    function parsePlaceholderTile(tile) {
      return parseBeerTile(tile, 'placeholder');
    }

    const seen = new Set();
    const beers = [];
    const rawDataLog = [];

    function addBeer(beer) {
      const key = beer.id || `${beer.Brewery}|${beer.Name}`;
      if (seen.has(key)) return;
      seen.add(key);
      const { id, ...rest } = beer;
      beers.push(rest);
    }

    for (const tile of document.querySelectorAll(loadedSelector)) {
      const raw = tile.getAttribute('data-gridbox-impression');
      const productData = parseGridAttribute(raw);
      rawDataLog.push({
        title: productData.title || productData.fullTitle || 'Unknown',
        productId: productData.productId || productData.itemId,
        source: 'loaded',
        rawData: productData,
      });
      addBeer(parseLoadedTile(tile));
    }
    for (const tile of document.querySelectorAll(placeholderSelector)) {
      const raw = tile.getAttribute('data-grid-data');
      const productData = parseGridAttribute(raw);
      rawDataLog.push({
        title: productData.title || productData.fullTitle || 'Unknown',
        productId: productData.productId || productData.itemId,
        source: 'placeholder',
        rawData: productData,
      });
      addBeer(parsePlaceholderTile(tile));
    }

    return { beers, rawDataLog };
  }, {
    baseUrl: BASE_URL,
    loadedSelector: LOADED_SELECTOR,
    placeholderSelector: PLACEHOLDER_SELECTOR,
  });
}

async function main() {
  const { url, out, debugInfo } = parseArgs(process.argv.slice(2));

  const browser = await chromium.launch({ headless: true });
  let context = await browser.newContext({
    viewport: { width: 900, height: 720 },
    javaScriptEnabled: false,
  });
  let page = await context.newPage();

  try {
    console.log(`Opening: ${url} with HTML-only mode`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector(`${LOADED_SELECTOR}, ${PLACEHOLDER_SELECTOR}`, {
      timeout: 60_000,
    });

    let title = await page.title();
    let loadedCount = await page.locator(LOADED_SELECTOR).count();
    let placeholderCount = await page.locator(PLACEHOLDER_SELECTOR).count();
    console.log(`Page title: ${title}`);
    console.log(`Loaded tiles: ${loadedCount}, placeholder tiles: ${placeholderCount}`);

    if (placeholderCount === 0 && loadedCount > 0) {
      console.log('No placeholder tiles found in HTML-only mode; retrying with JS-enabled mode.');
      await context.close();

      context = await browser.newContext({
        viewport: { width: 900, height: 720 },
        javaScriptEnabled: true,
      });
      page = await context.newPage();

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForSelector(`${LOADED_SELECTOR}, ${PLACEHOLDER_SELECTOR}`, {
        timeout: 60_000,
      });

      title = await page.title();
      loadedCount = await page.locator(LOADED_SELECTOR).count();
      placeholderCount = await page.locator(PLACEHOLDER_SELECTOR).count();
      console.log(`Fallback page title: ${title}`);
      console.log(`Fallback loaded tiles: ${loadedCount}, placeholder tiles: ${placeholderCount}`);
    }

    const { beers, rawDataLog } = await extractBeers(page);

    const result = {
      url: page.url(),
      scrapedAt: new Date().toISOString(),
      totalCount: beers.length,
      beers,
    };

    await writeFile(out, JSON.stringify(result, null, 2), 'utf8');
    console.log(`Wrote ${beers.length} beer(s) to ${out}`);

    // Save raw data log for inspection (only when enabled)
    if (debugInfo) {
      const rawDataPath = out.replace(/\.json$/, '-raw-data.json');
      await writeFile(rawDataPath, JSON.stringify(rawDataLog, null, 2), 'utf8');
      console.log(`Wrote raw data log to ${rawDataPath}`);
    } else {
      console.log('Raw data log not written (use --debug-info to enable)');
    }

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
