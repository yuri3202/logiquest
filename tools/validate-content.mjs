// Validação de passos no formato nativo (usado por tools/packs/*.json).
// O gerador de conteúdo falha aqui antes de chegar ao app: resposta calculada não pode errar.
import * as F from '../logiquest/src/engine/formula.ts';

export const VARS = new Set(['p', 'q', 'r', 's', 't']);
export const ART_KEYS = new Set([
  'tree2n', 'sagittal', 'associadas', 'scheffer', 'eulerPrime', 'truthColumns', 'demorgan', 'condTable',
  'bicondTable', 'lawsLadder', 'inferenceRules', 'argForm', 'vennQuant', 'nestedQuant', 'quantNegation',
  'openSentence', 'setOps', 'induction', 'circuit', 'dnfCnf', 'transMap', 'fallacies', 'proofColumns',
  'numberLine', 'gateMatrix', 'squareLogic',
]);
export const MASCOTS = new Set(['bit', 'turing', 'boole', 'sofia', 'migo', 'ada', 'memo']);
const VENN_TARGETS = new Set(['intersection', 'union', 'difference', 'complement', 'exclusive']);
export const GRADED = new Set([
  'choice', 'swipe', 'code-blank', 'sagittal', 'tokens', 'truth-grid', 'row-truth', 'match', 'proof-step',
  'venn', 'counterexample', 'multi', 'input', 'order', 'table-build', 'circuit',
]);

/** Valida e devolve a coluna-verdade de `formula`, registrando problemas. */
function columnOf(formula, vars, fail) {
  if (!F.tryParse(formula)) { fail(`fórmula inválida: "${formula}"`); return null; }
  const free = F.atomsOf(F.parse(formula));
  for (const v of vars || []) {
    if (!VARS.has(v)) fail(`variável fora de p q r s t: "${v}"`);
    if (!free.includes(v)) fail(`"${v}" não aparece em "${formula}"`);
  }
  if ((vars || []).length && new Set(vars).size !== vars.length) fail('vars repetidas');
  const col = F.truthColumn(formula, vars && vars.length ? vars : undefined);
  if (vars && vars.length && col.length !== 2 ** vars.length) fail(`coluna com ${col.length} linhas para ${vars.length} variáveis`);
  return col;
}

export function validateStep(raw, id) {
  const problems = [];
  const fail = (msg) => problems.push(`${id}: ${msg}`);
  const kind = raw.kind;
  if (!kind) { fail('sem kind'); return problems; }
  if (!GRADED.has(kind) && kind !== 'theory') return problems.concat([`${id}: kind desconhecido "${kind}"`]);
  if (kind === 'theory') {
    if (!raw.content) fail('theory sem content');
    if (raw.art && !ART_KEYS.has(raw.art)) fail(`art "${raw.art}" não existe em ConceptArt`);
    if (raw.mascot && !MASCOTS.has(raw.mascot)) fail(`mascot "${raw.mascot}" inválido`);
    return problems;
  }
  if (!raw.instruction) fail('passo avaliativo sem instruction');
  if (!raw.explanation) fail('passo avaliativo sem explanation');
  if (!raw.source) fail('passo avaliativo sem source (cite o PDF/lista)');

  switch (kind) {
    case 'choice':
    case 'sagittal': {
      const n = (raw.options || []).filter((o) => o.isCorrect).length;
      if (n !== 1) fail(`esperado 1 alternativa correta, achou ${n}`);
      if (kind === 'choice' && (raw.options || []).length < 2) fail('choice com menos de 2 alternativas');
      if (kind === 'sagittal') {
        columnOf(raw.formula, [], fail);
        if (!raw.mappings?.length) fail('sagittal sem mappings');
      }
      break;
    }
    case 'swipe':
      if (typeof raw.isTrue !== 'boolean') fail('swipe sem isTrue booleano');
      break;
    case 'code-blank':
    case 'row-truth':
      if (!(raw.correctIndex >= 0 && raw.correctIndex < (raw.options || []).length)) fail('correctIndex fora da faixa');
      break;
    case 'tokens': {
      if (raw.check === 'equiv') {
        columnOf(raw.formula, [], fail);
        if (!raw.tokens?.length) fail('tokens vazio');
      } else {
        if (!raw.correctSequence?.length) fail('correctSequence vazio');
        const pool = [...(raw.tokens || [])];
        for (const t of raw.correctSequence || []) {
          const at = pool.indexOf(t);
          if (at < 0) fail(`bloco "${t}" da resposta não está no banco`);
          else pool.splice(at, 1);
        }
      }
      break;
    }
    case 'truth-grid': {
      if (!raw.rows?.length) fail('truth-grid sem linhas');
      let blanks = 0;
      for (const row of raw.rows || []) for (const cell of row) {
        if (cell && typeof cell === 'object') { blanks++; if (cell.ans !== 'V' && cell.ans !== 'F') fail('célula em branco sem ans válido'); }
        else if (cell !== 'V' && cell !== 'F') fail(`célula fixa inválida: ${JSON.stringify(cell)}`);
      }
      if (!blanks) fail('truth-grid sem nenhuma célula para preencher');
      break;
    }
    case 'match':
      if ((raw.pairs || []).length < 2) fail('match precisa de 2+ pares');
      break;
    case 'proof-step':
      if (!(raw.correctExpr >= 0 && raw.correctExpr < (raw.exprOptions || []).length)) fail('correctExpr fora da faixa');
      if (!(raw.correctRule >= 0 && raw.correctRule < (raw.ruleOptions || []).length)) fail('correctRule fora da faixa');
      break;
    case 'venn':
      if (!VENN_TARGETS.has(raw.targetRegion)) fail(`targetRegion desconhecida "${raw.targetRegion}"`);
      break;
    case 'counterexample':
      if (!(raw.items || []).some((i) => i.isCounter)) fail('nenhum item com isCounter');
      break;
    case 'multi': {
      const opts = raw.options || [];
      if (opts.length < 2) fail('multi com menos de 2 alternativas');
      let want;
      if (raw.formula) {
        columnOf(raw.formula, [], fail);
        want = opts.map((o, i) => (F.tryParse(o) && F.equivalent(o, raw.formula) ? i : -1)).filter((i) => i >= 0);
        if (opts.some((o) => !F.tryParse(o))) fail('alguma alternativa do multi não é fórmula parseável');
        if (want.length === 0) fail('nenhuma alternativa equivalente à fórmula (resposta impossível)');
        if (want.length === opts.length) fail('todas as alternativas são corretas');
        if (raw.correct && raw.correct.length !== want.length) fail(`correct (${JSON.stringify(raw.correct)}) difere do cálculo (${JSON.stringify(want)})`);
      } else {
        want = raw.correct || [];
        if (!want.length) fail('multi sem formula e sem correct');
        for (const i of want) if (!(i >= 0 && i < opts.length)) fail(`índice ${i} fora da faixa`);
      }
      break;
    }
    case 'input': {
      if (raw.formula) {
        columnOf(raw.formula, [], fail);
        for (const a of raw.accepted || []) if (!(F.tryParse(a) && F.equivalent(a, raw.formula))) fail(`accepted "${a}" não equivale à fórmula`);
      } else if (!(raw.accepted || []).length) {
        fail('input sem formula e sem accepted');
      }
      break;
    }
    case 'order':
      if ((raw.items || []).length < 2) fail('order precisa de 2+ itens');
      if (raw.labels && raw.labels.length !== raw.items.length) fail('labels e items de tamanhos diferentes');
      if (new Set(raw.items || []).size !== (raw.items || []).length) fail('itens duplicados embaralham a resposta');
      break;
    case 'table-build':
      columnOf(raw.formula, raw.vars || [], fail);
      break;
    case 'circuit':
      columnOf(raw.formula, raw.vars || [], fail);
      if (raw.target !== 'V' && raw.target !== 'F') fail('target deve ser V ou F');
      break;
  }

  if (raw.art && !ART_KEYS.has(raw.art)) fail(`art "${raw.art}" não existe em ConceptArt`);
  if (raw.mascot && !MASCOTS.has(raw.mascot)) fail(`mascot "${raw.mascot}" inválido`);
  return problems;
}

export function validateLesson(lesson, where) {
  const problems = [];
  if (!lesson.id) problems.push(`${where}: lição sem id`);
  if (!lesson.title) problems.push(`${where}: lição ${lesson.id} sem title`);
  if (lesson.char && !MASCOTS.has(lesson.char)) problems.push(`${where}: lição ${lesson.id} com char "${lesson.char}"`);
  if (!(lesson.steps || []).length) problems.push(`${where}: lição ${lesson.id} sem steps`);
  (lesson.steps || []).forEach((s, i) => problems.push(...validateStep(s, `${lesson.id}#${i}`)));
  return problems;
}
