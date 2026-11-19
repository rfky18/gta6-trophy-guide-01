// Leonida Ledger — offline GTA VI trophy guide & tracker.
// All progress lives in localStorage; export/import round-trips it as JSON.
// Guides are our own words; every step cites a numbered source (see Sources).
const KEY = 'leonida-ledger-v1';
const DEMO_EARNED = [2, 3, 4, 5, 8, 16, 19, 20, 21, 22, 23, 24, 32, 35, 42, 46, 55];
const DEMO_COUNTS = { 15: 120, 17: 18, 28: 6, 31: 40, 32: 22, 35: 55 };
const KIND_LABEL = { all: 'All', goal: 'Goal', story: 'Story', side: 'Side chains', collectibles: 'Collectibles', activities: 'Activities', crime: 'Crime', riddles: 'Riddles', money: 'Money', feats: 'Feats', online: 'Online' };
const KIND_ORDER = ['all', 'story', 'missable', 'collectibles', 'activities', 'side', 'crime', 'riddles', 'money', 'feats', 'goal', 'online'];
const STAGES = [
  { n: 0, title: 'S0 — GOAL: 100% and the platinum', note: 'The two that only fall when everything else does.' },
  { n: 1, title: 'S1 — Opening & Chapter 1', note: 'Do the balcony meditation before the chapter ends.' },
  { n: 2, title: 'S2 — Chapters 2–3', note: 'Switching, Scooter Bros, Snap Gun, Race Against Yago.' },
  { n: 3, title: 'S3 — Chapter 4', note: 'Bank vaults open near the end of this chapter.' },
  { n: 4, title: 'S4 — Chapter 5 & finale', note: 'Final mission — keep an untouched save before it.' },
  { n: 5, title: 'S5 — Side chains', note: 'Six character finales + 8 Strangers & Freaks strands.' },
  { n: 6, title: 'S6 — Cleanup: activities & collectibles', note: 'The long grind — stunts, ranges, cards, WAiNK, riddles.' },
  { n: 7, title: 'S7 — Cleanup: money & 100%', note: 'Garages, laundering, spending — then A Long Road.' },
];
const GRADE_RANK = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
const params = new URLSearchParams(location.search);
let trophies = [], sources = [];
let state = loadState();
let revealed = new Set();

function loadState() {
  let s;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { s = JSON.parse(raw); s.earned = new Set(s.earned || []); s.counts = s.counts || {}; }
  } catch (e) { /* corrupted save: fall through to demo */ }
  if (!s) {
    const demo = params.get('demo') !== '0';
    s = {
      earned: new Set(demo ? DEMO_EARNED : []),
      counts: demo ? { ...DEMO_COUNTS } : {},
      spoilers: 'shown',
    };
  }
  // URL params override saved state, so deep links (and screenshots) are deterministic.
  if (params.get('spoilers')) s.spoilers = params.get('spoilers');
  if (params.get('demo') === '0') { s.earned = new Set(); s.counts = {}; }
  s.view = params.get('view') || 'ledger';
  s.kind = params.get('kind') || 'all';
  s.search = ''; s.sort = 'id'; s.unearnedOnly = false;
  s.selected = Number(params.get('select') || 28);
  return s;
}
function saveState() {
  localStorage.setItem(KEY, JSON.stringify({ earned: [...state.earned], counts: state.counts, spoilers: state.spoilers }));
}
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function gradeLetter(g) { return { platinum: 'P', gold: 'G', silver: 'S', bronze: 'B' }[g]; }
function citeList(nums) { return nums.map(n => '[' + n + ']').join(''); }
function trophySources(t) {
  const set = new Set(t.sources || []);
  (t.steps || []).forEach(st => (st.s || []).forEach(n => set.add(n)));
  return [...set].sort((a, b) => a - b);
}
function isHiddenStory(t) { return state.spoilers === 'hidden' && t.kind === 'story' && !state.earned.has(t.id) && !revealed.has(t.id); }
function auditNumbers() {
  const steps = trophies.reduce((a, t) => a + (t.steps || []).length, 0);
  const cited = trophies.reduce((a, t) => a + (t.steps || []).filter(st => (st.s || []).length).length, 0);
  return {
    steps, cited,
    guidesCited: trophies.filter(t => (t.sources || []).length).length,
    hidden: trophies.filter(t => t.hidden).length,
    possible: trophies.filter(t => t.missable === 'possible').length,
    watch: trophies.filter(t => t.watch).length,
    unconfirmed: trophies.filter(t => t.unconfirmed).length,
    partial: trophies.filter(t => t.partial).length,
    single: trophies.filter(t => trophySources(t).length === 1).length,
    disagree: 2, // The Shootist (range count) + Positive Mental Attitude (18 vs 15)
  };
}
function renderAudit() {
  const a = auditNumbers();
  el('audit').innerHTML = 'AUDIT <b>55 official</b><span class="sep">·</span>1P 2G 6S 46B<span class="sep">·</span><b>' + a.hidden + ' hidden</b><span class="sep">·</span><b>' + a.guidesCited + '/55 guides cite a source</b><span class="sep">·</span><b>' + a.cited + '/' + a.steps + ' steps cited</b><span class="sep">·</span><b>7 sources read 20 Nov 2026</b><span class="sep">·</span><b>' + a.possible + ' possibly missable</b><span class="sep">·</span>' + a.watch + ' watch<span class="sep">·</span>' + a.unconfirmed + ' unconfirmed<span class="sep">·</span>' + a.partial + ' partial<span class="sep">·</span>' + a.disagree + ' disagree<span class="sep">·</span>' + a.single + ' single-source';
}
function renderWarn() {
  el('warnBar').innerHTML = '&#9888; 2 POSSIBLY MISSABLE — Positive Mental Attitude: the Chapter 1 balcony meditation may vanish after Chapter 1 ends — do it in Chapter 1. <button type="button" id="warnShow">Show it</button>';
  el('warnShow').addEventListener('click', () => selectTrophy(28));
}
function kindCount(kind) {
  if (kind === 'all') return trophies.length;
  if (kind === 'missable') return trophies.filter(t => t.missable === 'possible' || t.watch).length;
  if (kind === 'online') return 0;
  return trophies.filter(t => t.kind === kind).length;
}
function renderFilters() {
  el('kindFilters').innerHTML = KIND_ORDER.map(k => {
    const label = k === 'missable' ? 'Missable' : KIND_LABEL[k];
    return '<button type="button" data-kind="' + k + '" class="' + (state.kind === k ? 'on' : '') + '">' + label + ' ' + kindCount(k) + '</button>';
  }).join('');
  el('kindFilters').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.kind = b.dataset.kind; renderAll(); }));
}
function filteredTrophies() {
  let list = trophies.slice();
  if (state.kind === 'missable') list = list.filter(t => t.missable === 'possible' || t.watch);
  else if (state.kind === 'online') list = [];
  else if (state.kind !== 'all') list = list.filter(t => t.kind === state.kind);
  if (state.unearnedOnly) list = list.filter(t => !state.earned.has(t.id));
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(t => (t.name + ' ' + t.description + ' ' + t.guide).toLowerCase().includes(q));
  }
  if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (state.sort === 'grade') list.sort((a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade] || a.id - b.id);
  else if (state.sort === 'stage') list.sort((a, b) => a.stage - b.stage || a.id - b.id);
  else list.sort((a, b) => a.id - b.id);
  return list;
}
function flagsHtml(t) {
  let h = '';
  if (t.missable === 'possible') h += ' <span class="tag tag-miss">POSSIBLY MISSABLE</span>';
  if (t.watch) h += ' <span class="tag tag-watch">WATCH</span>';
  if (t.unconfirmed) h += ' <span class="tag tag-unc">NOT PINNED DOWN YET</span>';
  if (t.partial) h += ' <span class="tag tag-unc">PARTIAL</span>';
  if (t.hidden) h += ' <span class="tag tag-hid">HIDDEN ON PSN</span>';
  return h;
}
function renderList() {
  const list = filteredTrophies();
  el('list').innerHTML = list.map(t => {
    const earned = state.earned.has(t.id);
    const hid = isHiddenStory(t);
    const name = hid ? 'Story trophy — hidden until earned' : esc(t.name);
    const desc = hid ? 'Spoiler setting is on. Earn it or tap Reveal.' : esc(t.description);
    return '<li data-id="' + t.id + '" class="' + (state.selected === t.id ? 'sel' : '') + '">'
      + '<input type="checkbox" ' + (earned ? 'checked' : '') + ' data-earn="' + t.id + '" aria-label="Mark ' + esc(t.name) + ' earned">'
      + '<span class="g g-' + t.grade + '">' + gradeLetter(t.grade) + '</span>'
      + '<span><span class="nm">' + name + '</span>' + flagsHtml(t)
      + '<br><span class="ds">' + desc + '</span>'
      + '<br><span class="meta">#' + t.id + ' · ' + KIND_LABEL[t.kind] + ' · ' + STAGES[t.stage].title.split(' — ')[0] + ' · ' + citeList(trophySources(t)) + '</span>'
      + (hid ? ' <button type="button" data-reveal="' + t.id + '">Reveal</button>' : '')
      + '</span></li>';
  }).join('') || '<li>No trophies match this filter.</li>';
  el('shownCount').textContent = list.length + ' shown · ' + state.earned.size + ' of 55 earned';
  el('list').querySelectorAll('[data-earn]').forEach(cb => cb.addEventListener('change', () => {
    const id = Number(cb.dataset.earn);
    if (cb.checked) state.earned.add(id); else state.earned.delete(id);
    saveState(); renderAll();
  }));
  el('list').querySelectorAll('li[data-id]').forEach(li => li.addEventListener('click', e => {
    if (e.target.matches('input,button')) return;
    selectTrophy(Number(li.dataset.id));
  }));
  el('list').querySelectorAll('[data-reveal]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); revealed.add(Number(b.dataset.reveal)); renderList();
  }));
  const next = trophies.filter(t => !state.earned.has(t.id))
    .sort((a, b) => (a.id === 28 ? -1 : b.id === 28 ? 1 : a.stage - b.stage || a.id - b.id)).slice(0, 5);
  el('nextUp').innerHTML = next.map(t => '<div class="nu"><b>' + STAGES[t.stage].title.split(' — ')[0] + '</b> ' + esc(t.name) + '</div>').join('') || '<div class="nu">All 55 earned — platinum time.</div>';
}
function selectTrophy(id) { state.selected = id; renderList(); renderDetail(); }
function renderDetail() {
  const t = trophies.find(x => x.id === state.selected) || trophies[0];
  if (!t) { el('detail').innerHTML = ''; return; }
  const earned = state.earned.has(t.id);
  const hid = isHiddenStory(t);
  let miss = '';
  if (t.missable === 'possible') miss = '<div class="callout"><b>MISSABLE? POSSIBLY</b> — ' + (t.id === 28 ? 'the balcony meditation is gone after Chapter 1 and it is unconfirmed whether “every spot” includes it. Four pages read and one excerpt name it the only missable risk. Do it in Chapter 1 and keep a Chapter 1 save.' : 'Race Against Yago in Chapter 3 is time-sensitive (hourglass icon). Save first and race it the moment it appears.') + '</div>';
  else if (t.watch) miss = '<div class="callout warn2"><b>WATCH</b> — one source warns this chain has story-linked windows. Start it as soon as it unlocks; the warning is single-source.</div>';
  else if (t.unconfirmed) miss = '<div class="callout warn2"><b>NOT PINNED DOWN YET</b> — no guide has confirmed the exact trigger. The description is the only hint; what follows is our best reading, not a confirmed method.</div>';
  else if (t.partial) miss = '<div class="callout warn2"><b>PARTIAL</b> — the description gives the method, but the precise trigger is still being confirmed.</div>';
  let countHtml = '';
  if (t.count) {
    const cur = state.counts[t.id] || 0;
    const pct = Math.min(100, Math.round(cur / t.count * 100));
    countHtml = '<div class="counter"><b>YOUR COUNT</b><button type="button" id="cntDown" aria-label="Decrease count">−</button><b>' + cur + ' / ' + t.count.toLocaleString() + '</b><button type="button" id="cntUp" aria-label="Increase count">+</button><span>' + esc(t.countUnit || '') + '</span><span class="bar"><i style="width:' + pct + '%"></i></span></div>';
  }
  el('detail').innerHTML = '<button type="button" id="markBtn" class="markbtn ' + (earned ? 'done' : '') + '">' + (earned ? '✓ Earned' : 'Mark earned') + '</button>'
    + '<span class="g g-' + t.grade + '">' + gradeLetter(t.grade) + '</span> <b>' + t.grade.toUpperCase() + '</b> <span class="sub">· TROPHY #' + t.id + ' OF 55 · ' + KIND_LABEL[t.kind] + ' · ' + STAGES[t.stage].title + '</span>'
    + '<h2>' + (hid ? 'Story trophy — hidden until earned' : esc(t.name)) + '</h2>'
    + '<div class="sub">' + flagsHtml(t) + '</div>'
    + '<div class="off"><b>OFFICIAL DESCRIPTION</b><p>“' + esc(t.description) + '”</p></div>'
    + miss
    + '<h4>IN SHORT</h4><p>' + esc(t.short) + '</p>'
    + countHtml
    + '<h4>HOW TO GET IT — IN OUR OWN WORDS</h4><ol class="steps">' + (t.steps || []).map(st => '<li>' + esc(st.t) + ' <span class="cite">' + citeList(st.s || []) + '</span></li>').join('') + '</ol>'
    + '<p class="foot">Our own wording. Cited ' + citeList(trophySources(t)) + ' · read 20 Nov 2026 · trophy ' + t.id + ' of 55 · unofficial fan guide.</p>';
  el('markBtn').addEventListener('click', () => {
    if (state.earned.has(t.id)) state.earned.delete(t.id); else state.earned.add(t.id);
    saveState(); renderAll();
  });
  const up = el('cntUp'), down = el('cntDown');
  if (up) up.addEventListener('click', () => { state.counts[t.id] = Math.min(t.count, (state.counts[t.id] || 0) + 1); saveState(); renderDetail(); });
  if (down) down.addEventListener('click', () => { state.counts[t.id] = Math.max(0, (state.counts[t.id] || 0) - 1); saveState(); renderDetail(); });
}
function citedBy(n) {
  // [7] is the official list itself: it underlies every entry's name, description
  // and grade, so it is cited by all 55 guides by definition.
  if (n === 7) return trophies.length;
  return trophies.filter(t => trophySources(t).includes(n)).length;
}
function renderSourcesPanel() {
  el('sourcesPanel').innerHTML = '<h3>SOURCES — READ 20 NOV 2026</h3>' + sources.map(s => {
    const n = citedBy(s.n), pct = Math.round(n / 55 * 100);
    return '<div class="src"><b>[' + s.n + '] ' + esc(s.name) + '</b> — ' + esc(s.title)
      + '<br><span class="u">' + esc(s.url) + '</span>'
      + '<br><span class="cc">read 20 Nov 2026 · cited by ' + n + ' of 55 guides</span>'
      + '<span class="cb"><i style="width:' + pct + '%"></i></span></div>';
  }).join('') + '<p class="foot">Every step cites at least one source. A link opens only if you follow it — the app fetches nothing.</p>';
}
function renderRoadmap() {
  el('roadmap').innerHTML = '<div class="stage"><h3>GOAL — 100% AND THE PLATINUM <span>' + state.earned.size + '/55 earned · ' + Math.round(state.earned.size / 55 * 100) + '%</span></h3><p>Vice Got a Price! pops when the other 54 are done. A Long Road (100%) is the hardest trophy — about 200 hours, difficulty 4/10. [1][3]</p></div>'
    + STAGES.map(st => {
      const items = trophies.filter(t => t.stage === st.n);
      const done = items.filter(t => state.earned.has(t.id)).length;
      return '<div class="stage"><h3>' + esc(st.title) + ' <span>' + done + '/' + items.length + ' earned</span></h3><p>' + esc(st.note) + '</p><ul>'
        + items.map(t => '<li class="' + (state.earned.has(t.id) ? 'done' : '') + '">' + (state.earned.has(t.id) ? '✓ ' : '○ ') + esc(t.name) + ' <span class="cite">' + citeList(trophySources(t)) + '</span></li>').join('') + '</ul></div>';
    }).join('');
  const next = trophies.filter(t => !state.earned.has(t.id))
    .sort((a, b) => (a.id === 28 ? -1 : b.id === 28 ? 1 : a.stage - b.stage || a.id - b.id)).slice(0, 8);
  el('planner').innerHTML = '<h3>NEXT UP — IN ROADMAP ORDER</h3><ol>' + next.map(t => '<li><b>' + STAGES[t.stage].title.split(' — ')[0] + '</b> — ' + esc(t.name) + '</li>').join('') + '</ol>'
    + '<h3>PLATINUM MATH</h3><p class="foot">Story 60–80 h · 100% checklist ~100 h · cleanup ~10 h · ~200 h total, difficulty 4/10, 1 playthrough, 0 online trophies, no mission replay, 15 manual save slots. [1][3]</p>'
    + '<h3>SAVE RULE</h3><p class="foot">Keep a manual save at the start of every chapter and one untouched save before the final mission. Cheats disable trophies and saving — keep them off your trophy save. [1][2]</p>';
}
function renderMissables() {
  const card = (t, head, body) => '<div class="card"><h3>' + esc(t.name) + ' <span class="tag ' + (t.missable === 'possible' ? 'tag-miss' : t.watch ? 'tag-watch' : 'tag-unc') + '">' + head + '</span></h3><p>' + body + ' <span class="cite">' + citeList(trophySources(t)) + '</span></p></div>';
  const poss = trophies.filter(t => t.missable === 'possible');
  const watch = trophies.filter(t => t.watch);
  const unc = trophies.filter(t => t.unconfirmed);
  const part = trophies.filter(t => t.partial);
  el('missables').innerHTML = '<div class="card"><h3>2 POSSIBLY MISSABLE</h3><p>PowerPyx flags one trophy, and only as a maybe. OutputLag adds one time-sensitive race. Nothing else in the list is reported missable by any source we read. [1][2]</p></div>'
    + poss.map(t => card(t, 'POSSIBLY MISSABLE', t.id === 28 ? 'The Chapter 1 balcony meditation disappears with the chapter, and nobody has confirmed whether “every spot” includes it. Do it in Chapter 1 and keep a Chapter 1 save until the trophy pops.' : 'Race Against Yago (Chapter 3) carries an hourglass icon. Save first, then race it the moment it appears.')).join('')
    + '<div class="card"><h3>5 WATCH — SINGLE-SOURCE WARNING</h3><p>TechWiser (via eGamers) reports the stranger chains behind the five hidden side trophies have windows linked to story progress. Only one source gives that warning, so we flag it as WATCH, not as confirmed missable. Start each chain as soon as it unlocks. [4]</p></div>'
    + watch.map(t => card(t, 'WATCH', esc(t.description) + ' Start the chain as soon as it unlocks; the timing warning is single-source.')).join('')
    + '<div class="card"><h3>4 UNCONFIRMED + 2 PARTIAL</h3><p>Five hidden trophies have no confirmed trigger at launch, per OutputLag; we count 4 as fully unconfirmed and 2 as partial (the description gives a method, the exact trigger is not pinned down). [2][3]</p></div>'
    + unc.map(t => card(t, 'NOT PINNED DOWN YET', esc(t.short))).join('')
    + part.map(t => card(t, 'PARTIAL', esc(t.short))).join('');
}
function renderSourcesPage() {
  const a = auditNumbers();
  el('sourcesPage').innerHTML = '<div class="stage"><h3>SOURCES &amp; AUDIT</h3><p class="big">AUDIT — <b>55 official</b> · 1P 2G 6S 46B · <b>' + a.hidden + ' hidden</b> · <b>' + a.guidesCited + '/55 guides cite a source</b> · <b>' + a.cited + '/' + a.steps + ' steps cited</b> · <b>7 sources read 20 Nov 2026</b> · ' + a.possible + ' possibly missable · ' + a.watch + ' watch · ' + a.unconfirmed + ' unconfirmed · ' + a.partial + ' partial · ' + a.disagree + ' disagree · ' + a.single + ' single-source.</p>'
    + '<p class="big">Where the numbers come from: the 55 names, descriptions and grades are the official list (Exophase / kit). “Sources disagree” is shown, not hidden: The Shootist (2 ranges per OutputLag, 12 per GTAZone) and Positive Mental Attitude (18 meditations for the trophy, 15 on the 100% list). “Not pinned down yet” means no guide we read has confirmed the trigger.</p></div>'
    + '<div class="stage"><h3>THE 7 SOURCES</h3><table><tr><th>#</th><th>Source</th><th>What it gave this guide</th><th>Cited by</th></tr>'
    + sources.map(s => '<tr><td>[' + s.n + ']</td><td><b>' + esc(s.name) + '</b><br>' + esc(s.title) + '<br><span class="cite">' + esc(s.url) + '</span></td><td>' + esc(s.note) + '</td><td>' + citedBy(s.n) + ' / 55</td></tr>').join('') + '</table></div>'
    + '<div class="stage"><h3>EXPORT / IMPORT</h3><p class="big">Progress is saved in this browser (localStorage) the moment you tick a trophy or move a counter. <b>Export</b> downloads your progress as JSON; <b>Import</b> reads that file back on any machine. Use the buttons in the header. No account, no server, no network.</p></div>';
}
function renderHeader() {
  el('earnedBig').textContent = state.earned.size + ' / 55';
  const g = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  trophies.forEach(t => { if (state.earned.has(t.id)) g[t.grade]++; });
  el('tally').textContent = 'P ' + g.platinum + '/1 · G ' + g.gold + '/2 · S ' + g.silver + '/6 · B ' + g.bronze + '/46';
  el('spoilerBtn').textContent = 'Spoilers: ' + state.spoilers;
  el('tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === state.view));
  el('viewLedger').classList.toggle('hidden', state.view !== 'ledger');
  el('viewRoadmap').classList.toggle('hidden', state.view !== 'roadmap');
  el('viewMissables').classList.toggle('hidden', state.view !== 'missables');
  el('viewSources').classList.toggle('hidden', state.view !== 'sources');
}
function renderAll() {
  renderHeader(); renderAudit(); renderFilters(); renderList(); renderDetail(); renderSourcesPanel();
  renderRoadmap(); renderMissables(); renderSourcesPage();
}
function exportProgress() {
  const blob = new Blob([JSON.stringify({ app: 'leonida-ledger', earned: [...state.earned].sort((a, b) => a - b), counts: state.counts, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'leonida-ledger-progress.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importProgress(file) {
  try {
    const data = JSON.parse(await file.text());
    const ids = new Set(trophies.map(t => t.id));
    state.earned = new Set((data.earned || []).filter(id => ids.has(Number(id))).map(Number));
    state.counts = {};
    Object.entries(data.counts || {}).forEach(([k, v]) => { if (ids.has(Number(k))) state.counts[Number(k)] = Math.max(0, Number(v) || 0); });
    saveState(); renderAll();
  } catch (e) { alert('That file is not a Leonida Ledger progress export.'); }
}
async function init() {
  const [td, sd] = await Promise.all([fetch('data/trophies.json').then(r => r.json()), fetch('data/sources.json').then(r => r.json())]);
  trophies = td.trophies; sources = sd.sources;
  el('search').addEventListener('input', e => { state.search = e.target.value; renderList(); });
  el('sortSel').addEventListener('change', e => { state.sort = e.target.value; renderList(); });
  el('unearnedOnly').addEventListener('change', e => { state.unearnedOnly = e.target.checked; renderList(); });
  el('spoilerBtn').addEventListener('click', () => { state.spoilers = state.spoilers === 'shown' ? 'hidden' : 'shown'; saveState(); renderAll(); });
  el('exportBtn').addEventListener('click', exportProgress);
  el('importFile').addEventListener('change', e => { if (e.target.files[0]) importProgress(e.target.files[0]); e.target.value = ''; });
  el('tabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; renderAll(); }));
  renderWarn();
  renderAll();
  window.__shotReady = true;
  document.documentElement.setAttribute('data-shot-ready', '1');
}
init();
