// Consolida o conteúdo do app: protótipo HTML + packs autorados + gerador computado.
// Roda antes do build e FALHA se qualquer step for inválido — conteúdo é a barra de qualidade.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRADED, MASCOTS, validateStep } from './validate-content.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, '../content-extracted');
const packsDir = resolve(here, 'packs');
const outFile = resolve(here, '../logiquest/src/content/generated.json');

const read = (f) => JSON.parse(readFileSync(resolve(srcDir, f), 'utf8'));
const legacy = {
  lessons: read('lessonsDB.json'),
  modules: read('modulesMeta.json'),
  bosses: read('bossPools.json'),
  cards: read('flashcardsDB.json'),
  ava: read('avaShortcutList.json'),
};

const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };

/* ---------- normalização do protótipo (legado) ---------- */

const CHOICE = new Set(['multiple-choice', 'translation-choice']);

function normalizeStep(raw, lessonId, idx) {
  const id = `${lessonId}#${idx}`;
  const base = { id, source: raw.badge ?? null };

  if (CHOICE.has(raw.type)) {
    const correct = (raw.options || []).filter((o) => o.isCorrect).length;
    check(correct === 1, `${id}: esperado exatamente 1 alternativa correta, achou ${correct}`);
    check(!!raw.explanation, `${id}: step avaliativo sem explanation`);
    return { ...base, kind: 'choice', instruction: raw.instruction, options: raw.options, explanation: raw.explanation };
  }

  switch (raw.type) {
    case 'theory':
      return { ...base, kind: 'theory', title: raw.title ?? null, content: raw.content, table: raw.table ?? null, instruction: raw.instruction ?? null };
    case 'swipe-tf':
      check(!!raw.explanation, `${id}: sem explanation`);
      return { ...base, kind: 'swipe', instruction: raw.instruction, statement: raw.statement, subtext: raw.subtext ?? null, isTrue: raw.isTrue, explanation: raw.explanation };
    case 'mimo-code':
      check(typeof raw.correctIndex === 'number', `${id}: sem correctIndex`);
      return { ...base, kind: 'code-blank', instruction: raw.instruction, codePrefix: raw.codePrefix, codeSuffix: raw.codeSuffix ?? '', options: raw.options, correctIndex: raw.correctIndex, explanation: raw.explanation };
    case 'sagittal-visual':
      return { ...base, kind: 'sagittal', instruction: raw.instruction, formula: raw.formula, mappings: raw.mappings, options: raw.options, explanation: raw.explanation };
    case 'word-bank':
      check(Array.isArray(raw.correctSequence) && raw.correctSequence.length > 0, `${id}: correctSequence vazio`);
      return { ...base, kind: 'tokens', instruction: raw.instruction, promptBox: raw.promptBox ?? null, tokens: raw.tokens, correctSequence: raw.correctSequence, hint: raw.hint ?? null, explanation: raw.explanation };
    case 'truth-table':
      return { ...base, kind: 'row-truth', title: raw.title ?? null, instruction: raw.instruction, rowContext: raw.rowContext, options: raw.options, correctIndex: raw.correctIndex, explanation: raw.explanation };
    case 'multi-truth-table':
      return { ...base, kind: 'truth-grid', instruction: raw.instruction, headers: raw.headers, rows: raw.rows, explanation: raw.explanation };
    case 'match-pairs':
      return { ...base, kind: 'match', instruction: raw.instruction, pairs: raw.pairs, explanation: raw.explanation };
    case 'deductive-builder':
      check(typeof raw.correctExpr === 'number' && typeof raw.correctRule === 'number', `${id}: falta correctExpr/correctRule`);
      return { ...base, kind: 'proof-step', title: raw.title ?? null, instruction: raw.instruction, proofState: raw.proofState, exprOptions: raw.exprOptions, ruleOptions: raw.ruleOptions, correctExpr: raw.correctExpr, correctRule: raw.correctRule, explanation: raw.explanation };
    case 'venn-interactive':
      return { ...base, kind: 'venn', title: raw.title ?? null, instruction: raw.instruction, targetRegion: raw.targetRegion, explanation: raw.explanation };
    case 'counterexample-visual':
      check((raw.items || []).some((i) => i.isCounter), `${id}: nenhum item marcado isCounter`);
      return { ...base, kind: 'counterexample', instruction: raw.instruction, items: raw.items, explanation: raw.explanation };
    default:
      problems.push(`${id}: tipo desconhecido "${raw.type}"`);
      return null;
  }
}

/* ---------- montagem ---------- */

const lessons = Object.entries(legacy.lessons).map(([id, l]) => ({
  id,
  unitTitle: l.unitTitle ?? null,
  title: l.title,
  char: l.char ?? 'bit',
  icon: l.icon ?? 'star',
  steps: (l.steps || []).map((s, i) => normalizeStep(s, id, i)).filter(Boolean),
}));
for (const l of lessons) check(l.steps.length > 0, `lição ${l.id}: sem steps`);

const packFiles = existsSync(packsDir)
  ? readdirSync(packsDir).filter((f) => f.endsWith('.json')).sort()
  : [];
const seen = new Map(lessons.map((l) => [l.id, 'protótipo']));
for (const file of packFiles) {
  let pack;
  try {
    pack = JSON.parse(readFileSync(resolve(packsDir, file), 'utf8'));
  } catch (e) {
    problems.push(`pack ${file}: JSON inválido (${e.message})`);
    continue;
  }
  for (const l of pack.lessons || []) {
    if (seen.has(l.id)) {
      problems.push(`pack ${file}: lição duplicada "${l.id}" (já vem de ${seen.get(l.id)})`);
      continue;
    }
    seen.set(l.id, file);
    check(!!l.title, `pack ${file}: lição ${l.id} sem title`);
    check(MASCOTS.has(l.char), `pack ${file}: lição ${l.id} com char "${l.char}"`);
    check((l.steps || []).length > 0, `pack ${file}: lição ${l.id} sem steps`);
    const steps = (l.steps || []).map((s, i) => {
      const id = `${l.id}#${i}`;
      problems.push(...validateStep(s, id));
      return { ...s, id, source: s.source ?? null, explanation: s.explanation ?? null, instruction: s.instruction ?? null };
    });
    lessons.push({ id: l.id, unitTitle: l.unitTitle ?? null, title: l.title, char: l.char ?? 'bit', icon: l.icon ?? 'star', steps });
  }
}

const bosses = Object.fromEntries(
  Object.entries(legacy.bosses).map(([poolId, steps]) => [
    poolId,
    steps.map((s, i) => normalizeStep(s, poolId, i)).filter(Boolean),
  ]),
);

const extPath = resolve(here, 'modules-ext.json');
const ext = existsSync(extPath) ? JSON.parse(readFileSync(extPath, 'utf8')) : { modules: [] };
const modules = [...legacy.modules, ...ext.modules];

const lessonIds = new Set(lessons.map((l) => l.id));
const byId = new Map(lessons.map((l) => [l.id, l]));
for (const m of modules) {
  for (const ref of m.lessons) {
    if (ref.startsWith('boss_')) continue;
    check(lessonIds.has(ref), `módulo ${m.id}: lição órfã (${ref})`);
  }
  const poolId = m.lessons.find((r) => r.startsWith('boss_'));
  if (poolId && !(poolId in bosses)) {
    const mine = m.lessons.filter((r) => lessonIds.has(r)).flatMap((r) => byId.get(r).steps);
    const graded = mine.filter((s) => GRADED.has(s.kind));
    check(graded.length > 0, `módulo ${m.id}: sem passos avaliáveis para o boss ${poolId}`);
    if (!graded.length) continue;
    const n = Math.min(6, graded.length);
    const stride = Math.max(1, Math.floor(graded.length / n));
    bosses[poolId] = Array.from({ length: n }, (_, i) => ({ ...graded[(i * stride) % graded.length], id: `${poolId}#${i}` }));
  }
}
for (const m of modules) {
  for (const ref of m.lessons) {
    if (ref.startsWith('boss_')) check(ref in bosses, `módulo ${m.id}: pool de boss ausente (${ref})`);
  }
}

// Toda lição precisa aparecer na trilha — senão o aluno nunca vê o conteúdo escrito.
const referenced = new Set(modules.flatMap((m) => m.lessons));
for (const id of lessonIds) check(referenced.has(id), `lição fora da trilha: ${id} (adicione em tools/modules-ext.json)`);

const ava = [...legacy.ava, ...(ext.ava || [])];
for (const a of ava) {
  check(lessonIds.has(a.lessonId) || a.lessonId in bosses, `atalho AVA "${a.title}": destino inexistente (${a.lessonId})`);
}

const stepTotal = lessons.reduce((n, l) => n + l.steps.length, 0);
const kinds = {};
for (const l of lessons) for (const s of l.steps) kinds[s.kind] = (kinds[s.kind] || 0) + 1;

if (problems.length) {
  console.error(`\nCONTEÚDO INVÁLIDO (${problems.length}):`);
  for (const p of problems.slice(0, 40)) console.error('  - ' + p);
  process.exit(1);
}

const content = {
  meta: { generatedFrom: 'protótipo + packs + gerador', stepCount: stepTotal },
  modules,
  lessons,
  bosses,
  flashcards: [...legacy.cards, ...(ext.flashcards || [])],
  ava,
};
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(content, null, 2));
console.log(`OK lições=${lessons.length} steps=${stepTotal} módulos=${modules.length} bosses=${Object.keys(bosses).length} cards=${content.flashcards.length} ava=${ava.length}`);
console.log(`packs: ${packFiles.length} (${packFiles.join(', ') || 'nenhum'})`);
console.log('kinds: ' + JSON.stringify(kinds));
