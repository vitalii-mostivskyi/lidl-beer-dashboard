
/**
 * Fetches Untappd data with improved smart retries and fixed performance logging.
 * @param {Array} beerList - Array of { Name, Brewery, Packaging, Price }
 */
async function fetchUntappdData(beerList) {
    const startTime = Date.now();
    const results = [];
    window.untappdBeers = results;

    async function performSearch(query) {
        try {
            const url = `/search?q=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return Array.from(doc.querySelectorAll('.beer-item'));
        } catch (e) { return []; }
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
                    console.log("[" + (i+1) + "/" + beerList.length + "] ↩️ SKIP DUPLICATE -> " + q + " | URL: /search?q=" + encodeURIComponent(q));
                } catch (e) {}
                return triedQueries.get(q);
            }
            try {
                console.log("[" + (i+1) + "/" + beerList.length + "] 🔎 SEARCH -> " + q + " | URL: /search?q=" + encodeURIComponent(q));
            } catch (e) { /* ignore logging errors */ }
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
                    if (items && items.length > 0) { usedRetry = true; break; }
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
                Name: first.querySelector('.name a')?.textContent.trim(),
                Brewery: first.querySelector('.brewery a')?.textContent.trim(),
                Rating: first.querySelector('.caps')?.getAttribute('data-rating') || "0",
                Packaging: beer.Packaging,
                Price: beer.Price,
                Style: first.querySelector('.style')?.textContent.trim() || "N/A",
                Abv: first.querySelector('.abv')?.textContent.trim() || "N/A",
                IsDrunk: first.classList.contains('drankit'),
                Link: "https://untappd.com" + first.querySelector('.name a')?.getAttribute('href'),
                Found: true
            };
            results.push(foundBeer);
            console.log("[" + (i+1) + "/" + beerList.length + "] ✅ FOUND: " + beer.Name + (usedRetry ? ' (retry)' : ''));

            if (items.length > 1) {
                // Collect detailed matches for end-of-run reporting
                try {
                    const matches = items.map(it => {
                        const n = it.querySelector('.name a')?.textContent.trim() || 'N/A';
                        const b = it.querySelector('.brewery a')?.textContent.trim() || 'N/A';
                        return b + ' - ' + n;
                    });
                    inconclusiveMatches.push({ Brewery: beer.Brewery, Name: beer.Name, matches });
                } catch (e) {
                    inconclusiveMatches.push({ Brewery: beer.Brewery, Name: beer.Name, matches: [] });
                }
            }
        } else {
            results.push({ ...beer, Found: false });
            console.warn("[" + (i+1) + "/" + beerList.length + "] ❌ NOT FOUND: " + beer.Name);
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const foundCount = results.filter(b => b.Found).length;

    console.log("%c--- FETCH SUMMARY ---", "color: #ff9000; font-weight: bold; font-size: 14px;");
    console.log("Total Time: " + duration + "s");
    console.log("Found: " + foundCount + " | Not Found: " + (results.length - foundCount));
    console.log("Total Processed: " + results.length);

    if (inconclusiveMatches.length > 0) {
        console.log("%c--- INCONCLUSIVE MATCHES ---", "color: #1e3a8a; font-weight: bold; font-size: 12px;");
        inconclusiveMatches.forEach(entry => {
            const count = Array.isArray(entry.matches) ? entry.matches.length : 0;
            try {
                console.log("%c%s", "color: #1e40af; font-weight: 600;", entry.Brewery + " - " + entry.Name + (count ? " (" + count + " matches):" : ":"));
                if (count) {
                    entry.matches.forEach(m => console.log("%c   - %s", "color: #374151;", m));
                }
            } catch (e) {
                // fallback to plain logging
                console.log(entry.Brewery + " - " + entry.Name + (count ? " (" + count + " matches):" : ":"));
                if (count) entry.matches.forEach(m => console.log("   - " + m));
            }
        });
    }

    return results;
}

fetchUntappdData(window.lidlBeers);
