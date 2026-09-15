import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'src', 'data', 'kurals.json');
const OUT  = path.join(ROOT, 'src', 'data', 'modern.json');

const kurals = JSON.parse(fs.readFileSync(DATA, 'utf8'))
  .slice()
  .sort((a, b) => Number(a.number) - Number(b.number));

const entries = {};
if (fs.existsSync(OUT)) {
  const arr = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  arr.forEach((item, idx) => { if (item?.m) entries[idx] = item; });
}

const FRAMES = [
  m => `In everyday life, this means: ${m}`,
  m => `Make it real today: ${m}`,
  m => `Bring the idea home: ${m}`,
  m => `A practical reading: ${m}`,
  m => `When life tests this: ${m}`,
];

function restate(m) {
  let s = String(m).trim().replace(/\s+/g, ' ');
  s = s.replace(/^as\s+(?=[a-z])/i, m2 => m2.length ? '' : '');
  if (!/^[A-Z]/.test(s)) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

let filled = 0;
kurals.forEach(k => {
  const n = Number(k.number);
  if (entries[n] && entries[n].src !== 0) return;
  const m = (k.eng_exp || k.eng || '').trim();
  if (!m) return;
  const chap = (k.chap_eng || `Kural ${n}`).trim();
  const frame = FRAMES[n % FRAMES.length];
  entries[n] = {
    t: `Practicing ${chap}`,
    m: frame(restate(m)),
    src: 0,
  };
  filled += 1;
});

const arr = [];
kurals.forEach(k => { arr[k.number] = entries[k.number] || null; });
arr[0] = null;
fs.writeFileSync(OUT, JSON.stringify(arr, null, 0));
console.log(`filled ${filled} kurals with local readings; total entries: ${arr.filter(x => x && x.m).length}`);