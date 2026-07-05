/**
 * ResultFormatter - Formats search results and generates summary output
 */
export class ResultFormatter {
  /**
   * Format the summary after searching
   * 
   * @param {Array} allSearchResults - Array of search results from RetryStrategy
   * @param {number} totalDuration - Total time in milliseconds
   * @returns {string} - Formatted summary for console output
   */
  formatSummary(allSearchResults, totalDuration) {
    const durationSec = (totalDuration / 1000).toFixed(2);
    const foundCount = allSearchResults.filter(r => r.found).length;
    const notFoundCount = allSearchResults.filter(r => !r.found).length;

    let output = "\n--- FETCH SUMMARY ---\n";
    output += `Total Time: ${durationSec}s\n`;
    output += `Found: ${foundCount} | Not Found: ${notFoundCount}\n`;
    output += `Total Processed: ${allSearchResults.length}\n`;

    // Collect beers with multiple matches (inconclusive)
    const inconclusiveMatches = allSearchResults
      .filter(r => r.hasMultipleMatches && r.found)
      .map(r => ({
        originalBeer: r.originalBeer,
        finalResult: r.finalResult,
        allMatches: r.allMatches
      }));

    // Collect not-found beers with their attempted queries
    const notFoundBeers = allSearchResults
      .filter(r => !r.found)
      .map(r => ({
        beer: r.finalResult,
        attempts: r.attempts
      }));
      
    // Print not-found beers section with their attempted queries
    if (notFoundBeers.length > 0) {
      output += "\n--- NOT FOUND BEERS ---\n";
      notFoundBeers.forEach((entry, index) => {
        const beer = entry.beer;
        output += `\n❌ [${index + 1}/${notFoundBeers.length}] ${beer.Brewery} - ${beer.Name}\n`;

        if (entry.attempts && entry.attempts.length > 0) {
          output += `   Attempted queries (${entry.attempts.length}):\n`;
          entry.attempts.forEach((attempt, attemptIndex) => {
            output += `     ${attemptIndex + 1}. ${attempt.query}\n`;
          });
        }
      });
    }

    // Print inconclusive matches section
    if (inconclusiveMatches.length > 0) {
      output += "\n--- INCONCLUSIVE MATCHES (Multiple Results) ---\n";
      inconclusiveMatches.forEach(entry => {
        const matches = entry.allMatches || [];
        output += `${entry.originalBeer.Brewery} - ${entry.originalBeer.Name}`;
        if (matches.length > 0) {
          output += ` (${matches.length} matches):\n`;
          matches.forEach(m => {
            const breweryName = m.brewery || 'N/A';
            const beerName = m.name || 'N/A';
            output += `   - ${breweryName} - ${beerName}\n`;
          });
        } else {
          output += "\n";
        }
      });
    }

    return output;
  }
}
