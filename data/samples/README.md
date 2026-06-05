# Lidl Craft Beer Monthly Snapshots

Historical HTML and data snapshots captured from the Lidl craft beer listing page.

## Structure

```
samples/
├── 2026-06/
│   ├── README.md              (This file, customized per month)
│   ├── page-2026-06-05.html   (Saved HTML from capture date)
│   └── beers.json             (Reference: extracted data from page)
└── 2026-05/
    ├── README.md
    ├── page-2026-05-12.html
    └── beers.json
```

## Why Keep These?

1. **Layout regression testing**: Compare HTML month-to-month to detect CSS/DOM changes before they break the scraper
2. **Data validation**: Reference data at time of capture for cross-checking
3. **Historical analysis**: Track pricing, packaging, and beer selection changes over time

## Naming Convention

- HTML files: `page-YYYY-MM-DD.html` (date = capture date)
- JSON files: `beers.json` (one version per month; no dates needed since folder names it)
- README: Document execution mode and observations

## Per-Month README Template

```markdown
# 2026-06 Snapshot

**Captured:** 2026-06-05  
**Mode:** HTML-only (javaScriptEnabled: false)  
**Tiles:** Loaded=0, Placeholder=35  

### Execution Notes
- All product data available in placeholder tiles (data-grid-data)
- No JS-enabled fallback needed
- Packaging reliably extracted from imageList_V1[0].accessibility

### Layout Observations
- Product grid uses ODSc Masonry layout
- No changes from 2026-05 snapshot

### Versions saved
- `page-2026-06-05.html` — HTML-only snapshot (no JS, placeholder tiles)
- `page-2026-06-05.loaded.html` — JS-enabled snapshot that includes loaded tiles

### Known data quirks
- Three products (IDs: 10034805, 10034821, 10034824) were observed to lack explicit packaging in the product payloads and are marked `Unknown` by the scraper. They are:
    - 10034805 — Gelato: Pink Guava Mango Sticky Rice
    - 10034821 — Zakładowy Wyjąć Grilla To Jest Chwila
    - 10034824 — Browar PINTA Taproom NZ Bright IPA

### Next Month Checklist
- [ ] Check if layout changed
- [ ] Compare DOM structure (use `diff` on HTML files if structure differs)
```

## Maintenance

After running the monthly scraper with `--save-sample-data`:
1. Run the scraper with `--save-sample-data` to save both the HTML snapshot and the extracted `beers.json` into `data/samples/YYYY-MM/`:

```bash
npm run scrape -- --url "<LIDL_LISTING_URL>" --save-sample-data
```

2. Verify files in `data/samples/YYYY-MM/`:
    - `page-YYYY-MM-DD.html` or `page-YYYY-MM-DD.loaded.html`
    - `beers.json`
3. Update the per-month `README.md` with execution notes and layout observations, then commit the folder.

**Never commit** `Lidl Crat Beers of the Month_files/` or CSS/JS assets—HTML only.
