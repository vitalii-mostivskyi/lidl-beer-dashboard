# lidl-beer-dashboard

Monthly Lidl craft beer list → Untappd lookup → personal dashboard.

## Scrape Lidl beers (CLI)

Requires [Node.js](https://nodejs.org/) 20+.

```bash
npm install
npx playwright install chromium
npm run scrape -- --url "https://www.lidl.pl/..." [--out beers.json]
```

### Parameters

- `--url` (required): Lidl product listing URL (craft beers page for the month)
- `--out` (optional): Output JSON path (default: `data/output/beers-YYYY-MM-DD_HHMMSS.json` if omitted)
- `--debug-info` (optional): When present, write a debug raw-data file alongside the main output (named `<out>-raw-data.json`).
- `--load-tiles` (optional): Force JS-enabled mode and capture loaded tiles (useful for testing the loaded-tile parsing path).
- `--save-sample-data` (optional): Save the final page HTML snapshot and the extracted `beers.json` into `data/samples/YYYY-MM/` (filenames: `page-YYYY-MM-DD(.loaded).html` and `beers.json`).

Default output path:

If you omit `--out`, the scraper writes results to `data/output/beers-YYYY-MM-DD_HHMMSS.json` by default. Use `--out` to override.

### Output files

**Main output** (`beers.json`):
```json
{
  "url": "...",
  "scrapedAt": "2026-06-04T12:00:00.000Z",
  "totalCount": 42,
  "beers": [
    { "Name": "...", "Brewery": "...", "Packaging": "Can", "Price": 12.99, "URL": "..." }
  ]
}
```

**Debug log** (`beers-raw-data.json`): Contains raw product data from both tile sources for inspection and debugging:
```json
[
  {
    "title": "Product Name",
    "productId": 12345678,
    "source": "placeholder",
    "rawData": { ... }
  }
]
```

The scraper reads product data from each tile without scrolling: loaded tiles use `data-gridbox-impression`, placeholders use `data-grid-data` (full catalog is present in the page HTML). It operates in HTML-only mode for performance and falls back to JavaScript if needed.

### GitHub Actions

1. Push this repo to GitHub (optionally commit `package-lock.json` after `npm install` for reproducible CI).
2. **Actions** → **Scrape Lidl beers** → **Run workflow**.
3. Paste the Lidl **product listing** URL (craft beers page for the month).
4. When the run finishes, open the run and download the **lidl-beers-** artifact (`beers.json`; run number is in the artifact name).

## Manual pipeline (browser console)

1. Open the Lidl listing, scroll to the bottom, run [`src/beer-scraper/beer-scraper.js`](src/beer-scraper/beer-scraper.js) in DevTools.
2. On [Untappd](https://untappd.com) while logged in, run [`src/untappd-researcher/untappd-researcher.js`](src/untappd-researcher/untappd-researcher.js).
3. Run [`src/beer-dashboard/beer-dashboard-generator.js`](src/beer-dashboard/beer-dashboard-generator.js) to download the HTML dashboard.

## Deploy dashboard (GitHub Pages)

You can publish the static Beer Dashboard to GitHub Pages using the provided workflow.

1. Commit and push these new files to the repository.
2. In GitHub, open **Actions** → **Deploy Beer Dashboard** → **Run workflow**.
3. Paste the full `untappd-beers.json` contents into the `json_content` input and run the workflow.
4. When the workflow completes, open the repository **Pages** section (Settings → Pages) or the workflow summary to find the published URL.

Notes:
- The workflow writes the pasted JSON into `untappd-beers.json` and deploys the `BeerDashboard/` files as a static site to Pages.
- If the JSON is very large, consider committing the file to the repo and using the file path instead; the workflow expects pasted JSON by default.
