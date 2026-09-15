# Data Sources

The project now avoids per-Kural API calls so the site is not affected by HTTP 402/rate-limit responses from third-party serverless endpoints.

## Primary static source

- `https://raw.githubusercontent.com/tk120404/thirukkural/master/thirukkural.json`
  - 1,330 Kurals
  - Original Tamil lines
  - English translation
  - English explanation
  - Tamil explanations

## Chapter metadata

- `https://raw.githubusercontent.com/tk120404/thirukkural/master/detail.json`
  - 133 chapters
  - Tamil chapter names
  - English chapter names
  - Section metadata
  - Kural start/end ranges

## Build behaviour

Run:

```bash
npm run build-data
```

The builder downloads the two static JSON files once, validates all 1,330 Kural numbers and Tamil text, merges chapter metadata, and writes the complete local file to `src/data/kurals.json`.

There is **no one-by-one Vercel API fallback**. This intentionally prevents repeated HTTP 402 errors such as:

```text
https://api-thirukkural.vercel.app/api?num=1 failed (HTTP 402)
```

## Runtime fallback

If `src/data/kurals.json` is still empty, the website loads the same static `thirukkural.json` once and retrieves Kurals from that in memory. It does not make 1,330 individual API requests.

## Display policy

The website displays:

1. Original Tamil Kural
2. Meaning in English
3. Modern-day interpretation

Roman/Tanglish transliteration is intentionally not displayed.


## Navigation
The application uses HashRouter-compatible hash URLs for static hosting. Internal links write the URL hash directly and the router renders the corresponding page. This avoids relying on server rewrites for `/kural/...` routes.
