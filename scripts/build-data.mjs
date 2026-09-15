import { writeFile } from 'node:fs/promises';

const TOTAL_KURALS = 1330;
const output = new URL('../src/data/kurals.json', import.meta.url);

// IMPORTANT:
// The old builder tried the Vercel single-Kural API for every missing Kural.
// That endpoint can return HTTP 402, which made the build look like it was
// downloading forever. This builder uses stable, static GitHub JSON files
// instead, so there is no one-by-one API loop and no HTTP 402 dependency.
const KURAL_DATA_URL = 'https://raw.githubusercontent.com/tk120404/thirukkural/master/thirukkural.json';
const DETAIL_DATA_URL = 'https://raw.githubusercontent.com/tk120404/thirukkural/master/detail.json';

function hasTamilText(value = '') {
  return /[\u0B80-\u0BFF]/.test(String(value));
}

function textValue(...values) {
  return values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
}

function fetchJson(url, attempts = 3) {
  return (async () => {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
            'user-agent': 'Thirukkural-Immersive-StaticData/1.0',
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          const delay = 1000 * attempt;
          console.log(`  retry ${attempt + 1}/${attempts} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  })();
}

function flattenChapters(detailPayload) {
  const chapters = new Map();
  const sections = detailPayload?.[0]?.section?.detail || [];

  for (const section of sections) {
    const groups = section?.chapterGroup?.detail || [];
    for (const group of groups) {
      const chapterList = group?.chapters?.detail || [];
      for (const chapter of chapterList) {
        const number = Number(chapter?.number);
        if (!Number.isInteger(number) || number < 1 || number > 133) continue;
        chapters.set(number, {
          number,
          nameTamil: textValue(chapter?.name),
          nameEnglish: textValue(chapter?.translation),
          start: Number(chapter?.start),
          end: Number(chapter?.end),
          sectionTamil: textValue(section?.name),
          sectionEnglish: textValue(section?.translation),
        });
      }
    }
  }

  return chapters;
}

function normalizeKural(raw, chapterMap) {
  const number = Number(raw?.Number ?? raw?.number);
  const chapterNumber = Math.ceil(number / 10);
  const chapter = chapterMap.get(chapterNumber);

  return {
    number,
    chap_tam: chapter?.nameTamil || `அதிகாரம் ${chapterNumber}`,
    chap_eng: chapter?.nameEnglish || '',
    sect_tam: chapter?.sectionTamil || '',
    sect_eng: chapter?.sectionEnglish || '',
    line1: textValue(raw?.Line1),
    line2: textValue(raw?.Line2),
    eng: textValue(raw?.Translation),
    // This is the English explanation shown as the Kural meaning.
    eng_exp: textValue(raw?.explanation, raw?.Translation),
    tam_exp: textValue(raw?.mv, raw?.sp, raw?.mk),
  };
}

function usable(row) {
  return (
    Number.isInteger(row.number) &&
    row.number >= 1 &&
    row.number <= TOTAL_KURALS &&
    hasTamilText(row.line1) &&
    hasTamilText(row.line2) &&
    Boolean(row.eng_exp)
  );
}

console.log('Building the Thirukkural dataset from static GitHub JSON...');
console.log(`Primary Kural data: ${KURAL_DATA_URL}`);
console.log(`Chapter metadata:   ${DETAIL_DATA_URL}`);
console.log('No per-Kural Vercel API requests are used.');

const [kuralPayload, detailPayload] = await Promise.all([
  fetchJson(KURAL_DATA_URL),
  fetchJson(DETAIL_DATA_URL),
]);

const rawKurals = Array.isArray(kuralPayload?.kural)
  ? kuralPayload.kural
  : Array.isArray(kuralPayload)
    ? kuralPayload
    : [];

const chapterMap = flattenChapters(detailPayload);
console.log(`Received ${rawKurals.length} Kural records and ${chapterMap.size} chapter records.`);

const records = rawKurals
  .map(row => normalizeKural(row, chapterMap))
  .filter(usable)
  .sort((a, b) => a.number - b.number);

const byNumber = new Map(records.map(row => [row.number, row]));
const missing = [];
for (let number = 1; number <= TOTAL_KURALS; number++) {
  if (!byNumber.has(number)) missing.push(number);
}

console.log(`Validated ${records.length}/${TOTAL_KURALS} Kurals.`);

if (missing.length) {
  throw new Error(
    `Static dataset is incomplete. Missing ${missing.length} Kural(s): ${missing.join(', ')}`
  );
}

if (chapterMap.size !== 133) {
  throw new Error(`Expected 133 chapters, received ${chapterMap.size}.`);
}

await writeFile(output, JSON.stringify(records, null, 2), 'utf8');
console.log(`✓ Successfully wrote ${records.length} Kurals to src/data/kurals.json`);
console.log('✓ Tamil text, English meaning, and chapter metadata are all local now.');
console.log('✓ The website no longer needs a live Kural API to display the 1,330 Kurals.');
