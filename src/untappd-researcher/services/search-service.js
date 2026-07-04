/**
 * Abstract SearchService interface
 * Both real (Untappd) and mock implementations must satisfy this contract
 */
export class SearchService {
  /**
   * Search for beers matching a query
   * @param {string} query - Search query string
   * @returns {Promise<Array>} - Array of beer items found
   * @throws {Error} - Subclasses must implement this method
   */
  async search(query) {
    throw new Error('search() must be implemented by subclass');
  }
}
