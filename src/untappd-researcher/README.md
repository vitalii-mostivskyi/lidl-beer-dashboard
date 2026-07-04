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
- Logged into [Untappd.com](https://untappd.com) in your browser
- Browser Developer Tools open (F12 or right-click → Inspect)
- A `beers.json` file loaded in the page (from Step 1)

### Running the Script

1. Open your browser console (DevTools → Console tab)
2. Paste the entire contents of `untappd-researcher.js`
3. The script executes immediately, assuming:
   - `window.lidlBeers` contains the array of beers to search
   - You're currently on Untappd's search page
4. Results are stored in `window.untappdBeers` and logged to console
5. Monitor console output for progress and any issues

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

Each matched beer in `window.untappdBeers` contains:

```javascript
{
  // Original Lidl data
  Name: "Polish Hazy IPA",
  Brewery: "Browar Pinta",
  Packaging: "500ml",
  Price: "9.99 zł",
  
  // Untappd data (if Found: true)
  Found: true,
  Rating: "4.25",            // User rating (0-5 scale)
  Style: "Hazy IPA",         // Beer style per Untappd
  Abv: "6.5%",               // Alcohol by volume
  IsDrunk: false,            // Whether you've logged it on Untappd
  Link: "https://untappd.com/beer/123456",
  
  // Search metadata
  Brewery: "Browar Pinta",   // As found on Untappd (may differ slightly)
}
```

**For unmatched beers** (`Found: false`):
- All Untappd fields omitted or defaulted
- Contains original Lidl data only

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

### Browser Compatibility
- Works in Chrome, Firefox, Safari DevTools console
- Relies on `fetch()` API and `DOMParser` (modern browser features)
- Must run on `untappd.com` domain to access search functionality

### Error Handling
- Search failures log as empty result arrays (treated as "not found")
- Console logging errors are silently caught to prevent script termination
- Network errors in `performSearch()` return empty arrays (graceful degradation)

### Rate Limiting
- No explicit rate limiting; relies on browser's standard fetch behavior
- Untappd may rate-limit aggressive searches; monitor for slowdowns
- Per-beer caching minimizes duplicate requests

---

## Integration with Beer Dashboard Workflow

### Input (Step 1 Output)
```
beers.json: [
  { Name, Brewery, Packaging, Price },
  ...
]
```
Loaded as `window.lidlBeers` before script execution.

### Output (Step 2 Result)
```
window.untappdBeers: [
  { ...enriched with Untappd data },
  ...
]
```
Export or copy from console → use in Step 3 (web deployment).

### Export Steps
1. Open DevTools → Console
2. Copy `JSON.stringify(window.untappdBeers, null, 2)` output
3. Save as `untappd-beers.json`
4. Pass to Step 3 for dashboard generation

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
