#!/usr/bin/env node

/**
 * Test Runner - Run untappd-researcher with mock data
 * Allows testing retry logic and result formatting without browser
 *
 * Usage:
 *   npm run test:research                    (runs scenario D - comprehensive mix)
 *   npm run test:research -- --scenario A    (runs specific scenario)
 *   npm run test:research -- --scenario B
 *   npm run test:research -- --scenario C
 *   npm run test:research -- --scenario D
 */

import { RetryStrategy } from './retry-strategy.js';
import { MockSearchService } from './services/mock-search-service.js';
import { ResultFormatter } from './result-formatter.js';
import { scenarioA, scenarioB, scenarioC, scenarioD } from './test-scenarios.mjs';

const SCENARIOS = {
  A: scenarioA,
  B: scenarioB,
  C: scenarioC,
  D: scenarioD
};

function parseArgs(argv) {
  let scenarioName = 'D'; // Default to comprehensive scenario

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--scenario') {
      scenarioName = argv[++i]?.toUpperCase();
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  if (!SCENARIOS[scenarioName]) {
    console.error(`Error: Unknown scenario "${scenarioName}". Valid options: A, B, C, D\n`);
    printUsage();
    process.exit(1);
  }

  return { scenarioName };
}

function printUsage() {
  console.log(`Test Runner - Test retry logic without browser

Usage: npm run test:research -- [--scenario SCENARIO] [--help]

Scenarios:
  A - Basic: found single, found multiple, not-found
  B - Special: ONINNI, PL, NELSON REGION, style stripping, word peeling
  C - Word peeling: progressive name shortening
  D - Comprehensive mix (default)

Examples:
  npm run test:research
  npm run test:research -- --scenario A
  npm run test:research -- --scenario B
  npm run test:research -- --help
`);
}

async function main() {
  const { scenarioName } = parseArgs(process.argv.slice(2));
  const scenario = SCENARIOS[scenarioName];

  console.log(`\n📋 Running Test Scenario ${scenarioName}`);
  console.log(`Description: ${scenario.description}\n`);
  console.log(`Loading ${scenario.beers.length} beers...\n`);

  // Create mock search service with scenario data
  const mockSearchService = new MockSearchService(scenario.scenarioMap);

  // Create retry strategy with mock service
  const retryStrategy = new RetryStrategy(mockSearchService);

  // Run search for each beer
  const startTime = Date.now();
  const allResults = [];

  for (let i = 0; i < scenario.beers.length; i++) {
    const beer = scenario.beers[i];
    const result = await retryStrategy.search(beer);

    if (result.found) {
      const retryCount = result.attempts.length - 1;
      console.log(`[${i + 1}/${scenario.beers.length}] ✅ FOUND: ${beer.Name}${retryCount > 0 ? ` (${retryCount} retries)` : ''}`);
    } else {
      console.log(`[${i + 1}/${scenario.beers.length}] ❌ NOT FOUND: ${beer.Name}`);
    }

    allResults.push(result);
  }

  const totalDuration = Date.now() - startTime;

  // Format and print summary
  const formatter = new ResultFormatter();
  const summary = formatter.formatSummary(allResults, totalDuration);
  console.log(summary);

  // Print queries tracked by mock service (for debugging)
  const totalQueries = mockSearchService.getQueriesAttempted().length;
  console.log(`\n📊 Mock Service Stats:\n   Total queries executed: ${totalQueries}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
