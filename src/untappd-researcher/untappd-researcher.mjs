import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const UNTAPPD_BASE_URL = "https://untappd.com";

function parseArgs(argv) {
  let input;
  let output;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input') {
      input = argv[++i];
    } else if (arg === '--output' || arg === '--out') {
      output = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (!arg.startsWith('--')) {
      // Treat first non-flag argument as input file
      if (!input) input = arg;
    }
  }

  if (!input) {
    console.error('Error: --input <path> is required.\n');
    printUsage();
    process.exit(1);
  }

  if (!output) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fname = `untappd-beers-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
    output = `data/output/${fname}`;
  }

  return { input, output };
}

function printUsage() {
  console.log(`Usage: npm run research -- [--input] <BEERS_JSON> [--output OUTPUT.json]

Options:
  --input   Path to beers.json from Step 1 (required)
  --output  Output JSON path (default: data/output/untappd-beers-YYYYMMDD_HHMMSS.json)
  --help    Show this message

Example:
  npm run research -- --input data/samples/2026-06/beers-2026-06-05.json
  npm run research -- --input beers.json --output results.json
`);
}

async function fetchUntappdData(page, beerList) {
  const startTime = Date.now();
  const results = [];

  async function performSearch(query) {
    try {
      const url = `${UNTAPPD_BASE_URL}/search?q=${encodeURIComponent(query)}`;
      
      // Navigate to search URL and wait for results
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      
      // Extract beer items from the page HTML
      const items = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.beer-item, [data-beer-id]')).map(el => {
          const nameLink = el.querySelector('.name a, .beer-name a');
          const breweryLink = el.querySelector('.brewery a, .brewer-name a');
          const styleEl = el.querySelector('.style, .beer-style');
          const abvEl = el.querySelector('.abv');
          const ratingEl = el.querySelector('.caps, [data-rating]');
          
          return {
            name: nameLink?.textContent?.trim(),
            nameHref: nameLink?.getAttribute('href'),
            brewery: breweryLink?.textContent?.trim(),
            style: styleEl?.textContent?.trim(),
            abv: abvEl?.textContent?.trim(),
            rating: ratingEl?.getAttribute('data-rating') || ratingEl?.getAttribute('data-score'),
          };
        }).filter(item => item.name || item.brewery);
      });

      return items;
    } catch (e) {
      return [];
    }
  }

  const inconclusiveMatches = [];

  for (let i = 0; i < beerList.length; i++) {
    const beer = beerList[i];
    let items = [];

    // Prepare cleaned brewery (used for first retry)
    let breweryForQuery = beer.Brewery.replace(/\bBrowar\b\s*/gi, '').trim();
    // First attempt: use original brewery + original beer name
    let query = beer.Brewery + " " + beer.Name;
    let usedRetry = false;

    // Per-beer cache to dedupe identical queries and store results
    const triedQueries = new Map();

    // Helper wrapper to log every search attempt and avoid duplicate requests
    async function doSearch(q) {
      if (triedQueries.has(q)) {
        try {
          console.log(`[${i + 1}/${beerList.length}] ↩️ SKIP DUPLICATE -> ${q}`);
        } catch (e) {}
        return triedQueries.get(q);
      }
      try {
        console.log(`[${i + 1}/${beerList.length}] 🔎 SEARCH -> ${q}`);
      } catch (e) {
        /* ignore logging errors */
      }
      const res = await performSearch(q);
      triedQueries.set(q, res);
      return res;
    }

    items = await doSearch(query);

    // First retry: strip "Browar" from brewery and try again
    if (!items || items.length === 0) {
      query = breweryForQuery + " " + beer.Name;
      items = await doSearch(query);
      usedRetry = !!(items && items.length > 0);
    }

    // --- IMPROVED RETRY LOGIC ---
    if ((!items || items.length === 0) && beer.Name.includes("ONINNI")) {
      query = breweryForQuery + " " + beer.Name.replace("ONINNI", "Our New IPA Needs No Introduction");
      items = await doSearch(query);
      usedRetry = !!(items && items.length > 0);
    }

    if ((!items || items.length === 0) && beer.Name.includes("PL ")) {
      query = breweryForQuery + " " + beer.Name.replace("PL ", "Polish ");
      items = await doSearch(query);
      usedRetry = !!(items && items.length > 0);
    }

    if ((!items || items.length === 0) && beer.Name.includes("THE NELSON REGION")) {
      query = breweryForQuery + " " + beer.Name.replace("THE NELSON REGION - ", "");
      items = await doSearch(query);
      usedRetry = !!(items && items.length > 0);
    }

    // Broaden Search (Explicit Style Stripping)
    if (!items || items.length === 0) {
      const styles = ["Polish Hazy IPA", "West Coast IPA", "Hazy IPA", "IPA", "Session Oat IPA", "Red IPA"];
      for (const style of styles) {
        if (beer.Name.includes(style)) {
          query = breweryForQuery + " " + beer.Name.replace(style, "").trim();
          items = await doSearch(query);
          if (items && items.length > 0) {
            usedRetry = true;
            break;
          }
        }
      }
    }

    // Final Fallback: Peel back words one by one
    if (!items || items.length === 0) {
      let words = beer.Name.split(' ');
      while (words.length > 1 && (!items || items.length === 0)) {
        words.pop();
        query = breweryForQuery + " " + words.join(' ');
        items = await doSearch(query);
        if (items && items.length > 0) usedRetry = true;
      }
    }

    if (items && items.length > 0) {
      const first = items[0];
      const foundBeer = {
        Name: first.name,
        Brewery: first.brewery,
        Rating: first.rating || "0",
        Packaging: beer.Packaging,
        Price: beer.Price,
        Style: first.style || "N/A",
        Abv: first.abv || "N/A",
        Link: first.nameHref ? `${UNTAPPD_BASE_URL}${first.nameHref}` : "",
        Found: true
      };
      results.push(foundBeer);
      console.log(`[${i + 1}/${beerList.length}] ✅ FOUND: ${beer.Name}${usedRetry ? ' (retry)' : ''}`);

      if (items.length > 1) {
        // Collect detailed matches for end-of-run reporting
        try {
          const matches = items.map(it => {
            const n = it.name || 'N/A';
            const b = it.brewery || 'N/A';
            return b + ' - ' + n;
          });
          inconclusiveMatches.push({ Brewery: beer.Brewery, Name: beer.Name, matches });
        } catch (e) {
          inconclusiveMatches.push({ Brewery: beer.Brewery, Name: beer.Name, matches: [] });
        }
      }
    } else {
      results.push({ ...beer, Found: false });
      console.warn(`[${i + 1}/${beerList.length}] ❌ NOT FOUND: ${beer.Name}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const foundCount = results.filter(b => b.Found).length;

  console.log("\n--- FETCH SUMMARY ---");
  console.log(`Total Time: ${duration}s`);
  console.log(`Found: ${foundCount} | Not Found: ${results.length - foundCount}`);
  console.log(`Total Processed: ${results.length}`);

  if (inconclusiveMatches.length > 0) {
    console.log("\n--- INCONCLUSIVE MATCHES ---");
    inconclusiveMatches.forEach(entry => {
      const count = Array.isArray(entry.matches) ? entry.matches.length : 0;
      console.log(`${entry.Brewery} - ${entry.Name}${count ? ` (${count} matches):` : ''}`);
      if (count) {
        entry.matches.forEach(m => console.log(`   - ${m}`));
      }
    });
  }

  return results;
}

async function main() {
  const { input, output: outPath } = parseArgs(process.argv.slice(2));

  // Read input beers
  let inputData;
  try {
    const fileContent = await readFile(input, 'utf8');
    inputData = JSON.parse(fileContent);
  } catch (err) {
    console.error(`Error reading input file: ${err.message}`);
    process.exit(1);
  }

  const beerList = inputData.beers || [];
  console.log(`Loaded ${beerList.length} beers from ${input}\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to Untappd base to establish context
    await page.goto(UNTAPPD_BASE_URL, { waitUntil: 'domcontentloaded' });

    const results = await fetchUntappdData(page, beerList);

    // Create output directory
    const outDir = outPath.substring(0, outPath.lastIndexOf('/'));
    await mkdir(outDir, { recursive: true });

    // Write results
    const output = {
      searchedAt: new Date().toISOString(),
      totalCount: results.length,
      foundCount: results.filter(b => b.Found).length,
      beers: results
    };

    await writeFile(outPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\nWrote results to ${outPath}`);

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
