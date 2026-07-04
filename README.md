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

1. Open **Actions** → **Scrape Lidl beers** → **Run workflow**.
2. Paste the Lidl **product listing** URL (craft beers page for the month) and start the run.
3. When the run finishes, download the **lidl-beers-** artifact (`beers.json`) or use it as input for the next step.

## Deploy dashboard (GitHub Pages)

You can publish the static Beer Dashboard to GitHub Pages using the provided workflow.

1. Commit the dashboard data file to [src/beer-dashboard/untappd-beers.json](src/beer-dashboard/untappd-beers.json) and push the repository.
2. In GitHub, open **Actions** → **Deploy Beer Dashboard** → **Run workflow**.
3. When the workflow completes, open the repository **Pages** section (Settings → Pages) or the workflow summary to find the published URL.

## Manual / alternate workflow

The main scrape and publish steps now run through GitHub Actions. The browser-console path is mostly useful for local debugging or experimentation.

1. Use the CLI scraper locally if you want to generate a JSON file for inspection: `npm run scrape -- --url "https://www.lidl.pl/..." [--out beers.json]`.
2. On [Untappd](https://untappd.com) while logged in, run [src/untappd-researcher/untappd-researcher.js](src/untappd-researcher/untappd-researcher.js) to enrich the beer data.
3. Commit the resulting data to [src/beer-dashboard/untappd-beers.json](src/beer-dashboard/untappd-beers.json) and run the deployment workflow to publish the site.

Notes:
- The deployment workflow copies the committed JSON from [src/beer-dashboard/untappd-beers.json](src/beer-dashboard/untappd-beers.json) into the generated `site/` folder before publishing.
- If you update the dashboard data, commit the JSON file in the repository and re-run the deployment workflow.
