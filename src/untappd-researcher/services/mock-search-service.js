import { SearchService } from './search-service.js';

/**
 * Mock SearchService for testing
 * Accepts a scenario map: { query -> items[] }
 * Tracks all queries attempted for diagnostic reporting
 */
export class MockSearchService extends SearchService {
  /**
   * @param {Object} scenarioMap - Map of query strings to result items
   *        Example: { "brewery name beer name" -> [{name, brewery, style, abv, rating}, ...] }
   */
  constructor(scenarioMap = {}) {
    super();
    this.scenarioMap = scenarioMap;
    this.allQueriesAttempted = [];
  }

  /**
   * Search the mock scenario map for matching results
   * @param {string} query - Search query string
   * @returns {Promise<Array>} - Items matching the query in scenario map, or empty array
   */
  async search(query) {
    // Track every query attempted
    this.allQueriesAttempted.push(query);

    // Return results from scenario map or empty array if not found
    return this.scenarioMap[query] || [];
  }

  /**
   * Get all queries that have been attempted
   * @returns {Array<string>} - All queries tried
   */
  getQueriesAttempted() {
    return this.allQueriesAttempted;
  }

  /**
   * Reset the query tracking (useful between tests)
   */
  resetQueryTracking() {
    this.allQueriesAttempted = [];
  }
}
