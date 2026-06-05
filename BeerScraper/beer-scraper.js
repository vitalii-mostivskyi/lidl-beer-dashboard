/**
 * Lidl Beer Scraper (v4 - Optimized)
 * Browser console fallback — scroll the listing to the bottom first, then paste and run.
 * Automated CLI: npm run scrape -- --url "<LIDL_LISTING_URL>" (see ../README.md)
 * Returns JSON with Name, Brewery, Packaging (Bottle/Can), Price, and URL.
 */
(() => {
    const tiles = Array.from(document.querySelectorAll('[data-gridbox-impression]'));

    if (tiles.length === 0) {
        console.error('No products found. Make sure you are on the product list page.');
        return;
    }

    const beers = tiles.map(tile => {
        // 1. Extract core data from the data attribute
        const rawData = tile.getAttribute('data-gridbox-impression');
        let productData = {};
        try {
            productData = JSON.parse(decodeURIComponent(rawData));
        } catch (e) {
            console.warn('Could not parse data for a tile:', e);
        }

        // 2. Get the full product URL
        const productUrl = tile.querySelector('a.odsc-tile__link')?.href || '';

        // 3. Determine packaging from image alt text
        const images = Array.from(tile.querySelectorAll('img'));
        let packaging = 'Unknown';
        for (const img of images) {
            const alt = (img.alt || '').toLowerCase();
            if (alt.includes('puszka')) {
                packaging = 'Can';
                break;
            } else if (alt.includes('butelka')) {
                packaging = 'Bottle';
                break;
            }
        }

        return {
            Name: productData.name || 'Unknown',
            Brewery: productData.brand || 'Unknown',
            Packaging: packaging,
            Price: productData.price,
            URL: productUrl
        };
    });

    const finalResult = {
        url: window.location.href,
        totalCount: beers.length,
        beers: beers
    };

    window.lidlBeers = beers;
    return finalResult;
})();
