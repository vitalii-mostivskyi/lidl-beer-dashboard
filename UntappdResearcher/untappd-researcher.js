
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
            return doc.querySelector('.beer-item');
        } catch (e) { return null; }
    }

    for (let i = 0; i < beerList.length; i++) {
        const beer = beerList[i];
        let item = null;
        let query = beer.Brewery + " " + beer.Name;
        let usedRetry = false;
        
        item = await performSearch(query);

        // --- IMPROVED RETRY LOGIC ---
        if (!item && beer.Name.includes("ONINNI")) {
            query = beer.Brewery + " " + beer.Name.replace("ONINNI", "Our New IPA Needs No Introduction");
            item = await performSearch(query);
            usedRetry = !!item;
        }
        if (!item && beer.Name.includes("PL ")) {
            query = beer.Brewery + " " + beer.Name.replace("PL ", "Polish ");
            item = await performSearch(query);
            usedRetry = !!item;
        }
        if (!item && beer.Name.includes("THE NELSON REGION")) {
            query = beer.Brewery + " " + beer.Name.replace("THE NELSON REGION - ", "");
            item = await performSearch(query);
            usedRetry = !!item;
        }

        // Broaden Search (Explicit Style Stripping)
        if (!item) {
            const styles = ["Polish Hazy IPA", "West Coast IPA", "Hazy IPA", "IPA", "Session Oat IPA", "Red IPA"];
            for (const style of styles) {
                if (beer.Name.includes(style)) {
                    query = beer.Brewery + " " + beer.Name.replace(style, "").trim();
                    item = await performSearch(query);
                    if (item) { usedRetry = true; break; }
                }
            }
        }

        // Final Fallback: Peel back words one by one
        if (!item) {
            let words = beer.Name.split(' ');
            while (words.length > 1 && !item) {
                words.pop();
                query = beer.Brewery + " " + words.join(' ');
                item = await performSearch(query);
                if (item) usedRetry = true;
            }
        }

        if (item) {
            const foundBeer = {
                Name: item.querySelector('.name a')?.textContent.trim(),
                Brewery: item.querySelector('.brewery a')?.textContent.trim(),
                Rating: item.querySelector('.caps')?.getAttribute('data-rating') || "0",
                Packaging: beer.Packaging,
                Price: beer.Price,
                Style: item.querySelector('.style')?.textContent.trim() || "N/A",
                Abv: item.querySelector('.abv')?.textContent.trim() || "N/A",
                IsDrunk: item.classList.contains('drankit'),
                Link: "https://untappd.com" + item.querySelector('.name a')?.getAttribute('href'),
                Found: true
            };
            results.push(foundBeer);
            console.log("[" + (i+1) + "/" + beerList.length + "] ✅ FOUND: " + beer.Name + (usedRetry ? ' (retry)' : ''));
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

    return results;
}

fetchUntappdData(window.lidlBeers);
