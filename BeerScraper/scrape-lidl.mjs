import { writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const LOADED_SELECTOR = '[data-gridbox-impression]';
const PLACEHOLDER_SELECTOR = '[data-grid-data]';
const BASE_URL = 'https://www.lidl.pl';

function parseArgs(argv) {
  let url;
  let out;
  let debugInfo = false;
  let loadTiles = false;
  let saveSampleData = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url') {
      url = argv[++i];
    } else if (arg === '--out') {
      out = argv[++i];
    } else if (arg === '--debug-info' || arg === '--debug') {
      debugInfo = true;
    } else if (arg === '--load-tiles') {
      loadTiles = true;
    } else if (arg === '--save-sample-data') {
      saveSampleData = true;
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

  return { url, out, debugInfo, loadTiles, saveSampleData };
}

function printUsage() {
  console.log(`Usage: npm run scrape -- --url "<LIDL_LISTING_URL>" [--out beers.json]

Options:
  --url   Lidl product listing URL (required)
  --out   Output JSON path (default: beers.json)
  --debug-info  Write raw product payloads to <out>-raw-data.json for debugging
  --load-tiles  Force JS-enabled mode and capture loaded tiles (writes .loaded.html sample)
  --save-html-snapshot  Save final page HTML to 'data/samples/YYYY-MM/page-YYYY-MM-DD(.loaded).html'
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
  const { url, out: outArg, debugInfo, loadTiles, saveSampleData } = parseArgs(process.argv.slice(2));

  // Ensure default output path when --out not provided: data/output/beers-YYYYMMDD_HHMMSS.json
  let out = outArg;
  if (!out) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fname = `beers-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
    out = `data/output/${fname}`;
    await mkdir('data/output', { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  let context;
  let page;

  try {
    if (loadTiles) {
      context = await browser.newContext({
        viewport: { width: 900, height: 720 },
        javaScriptEnabled: true,
      });
      page = await context.newPage();
      console.log(`Opening: ${url} with JS-enabled mode (load tiles forced)`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForSelector(`${LOADED_SELECTOR}, ${PLACEHOLDER_SELECTOR}`, { timeout: 60_000 });

      // Auto-scroll to trigger lazy-loading of tiles until stable
      let prevLoaded = -1;
      let stable = 0;
      const maxIter = 40;
      for (let i = 0; i < maxIter; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        const loadedCount = await page.locator(LOADED_SELECTOR).count();
        if (loadedCount === prevLoaded) {
          stable++;
        } else {
          stable = 0;
          prevLoaded = loadedCount;
        }
        if (stable >= 3) break;
      }

      const title = await page.title();
      const loadedCount = await page.locator(LOADED_SELECTOR).count();
      const placeholderCount = await page.locator(PLACEHOLDER_SELECTOR).count();
      console.log(`Page title: ${title}`);
      console.log(`Loaded tiles: ${loadedCount}, placeholder tiles: ${placeholderCount}`);
    } else {
      context = await browser.newContext({
        viewport: { width: 900, height: 720 },
        javaScriptEnabled: false,
      });
      page = await context.newPage();

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
    }

    const { beers, rawDataLog } = await extractBeers(page);

    // Save result object (main output)

    const result = {
      url: page.url(),
      scrapedAt: new Date().toISOString(),
      totalCount: beers.length,
      beers,
    };

    await writeFile(out, JSON.stringify(result, null, 2), 'utf8');
    console.log(`Wrote ${beers.length} beer(s) to ${out}`);

    // Optionally save HTML snapshot and sample data (beers.json) to samples folder
    if (saveSampleData) {
      try {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const dir = `data/samples/${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
        await mkdir(dir, { recursive: true });
        const year = now.getFullYear();
        const month = pad(now.getMonth() + 1);
        const day = pad(now.getDate());
        const dateStr = `${year}-${month}-${day}`;
        const base = `${dir}/page-${dateStr}`;
        const filename = loadTiles ? `${base}.loaded.html` : `${base}.html`;
        const html = await page.content();
        await writeFile(filename, html, 'utf8');
        // Save the extracted beers JSON into the samples folder with a matching date-based name
        const sampleJsonPath = loadTiles ? `${dir}/beers-${dateStr}.loaded.json` : `${dir}/beers-${dateStr}.json`;
        await writeFile(sampleJsonPath, JSON.stringify(result, null, 2), 'utf8');
        console.log(`Saved HTML snapshot to ${filename}`);
        console.log(`Saved sample data to ${sampleJsonPath}`);
      } catch (err) {
        console.warn('Failed to save sample data:', err.message);
      }
    }

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
