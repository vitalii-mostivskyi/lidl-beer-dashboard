# lidl-beer-dashboard

Monthly Lidl craft beer list → Untappd lookup → personal dashboard.

## Scrape Lidl beers (CLI)

Requires [Node.js](https://nodejs.org/) 20+.

```bash
npm install
npx playwright install chromium
npm run scrape -- --url "https://www.lidl.pl/..." --out beers.json
```

Output JSON shape:

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

The scraper scrolls the listing until the product tile count stabilizes (same as scrolling manually in the browser).

### GitHub Actions

1. Push this repo to GitHub (optionally commit `package-lock.json` after `npm install` for reproducible CI).
2. **Actions** → **Scrape Lidl beers** → **Run workflow**.
3. Paste the Lidl **product listing** URL (craft beers page for the month).
4. When the run finishes, open the run and download the **lidl-beers-** artifact (`beers.json`; run number is in the artifact name).

## Manual pipeline (browser console)

1. Open the Lidl listing, scroll to the bottom, run [`BeerScraper/beer-scraper.js`](BeerScraper/beer-scraper.js) in DevTools.
2. On [Untappd](https://untappd.com) while logged in, run [`UntappdResearcher/untappd-researcher.js`](UntappdResearcher/untappd-researcher.js).
3. Run [`BeerDashboard/beer-dashboard-generator.js`](BeerDashboard/beer-dashboard-generator.js) to download the HTML dashboard.
