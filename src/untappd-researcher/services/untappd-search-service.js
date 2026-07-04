import { SearchService } from './search-service.js';

const UNTAPPD_BASE_URL = "https://untappd.com";

/**
 * Real Untappd search service using Playwright browser
 */
export class UntappdSearchService extends SearchService {
  constructor(page) {
    super();
    this.page = page;
  }

  /**
   * Search Untappd for beers matching a query
   * @param {string} query - Search query string
   * @returns {Promise<Array>} - Array of beer items found on Untappd
   */
  async search(query) {
    try {
      const url = `${UNTAPPD_BASE_URL}/search?q=${encodeURIComponent(query)}`;

      // Navigate to search URL and wait for results
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

      // Extract beer items from the page HTML
      const items = await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('.beer-item, [data-beer-id]')).map(el => {
          const nameLink = el.querySelector('.name a, .beer-name a');
          const breweryLink = el.querySelector('.brewery a, .brewer-name a');
          const styleEl = el.querySelector('.style, .beer-style');
          const abvEl = el.querySelector('.abv');
          const ratingEl = el.querySelector('.caps, [data-rating]');

          return {
            name: nameLink?.textContent?.trim(),
            nameHref: nameLink?.getAttribute('href'),
            brewery: breweryLink?.textContent?.trim(),
            style: styleEl?.textContent?.trim(),
            abv: abvEl?.textContent?.trim(),
            rating: ratingEl?.getAttribute('data-rating') || ratingEl?.getAttribute('data-score'),
          };
        }).filter(item => item.name || item.brewery);
      });

      return items;
    } catch (e) {
      return [];
    }
  }
}
