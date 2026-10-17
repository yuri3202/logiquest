// Extrai os blocos de dados do HTML expandido e escreve JSON por estrutura.
const fs = require('fs');
const vm = require('vm');

const SRC = process.argv[2];
const OUT = process.argv[3];
const html = fs.readFileSync(SRC, 'utf8');

function blockAt(declName) {
  const re = new RegExp(`(?:const|let|var)\\s+${declName}\\s*=\\s*`);
  const m = html.match(re);
  if (!m) return null;
  const start = m.index + m[0].length;
  const open = html[start];
  if (!'[{'.includes(open)) return null;
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = null, esc = false, i = start;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '/' && html[i + 1] === '/') { while (i < html.length && html[i] !== '\n') i++; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

const names = ['modulesMeta', 'lessonsDB', 'bossPools', 'flashcardsDB', 'avaShortcutList', 'appState', 'MascotNames', 'MascotSVGs'];
const out = {};
for (const n of names) {
  const txt = blockAt(n);
  if (!txt) { console.log('MISS ' + n); continue; }
  try {
    out[n] = vm.runInNewContext('(' + txt + ')', {}, { timeout: 2000 });
    console.log('OK   ' + n + '  (' + txt.length + ' chars)');
  } catch (e) {
    console.log('ERR  ' + n + '  ' + e.message);
  }
}

fs.mkdirSync(OUT, { recursive: true });
for (const [k, v] of Object.entries(out)) {
  fs.writeFileSync(`${OUT}/${k}.json`, JSON.stringify(v, null, 2));
}

if (out.lessonsDB) {
  const rows = [];
  for (const [id, L] of Object.entries(out.lessonsDB)) {
    const types = (L.steps || []).map(s => s.type);
    const counts = {};
    types.forEach(t => (counts[t] = (counts[t] || 0) + 1));
    rows.push({ id, title: L.title, mascot: L.mascot, steps: types.length, counts });
  }
  fs.writeFileSync(`${OUT}/_index-lessons.json`, JSON.stringify(rows, null, 2));
  console.log('\nLIÇÕES: ' + rows.length);
  for (const r of rows) console.log(`  ${r.id.padEnd(28)} ${String(r.steps).padStart(2)} steps  ${JSON.stringify(r.counts)}`);
}
if (out.unitsData) console.log('\nUNIDADES: ' + out.unitsData.map(u => u.id + ' -> ' + (u.lessons || []).length).join(' | '));
