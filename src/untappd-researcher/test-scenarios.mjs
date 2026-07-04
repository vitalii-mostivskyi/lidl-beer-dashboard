/**
 * Test Scenarios for MockSearchService
 * Define test data: beer lists + mock query->result maps
 */

/**
 * Scenario A: Mix of found, not-found, and multiple-match beers
 */
export const scenarioA = {
  description: "Basic scenarios: found (single), found (multiple), not-found",
  beers: [
    {
      Name: "Peroni",
      Brewery: "Peroni",
      Packaging: "Bottle",
      Price: "5.99",
      URL: "https://example.com/peroni"
    },
    {
      Name: "Guinness",
      Brewery: "Guinness",
      Packaging: "Bottle",
      Price: "6.99",
      URL: "https://example.com/guinness"
    },
    {
      Name: "UnknownBeer",
      Brewery: "UnknownBrewery",
      Packaging: "Can",
      Price: "3.99",
      URL: "https://example.com/unknown"
    }
  ],
  scenarioMap: {
    "Peroni Peroni": [
      {
        name: "Peroni",
        brewery: "Peroni Brewery",
        style: "Lager",
        abv: "4.7%",
        rating: "3.5",
        nameHref: "/beer/peroni/123456"
      }
    ],
    "Guinness Guinness": [
      {
        name: "Guinness Original",
        brewery: "Guinness",
        style: "Stout",
        abv: "4.2%",
        rating: "4.0",
        nameHref: "/beer/guinness-original/234567"
      },
      {
        name: "Guinness Draught",
        brewery: "Guinness",
        style: "Stout",
        abv: "4.2%",
        rating: "4.1",
        nameHref: "/beer/guinness-draught/234568"
      },
      {
        name: "Guinness Extra Stout",
        brewery: "Guinness",
        style: "Stout",
        abv: "4.3%",
        rating: "4.0",
        nameHref: "/beer/guinness-extra/234569"
      }
    ]
  }
};

/**
 * Scenario B: Special retry cases (ONINNI, PL abbreviations, style stripping, word peeling)
 */
export const scenarioB = {
  description: "Special retry paths: acronym expansion, style stripping, word peeling",
  beers: [
    {
      Name: "ONINNI",
      Brewery: "Browar Test",
      Packaging: "Bottle",
      Price: "7.99",
      URL: "https://example.com/oninni"
    },
    {
      Name: "PL Kolsch",
      Brewery: "Browar Polish",
      Packaging: "Bottle",
      Price: "5.49",
      URL: "https://example.com/pl-kolsch"
    },
    {
      Name: "THE NELSON REGION - Adventure",
      Brewery: "Browar Adventure",
      Packaging: "Can",
      Price: "6.49",
      URL: "https://example.com/nelson"
    },
    {
      Name: "Hazy IPA Special Edition",
      Brewery: "Browar IPA",
      Packaging: "Bottle",
      Price: "7.49",
      URL: "https://example.com/hazy-ipa"
    }
  ],
  scenarioMap: {
    // First query for ONINNI fails
    "Browar Test ONINNI": [],
    // Browar stripped - still fails
    "Test ONINNI": [],
    // Acronym expansion succeeds
    "Test Our New IPA Needs No Introduction": [
      {
        name: "ONINNI",
        brewery: "Test Brewery",
        style: "IPA",
        abv: "6.2%",
        rating: "4.3",
        nameHref: "/beer/oninni/345678"
      }
    ],

    // PL queries
    "Browar Polish PL Kolsch": [],
    "Polish PL Kolsch": [],
    "Polish Polish Kolsch": [
      {
        name: "Polish Kolsch",
        brewery: "Polish Brewery",
        style: "Kolsch",
        abv: "5.0%",
        rating: "4.0",
        nameHref: "/beer/polish-kolsch/456789"
      }
    ],

    // NELSON REGION queries
    "Browar Adventure THE NELSON REGION - Adventure": [],
    "Adventure THE NELSON REGION - Adventure": [],
    "Adventure Adventure": [
      {
        name: "Adventure IPA",
        brewery: "Adventure Brewery",
        style: "IPA",
        abv: "6.5%",
        rating: "4.2",
        nameHref: "/beer/adventure-ipa/567890"
      }
    ],

    // Style stripping - all first attempts fail
    "Browar IPA Hazy IPA Special Edition": [],
    "IPA Hazy IPA Special Edition": [],
    // Style stripping succeeds
    "IPA Special Edition": [
      {
        name: "Special Edition Hazy",
        brewery: "IPA Brewery",
        style: "Hazy IPA",
        abv: "6.8%",
        rating: "4.4",
        nameHref: "/beer/special-hazy/678901"
      }
    ]
  }
};

/**
 * Scenario C: Word peeling retry path (progressively shorter names)
 */
export const scenarioC = {
  description: "Word peeling: brand name too specific initially, succeeds with fewer words",
  beers: [
    {
      Name: "Limited Edition Imperial Stout Extravaganza",
      Brewery: "Browar Big",
      Packaging: "Bottle",
      Price: "12.99",
      URL: "https://example.com/limited"
    }
  ],
  scenarioMap: {
    // All attempts with full name fail
    "Browar Big Limited Edition Imperial Stout Extravaganza": [],
    "Big Limited Edition Imperial Stout Extravaganza": [],

    // Word peeling attempts
    "Big Limited Edition Imperial Stout": [],
    "Big Limited Edition Imperial": [],
    "Big Limited Edition": [],
    "Big Limited": [
      {
        name: "Limited Edition",
        brewery: "Big Brewery",
        style: "Stout",
        abv: "8.5%",
        rating: "4.5",
        nameHref: "/beer/limited-ed/789012"
      }
    ]
  }
};

/**
 * Scenario D: Mix of all scenarios (comprehensive test)
 */
export const scenarioD = {
  description: "Comprehensive mix: found single, found multiple, not-found, retry successes",
  beers: [
    // From scenario A
    {
      Name: "Peroni",
      Brewery: "Peroni",
      Packaging: "Bottle",
      Price: "5.99",
      URL: "https://example.com/peroni"
    },
    // From scenario B
    {
      Name: "ONINNI",
      Brewery: "Browar Test",
      Packaging: "Bottle",
      Price: "7.99",
      URL: "https://example.com/oninni"
    },
    // From scenario C
    {
      Name: "Limited Edition Imperial Stout",
      Brewery: "Browar Big",
      Packaging: "Bottle",
      Price: "12.99",
      URL: "https://example.com/limited"
    },
    // Pure not-found
    {
      Name: "CompletelyUnknown BeerName",
      Brewery: "NonExistentBrewery XYZ",
      Packaging: "Can",
      Price: "4.99",
      URL: "https://example.com/unknown-xyz"
    }
  ],
  scenarioMap: {
    // Peroni - found in single attempt
    "Peroni Peroni": [
      {
        name: "Peroni",
        brewery: "Peroni Brewery",
        style: "Lager",
        abv: "4.7%",
        rating: "3.5",
        nameHref: "/beer/peroni/123456"
      }
    ],

    // ONINNI - found via acronym expansion
    "Browar Test ONINNI": [],
    "Test ONINNI": [],
    "Test Our New IPA Needs No Introduction": [
      {
        name: "ONINNI",
        brewery: "Test Brewery",
        style: "IPA",
        abv: "6.2%",
        rating: "4.3",
        nameHref: "/beer/oninni/345678"
      }
    ],

    // Limited - found via word peeling
    "Browar Big Limited Edition Imperial Stout": [],
    "Big Limited Edition Imperial Stout": [],
    "Big Limited Edition": [],
    "Big Limited": [
      {
        name: "Limited Edition",
        brewery: "Big Brewery",
        style: "Stout",
        abv: "8.5%",
        rating: "4.5",
        nameHref: "/beer/limited-ed/789012"
      }
    ]

    // CompletelyUnknown BeerName - not found in any scenario
  }
};
