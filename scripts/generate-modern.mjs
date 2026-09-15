import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT  = path.resolve(__dirname, '..');
const DATA  = path.join(ROOT, 'src', 'data', 'kurals.json');
const OUT   = path.join(ROOT, 'src', 'data', 'modern.json');
const STATE = path.join(ROOT, 'scripts', '.modern-state.json');

const MODEL    = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const ACCOUNT  = process.env.CF_ACCOUNT_ID || '46847dadc63740c40819d01e36f35348';
const TOKEN    = process.env.CF_API_TOKEN || '';
const BATCH    = Number(process.env.BATCH_SIZE || 5);
const CONCURR  = Number(process.env.CONCURRENCY || 3);
const SAMPLE   = process.env.SAMPLE ? Number(process.env.SAMPLE) : 0; // 0 = all
const MAX_TOK  = 1600;

const kurals = JSON.parse(fs.readFileSync(DATA, 'utf8'))
  .slice()
  .sort((a, b) => Number(a.number) - Number(b.number));

const existing = {};
if (fs.existsSync(OUT)) {
  const arr = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  arr.forEach((item, idx) => { if (item?.m) existing[idx] = item; });
}
const done = new Set(Object.keys(existing).filter(n => existing[n].src !== 0).map(Number));

const queue = kurals
  .map(k => Number(k.number))
  .filter(n => !done.has(n));
if (SAMPLE > 0) queue.length = Math.min(queue.length, SAMPLE);

function buildPrompt(batch) {
  const lines = batch.map(k =>
    `V${k.number === 1 ? 1 : k.number}. Kural #${k.number} — chapter: ${k.chap_eng}\n   Tamil verse: ${k.line1} / ${k.line2}\n   English meaning: ${k.eng_exp || k.eng}`
  ).join('\n');
  return `You are a translator of ancient Tamil wisdom for busy modern readers. For EACH verse below write a short "modern day interpretation":
- title: 3-6 words, a fresh contemporary heading that names the idea.
- text: exactly two sentences, 22-45 words total, applying THAT verse's idea to everyday modern life with a concrete small example; make every reading clearly specific to its verse and obviously different from the others; never generic advice; do not re-translate the meaning; no quotation marks around the whole text; no markdown.
SERIOUS TONE, WARM BUT DIRECT.

Verses:
${lines}

Respond with ONLY a raw JSON array of ${batch.length} objects, no prose, no markdown fencing. Each object exactly: {"n":<kural number>,"t":"<title>","m":"<text>"}`;
}

async function callBatch(batch) {
  const prompt = buildPrompt(batch);
  const body = JSON.stringify({
    model: MODEL,
    input: { messages: [{ role: 'user', content: prompt }], max_tokens: MAX_TOK },
  });
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body,
  });
  if (res.status === 402) throw new Retryable('402 payment required', false);
  if (res.status === 429 || res.status === 500 || res.status === 503) {
    throw new Retryable(`${res.status}: ${(await res.text().catch(() => '')).slice(0, 180)}`, true);
  }
  if (!res.ok) throw new Retryable(`${res.status}: ${(await res.text().catch(() => '')).slice(0, 180)}`, true);
  const json = await res.json();
  if (!json.success) throw new Retryable(JSON.stringify(json.errors || json).slice(0, 240), true);
  const content =
    json.result?.choices?.[0]?.message?.content ??
    json.result?.response ??
    '';
  return String(content).trim();
}

class Retryable extends Error {
  constructor(msg, retriable) { super(msg); this.retriable = retriable; }
}

function extractJson(text) {
  const clean = text.replace(/```json|```/g, '');
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(clean.slice(start, end + 1)); }
  catch { return null; }
}

function save(entries) {
  const arr = [];
  kurals.forEach(k => {
    const hit = entries[k.number];
    arr[k.number] = hit && hit.m ? { t: hit.t || 'A modern reading', m: hit.m, src: hit.src === 0 ? 0 : 1 } : null;
  });
  arr[0] = null;
  fs.writeFileSync(OUT, JSON.stringify(arr, null, 0));
}

async function runItem(item, index, total) {
  const batch = kurals.filter(k => item.indexOf(Number(k.number)) === -1);
  const picked = [];
  for (const n of item) {
    const k = kurals.find(x => Number(x.number) === n);
    if (k) picked.push(k);
  }
  if (!picked.length) return { error: 'empty batch' };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const raw = await callBatch(picked);
      const parsed = extractJson(raw);
      if (!parsed || !Array.isArray(parsed)) throw new Retryable('unparsed model output: ' + raw.slice(0, 140), true);
      const good = {};
      for (const obj of parsed) {
        if (obj && Number.isFinite(Number(obj.n)) && obj.t && obj.m) {
          good[Number(obj.n)] = { t: String(obj.t).trim(), m: String(obj.m).trim(), src: 1 };
          done.add(Number(obj.n));
        }
      }
      return { good, raw: raw.slice(0, 120) };
    } catch (err) {
      if (err instanceof Retryable && !err.retriable) throw err;
      await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error('exhausted retries');
}

async function main() {
  if (!TOKEN) { console.error('CF_API_TOKEN env missing'); process.exit(1); }
  const chunks = [];
  for (let i = 0; i < queue.length; i += BATCH) chunks.push(queue.slice(i, i + BATCH));
  const remaining = chunks.length;
  if (SAMPLE > 0) console.log(`SAMPLE mode: processing ${queue.length} kurals (${chunks.length} batches)`);
  else console.log(`Generating modern interpretations: ${queue.length} kurals, ${chunks.length} batches, concurrency ${CONCURR}`);

  let cursor = 0;
  const onDone = async (res, chunk) => {
    if (res?.good) {
      Object.assign(existing, res.good);
      for (const n of Object.keys(res.good)) done.add(Number(n));
    }
    cursor += 1;
    if (cursor % 20 === 0 || cursor === remaining) {
      save(existing);
      console.log(`progress ${cursor}/${remaining}`);
      fs.writeFileSync(STATE, JSON.stringify({ cursor, done: [...done], ts: Date.now() }, null, 2));
    }
  };
  const onErr = (err, chunk) => {
    if (err instanceof Retryable && !err.retriable) { console.error('FATAL (402 etc):', err.message); process.exit(2); }
    console.error('batch failed after retries:', chunk, err.message);
    throw err;
  };

  const start = Date.now();
  // Process chunks with a small worker pool.
  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURR, chunks.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= chunks.length) break;
      const chunk = chunks[idx];
      try {
        const res = await runItem(chunk, idx, chunks.length);
        await onDone(res, chunk);
      } catch (err) {
        if (err instanceof Retryable && !err.retriable) throw err;
        onErr(err, chunk);
      }
    }
  });
  await Promise.all(workers);
  save(existing);
  console.log(`DONE in ${Math.round((Date.now() - start) / 1000)}s. modern.json entries: ${Object.keys(existing).length}`);
}

main().catch(err => { console.error(err); process.exit(1); });