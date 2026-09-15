// Thirukkural neural voice endpoint.
//
// Speaks the actual Tamil verse (not a romanization) with a clear Google Tamil
// voice, and the English meaning with a natural Indian English voice. Audio is
// proxied from Google's well-known translate_tts endpoint and every phrase is
// cached at the edge, so each Kural is synthesized at most once and then served
// instantly from Cloudflare's cache.
//
// Deploy from this folder:
//   npx wrangler login
//   npx wrangler deploy
// Then build the site with VITE_TTS_ENDPOINT set in .env.local.
//
// Endpoints:
//   GET /voices                       -> JSON language/voice info
//   GET /synthesize?text=...&lang=ta  -> audio/mpeg byte stream
//        lang=ta    real Tamil verse, clear Tamil pronunciation
//        lang=en-in English meaning, natural Indian English voice
//
// Optional abuse protection: set the TTS_API_KEY secret. When present every
// /synthesize request must include it via `x-api-key` header or `key` query.

const LANGS = ['ta', 'en-in', 'en'];
const MAX_TEXT = 500;
const GTTS_CHUNK = 180;          // gTTS truncates above ~200 chars per call
const GTTS_URL   = 'https://translate.google.com/translate_tts';
const GTTS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Referer': 'https://translate.google.com/',
  'Accept': '*/*',
};
const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=31536000, immutable' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Max-Age': '86400',
};

function withCors(response, extra = {}) {
  const h = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders)) h.set(k, v);
  for (const [k, v] of Object.entries(extra))       h.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

function json(data, status = 200) {
  return withCors(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  }));
}

function isAuthorized(request, env) {
  if (!env.TTS_API_KEY) return true;
  const hdr  = request.headers.get('x-api-key') || '';
  const parm = new URL(request.url).searchParams.get('key') || '';
  return hdr === env.TTS_API_KEY || parm === env.TTS_API_KEY;
}

// Split long text on sentence/word boundaries so no single gTTS call exceeds
// the ~200 character hard limit that would silently truncate speech.
function chunkText(text) {
  if (text.length <= GTTS_CHUNK) return [text];
  const parts = [];
  let rest = text;
  while (rest.length > GTTS_CHUNK) {
    let cut = rest.lastIndexOf('. ', GTTS_CHUNK);
    if (cut < 60) cut = rest.lastIndexOf(' ', GTTS_CHUNK);
    if (cut < 60) cut = GTTS_CHUNK;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

// Wrap fetch so we never leak Google's underlying response into the client.
async function gtts(text, tl) {
  const url = new URL(GTTS_URL);
  url.searchParams.set('ie', 'UTF-8');
  url.searchParams.set('client', 'tw-ob');
  url.searchParams.set('tl', tl);
  url.searchParams.set('q', text);
  return fetch(url.toString(), { headers: GTTS_HEADERS });
}

async function synthesize(request, url, env, ctx, text, lang) {
  const cache    = caches.default;
  const cacheUrl = url.origin + '/synthesize?lang=' + lang + '&text=' + encodeURIComponent(text);
  const cacheReq = new Request(cacheUrl, { method: 'GET' });

  const cached = await cache.match(cacheReq);
  if (cached) return withCors(cached, CACHE_HEADERS);

  const chunks = chunkText(text);
  const buffers = [];
  for (const chunk of chunks) {
    const res = await gtts(chunk, lang);
    if (!res.ok || res.status !== 200) {
      const detail = await res.text().catch(() => '');
      return json({ error: 'Speech provider error.', status: res.status, detail: String(detail).slice(0, 120) }, 502);
    }
    const arrayBuffer = await res.arrayBuffer();
    buffers.push(arrayBuffer);
  }

  const total = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const audio  = new Uint8Array(total);
  let offset = 0;
  for (const buf of buffers) {
    audio.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  const resp = new Response(audio, {
    status: 200,
    headers: {
      'Content-Type':   'audio/mpeg',
      'Content-Length': String(total),
      ...CACHE_HEADERS,
    },
  });

  ctx.waitUntil(cache.put(cacheReq, resp.clone()));
  return withCors(resp);
}

async function handle(request, env, ctx) {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders });

  const url   = new URL(request.url);
  const route = url.pathname;

  if (route === '/')
    return json({
      name: 'thirukkural-tts',
      voices: {
        ta:    'Google Tamil (female, clear Tamil pronunciation)',
        'en-in': 'Google Indian English (natural Indian accent)',
      },
      endpoints: ['/voices', '/synthesize?text=...&lang=ta'],
    });

  if (route === '/voices')
    return json({
      voices: {
        ta:    { lang: 'ta',    description: 'Tamil — reads the original verse.' },
        'en-in': { lang: 'en-in', description: 'Indian English — reads the meaning.' },
      },
    });

  if (route !== '/synthesize')
    return json({ error: 'Not found.' }, 404);

  if (request.method !== 'GET')
    return json({ error: 'Method not allowed.' }, 405);

  if (!isAuthorized(request, env))
    return json({ error: 'Missing or invalid API key.' }, 401);

  const text = (url.searchParams.get('text') || '').slice(0, MAX_TEXT).trim();
  if (!text) return json({ error: 'Missing "text" parameter.' }, 400);

  const lang = (url.searchParams.get('lang') || 'ta').toLowerCase();
  if (!LANGS.includes(lang))
    return json({ error: `Unsupported lang "${lang}".`, langs: LANGS }, 400);

  return synthesize(request, url, env, ctx, text, lang);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch (err) {
      console.error('REQUEST FAILURE:', err);
      return json({ error: 'Internal error', detail: String(err.stack || err.message || err) }, 500);
    }
  },
};