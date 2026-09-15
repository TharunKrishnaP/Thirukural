# Thirukkural — Wisdom, Reimagined

An immersive React + Vite website for exploring all 1,330 Thirukkurals.

## V13 highlights
- Tamil Kural is always shown first on the Kural page.
- The Kural page then shows **Meaning in English**, followed by a **Modern Interpretation**.
- A **Roman/Tanglish transliteration** of every Kural line is displayed so non-Tamil readers can pronounce the original text.
- No separate English-translation block is displayed.
- The Read Aloud control uses a **real Tamil voice through a gTTS (Google Translate TTS) proxy Worker**: it reads the original Kural in Tamil script with native pronunciation, and reads the English meaning with an Indian English voice (`en-in`). It falls back to the browser's speech engine otherwise (optimized for Android Chrome and desktop browsers), speaking Tamil as `ta-IN` from the Tamil script and the meaning as `en-IN`.
- The Wisdom Galaxy is now hierarchical and lightweight: **அ → 133 chapters → 10 Kurals → Kural explanation page**.
- The Galaxy uses layered rings, chapter branches, zoom, drag, and Android pinch gestures without rendering 1,330 animated stars at once.
- Chapter names are bundled in the application so the landing/explore pages do not depend on an API response for chapter naming.
- Hash routing and relative Vite assets make the built site suitable for static hosting.

## Run locally

```bash
npm install
npm run build-data
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## Data builder

`npm run build-data` downloads the complete static collection once, validates that the original Tamil text is present for all 1,330 Kurals, merges the 133 chapter records, sorts the collection from 1 to 1330, and writes:

`src/data/kurals.json`

The builder deliberately rejects rows that do not contain Tamil Unicode text so an English-only response cannot silently replace the original Kural.

## Deployment

Run `npm run build` and deploy the generated `dist/` folder to any static host such as GitHub Pages, Netlify, Vercel, Cloudflare Pages, or another static web server. Because the app uses HashRouter and relative assets, it does not require server-side route rewrites.


## Voice read-aloud

By default the Read Aloud control uses the browser's built-in speech synthesis. To upgrade it to a correctly-pronouncing, real-voice TTS:

1. Deploy the included Worker (folder `workers/tts`, a gTTS proxy with edge caching):

   ```bash
   npx wrangler login
   cd workers/tts
   npx wrangler deploy
   ```

   Optionally add a shared secret to limit abuse: `npx wrangler secret put TTS_API_KEY` and name the matching client key `VITE_TTS_KEY`.

2. Point the site at the Worker. Vite env files are never committed, so create `.env.local` in the project root:

   ```
   VITE_TTS_ENDPOINT=https://thirukkural-tts.<your-subdomain>.workers.dev
   # VITE_TTS_KEY=<same value as TTS_API_KEY, only if you set the secret>
   ```

3. Rebuild with `npm run build`.

The Worker calls Google Translate's TTS (gTTS): `tl=ta` pronounces the original Tamil verse from the actual Tamil characters (clear native Tamil), and `tl=en-in` reads the English meaning in a natural Indian English voice. Each synthesized phrase is cached on Cloudflare's edge keyed by `text + language`, so repeat plays are instant and cost nothing; long phrases are chunked because gTTS truncates around 200 characters. When `VITE_TTS_ENDPOINT` is empty the browser speech engine is used (Tamil as `ta-IN`, meaning as `en-IN`), so local development keeps working without Cloudflare.


## Data loading note

The project no longer depends on per-Kural Vercel API calls. The previous endpoint could return HTTP 402 during bulk loading. V14 uses a complete static JSON dataset instead, which is fetched once at build time and, if necessary, once at runtime.


## Navigation reliability (V17)
All internal navigation uses explicit hash URLs (`#/...`) so the site works reliably on static hosting without server-side rewrite rules. The Kural route is `#/kural/<number>`. Wisdom Galaxy uses `#/galaxy?chapter=<number>` for its chapter level, and every Kural node links directly to its Kural route.


## Kural page reliability

Individual Kural pages load the requested Kural from the compact `tamil-kural-api.vercel.app` endpoint first, then fall back to the documented `api-thirukkural.web.app` endpoint and finally the complete static GitHub dataset. This prevents a single Kural page from depending on a large dataset download.


## Kural page reliability
The Kural route uses a documented individual-Kural API first, with independent fallbacks, local caching, and a visible error boundary. Kural 1 is bundled as an emergency offline record so the route never becomes a blank screen.
