# Untappd Researcher - Step 2: Beer Matching

## Overview

The **Untappd Researcher** is a browser-based script that automatically matches beers scraped from Lidl's catalog against [Untappd.com](https://untappd.com), enriching them with Untappd data (ratings, style, ABV, user ratings, etc.).

This is **Step 2** of the beer dashboard workflow:
1. **Step 1**: Scrape Lidl beer catalog → generate `beers.json`
2. **Step 2** (THIS): Match beers in Untappd ← *manual step, requires login*
3. **Step 3**: Deploy to web dashboard

---

## Usage

### Prerequisites
- Node.js ≥20
- A `beers.json` file from Step 1 (scraper output)
- Internet connection (Untappd searches are performed automatically)

### Running the Script

1. Execute via npm:
   ```bash
   npm run research -- --input data/samples/2026-06/beers-2026-06-05.json
   ```
   Or with custom output path:
   ```bash
   npm run research -- --input beers.json --output my-results.json
   ```

2. The script will:
   - Load beers from the input JSON file
   - Open a headless browser (automated)
   - Search Untappd for each beer
   - Log progress to console with search attempts and retry information
   - Write enriched results to the output file

3. Monitor console output for:
   - Search progress (🔎 SEARCH, ✅ FOUND, ❌ NOT FOUND)
   - Retry attempts and duplicates skipped
   - Final summary with timing and match count
   - Inconclusive matches (multiple results) flagged for review

---

## Search Strategy & Retry Logic

The script uses a **progressive refinement approach** to handle the complexity of beer name matching across two databases.

### Search Attempts (in order)

#### 1. **Primary Search**
```
Query: "[Original Brewery] [Original Beer Name]"
Example: "Browar Pinta Polish Hazy IPA"
```
- Attempts an exact match with full brewery + beer name
- Stops on first success

#### 2. **Browar Removal Retry**
```
Query: "[Brewery without 'Browar'] [Original Beer Name]"
Example: "Pinta Polish Hazy IPA"
```
- Polish breweries often have "Browar" (Polish for "Brewery") in Lidl catalog
- Untappd typically doesn't use this prefix
- **When triggered**: First search returned 0 results

#### 3. **Special Case Handling** (Beer-Specific)

These hardcoded expansions handle known naming discrepancies:

| Condition | Replacement | Reason |
|-----------|-------------|--------|
| Contains "ONINNI" | "Our New IPA Needs No Introduction" | Acronym to full name |
| Contains "PL " | "Polish " | Abbreviation expansion |
| Contains "THE NELSON REGION" | Removes prefix | Unnecessary qualifier |

- **When triggered**: Previous searches returned 0 results

#### 4. **Explicit Style Stripping**

Known beer styles are progressively removed from the query:
- Polish Hazy IPA
- West Coast IPA
- Hazy IPA
- IPA
- Session Oat IPA
- Red IPA

```
Query: "[Brewery] [Beer Name without Style]"
Example: If searching "Browar Pinta Polish Hazy IPA" fails:
         Try: "Pinta IPA" → "Pinta" (last attempt)
```

- **When triggered**: Still no results after special case handling
- **Benefit**: Finds beers where the style descriptor differs between Lidl and Untappd

#### 5. **Progressive Word Stripping (Last Resort)**

If all strategies fail, removes words from the beer name one-by-one:

```
Original: "Browar Pinta Limited Edition Special Release Polish Hazy IPA"

Attempts:
"Browar Pinta Limited Edition Special Release Polish Hazy"
"Browar Pinta Limited Edition Special Release Polish"
"Browar Pinta Limited Edition Special Release"
... (continues until found or only brewery name remains)
```

- **Benefit**: Catches beers with verbose/temporary qualifiers in Lidl's catalog
- **Stops**: When either a match is found OR only the brewery name remains

---

## Inconclusive Matches Handling

When a search returns **multiple results** (>1 match), the script:

1. **Uses the first result** as the primary match
2. **Flags for manual review** by collecting all matches in the `inconclusiveMatches` array
3. **Logs detailed output** at the end with all candidates

### Example Console Output:
```
--- INCONCLUSIVE MATCHES ---
Browar Pinta - Polish Hazy IPA (3 matches):
   - Browar Pinta - Polish Hazy IPA v1.0
   - Browar Pinta - Polish Hazy IPA v2.0
   - Pinta - Hazy IPA
```

**Why this matters**: 
- Lidl may sell multiple versions of the same beer (different batches, sizes)
- Untappd lists them as separate entries
- Manual verification helps ensure the correct version is matched

---

## Performance & Deduplication

### Query Caching (Per-Beer)

Each beer maintains a local cache (`triedQueries` Map) of already-attempted queries to avoid redundant API calls:

```javascript
// If "Pinta Polish Hazy IPA" was already searched, 
// skip it and reuse the cached result
→ [SKIP DUPLICATE] query (cached result)
```

**Benefit**: Reduces API load when retries attempt similar variations

### Performance Logging

The script tracks and reports:
- **Total Duration**: Wall-clock time in seconds
- **Found Count**: Beers successfully matched
- **Not Found Count**: Beers with no Untappd match
- **Total Processed**: Input beer count

Example:
```
--- FETCH SUMMARY ---
Total Time: 42.38s
Found: 156 | Not Found: 4
Total Processed: 160
```

---

## Output Structure

The script writes results to a JSON file (or prints to console if output path not specified) containing:

```javascript
{
  "searchedAt": "2026-06-05T12:30:45.123Z",
  "totalCount": 35,
  "foundCount": 34,
  "beers": [
    {
      // Original Lidl data
      "Name": "Polish Hazy IPA",
      "Brewery": "Browar Pinta",
      "Packaging": "Can",
      "Price": 9.99,
      
      // Untappd data (if Found: true)
      "Found": true,
      "Rating": "4.25",            // User rating (0-5 scale)
      "Style": "Hazy IPA",         // Beer style per Untappd
      "Abv": "6.5%",               // Alcohol by volume
      "Link": "https://untappd.com/beer/123456",
      
      // Search metadata
      "Brewery": "Browar Pinta"    // As found on Untappd (may differ slightly)
    },
    {
      // Unmatched beer - contains only original Lidl data
      "Name": "Unknown Beer",
      "Brewery": "Unknown Brewery",
      "Packaging": "Can",
      "Price": 8.99,
      "Found": false
    }
  ]
}
```

**Key changes from Step 2 browser version:**
- ❌ **No `IsDrunk` field** (now handled separately via dashboard upload in Step 3)
- ✅ **File-based I/O** instead of `window.untappdBeers` global
- ✅ **Automated browser** (no manual DevTools required)

---

## Console Output Guide

### Search Log Symbols
- 🔎 **SEARCH**: New search attempt being made
- ↩️ **SKIP DUPLICATE**: Query already cached from this beer's search
- ✅ **FOUND**: Beer matched successfully (number in brackets = attempt count)
- ❌ **NOT FOUND**: No match after all retry strategies
- 📊 **Summary**: Final statistics (duration, success rate, etc.)

### Example:
```
[1/160] 🔎 SEARCH -> Browar Pinta Polish Hazy IPA
[1/160] ↩️ SKIP DUPLICATE -> Pinta Polish Hazy IPA
[1/160] ✅ FOUND: Polish Hazy IPA (retry)
[2/160] 🔎 SEARCH -> Browar Tyskie Lager
[2/160] ✅ FOUND: Tyskie Lager
[3/160] 🔎 SEARCH -> Browar Unknown Brand XYZ
[3/160] ❌ NOT FOUND: Unknown Brand XYZ
```

---

## Known Limitations & Workarounds

| Issue | Cause | Workaround |
|-------|-------|-----------|
| Beer not found on Untappd | Discontinued/very new/niche | Check manually; mark `Found: false` |
| Multiple similar results | Different batches/versions exist | Review inconclusive matches log |
| Slow performance | High result volume + retry attempts | Patient waiting; script is optimized |
| Wrong match selected | Ambiguous name or search failure | Manual post-processing of results |

---

## Technical Notes

### Environment
- **Execution**: Node.js ≥20 (via npm script)
- **Browser**: Headless Chromium (via Playwright)
- **No user interaction required**: Fully automated

### Error Handling
- Search failures return empty result arrays (treated as "not found")
- Network errors in search gracefully degrade (empty results)
- Invalid input JSON exits with error message
- Browser context failures are reported with timeout information

### Performance & Scaling
- Sequential search execution (one beer at a time)
- Per-beer query caching to avoid duplicate searches
- Typical runtime: 30-60 seconds for 35-50 beers (depending on network)
- Each failed search consumes ~1-2 seconds (timeout/navigation)

### Rate Limiting
- Untappd may rate-limit rapid automated searches
- If searches slow down mid-run, it's likely rate-limiting
- Retry mechanism automatically handles transient failures
- Consider splitting large batches if timeouts occur

---

## Integration with Beer Dashboard Workflow

### Input (Step 1 Output)
```bash
beers.json
├── url: "https://www.lidl.pl/c/piwa-kraftowe/a10072919"
├── scrapedAt: "2026-06-05T11:44:03.558Z"
├── totalCount: 35
└── beers: [
    { Name, Brewery, Packaging, Price, URL },
    ...
  ]
```

Pass to Step 2 via:
```bash
npm run research -- --input beers.json
```

### Output (Step 2 Result)
```bash
untappd-beers-2026-06-05_123045.json (or custom path)
├── searchedAt: "2026-06-05T12:30:45.123Z"
├── totalCount: 35
├── foundCount: 34
└── beers: [
    { ...enriched with Untappd data },
    ...
  ]
```

### Next: Step 3 Integration
1. Generated `untappd-beers-*.json` is input to web dashboard generation
2. Dashboard displays enriched beers with Untappd ratings, ABV, style
3. User uploads separate JSON with their "drunk beers" for status tracking (decoupled from Step 2)
4. Dashboard merges all data sources for final visualization

---

## Debugging

If a beer isn't matching when you know it exists on Untappd:

1. **Check console for query attempts**: Look for the beer name in the SEARCH logs
2. **Try manual search**: Visit `untappd.com/search?q=[beer+name]` yourself
3. **Check Inconclusive Matches**: Your beer may appear there with wrong rank
4. **Verify Untappd availability**: Ensure beer isn't delisted or misspelled there
5. **Add special case**: If a pattern emerges, submit a PR to add it to retry logic

---

## Maintenance & Future Improvements

### Potential Enhancements
- [ ] Configurable retry strategies (user-provided expansions)
- [ ] Parallel API requests (currently sequential)
- [ ] Export results to CSV
- [ ] Fuzzy matching for close-call results
- [ ] Persistent caching across page reloads
- [ ] Integration as browser extension

### Contributing
See main [README.md](../../README.md) for contribution guidelines.
