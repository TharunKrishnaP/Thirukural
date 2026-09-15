import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Brain, Check, Copy, Heart, ArrowUpRight, Menu, Moon, Search, Share2, Sparkles, Sun, Volume2, X } from 'lucide-react';
import './styles.css';
import localKurals from './data/kurals.json';
import modernKurals from './data/modern.json';
import { romanize } from 'tamil-romanizer';

// ── Optional Cloudflare neural voice endpoint ────────────────────────────────
// When set to the deployed Worker URL the Audio component will use Cloudflare
// Workers AI (Deepgram Aura) for a natural, custom voice.  When the variable
// is empty (the default for local development) the browser's built-in speech
// synthesis is used instead.
// Set in .env.local:  VITE_TTS_ENDPOINT=https://thirukkural-tts.<subdomain>.workers.dev
const TTS_ENDPOINT = (import.meta.env?.VITE_TTS_ENDPOINT ?? '').replace(/\/+$/,'');
// Optional shared secret (secret set with `npx wrangler secret put TTS_API_KEY`).
// The client-side value lives in .env.local and is never committed.
const TTS_KEY = import.meta.env?.VITE_TTS_KEY ?? '';

const TOTAL = 1330;

const CHAPTER_NAMES = [
  'The Praise of God','The Excellence of Rain','The Greatness of Ascetics','Assertion of the Strength of Virtue','Domestic Life','The Goodness of a Life Partner','The Boon of Children','Possessing Love','Hospitality','Speaking Pleasantly','Gratitude','Neutrality','Having Restraint','Possessing Propriety','Not Desiring Another’s Wife','Possessing Forbearance','Bearing No Envy','Not Coveting','Avoiding Backbiting','Avoiding Vain Speech','Dread of Evil Deeds','Knowing One’s Duty to Society','Giving','Renown','Compassion','Abstaining from Flesh','Austerity','False Conduct','Not Stealing','Truthfulness','Abstaining from Anger','Non-Injuring','Non-Killing','Impermanence','Renunciation','Realising the Truth','Ending Desire','Destiny','The Majesty of a King','Learning','Lack of Learning','Learning by Listening','Possession of Knowledge','Avoiding Faults','Seeking the Support of the Wise','Avoiding Harmful Associations','Acting after Deliberation','Knowing Strength','Knowing the Right Time','Knowing the Right Place','Testing and Trusting People','Choosing People for Responsibilities','Cherishing Kindred','Avoiding Forgetfulness','Just Rule','Tyrannical Rule','Avoiding Fear-Inspiring Rule','Considerate Regard','Employing Spies','Resolute Effort','Abstention from Sloth','Manly Exertion','Intrepidity in the Face of Misfortune','The Councillor of State','Eloquence','Purity of Action','Decision of Character','The Conduct of Affairs','The Ambassador','Comporting Oneself Before Princes','Reading Unspoken Signs','Knowing the Assembly','Not Fearing the Assembly','The Country','Fortification','The Way of Acquiring Wealth','The Excellence of an Army','Military Spirit','Friendship','Examining Friendship','Long-Standing Friendship','Harmful Friendship','False Friendship','Folly','Shallow Understanding','Divisive Hostility','The Character of Enmity','Assessing Enmity','Internal Enmity','Not Offending the Great and Powerful','Following a Wife’s Direction','Transactional Relationships','Abstaining from Intoxicants','Gambling','Medicine','Nobility of Character','Honour','Greatness','Noble Excellence','Courtesy and Consideration','Wealth Without Benefit','Shame and Self-Respect','The Way of Building a Family Name','Farming','Poverty','Begging','The Dread of Begging','Baseness','The Distress of Her Beauty','Reading the Signs','Rejoicing in the Embrace','Praising Her Beauty','Declaring the Excellence of Love','Setting Reserve Aside','The Rumour','Unendurable Separation','Pining and Complaint','Eyes Worn Out with Grief','The Pallor of Longing','The Solitary Anguish','Sad Remembrance','The Visions of the Night','Lamenting at Evening','The Wasting Away','Speaking with the Heart','Reserve Overcome','Longing for the Beloved','Making the Signs Known','Desire for Reunion','Quarrelling with the Heart','Sulking','The Subtleties of Sulking','The Pleasures of Temporary Estrangement'
];

// Runtime fallback uses ONE static JSON file, not a per-Kural API.
// This avoids the HTTP 402 responses from the old Vercel endpoint.
const STATIC_KURAL_DATA_URL = 'https://raw.githubusercontent.com/tk120404/thirukkural/master/thirukkural.json';
// Primary runtime source for individual Kural pages. This endpoint returns one
// compact JSON object, supports browser access, and avoids downloading a 2+ MB
// dataset just to open one Kural.
const KURAL_API_URLS = [
  // Documented current endpoint from the API project.
  number => `https://api-thirukkural.vercel.app/api?num=${number}`,
  // Independent public API fallback.
  number => `https://thirukkural.senkanthal.org/kural/${number}`,
  // Older but still documented API implementation.
  number => `https://tamil-kural-api.vercel.app/api/kural/${number}`,
];
let remoteKuralsPromise = null;

const SECTIONS = [
  { key:'aram', tamil:'அறத்துப்பால்', english:'Virtue', range:'1–380', chapters:'1–38', tone:'sage', description:'Ethics, compassion, family, self-control and the foundations of a good life.' },
  { key:'porul', tamil:'பொருட்பால்', english:'Wealth & Society', range:'381–1080', chapters:'39–108', tone:'gold', description:'Leadership, justice, friendship, learning, courage, governance and society.' },
  { key:'inbam', tamil:'காமத்துப்பால்', english:'Love', range:'1081–1330', chapters:'109–133', tone:'rose', description:'Love, longing, union, separation, memory and reunion.' },
];

const LENSES = [
  {id:'anger', icon:'◐', title:'When anger rises', subtitle:'Pause, restraint & clarity', chapters:[13,31,32]},
  {id:'learning', icon:'⌁', title:'When you want to learn', subtitle:'Knowledge, listening & wisdom', chapters:[40,41,42]},
  {id:'leadership', icon:'◇', title:'When you lead', subtitle:'Justice, courage & responsibility', chapters:[39,55,64]},
  {id:'friendship', icon:'∞', title:'When friendship matters', subtitle:'Choosing people & keeping trust', chapters:[79,80,82]},
  {id:'kindness', icon:'✦', title:'When life needs kindness', subtitle:'Compassion, generosity & love', chapters:[8,23,25]},
  {id:'resilience', icon:'△', title:'When life gets difficult', subtitle:'Courage, effort & steadiness', chapters:[62,66,70]},
  {id:'love', icon:'♡', title:'When you think of love', subtitle:'Union, longing & reunion', chapters:[109,111,116]},
  {id:'truth', icon:'○', title:'When truth matters', subtitle:'Integrity, speech & conduct', chapters:[30,31,34]},
];

const FINDER_RULES = [
  {words:['anger','angry','mad','irritated','frustrated','கோபம்'], lens:'anger'},
  {words:['study','learn','learning','knowledge','education','school','கல்வி'], lens:'learning'},
  {words:['leader','leadership','manager','power','government','தலைமை','ஆட்சி'], lens:'leadership'},
  {words:['friend','friendship','trust','நட்பு','நண்பர்'], lens:'friendship'},
  {words:['kind','kindness','help','charity','compassion','கருணை','அன்பு'], lens:'kindness'},
  {words:['difficult','failure','resilience','courage','struggle','துன்பம்','முயற்சி'], lens:'resilience'},
  {words:['love','lover','relationship','longing','காதல்'], lens:'love'},
  {words:['truth','honest','honesty','integrity','உண்மை'], lens:'truth'},
];

const VISUALS = [
  {name:'The Still Water', subtitle:'A pause before reaction', symbol:'≈', className:'water'},
  {name:'The Lamp', subtitle:'Knowledge becoming clarity', symbol:'✦', className:'lamp'},
  {name:'The Bridge', subtitle:'A choice connecting two paths', symbol:'◇', className:'bridge'},
  {name:'The Mountain', subtitle:'Steady effort over time', symbol:'△', className:'mountain'},
  {name:'The Open Hand', subtitle:'Giving as an active choice', symbol:'✋', className:'hand'},
  {name:'The Compass', subtitle:'Values guiding decisions', symbol:'✧', className:'compass'},
  {name:'The Orbit', subtitle:'Two lives moving toward each other', symbol:'∞', className:'orbit'},
];

const MODERN = [
  ['Pause before reaction','A difficult message, meeting or argument can become a small practice in restraint: create a gap between what happens and what you choose to do.'],
  ['Learn before certainty','In a world of instant opinions, this wisdom can be read as an invitation to listen, study and let understanding arrive before certainty.'],
  ['Power is a responsibility','Leadership is not only about making decisions. It is about making decisions that can survive scrutiny from the people affected by them.'],
  ['Choose your circle carefully','The people around us influence what we tolerate, attempt and become. Friendship can be part of the architecture of a good life.'],
  ['Kindness becomes action','Kindness matters when it moves from an idea into a choice — how we speak, share, forgive and respond to another person.'],
  ['Consistency beats intensity','Difficult seasons rarely yield to one heroic moment. The useful question is what can be done steadily, again and again.'],
  ['Feelings have their own language','Love is explored as a landscape of attention, absence, anticipation, closeness and memory.'],
  ['Trust is built in details','Truth is not only a statement. It is a pattern of speech and conduct that lets other people know where they stand with us.'],
];

const LanguageContext = createContext({lang:'en', setLang:()=>{}});
const useLanguage = () => useContext(LanguageContext);

function cacheGet(key){ try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function cacheSet(key,value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function cacheClear(){ try { Object.keys(localStorage).filter(k=>k.startsWith('thirukkural:')).forEach(k=>localStorage.removeItem(k)); } catch {} }

function hasTamilText(value=''){ return /[\u0B80-\u0BFF]/.test(String(value)); }

function romanFor(text, cap=true){
  try{ return romanize(String(text||'').trim(), { scheme:'practical', exceptions:true, capitalize: cap?'sentence':'none' }); }
  catch{ return String(text||'').trim(); }
}

function textValue(...values){
  return values.find(value=>typeof value==='string' && value.trim())?.trim() || '';
}

function tamilLines(raw){
  const candidates=[];
  if(Array.isArray(raw?.kural)) candidates.push(...raw.kural);
  if(Array.isArray(raw?.Tamil)) candidates.push(...raw.Tamil);
  if(Array.isArray(raw?.tamil)) candidates.push(...raw.tamil);
  const single=textValue(raw?.tamil,raw?.Tamil,raw?.kural_text,raw?.kuralTamil,raw?.kural_tamil);
  if(single) candidates.push(...single.split(/\$|\n/));
  const l1=textValue(raw?.line1,raw?.Line1,raw?.tamil_line1,raw?.TamilLine1,raw?.kural_line1,raw?.kural_bamini1);
  const l2=textValue(raw?.line2,raw?.Line2,raw?.tamil_line2,raw?.TamilLine2,raw?.kural_line2,raw?.kural_bamini2);
  if(l1) candidates.unshift(l1);
  if(l2) candidates.splice(1,0,l2);
  const tamilOnly=candidates.filter(value=>hasTamilText(value));
  const source=tamilOnly.length>=2?tamilOnly:candidates;
  return [source[0]||'',source[1]||''];
}

function normalize(raw, number){
  const props=raw?.properties || raw;
  const [line1,line2]=tamilLines(props);
  const meaning=props?.meaning || raw?.meaning || {};
  const couplet=typeof props?.couplet==='string' ? props.couplet.split(/\$|\n/) : [];
  const tamilFallback=[line1||couplet[0]||'',line2||couplet[1]||''];
  const n=Number(props?.number ?? props?.kural_number ?? props?.kural_no ?? props?.id ?? props?.['0_number'] ?? number);
  const chapterIndex=Math.ceil(n/10)-1;
  return {
    number:n,
    chap_tam:textValue(props?.chap_tam,props?.chapter_tam,props?.chapterTamil,props?.chapter_tamil,props?.chapter,props?.adhikarm_tamil,props?.['2_adikaram']) || `அதிகாரம் ${Math.ceil(n/10)}`,
    chap_eng:textValue(props?.chap_eng,props?.chapter_en,props?.chapter_english,props?.adhikarm_english) || CHAPTER_NAMES[chapterIndex] || `Chapter ${Math.ceil(n/10)}`,
    sect_tam:textValue(props?.sect_tam,props?.section_tam,props?.sectionTamil,props?.section_tamil,props?.section,props?.pal_tamil),
    sect_eng:textValue(props?.sect_eng,props?.section_en,props?.section_english,props?.pal_english),
    line1:tamilFallback[0],
    line2:tamilFallback[1],
    eng:textValue(props?.eng,props?.translation,props?.english,props?.Translation),
    tam_exp:textValue(props?.tam_exp,props?.tamil_explanation,props?.explanation_ta,props?.kuralvilakam_tamil,props?.porul,meaning?.ta_mu_va),
    eng_exp:textValue(props?.eng_exp,props?.english_explanation,props?.explanation_en,props?.kuralvilakam_english,meaning?.en,props?.explanation),
  };
}

async function loadRemoteKurals(){
  if(remoteKuralsPromise) return remoteKuralsPromise;
  remoteKuralsPromise = fetch(STATIC_KURAL_DATA_URL, {headers:{Accept:'application/json'}})
    .then(res=>{
      if(!res.ok) throw new Error(`Static dataset request failed: ${res.status}`);
      return res.json();
    })
    .then(payload=>{
      const rows=Array.isArray(payload?.kural)?payload.kural:(Array.isArray(payload)?payload:[]);
      const map=new Map();
      rows.forEach((row,index)=>{
        const data=normalize(row,index+1);
        if(data.number>=1 && data.number<=TOTAL && data.line1 && data.line2 && hasTamilText(`${data.line1} ${data.line2}`)) map.set(data.number,data);
      });
      if(map.size<1300) throw new Error(`Static dataset returned only ${map.size} usable Kurals.`);
      return map;
    })
    .catch(error=>{ remoteKuralsPromise=null; throw error; });
  return remoteKuralsPromise;
}

async function fetchJsonWithTimeout(url, timeoutMs=9000){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try{
    const response = await fetch(url, {
      headers:{Accept:'application/json'},
      signal:controller.signal,
      cache:'no-store',
    });
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }finally{
    clearTimeout(timer);
  }
}

async function fetchSingleKural(number){
  let lastError = null;
  for(const makeUrl of KURAL_API_URLS){
    const url = makeUrl(number);
    try{
      const payload = await fetchJsonWithTimeout(url, 7000);
      const data = normalize(payload, number);
      if(data.number === number && data.line1 && data.line2 && hasTamilText(`${data.line1} ${data.line2}`)){
        return data;
      }
      // Some APIs wrap the record in {data:{...}} or {kural:{...}}.
      const wrapped = payload?.data || payload?.kural;
      if(wrapped && !Array.isArray(wrapped)){
        const retryData = normalize(wrapped, number);
        if(retryData.number === number && retryData.line1 && retryData.line2 && hasTamilText(`${retryData.line1} ${retryData.line2}`)){
          return retryData;
        }
      }
      throw new Error('The response did not contain valid Tamil Kural text.');
    }catch(error){
      lastError = error;
    }
  }
  throw lastError || new Error(`Kural ${number} could not be loaded.`);
}

async function getKural(number){
  const localRecord = Array.isArray(localKurals) ? localKurals.find(item => Number(item?.number ?? item?.kural_no ?? item?.['0_number']) === number) : null;
  if(localRecord){
    const local = normalize(localRecord, number);
    if(local.line1 && local.line2 && hasTamilText(`${local.line1} ${local.line2}`)){
      cacheSet(`thirukkural:kural:${number}`, local);
      return local;
    }
  }

  const cached = cacheGet(`thirukkural:kural:${number}`);
  if(cached?.line1 && cached?.line2 && hasTamilText(`${cached.line1} ${cached.line2}`)) return cached;

  // IMPORTANT: individual Kural pages must not depend on the large GitHub
  // dataset. Try the compact Kural API first. This is the reliable path for
  // direct links, Galaxy clicks, refreshes and mobile browsers.
  try{
    const data = await fetchSingleKural(number);
    cacheSet(`thirukkural:kural:${number}`, data);
    return data;
  }catch(singleError){
    // If the API is temporarily unavailable, fall back to the complete static
    // dataset. This preserves offline-ish behaviour after the dataset has been
    // loaded/cached or generated with npm run build-data.
    try{
      const dataset=await loadRemoteKurals();
      const data=dataset.get(number);
      if(data){
        cacheSet(`thirukkural:kural:${number}`, data);
        return data;
      }
    }catch(staticError){
      throw new Error(`Unable to load Kural ${number}. Please retry. ${singleError?.message || ''}`.trim());
    }
    throw singleError;
  }
}


function hashPath(to){
  const value=String(to ?? '/');
  if(value.startsWith('#')) return value;
  return `#${value.startsWith('/') ? value : `/${value}`}`;
}

function AppLink({to,className='',children,onClick,...props}){
  // Use a real anchor as the source of truth for navigation. HashRouter listens
  // to the URL hash, so the browser performs the navigation even if React is
  // busy or a parent gesture handler is active. This is deliberately simpler
  // and more reliable for static hosting than manually preventing the click.
  const href=hashPath(to);
  return <a href={href} className={className} onClick={onClick} {...props}>{children}</a>;
}

function KuralLink({number,className='',children,...props}){
  const n=Math.min(TOTAL,Math.max(1,Number(number)||1));
  return <AppLink to={`/kural/${n}`} className={className} {...props}>{children}</AppLink>;
}

// The app is intentionally hash-routed for static hosting. All in-app links
// ultimately write the hash directly, so navigation works even when a host
// does not provide SPA rewrite rules. HashRouter then renders the matching route.
function Link(props){ return <AppLink {...props}/>; }

function sectionFor(n){ return n<=380?SECTIONS[0]:n<=1080?SECTIONS[1]:SECTIONS[2]; }
function chapterFor(n){ return Math.ceil(n/10); }
function seeded(n){ return ((n*9301+49297)%233280)/233280; }
function visualFor(n){ return VISUALS[Math.floor(seeded(n)*VISUALS.length)]; }
function modernFor(n){
  const item=Array.isArray(modernKurals) ? modernKurals[Number(n)] : null;
  if(item && item.m) return [item.t || 'A modern reading', item.m];
  return MODERN[Math.floor(seeded(n)*MODERN.length)];
}

function AppShell({children}){
  const [dark,setDark] = useState(()=>localStorage.getItem('thirukkural:theme')!=='light');
  const [lang,setLang] = useState('en');
  const [menu,setMenu] = useState(false);
  useEffect(()=>{ document.documentElement.dataset.theme=dark?'dark':'light'; localStorage.setItem('thirukkural:theme',dark?'dark':'light'); },[dark]);
  return <LanguageContext.Provider value={{lang,setLang}}><div className="app">
    <header className="nav">
      <Link to="/" className="brand" onClick={()=>setMenu(false)}><span className="brand-mark">அ</span><span><b>THIRUKKURAL</b><small>WISDOM · REIMAGINED</small></span></Link>
      <button className="menu-button" onClick={()=>setMenu(v=>!v)} aria-label="Menu">{menu?<X/>:<Menu/>}</button>
      <nav className={menu?'open':''} onClick={()=>setMenu(false)}>
        <Link to="/explore">Explore</Link><Link to="/finder">Wisdom Finder</Link><Link to="/lens">Wisdom Lens</Link><Link to="/galaxy">Wisdom Galaxy</Link>
      </nav>
      <div className="nav-actions">
        <button className="icon-btn" onClick={()=>setDark(v=>!v)} aria-label="Toggle theme">{dark?<Sun size={17}/>:<Moon size={17}/>}</button>
      </div>
    </header>
    {children}
    <footer className="footer"><span>Thiruvalluvar's 1,330 couplets · a living reading experience.</span><span>Original text · meaning · interpretation</span></footer>
  </div></LanguageContext.Provider>;
}

function Home(){
  const navigate=useNavigate();
  const [daily,setDaily]=useState(null);
  useEffect(()=>{ const n=((new Date().getFullYear()*31)+(new Date().getMonth()+1)*17+new Date().getDate()*7)%TOTAL+1; getKural(n).then(setDaily).catch(()=>{}); },[]);
  return <main className="home">
    <section className="hero">
      <div className="hero-grid"/><div className="hero-glow glow-one"/><div className="hero-glow glow-two"/>
      <div className="hero-content">
        <div className="eyebrow"><span/> 1,330 COUPLETS · 133 CHAPTERS · 3 WORLDS</div>
        <h1>Timeless wisdom.<br/><em>Reimagined.</em></h1>
        <p className="hero-lead">Explore the Thirukkural through the language of today — read the original, understand the meaning, see the idea, and listen to every couplet.</p>
        <div className="hero-actions"><button className="primary" onClick={()=>navigate('/explore')}>Start exploring <ArrowRight size={17}/></button><button className="ghost" onClick={()=>navigate('/finder')}><Brain size={17}/> Find wisdom for my situation</button></div>
        <div className="hero-proof"><span><b>1,330</b> Kurals</span><span><b>133</b> Chapters</span><span><b>3</b> Sections</span></div>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="art-ring ring-1"/><div className="art-ring ring-2"/><div className="art-ring ring-3"/><div className="art-core">அ<br/><small>WISDOM</small></div><i className="particle p1"/><i className="particle p2"/><i className="particle p3"/><i className="particle p4"/></div>
    </section>

    <section className="intro-section"><div><span className="eyebrow">WHY THIS EXPERIENCE</span><h2>A classic text,<br/><em>not a static archive.</em></h2></div><p>Thirukkural is traditionally read as Tamil poetry. This experience adds a modern layer around the original: chapter context, English meanings, visual metaphors, audio, connections and a transparent way to discover relevant wisdom.</p></section>

    <section className="section-showcase"><div className="section-heading"><div><span className="eyebrow">THE THREE SECTIONS</span><h2>Three worlds of wisdom.</h2></div><Link to="/explore">View all chapters <ArrowRight size={15}/></Link></div><div className="section-cards">{SECTIONS.map((s,i)=><Link to={`/explore#${s.key}`} className={`section-card ${s.tone}`} key={s.key}><span className="section-index">0{i+1}</span><div className="section-symbol">{i===0?'◒':i===1?'◇':'♡'}</div><span className="eyebrow">{s.english.toUpperCase()}</span><h3>{s.english}</h3><p>{s.description}</p><footer><b>{s.range}</b><span>{s.chapters} chapters</span><ArrowUpRight/></footer></Link>)}</div></section>

    <section className="daily"><div className="daily-copy"><span className="eyebrow">TODAY'S KURAL</span><h2>A small idea<br/><em>for your day.</em></h2><p>One couplet, selected daily. Open it for the full reading experience.</p>{daily?<KuralLink number={daily.number} className="outline">Open Kural {daily.number} <ArrowRight size={16}/></KuralLink>:<Link to="/explore" className="outline">Explore the Kurals <ArrowRight size={16}/></Link>}</div><div className="daily-card">{daily?<><span className="daily-number">KURAL {daily.number}</span><span className="daily-chapter">{daily.chap_eng}</span><div className="daily-tamil">{daily.line1}<br/>{daily.line2}</div><div className="daily-translit">{romanFor(daily.line1)}<br/>{romanFor(daily.line2)}</div><p>{daily.eng_exp||'Open the Kural to explore its English meaning and explanation.'}</p></>:<div className="skeleton">Loading today's Kural…</div>}</div></section>

    <section className="finder-teaser"><div className="finder-orbit"><div>?</div></div><div><span className="eyebrow">WISDOM FINDER</span><h2>Don't know which Kural you need?</h2><p>Describe what you are facing. The finder uses an explainable topic map to guide you toward relevant chapters.</p><Link to="/finder" className="primary">Describe your situation <ArrowRight size={16}/></Link></div></section>
  </main>;
}

function Explore(){
  const {lang}=useLanguage();
  const [query,setQuery]=useState(''); const [chapter,setChapter]=useState(null); const [busy,setBusy]=useState(false);
  const loadChapters=async()=>{
    setBusy(true);
    const cached=cacheGet('thirukkural:chapters'); if(Array.isArray(cached)&&cached.length===133){setChapter(cached);setBusy(false);return;}
    const out=[];
    for(let c=1;c<=133;c++){
      try{ const d=await getKural((c-1)*10+1); out.push({chapter:c,tamil:d.chap_tam,english:CHAPTER_NAMES[c-1]||d.chap_eng,section:d.sect_eng}); }
      catch{ out.push({chapter:c,tamil:`அதிகாரம் ${c}`,english:CHAPTER_NAMES[c-1]||`Chapter ${c}`,section:''}); }
    }
    cacheSet('thirukkural:chapters',out); setChapter(out); setBusy(false);
  };
  useEffect(()=>{loadChapters();},[]);
  const filtered=useMemo(()=>{if(!chapter)return []; const q=query.trim().toLowerCase(); return chapter.filter(c=>!q||(c.english+' '+c.section).toLowerCase().includes(q));},[chapter,query]);
  return <main className="explore"><section className="page-hero"><span className="eyebrow">THE COMPLETE COLLECTION</span><h1>133 chapters.<br/><em>1,330 voices.</em></h1><p>Start with a chapter or search by English chapter name. Every chapter contains ten Kurals.</p><div className="searchbox"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search chapter name…"/><span>{filtered.length || (chapter?0:'—')} / 133</span></div><button className="text-button" onClick={()=>{cacheClear();window.location.reload();}}>Refresh content cache</button></section>{busy&&<div className="loading-strip"><Sparkles size={17}/> Building the chapter index from the Kural source…</div>}<section className="chapter-groups">{SECTIONS.map(s=><div className={`chapter-group ${s.tone}`} id={s.key} key={s.key}><div className="group-heading"><div><span className="eyebrow">{s.english.toUpperCase()}</span><h2>{lang==='ta' ? s.tamil : s.english}</h2></div><p>{s.description}</p></div><div className="chapter-grid">{filtered.filter(c=>s.key==='aram'?c.chapter<=38:s.key==='porul'?c.chapter>=39&&c.chapter<=108:c.chapter>=109).map(c=><Link className="chapter-card" to={`/chapter/${c.chapter}`} key={c.chapter}><span>{String(c.chapter).padStart(3,'0')}</span><div><h3>{lang==='ta' ? c.tamil : c.english}</h3></div><ArrowRight size={16}/></Link>)}</div></div>)}</section></main>;
}

function Chapter(){
  const {lang}=useLanguage();
  const {id}=useParams(); const n=Math.min(133,Math.max(1,Number(id)||1)); const [items,setItems]=useState([]); const [error,setError]=useState(false);
  useEffect(()=>{let alive=true; Promise.all(Array.from({length:10},(_,i)=>getKural((n-1)*10+i+1).catch(()=>null))).then(rows=>{if(alive){const valid=rows.filter(Boolean);setItems(valid);setError(valid.length===0);}});return()=>{alive=false};},[n]);
  const first=items[0]; const sec=sectionFor((n-1)*10+1);
  return <main className="chapter"><section className={`chapter-hero ${sec.tone}`}><Link to="/explore" className="back"><ArrowLeft size={16}/> All chapters</Link><span className="chapter-label">CHAPTER {String(n).padStart(3,'0')}</span><h1>{lang==='ta' ? (first?.chap_tam||`அதிகாரம் ${n}`) : (first?.chap_eng||CHAPTER_NAMES[n-1]||`Chapter ${n}`)}</h1><p>{lang==='ta' ? sec.tamil : sec.english}</p></section><section className="chapter-content"><div className="chapter-intro"><span>10 KURALS</span><p>This chapter is a sequence of ten couplets. Open any one for the full visual and explanation experience.</p></div>{error&&<div className="error-card"><strong>Content could not be loaded.</strong><span>Please check your internet connection and try again. The site uses a public Thirukkural source with browser CORS support.</span></div>}{items.map(k=><KuralLink number={k.number} className="kural-row" key={k.number}><span className="row-number">{String(k.number).padStart(4,'0')}</span><div><div className="row-tamil">{k.line1}<br/>{k.line2}</div><div className="row-translit">{romanFor(k.line1)}<br/>{romanFor(k.line2)}</div><p>{k.eng_exp||'Open for the English meaning.'}</p></div><ArrowRight/></KuralLink>)}</section></main>;
}

function VisualScene({kural}){
  const v=visualFor(kural.number); const sec=sectionFor(kural.number);
  return <section className={`visual-scene ${sec.tone} ${v.className}`}>
    <div className="scene-backdrop"><span className="orb orb-a"/><span className="orb orb-b"/><span className="orb orb-c"/><span className="scene-symbol">{v.symbol}</span></div>
    <div className="scene-meta"><span>KURAL {String(kural.number).padStart(4,'0')}</span><span>{v.name.toUpperCase()}</span></div>
    <div className="scene-copy">
      <span className="eyebrow">VISUAL WISDOM</span><h2>{v.subtitle}</h2>
      <div className="scene-tamil">{kural.line1}<br/>{kural.line2}</div>
      <div className="scene-translit">{romanFor(kural.line1)}<br/>{romanFor(kural.line2)}</div>
      <p>{kural.chap_eng}</p>
    </div>
  </section>;
}

function Audio({kural}){
  const [playing,setPlaying]=useState(false);
  const [busy,setBusy]=useState(false);
  const [rate,setRate]=useState(.82);
  const [mode,setMode]=useState('ta');
  const requestRef=useRef(0);
  const modeRef=useRef('ta');
  const audioRef=useRef(null);
  const retryRef=useRef(null);
  const utteranceRef=useRef(null);
  const retriedRef=useRef(false);

  const tamilLines=[kural.line1,kural.line2].filter(Boolean);
  const rawTamilText = tamilLines.join(' ').replace(/\s+/g,' ').trim();
  const englishText = (kural.eng_exp || kural.eng || '').replace(/\s+/g,' ').trim();

  const stop=()=>{
    requestRef.current+=1;
    if(retryRef.current) clearTimeout(retryRef.current);
    retryRef.current=null;
    try{ window.speechSynthesis?.cancel(); }catch{}
    utteranceRef.current=null;
    const a=audioRef.current;
    if(a){ try{ a.pause(); a.removeAttribute('src'); a.load(); }catch{} }
    setPlaying(false);
    setBusy(false);
  };

  const pickVoice=(voices,m)=>{
    const usable=voices.filter(v=>v && v.lang);
    if(m==='en'){
      return usable.find(v=>/^en[-_]/i.test(v.lang) && /India/i.test(v.name||''))
        || usable.find(v=>/^en[-_]/i.test(v.lang))
        || null;
    }
    return usable.find(v=>/^ta[-_]/i.test(v.lang))
      || usable.find(v=>/tamil/i.test(v.name||''))
      || null;
  };

  const browserSpeak=()=>{
    if(!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
    const m=modeRef.current;
    const text=(m==='ta'?rawTamilText:englishText);
    if(!text) return;
    stop();
    const requestId=++requestRef.current;
    const synth=window.speechSynthesis;
    const defaultLang=m==='en'?'en-IN':'ta-IN';

    const startSpeaking=()=>{
      if(requestRef.current!==requestId) return;
      const utterance=new SpeechSynthesisUtterance(text);
      const voices=synth.getVoices();
      const v=pickVoice(voices,m);
      utterance.lang=v?.lang||defaultLang;
      if(v) utterance.voice=v;
      utterance.rate=rate;
      utterance.pitch=1;
      utterance.volume=1;
      utterance.onstart=()=>{ if(requestRef.current===requestId){setPlaying(true);setBusy(false);} };
      utterance.onend=()=>{ if(requestRef.current===requestId){utteranceRef.current=null;setPlaying(false);} };
      utterance.onerror=event=>{
        if(requestRef.current!==requestId) return;
        if(event.error==='canceled') return;
        if(event.error==='interrupted' && !utteranceRef.current?._retried){
          utteranceRef.current={_retried:true};
          retryRef.current=setTimeout(()=>{
            retryRef.current=null;
            if(requestRef.current!==requestId) return;
            const retry=new SpeechSynthesisUtterance(text);
            retry.lang=defaultLang; retry.rate=rate; retry.pitch=1; retry.volume=1;
            retry.onstart=()=>setPlaying(true);
            retry.onend=()=>{if(requestRef.current===requestId){utteranceRef.current=null;setPlaying(false);}};
            retry.onerror=()=>{if(requestRef.current===requestId){utteranceRef.current=null;setPlaying(false);}};
            utteranceRef.current=retry;
            try{synth.cancel();synth.speak(retry);}catch{setPlaying(false);}
          },180);
          return;
        }
        utteranceRef.current=null;
        setPlaying(false);
      };
      utteranceRef.current=utterance;
      try{ synth.cancel(); synth.resume(); synth.speak(utterance);
        retryRef.current=setTimeout(()=>{try{synth.resume();}catch{}},250);
      }catch{setPlaying(false);}
    };

    const voices=synth.getVoices();
    if(voices.length) startSpeaking();
    else{
      let started=false;
      const onVoices=()=>{ if(started || requestRef.current!==requestId) return; started=true; synth.removeEventListener('voiceschanged',onVoices); startSpeaking(); };
      synth.addEventListener('voiceschanged',onVoices);
      retryRef.current=setTimeout(()=>{ if(started || requestRef.current!==requestId) return; started=true; synth.removeEventListener('voiceschanged',onVoices); startSpeaking(); },900);
    }
  };

  const workerSpeak=()=>{
    const m=modeRef.current;
    const text=(m==='ta'?rawTamilText:englishText);
    if(!text) return;
    const audio=audioRef.current;
    if(!audio) return;
    stop();
    const req=++requestRef.current;
    setBusy(true);
    const url=new URL('/synthesize',TTS_ENDPOINT);
    url.searchParams.set('text',text);
    url.searchParams.set('lang',m==='ta'?'ta':'en-in');
    if(TTS_KEY) url.searchParams.set('key',TTS_KEY);
    audio.src=url.toString();
    audio.playbackRate=rate;
    audio.oncanplaythrough=()=>{
      if(requestRef.current!==req) return;
      audio.oncanplaythrough=null;
      audio.play().then(()=>{}).catch(()=>{
        if(requestRef.current===req){ setBusy(false); browserSpeak(); }
      });
    };
    audio.onplaying=()=>{ if(requestRef.current===req){setBusy(false);setPlaying(true);retriedRef.current=false;} };
    audio.onended=()=>{ if(requestRef.current===req){setPlaying(false);} };
    audio.onerror=()=>{
      if(requestRef.current!==req) return;
      setPlaying(false);setBusy(false);
      if(!retriedRef.current){ retriedRef.current=true; browserSpeak(); }
    };
  };

  const speak=()=>{
    if(TTS_ENDPOINT){ workerSpeak(); }
    else{ browserSpeak(); }
  };

  const switchMode=m=>{
    if(m===modeRef.current) return;
    modeRef.current=m;
    setMode(m);
    if(playing||busy) speak();
  };

  useEffect(()=>()=>stop(),[]);
  const showBusy=busy && !playing;
  return <div className="audio">
    <button className={showBusy?'busy':''} onClick={playing?stop:speak}
      aria-label={playing?'Stop reading aloud':`Read aloud with ${mode==='en'?'English meaning':'Tamil verse'}`}>
      <Volume2 size={16}/>{playing?'Stop':(showBusy?'Reading…':'Read aloud')}
    </button>
    <span className="audio-voice" role="group" aria-label="Reading mode">
      <button className={mode==='ta'?'on':''} onClick={()=>switchMode('ta')} aria-pressed={mode==='ta'}>தமிழ்</button>
      <button className={mode==='en'?'on':''} onClick={()=>switchMode('en')} aria-pressed={mode==='en'}>English</button>
    </span>
    <label>Speed <select value={rate} onChange={e=>setRate(Number(e.target.value))} aria-label="Reading speed">
      <option value="0.65">0.65×</option><option value="0.82">0.82×</option><option value="0.95">0.95×</option><option value="1">1×</option>
    </select></label>
    {TTS_ENDPOINT && <span className="audio-badge" title="Native Tamil voice (gTTS) via the TTS Worker">TAMIL VOICE</span>}
    <audio ref={audioRef}/>
  </div>;
}

function Kural(){
  const {id}=useParams();
  const parsed=Number.parseInt(String(id),10);
  const n=Number.isFinite(parsed) ? Math.min(TOTAL,Math.max(1,parsed)) : 1;
  const [k,setK]=useState(null);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    setSaved(Boolean(cacheGet(`thirukkural:saved:${n}`)));
  },[n]);

  useEffect(()=>{
    let alive=true;
    setK(null);
    setError('');
    getKural(n).then(data=>{
      if(alive && data) setK(data);
    }).catch(err=>{
      if(alive) setError(err instanceof Error ? err.message : 'Unable to load this Kural.');
    });
    return()=>{alive=false};
  },[n]);

  if(error && !k) return <main className="error-page">
    <Sparkles/>
    <h1>We couldn't open Kural {n}.</h1>
    <p>The navigation is working, but the Kural data source did not return valid data. Try again or continue through the collection.</p>
    <div className="error-actions">
      <button className="primary" onClick={()=>{setError('');setK(null);getKural(n).then(setK).catch(e=>setError(e instanceof Error?e.message:'Unable to load this Kural.'));}}>Retry Kural</button>
      <Link to={`/chapter/${chapterFor(n)}`} className="outline">Open Chapter</Link>
      <Link to="/explore" className="outline">Return to Explore</Link>
    </div>
    <small className="error-detail">Source status: {error}</small>
  </main>;

  if(!k) return <main className="loading-page"><Sparkles className="spin"/><p>Opening Kural {n}…</p></main>;

  const sec=sectionFor(n);
  const v=visualFor(n);
  const modern=modernFor(n);
  const englishMeaning=k.eng_exp || k.eng || 'English meaning is unavailable for this Kural.';
  const tamilOne=k.line1 || '';
  const tamilTwo=k.line2 || '';
  const translitOne=romanFor(tamilOne);
  const translitTwo=romanFor(tamilTwo);

  const copy=async()=>{
    const text=`${tamilOne}\n${tamilTwo}\n\n${englishMeaning}\n— Thirukkural ${n}`;
    try{
      if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else { const area=document.createElement('textarea'); area.value=text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); }
      setCopied(true); setTimeout(()=>setCopied(false),1600);
    }catch{}
  };
  const share=async()=>{
    if(navigator.share){ try{await navigator.share({title:`Thirukkural ${n}`,text:`${tamilOne}\n${tamilTwo}\n\n${englishMeaning}`,url:location.href});}catch{} }
    else copy();
  };
  const toggleSave=()=>{
    const next=!saved;
    setSaved(next);
    if(next) cacheSet(`thirukkural:saved:${n}`,true);
    else {try{localStorage.removeItem(`thirukkural:saved:${n}`);}catch{}}
  };

  return <main className={`kural ${sec.tone}`}>
    <div className="kural-nav"><Link to={`/chapter/${chapterFor(n)}`}><ArrowLeft size={16}/>{k.chap_eng||CHAPTER_NAMES[chapterFor(n)-1]}</Link><span>{n} / {TOTAL}</span></div>
    <section className="kural-header">
      <div className="big-number">{String(n).padStart(4,'0')}</div>
      <div><span className="eyebrow">{sec.english.toUpperCase()}</span><h1>{k.chap_eng||CHAPTER_NAMES[chapterFor(n)-1]}</h1><p>Kural {n}</p></div>
      <div className="kural-tools"><Audio kural={k}/><button onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copied':'Copy'}</button><button onClick={share}><Share2 size={16}/> Share</button><button onClick={toggleSave} className={saved?'active':''}><Heart size={16} fill={saved?'currentColor':'none'}/> {saved?'Saved':'Save'}</button></div>
    </section>
    <VisualScene kural={k}/>
    <section className="reading kural-sequence">
      <div className="sequence-intro"><span className="eyebrow">KURAL {String(n).padStart(4,'0')}</span><h2>Read it. Hear it. Understand it.</h2><p>Read the original Tamil first, then explore a clear English explanation of its wisdom.</p></div>
      <article className="kural-block tamil-block"><div className="block-label"><span>01</span><b>THE KURAL IN TAMIL</b><Audio kural={k}/></div><div className="tamil-poem">{tamilOne}<br/>{tamilTwo}</div><div className="transliteration"><span className="translit-label">Read in English letters</span><span>{translitOne}<br/>{translitTwo}</span></div></article>
      <article className="kural-block meaning-block"><div className="block-label"><span>02</span><b>MEANING IN ENGLISH</b></div><p className="meaning-text">{englishMeaning}</p></article>
    </section>
    <section className="modern"><div><span className="eyebrow">UNDERSTAND THE KURAL</span><h2>Ancient words.<br/><em>Contemporary questions.</em></h2><p>This section is an interpretive reading, not a classical commentary.</p></div><div className="modern-card"><Sparkles size={20}/><span className="badge">MODERN INTERPRETATION</span><h3>{modern[0]}</h3><p>{modern[1]}</p><small>{v.name} · {sec.english}</small></div></section>
    <section className="connections"><div><span className="eyebrow">KEEP READING</span><h2>Stay with the idea.</h2></div><div className="connection-grid"><KuralLink number={Math.max(1,n-1)}><span>PREVIOUS</span><b>#{Math.max(1,n-1)}</b><ArrowLeft/></KuralLink><Link to={`/chapter/${chapterFor(n)}`}><span>CHAPTER</span><b>{k.chap_eng||CHAPTER_NAMES[chapterFor(n)-1]}</b><BookOpen/></Link><KuralLink number={n<TOTAL?n+1:1}><span>NEXT</span><b>#{n<TOTAL?n+1:1}</b><ArrowRight/></KuralLink></div></section>
  </main>;
}
function Finder(){
  const [query,setQuery]=useState(''); const [results,setResults]=useState([]); const [busy,setBusy]=useState(false);
  const find=async()=>{const q=query.trim().toLowerCase();if(!q)return;setBusy(true);const rules=FINDER_RULES.filter(r=>r.words.some(w=>q.includes(w.toLowerCase())));const chosen=(rules.length?rules:[FINDER_RULES[5],FINDER_RULES[4]]).slice(0,3);const nums=[];chosen.forEach(r=>{const lens=LENSES.find(x=>x.id===r.lens);lens?.chapters.forEach(c=>{for(let i=0;i<3;i++)nums.push((c-1)*10+i+1);});});const unique=[...new Set(nums)].slice(0,9);const data=await Promise.all(unique.map(n=>getKural(n).catch(()=>null)));setResults(data.filter(Boolean).map((k,i)=>({...k,reason:chosen[i%chosen.length]})));setBusy(false);};
  return <main className="finder"><section className="page-hero finder-hero"><span className="eyebrow"><Brain size={15}/> WISDOM FINDER</span><h1>Bring a question.<br/><em>Leave with a Kural.</em></h1><p>Describe a real-life situation in your own words. The first version of the finder is deliberately explainable: it maps language to curated wisdom themes rather than pretending to know the one perfect answer.</p><textarea value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')find()}} placeholder="I keep losing my temper with people at work…"/><button className="primary" onClick={find} disabled={busy}>{busy?'Finding wisdom…':'Find wisdom'} <ArrowRight size={16}/></button><small>Try: anger · friendship · learning · leadership · failure · love · truth</small></section>{results.length>0&&<section className="finder-results"><div className="section-heading"><div><span className="eyebrow">WHY THESE APPEARED</span><h2>A transparent path to the text.</h2></div><button className="text-button" onClick={()=>setResults([])}>Clear</button></div><div className="finder-grid">{results.map(k=><KuralLink className="finder-card" number={k.number} key={k.number}><span>{String(k.number).padStart(4,'0')}</span><div><small>{k.reason.lens.toUpperCase()} THEME</small><h3>{k.line1}<br/>{k.line2}</h3><div className="finder-translit">{romanFor(k.line1)}<br/>{romanFor(k.line2)}</div><p>{k.eng_exp}</p></div><ArrowRight/></KuralLink>)}</div></section>}</main>;
}

function Lens(){
  const [params]=useSearchParams(); const selected=params.get('topic'); const topic=LENSES.find(x=>x.id===selected);
  return <main className="lens"><section className="page-hero"><span className="eyebrow">WISDOM LENS</span><h1>What are you<br/><em>looking for?</em></h1><p>Choose a situation and begin with a small group of chapters. You can always move back to the full collection.</p></section><div className="lens-grid">{LENSES.map(l=><Link className={`lens-card ${selected===l.id?'selected':''}`} to={`/lens?topic=${l.id}`} key={l.id}><span className="lens-icon">{l.icon}</span><h3>{l.title}</h3><p>{l.subtitle}</p><small>Chapters {l.chapters.join(' · ')}</small></Link>)}</div>{topic&&<section className="lens-result"><span className="eyebrow">A STARTING POINT</span><h2>{topic.title}</h2><div>{topic.chapters.map(c=><Link to={`/chapter/${c}`} key={c}><span>{String(c).padStart(3,'0')}</span><b>Chapter {c}</b><ArrowRight size={15}/></Link>)}</div></section>}</main>;
}

function Galaxy(){
  const navigate=useNavigate();
  const [searchParams]=useSearchParams();
  const chapterParam=Number(searchParams.get('chapter'));
  const activeChapter=Number.isInteger(chapterParam)&&chapterParam>=1&&chapterParam<=133?chapterParam:null;
  const [zoomLabel,setZoomLabel]=useState(1);
  const viewportRef=useRef(null);
  const worldRef=useRef(null);
  const pointersRef=useRef(new Map());
  const gestureRef=useRef(null);

  const chapters=useMemo(()=>CHAPTER_NAMES.map((name,index)=>({
    id:index+1,
    name,
    section:sectionFor((index)*10+1),
  })),[]);

  const chapterPosition=(id)=>{
    const section=id<=38?0:id<=108?1:2;
    const start=section===0?1:section===1?39:109;
    const index=id-start;
    let ring,slot,count;
    if(section===0){
      ring=27; slot=index; count=38;
    }else if(section===1){
      const band=index%3;
      ring=36+band*6; slot=Math.floor(index/3); count=Math.ceil(70/3);
    }else{
      ring=55; slot=index; count=25;
    }
    const angle=-Math.PI/2+(slot/count)*Math.PI*2+(section===1?bandOffset(id)*Math.PI/180:0);
    const wobble=seeded(id*91+17)*2.5-1.25;
    const radius=ring+wobble;
    return {x:50+Math.cos(angle)*radius,y:50+Math.sin(angle)*radius*.76,angle};
  };

  const bandOffset=id=>((id*17)%7)-3.5;

  const kuralPosition=(index)=>{
    const angle=-Math.PI/2+(index/10)*Math.PI*2;
    const radius=27;
    return {x:50+Math.cos(angle)*radius,y:50+Math.sin(angle)*radius*.72};
  };

  const applyTransform=(x,y,z)=>{
    if(worldRef.current) worldRef.current.style.transform=`translate3d(${x}px,${y}px,0) scale(${z})`;
  };

  const getViewportCenter=()=>{
    const rect=viewportRef.current?.getBoundingClientRect();
    return rect?{x:rect.width/2,y:rect.height/2}:{x:0,y:0};
  };

  const clampZoom=z=>Math.max(0.85,Math.min(2.6,z));
  const setZoom=(next)=>{
    const z=clampZoom(next);
    const current=gestureRef.current?.transform||{x:0,y:0,z:zoomLabel};
    gestureRef.current={...(gestureRef.current||{}),transform:{x:current.x,y:current.y,z}};
    applyTransform(current.x,current.y,z);
    setZoomLabel(z);
  };

  const resetView=()=>{
    const z=activeChapter?1.35:1;
    gestureRef.current={...(gestureRef.current||{}),transform:{x:0,y:0,z}};
    applyTransform(0,0,z);
    setZoomLabel(z);
  };


  const onPointerDown=e=>{
    // Never start a Galaxy drag/pinch from an interactive navigation target.
    // This prevents pointer capture from swallowing the browser's anchor click.
    if(e.target?.closest?.('a,button,input,select,textarea')) return;
    const map=pointersRef.current;
    map.set(e.pointerId,{x:e.clientX,y:e.clientY});
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if(map.size===1){
      const t=gestureRef.current?.transform||{x:0,y:0,z:zoomLabel};
      gestureRef.current={transform:t,drag:{x:e.clientX,y:e.clientY,px:t.x,py:t.y}};
    }else if(map.size===2){
      const pts=[...map.values()];
      const dx=pts[0].x-pts[1].x,dy=pts[0].y-pts[1].y;
      const distance=Math.hypot(dx,dy);
      const center={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
      const t=gestureRef.current?.transform||{x:0,y:0,z:zoomLabel};
      gestureRef.current={transform:t,pinch:{distance,center,z:t.z,x:t.x,y:t.y}};
    }
  };

  const onPointerMove=e=>{
    const map=pointersRef.current;
    if(!map.has(e.pointerId)) return;
    map.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const g=gestureRef.current;
    if(map.size===1 && g?.drag){
      const t=g.transform;
      const x=g.drag.px+(e.clientX-g.drag.x);
      const y=g.drag.py+(e.clientY-g.drag.y);
      g.transform={x,y,z:t.z};
      applyTransform(x,y,t.z);
      return;
    }
    if(map.size===2 && g?.pinch){
      const pts=[...map.values()];
      const dx=pts[0].x-pts[1].x,dy=pts[0].y-pts[1].y;
      const distance=Math.hypot(dx,dy);
      const scale=distance/Math.max(1,g.pinch.distance);
      const z=clampZoom(g.pinch.z*scale);
      const center={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
      const dxCenter=center.x-g.pinch.center.x;
      const dyCenter=center.y-g.pinch.center.y;
      const x=g.pinch.x+dxCenter;
      const y=g.pinch.y+dyCenter;
      g.transform={x,y,z};
      applyTransform(x,y,z);
      setZoomLabel(z);
    }
  };

  const onPointerUp=e=>{
    pointersRef.current.delete(e.pointerId);
    if(pointersRef.current.size===0) gestureRef.current=null;
    else if(pointersRef.current.size===1){
      const p=[...pointersRef.current.values()][0];
      const t=gestureRef.current?.transform||{x:0,y:0,z:zoomLabel};
      gestureRef.current={transform:t,drag:{x:p.x,y:p.y,px:t.x,py:t.y}};
    }
  };

  useEffect(()=>{
    resetView();
    // Reset the transform when the galaxy level changes.
    // The map is intentionally static at each level to keep interaction smooth.
  },[activeChapter]);

  const activeName=activeChapter?CHAPTER_NAMES[activeChapter-1]:'';
  return <main className="galaxy">
    <section className="page-hero galaxy-hero">
      <span className="eyebrow">WISDOM GALAXY</span>
      <h1>From <em>அ</em> to an idea.</h1>
      <p>{activeChapter?`Chapter ${activeChapter} · ${activeName}. Explore its ten Kurals, then open any Kural for the complete explanation.`:'Start at the Tamil letter அ — the symbolic source of the Kural — then follow branches into 133 chapters. Select a chapter to reveal its ten Kurals.'}</p>
    </section>

    <div className="galaxy-toolbar">
      {activeChapter&&<button onClick={()=>{window.location.hash='/galaxy';}} aria-label="Back to chapters">← Chapters</button>}
      <button onClick={()=>setZoom(zoomLabel-.2)} aria-label="Zoom out">−</button>
      <span>{Math.round(zoomLabel*100)}%</span>
      <button onClick={()=>setZoom(zoomLabel+.2)} aria-label="Zoom in">+</button>
      <button onClick={resetView}>Reset</button>
    </div>

    <div
      ref={viewportRef}
      className="galaxy-viewport layered-galaxy"
      onWheel={e=>{e.preventDefault();setZoom(zoomLabel+(e.deltaY<0?.08:-.08));}}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={worldRef} className="galaxy-world hierarchical-world">
        <div className="galaxy-nebula nebula-a"/><div className="galaxy-nebula nebula-b"/><div className="galaxy-nebula nebula-c"/>
        <div className="galaxy-grid"/>
        <div className="hierarchy-ring ring-one"/><div className="hierarchy-ring ring-two"/><div className="hierarchy-ring ring-three"/>

        {!activeChapter ? <>
          <svg className="hierarchy-branches" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {chapters.map(ch=>{const p=chapterPosition(ch.id);return <line key={ch.id} x1="50" y1="50" x2={p.x} y2={p.y} className={ch.id<=38?'branch-sage':ch.id<=108?'branch-gold':'branch-rose'}/>;})}
          </svg>
          <div className="galaxy-core hierarchy-core"><span>அ</span><small>ROOT OF<br/>WISDOM</small></div>
          <div className="chapter-node-layer">
            {chapters.map(ch=>{const p=chapterPosition(ch.id);return <AppLink key={ch.id} to={`/galaxy?chapter=${ch.id}`} className={`chapter-node ${ch.section.tone}`} style={{left:`${p.x}%`,top:`${p.y}%`}} onPointerDown={e=>e.stopPropagation()} aria-label={`Chapter ${ch.id}: ${ch.name}`}><span className="node-number">{String(ch.id).padStart(3,'0')}</span><b>{ch.name}</b><i/></AppLink>;})}
          </div>
          <div className="galaxy-level-note"><strong>133 CHAPTERS</strong><span>Tap a chapter to descend into its 10 Kurals</span></div>
        </> : <>
          <svg className="hierarchy-branches kural-branches" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {Array.from({length:10},(_,i)=>{const p=kuralPosition(i);return <line key={i} x1="50" y1="50" x2={p.x} y2={p.y}/>;})}
          </svg>
          <div className="galaxy-core hierarchy-core active-core"><span>{String(activeChapter).padStart(3,'0')}</span><small>CHAPTER<br/>{activeName.toUpperCase()}</small></div>
          <div className="kural-node-layer">
            {Array.from({length:10},(_,i)=>{const number=(activeChapter-1)*10+i+1;const p=kuralPosition(i);return <KuralLink key={number} number={number} className={`kural-galaxy-node ${sectionFor(number).tone}`} style={{left:`${p.x}%`,top:`${p.y}%`}} onPointerDown={e=>e.stopPropagation()} aria-label={`Open Kural ${number}`}><span>{number}</span><b>Kural {i+1}</b></KuralLink>;})}
          </div>
          <div className="galaxy-level-note"><strong>10 KURALS</strong><span>Choose a Kural to open its Tamil text, English meaning and modern interpretation</span></div>
        </>}
      </div>
      <div className="galaxy-hint">Drag · Scroll / Pinch to zoom</div>
      <div className="galaxy-legend"><span><i className="legend-sage"/>Virtue</span><span><i className="legend-gold"/>Society</span><span><i className="legend-rose"/>Love</span></div>
    </div>
  </main>;
}

function App(){return <AppShell><Routes><Route path="/" element={<Home/>}/><Route path="/explore" element={<Explore/>}/><Route path="/chapter/:id" element={<Chapter/>}/><Route path="/kural/:id" element={<Kural/>}/><Route path="/finder" element={<Finder/>}/><Route path="/lens" element={<Lens/>}/><Route path="/galaxy" element={<Galaxy/>}/><Route path="*" element={<Home/>}/></Routes></AppShell>}

createRoot(document.getElementById('root')).render(<HashRouter><App/></HashRouter>);
