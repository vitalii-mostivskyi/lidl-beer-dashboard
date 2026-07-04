/**
 * RetryStrategy - Encapsulates all 8-step retry logic for beer search
 */
export class RetryStrategy {
  constructor(searchService) {
    this.searchService = searchService;
  }

  /**
   * Search for a beer with comprehensive retry strategy
   * Returns all attempts tried plus the final result
   * 
   * @param {Object} beer - Beer object with Name, Brewery, Packaging, Price
   * @returns {Promise<Object>} - { attempts: [{query, items}], finalResult }
   */
  async search(beer) {
    const attempts = [];

    // Prepare cleaned brewery (used for first retry)
    let breweryForQuery = beer.Brewery.replace(/\bBrowar\b\s*/gi, '').trim();

    // Per-beer cache to dedupe identical queries
    const triedQueries = new Set();

    /**
     * Helper: perform search and track attempt
     */
    const doSearch = async (query) => {
      if (triedQueries.has(query)) {
        return null; // Skip duplicate - return null to signal skip
      }
      triedQueries.add(query);
      const items = await this.searchService.search(query);
      attempts.push({ query, items: items || [] });
      return items;
    };

    // Step 1: Original query: [Brewery] [Name]
    let query = beer.Brewery + " " + beer.Name;
    let items = await doSearch(query);

    if (items && items.length > 0) {
      return this._buildResult(beer, attempts, items);
    }

    // Step 2: Strip "Browar" from brewery and try again
    query = breweryForQuery + " " + beer.Name;
    items = await doSearch(query);

    if (items && items.length > 0) {
      return this._buildResult(beer, attempts, items);
    }

    // Step 3: ONINNI expansion
    if (beer.Name.includes("ONINNI")) {
      query = breweryForQuery + " " + beer.Name.replace("ONINNI", "Our New IPA Needs No Introduction");
      items = await doSearch(query);
      if (items && items.length > 0) {
        return this._buildResult(beer, attempts, items);
      }
    }

    // Step 4: PL expansion to "Polish"
    if (beer.Name.includes("PL ")) {
      query = breweryForQuery + " " + beer.Name.replace("PL ", "Polish ");
      items = await doSearch(query);
      if (items && items.length > 0) {
        return this._buildResult(beer, attempts, items);
      }
    }

    // Step 5: THE NELSON REGION handling
    if (beer.Name.includes("THE NELSON REGION")) {
      query = breweryForQuery + " " + beer.Name.replace("THE NELSON REGION - ", "");
      items = await doSearch(query);
      if (items && items.length > 0) {
        return this._buildResult(beer, attempts, items);
      }
    }

    // Step 6: Broaden Search (Explicit Style Stripping)
    const styles = ["Polish Hazy IPA", "West Coast IPA", "Hazy IPA", "IPA", "Session Oat IPA", "Red IPA"];
    for (const style of styles) {
      if (beer.Name.includes(style)) {
        query = breweryForQuery + " " + beer.Name.replace(style, "").trim();
        items = await doSearch(query);
        if (items && items.length > 0) {
          return this._buildResult(beer, attempts, items);
        }
      }
    }

    // Step 7: Final Fallback: Peel back words one by one
    let words = beer.Name.split(' ');
    while (words.length > 1) {
      words.pop();
      query = breweryForQuery + " " + words.join(' ');
      items = await doSearch(query);
      if (items && items.length > 0) {
        return this._buildResult(beer, attempts, items);
      }
    }

    // Step 8: Not found - return original beer with Found: false
    return {
      attempts,
      finalResult: { ...beer, Found: false },
      found: false
    };
  }

  /**
   * Helper: Build a result object for a found beer
   */
  _buildResult(originalBeer, attempts, items) {
    const first = items[0];
    return {
      attempts,
      finalResult: {
        Name: first.name,
        Brewery: first.brewery,
        Rating: first.rating || "0",
        Packaging: originalBeer.Packaging,
        Price: originalBeer.Price,
        Style: first.style || "N/A",
        Abv: first.abv || "N/A",
        Link: first.nameHref ? `https://untappd.com${first.nameHref}` : "",
        Found: true
      },
      found: true,
      hasMultipleMatches: items.length > 1,
      allMatches: items
    };
  }
}
