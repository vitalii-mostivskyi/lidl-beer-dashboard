import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { UntappdSearchService } from './services/untappd-search-service.js';
import { RetryStrategy } from './retry-strategy.js';
import { ResultFormatter } from './result-formatter.js';

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

/**
 * Fetch Untappd data for a list of beers using RetryStrategy
 * Returns array of beer results with Found: true/false
 */
async function fetchUntappdData(page, beerList) {
  const startTime = Date.now();
  const allResults = [];

  // Inject page into UntappdSearchService
  const searchService = new UntappdSearchService(page);
  const retryStrategy = new RetryStrategy(searchService);

  for (let i = 0; i < beerList.length; i++) {
    const beer = beerList[i];
    console.log(`[${i + 1}/${beerList.length}] 🔎 Searching for: ${beer.Name}`);

    // RetryStrategy returns { attempts, finalResult, found, hasMultipleMatches, allMatches }
    const searchResult = await retryStrategy.search(beer);

    if (searchResult.found) {
      const retryCount = searchResult.attempts.length - 1;
      console.log(`[${i + 1}/${beerList.length}] ✅ FOUND: ${beer.Name}${retryCount > 0 ? ` (${retryCount} retries)` : ''}`);
    } else {
      console.log(`[${i + 1}/${beerList.length}] ❌ NOT FOUND: ${beer.Name}`);
    }

    allResults.push(searchResult);
  }

  const totalDuration = Date.now() - startTime;

  // Format and print summary using ResultFormatter
  const formatter = new ResultFormatter();
  const summary = formatter.formatSummary(allResults, totalDuration);
  console.log(summary);

  // Extract just the finalResult objects for JSON output
  const results = allResults.map(r => r.finalResult);
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
    await page.goto("https://untappd.com", { waitUntil: 'domcontentloaded' });

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
