Scroll test helper
==================

Purpose
-------

- Reproduce and experiment with scrolling strategies to trigger lazy-loading
  of product tiles on Lidl listing pages.

Why keep it
-----------

- It's a lightweight development helper for diagnosing when `window.scrollTo`
  is insufficient and a wheel/touch-like event is required.

How to use
----------

Run the script directly from the repo root:

```
node BeerScraper/dev/scroll-test.mjs
```

Or pass a URL:

```
node BeerScraper/dev/scroll-test.mjs "https://www.lidl.pl/c/piwa-kraftowe/a10072919"
```

Recommendation
--------------

Keep this under `BeerScraper/dev/` for future debugging; remove if you prefer a
cleaner repository.
