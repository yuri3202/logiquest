// Gera questões CU­MPUTADAS: a resposta de cada passo é derivada do motor proposicional,
// nunca digitada à mão. Roda `node tools/gen-pack.mjs` e escreve tools/packs/generated.json.
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from '../logiquest/src/engine/formula.ts';
import { validateStep } from './validate-content.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(here, 'packs/generated.json');

/* ---------- aleatoriedade determinística (o mesmo build ⇒ as mesmas lições) ---------- */

let seed = 0x9e3779b9;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const shuffled = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** 'V/F' compacto da linha canônica, para as explicações. */
const rowsLabel = (vars: string[]) => {
  if (vars.length === 2) return 'VV, VF, FV, FF';
  if (vars.length === 3) return 'VVV, VVF, VFV, VFF, FVV, FVF, FFV, FFF';
  return `${2 ** vars.length} linhas`;
};

const show = (f: string) => f.replace(/\^/g, ' ∧ ').replace(/v(?!)/g, ' ∨ ').replace(/→/g, ' → ').replace(/↔/g, ' ↔ ');

const reading = (f: string): string => {
  const mc = F.mainConnective(f);
  return {
    and: 'a conjunção só é V quando os dois lados são V',
    or: 'a disjunção basta um lado V para valer',
    imp: 'a condicional só falha quando o antecedente é V e o consequente é F',
    iff: 'a bicondicional vale quando os dois lados têm o mesmo valor',
    xor: 'a disjunção exclusiva vale quando exatamente um lado é V',
    nand: 'a negação disjunta (↑) é o contrário da conjunção',
    nor: 'a negação conjunta (↓) é o contrário da disjunção',
    not: 'a negação inverte o valor da fórmula',
  }[mc as string] ?? 'avalie de dentro para fora, respeitando a precedência ~ > ^ > v > → > ↔';
};

/* ---------- catálogos (só p q r s t e ~ ^ v → ↔ ⊕ ↑ ↓) ---------- */

const F2 = [
  'p ^ q', 'p v q', 'p → q', 'p ↔ q', 'p ⊕ q', 'p ↑ q', 'p ↓ q',
  '~p ^ q', 'p ^ ~q', '~p v ~q', '~(p v q)', '~(p ^ q)', 'p → ~q', '~p → q', '~p ↔ q', '(p → q) → q',
];
const F3 = [
  '(p ^ q) v r', 'p ^ (q v r)', '(p v q) → r', 'p → (q → r)', '(p ↔ q) ^ r',
  '~(p ^ q ^ r)', '(p v q) ^ (q v r)', 'p ⊕ q ⊕ r', '(p → q) → r', '~p v ~q v r',
  '(p ^ q) → (q v r)', '~(p → q) v r',
];
const GRID = [
  { f: '(p → q) ^ (~q → ~p)', cols: ['p', 'q', 'p → q', '~q → ~p', '(p → q) ^ (~q → ~p)'] },
  { f: '~(p ^ q) ↔ (~p v ~q)', cols: ['p', 'q', 'p ^ q', '~(p ^ q)', '~p v ~q', '~(p ^ q) ↔ (~p v ~q)'] },
  { f: '(p v q) ^ ~(p ^ q)', cols: ['p', 'q', 'p v q', 'p ^ q', '~(p ^ q)', '(p v q) ^ ~(p ^ q)'] },
  { f: '(p → q) v (q → p)', cols: ['p', 'q', 'p → q', 'q → p', '(p → q) v (q → p)'] },
  { f: '~(p → q) ^ q', cols: ['p', 'q', 'p → q', '~(p → q)', '~(p → q) ^ q'] },
  { f: '(p ⊕ q) ↔ ~(p ↔ q)', cols: ['p', 'q', 'p ⊕ q', 'p ↔ q', '~(p ↔ q)', '(p ⊕ q) ↔ ~(p ↔ q)'] },
];
const CLASSIFY = [
  'p v ~p', 'p ^ ~p', '(p → q) ↔ (~p v q)', '~~p ↔ p', 'p → (q → p)', '(p ^ q) ^ (p → ~q)',
  'p ↔ (p ^ q)', '(p → q) → (~q → ~p)', '~(p v q) v (p ^ q)', '(p v q) → p', 'p ⊕ (p ⊕ q)',
  '(p → q) ^ (q → r)', '~(p ↔ q) ⊕ (p ↔ ~q)', '(p ^ q) v (~p ^ ~q)', 'V → p', 'p → V', 'F → p',
];
const IMPLIES = [
  { base: 'p ^ q', cands: ['p', 'p v q', 'p → q', 'q → p', '~p', 'p ↔ q'] },
  { base: 'p ↔ q', cands: ['p → q', 'q → p', 'p ^ q', '~p v q', 'p v q'] },
  { base: '~(p v q)', cands: ['~p', '~q', '~p ^ ~q', 'p → q', '~p v q'] },
  { base: 'p → q', cands: ['~p v q', '~q → ~p', '~p → ~q', 'q → p', 'p ^ q'] },
  { base: '(p → q) ^ (q → r)', cands: ['p → r', 'q → r', '~r → ~p', 'p → q', 'r → p'] },
  { base: 'p ^ (q v r)', cands: ['(p ^ q) v (p ^ r)', 'p', 'q v r', 'p → q', '~q ^ ~r'] },
];
const EQUIV = [
  { base: 'p → q', cands: ['~p v q', '~q → ~p', 'q → p', '~p → ~q', 'p ^ ~q', '~~p v q'] },
  { base: '~(p ^ q)', cands: ['~p v ~q', '~(~~p ^ ~~q)', 'p → ~q', '~p ^ ~q', 'p ⊕ q', '~p → q'] },
  { base: 'p ↔ q', cands: ['(p → q) ^ (q → p)', '~p ↔ ~q', '~(p ⊕ q)', 'p ^ q', 'p v q', 'p ⊕ ~q'] },
  { base: '~(p → q)', cands: ['p ^ ~q', '~(~p v q)', 'p v ~q', '~p v q', '~p ^ q', 'p → ~q'] },
  { base: 'p v (q ^ r)', cands: ['(p v q) ^ (p v r)', 'p ^ (q v r)', '(p ^ r) v (p ^ q)', 'p v q', '~(~p ^ ~(q ^ r))', 'q ^ (p v r)'] },
];
const NAND_SET = [
  { f: '~p', want: 'p ↑ p' },
  { f: 'p ^ q', want: '(p ↑ q) ↑ (p ↑ q)' },
  { f: 'p v q', want: '(p ↑ p) ↑ (q ↑ q)' },
  { f: '~(p v q)', want: '(p ↑ q)' },
  { f: 'p → q', want: '(p ↑ p) ↑ ((q ↑ q) ↑ (q ↑ q))' },
];
const NEGATIONS = [
  '~(p ^ q)', '~(p v q)', '~(p → q)', '~(p ↔ q)', '~(~p ^ q)', '~(p v ~q)', '~((p ^ q) → r)', '~(~(p v q) ^ r)',
];

/* ---------- fábricas de passos ---------- */

let n = 0;
const meta = (source: string, explanation: string, extra: Record<string, unknown> = {}) => ({
  source, explanation, ...extra,
});

const tableBuild = (f: string, vars: string[], cap: string) => {
  const col = F.truthColumn(f, vars);
  const vs = col.filter((v: string) => v === 'V').length;
  return {
    kind: 'table-build',
    instruction: `Complete a coluna final da tabela de ${show(f)}.`,
    vars, formula: f, columnLabel: show(f),
    ...meta(`Alencar Filho, Cap. 3 — ${cap} (resposta calculada pelo motor)`,
      `${show(f)} resulta em ${col.join(' ')} em ${rowsLabel(vars)}: ${vs} linha(s) V. Lembre: ${reading(f)}.`,
      { mascot: 'bit', say: 'A última variável alterna mais rápido.' }),
  };
};

const circuitStep = (f: string, target: 'V' | 'F', cap: string) => {
  const vars = F.atomsOf(F.parse(f)).sort();
  return {
    kind: 'circuit',
    instruction: `Acenda as linhas em que ${show(f)} dá ${target}.`,
    vars, formula: f, target,
    ...meta(`Alencar Filho, Cap. 3 e 6 — ${cap} (resposta calculada pelo motor)`,
      `A saída ${target} aparece nas linhas marcadas; nas demais a fórmula vale ${target === 'V' ? 'F' : 'V'}. Motivo: ${reading(f)}.`,
      { art: 'circuit', mascot: 'migo', say: 'Monte a tabela antes de escolher.' }),
  };
};

const classifyChoice = (f: string) => {
  const cls = F.classify(f);
  const label: Record<string, string> = { tautologia: 'Tautologia', contradicao: 'Contradição', contingencia: 'Contingência' };
  const col = F.truthColumn(f);
  const options = shuffled(['tautologia', 'contradicao', 'contingencia']).map((k) => ({
    text: label[k], isCorrect: k === cls,
  }));
  const why = {
    tautologia: 'todas as linhas deram V',
    contradicao: 'todas as linhas deram F',
    contingencia: 'aparecem V e F, então o valor depende da linha',
  }[cls];
  return {
    kind: 'choice', instruction: `Classifique ${show(f)}.`, options,
    ...meta('Alencar Filho, Cap. 4 — classificação de fórmulas (resposta calculada pelo motor)',
      `${show(f)}: coluna ${col.join(' ')} — ${why}.`, { art: cls === 'tautologia' ? 'lawsLadder' : 'condTable' }),
  };
};

const classifySwipe = (f: string, kindWord: string) => {
  const cls = F.classify(f);
  const isTrue = cls === kindWord;
  const nome = cls === 'tautologia' ? 'uma tautologia'
    : cls === 'contradicao' ? 'uma contradição' : 'uma contingência';
  return {
    kind: 'swipe',
    instruction: 'Verdadeiro ou falso?',
    statement: `${show(f)} é ${kindWord === 'tautologia' ? 'uma tautologia' : 'uma contradição'}.`,
    subtext: 'Julgue com a tabela completa, não com a primeira linha.',
    isTrue,
    ...meta('Alencar Filho, Cap. 4 — tautologia e contradição (resposta calculada pelo motor)',
      `${isTrue ? 'De fato' : 'Não é isso'}: ${show(f)} é ${nome} — coluna ${F.truthColumn(f).join(' ')}.`),
  };
};

const truthGridStep = (spec: typeof GRID[number]) => {
  const vars = F.atomsOf(F.parse(spec.f)).sort();
  const cols = spec.cols.map((c) => (vars.includes(c) ? null : F.truthColumn(c, vars)));
  const rows = F.rowsFor(vars).map((env, r) => spec.cols.map((c, i) => {
    if (vars.includes(c)) return env[c] ? 'V' : 'F';
    return cols[i]![r];
  }));
  // esvazia uma célula em cada linha da última coluna (sempre há resposta)
  const blanked = rows.map((row, r) => row.map((cell: string, c: number) => (c === spec.cols.length - 1 && r % 2 === 1 ? { ans: cell } : cell)));
  return {
    kind: 'truth-grid',
    instruction: `Preencha as células que faltam em ${show(spec.f)}.`,
    headers: spec.cols.map((c) => show(c)), rows: blanked,
    ...meta(`Alencar Filho, Cap. 3 e 7 — construção de tabela (resposta calculada pelo motor)`,
      `Cada sub-fórmula é avaliada sozinha: ${spec.cols.filter((c) => !vars.includes(c)).map((c) => `${show(c)} = ${F.truthColumn(c, vars).join(' ')}`).join('; ')}.`,
      { mascot: 'turing', say: 'Cada coluna é uma sub-fórmula sozinha.' }),
  };
};

const impliesMulti = (spec: typeof IMPLIES[number]) => {
  const correct = spec.cands.map((c, i) => (F.implies(spec.base, c) ? i : -1)).filter((i: number) => i >= 0);
  return {
    kind: 'multi',
    instruction: `Marque toda fórmula que ${show(spec.base)} implica (⊨).`,
    options: spec.cands.map((c) => show(c)), correct,
    ...meta('Alencar Filho, Cap. 5 — implicação lógica (resposta calculada pelo motor)',
      `⊨ confere linha a linha: nenhuma linha faz ${show(spec.base)} valer V com a consequente F. Corretas: ${correct.map((i: number) => show(spec.cands[i])).join('; ')}.`),
  };
};

const equivMulti = (spec: typeof EQUIV[number]) => {
  return {
    kind: 'multi',
    instruction: `Marque todas as fórmulas equivalentes a ${show(spec.base)}.`,
    options: spec.cands.map((c) => show(c)), correct: null, formula: spec.base,
    ...meta('Alencar Filho, Cap. 6 e 7 — equivalência lógica (resposta calculada pelo motor)',
      `Equivalentes são as que têm a MESMA coluna que ${show(spec.base)} (${F.truthColumn(spec.base).join(' ')}). O app confere por tabela, não por memória.`,
      { art: 'lawsLadder' }),
  };
};

const nandChoice = (spec: typeof NAND_SET[number]) => {
  const others = NAND_SET.map((s) => s.want).filter((w) => w !== spec.want);
  const options = shuffled([spec.want, ...shuffled(others).slice(0, 3)]).map((t) => ({
    text: show(t), isCorrect: t === spec.want,
  }));
  return {
    kind: 'choice',
    instruction: `Escreva ${show(spec.f)} usando só o conectivo ↑ (negação disjunta).`,
    options,
    ...meta('Alencar Filho, Cap. 6 — conectivos de Scheffer (resposta calculada pelo motor)',
      `Conferido por tabela: ${show(spec.f)} e ${show(spec.want)} têm a mesma coluna. ↑ é funcionalmente completo, então ~, ^ e v se reconstroem com ele.`,
      { art: 'gateMatrix', mascot: 'boole', say: '~p é p ↑ p. Decore essa.' }),
  };
};

const negationTokens = (f: string) => {
  const pushed = F.pushNegation(f);
  const bank = shuffled([...pushed.split(''), ...shuffled(['^', 'v', '→', '↔', '(', ')', '~', 'p', 'q', 'r']).slice(0, 4)]);
  return {
    kind: 'tokens',
    instruction: `Empurre a negação para dentro de ${show(f)} (monte a fórmula equivalente).`,
    promptBox: show(f), tokens: bank, correctSequence: [], check: 'equiv', formula: pushed,
    hint: 'De Morgan: ~(A ^ B) vira ~A v ~B e ~(A v B) vira ~A ^ ~B. ~(A → B) vira A ^ ~B.',
    ...meta('Alencar Filho, Cap. 7 — leis de De Morgan (resposta calculada pelo motor)',
      `Negação empurrada: ${show(f)} ≡ ${show(pushed)}. O app aceita QUALQUER escrita equivalente, não só esta.`,
      { art: 'demorgan', mascot: 'boole', say: 'Troque o conectivo e negue os dois lados.' }),
  };
};

const rowTruth = (f: string, r: number) => {
  const vars = F.atomsOf(F.parse(f)).sort();
  const env = F.rowsFor(vars)[r];
  const col = F.truthColumn(f, vars);
  const val = col[r];
  const options = ['V', 'F'];
  return {
    kind: 'row-truth',
    instruction: `Qual o valor de ${show(f)} nessa linha?`,
    rowContext: Object.fromEntries(vars.map((v) => [v, env[v] ? 'V' : 'F'])),
    options, correctIndex: val === 'V' ? 0 : 1,
    ...meta(`Alencar Filho, Cap. 3 — avaliação linha a linha (resposta calculada pelo motor)`,
      `Com ${vars.map((v) => `${v}=${env[v] ? 'V' : 'F'}`).join(', ')} a fórmula fecha em ${val}: ${reading(f)}.`),
  };
};

const inputEquiv = (f: string) => ({
  kind: 'input',
  instruction: 'Digite uma fórmula equivalente (qualquer uma que feche).',
  prompt: show(f), accepted: [], formula: f,
  hint: 'Use ~, ^, v, →, ↔, ↑, ↓ e parênteses; o app confere por tabela-verdade.',
  placeholder: 'ex.: ~p v q',
  ...meta('Alencar Filho, Cap. 6 e 7 — equivalência (resposta calculada pelo motor)',
    `Uma resposta mínima: ${show(F.pushNegation(`~(${f})`) === f ? f : `~(${F.pushNegation(`~(${f})`)})`)}. ${reading(f)}.`,
    { art: 'transMap', mascot: 'ada', say: 'Sem acento, sem espaços: só símbolos.' }),
});

/* ---------- montagem das lições ---------- */

const lessons: { id: string; title: string; unitTitle: string; char: string; icon: string; steps: unknown[] }[] = [];

const push = (id: string, title: string, unitTitle: string, char: string, icon: string, steps: unknown[]) => {
  lessons.push({ id, title, unitTitle, char, icon, steps: steps.map((s) => ({ id: '', ...s as object })) });
  n += steps.length;
};

const twoVar = shuffled(F2).slice(0, 10);
const threeVar = shuffled(F3).slice(0, 5);

push('g3_tabela_mestra', 'Construa a coluna final', 'Capítulo 3 — Construção de tabelas-verdade', 'bit', 'tableCells', [
  { kind: 'theory', title: 'Como nasce uma coluna', content: 'Com n variáveis a tabela tem 2ⁿ linhas. Na ordem do livro a ÚLTIMA variável alterna a cada linha, a penúltima a cada 2, a primeira a cada 4. Complete a coluna e o app confere linha a linha.', table: null, instruction: null },
  ...twoVar.slice(0, 5).map((f) => tableBuild(f, ['p', 'q'], 'conectivos binários')),
  ...threeVar.slice(0, 2).map((f) => tableBuild(f, ['p', 'q', 'r'], 'três variáveis')),
  ...shuffled(GRID).slice(0, 3).map(truthGridStep),
  ...[0, 1, 2, 3].map((i) => rowTruth(pick(F2), i)),
  ...shuffled(F2).slice(0, 3).map((f) => circuitStep(f, 'V', 'leitura da tabela')),
]);

push('g4_classificar', 'Tautologia, contradição ou contingência', 'Capítulo 4 — Tautologias, contradições e contingências', 'turing', 'filter', [
  { kind: 'theory', title: 'Os três destinos de uma fórmula', content: 'Tautologia: V em todas as linhas. Contradição: F em todas. Contingência: depende da linha. Não existe quarta opção — basta olhar a coluna inteira.', table: null, instruction: null },
  ...shuffled(CLASSIFY).slice(0, 5).map(classifyChoice),
  ...shuffled(CLASSIFY).slice(6, 9).map((f) => classifySwipe(f, 'tautologia')),
  ...shuffled(CLASSIFY).slice(10, 12).map((f) => classifySwipe(f, 'contradicao')),
  ...shuffled(F2).slice(0, 3).map((f) => tableBuild(f, ['p', 'q'], 'classificação pela coluna')),
  ...[0, 3].map((r) => rowTruth(pick(F2), r)),
]);

push('g5_implicacao', 'Quem segue de quem', 'Capítulo 5 — Implicação lógica', 'boole', 'arrowsSplitUpAndLeft', [
  { kind: 'theory', title: '⊨ é mais forte que →', content: 'φ ⊨ ψ quando NENHUMA linha faz φ valer V e ψ valer F. É uma relação entre fórmulas, não uma fórmula. Toda tautologia φ → ψ acompanha a implicação, mas o teste é a tabela.', table: null, instruction: null },
  ...IMPLIES.map(impliesMulti),
  ...shuffled(F2).slice(0, 3).map((f) => circuitStep(f, 'F', 'caça da linha F')),
  ...[2, 3, 1].map((r) => rowTruth(pick(F3), r)),
  ...shuffled(GRID).slice(0, 2).map(truthGridStep),
]);

push('g6_equivalencias', 'Escreva de outro jeito, vale igual', 'Capítulo 6 e 7 — Equivalência lógica e álgebra das proposições', 'boole', 'scaleBalanced', [
  { kind: 'theory', title: 'Equivalência = mesma coluna', content: 'φ ≡ ψ quando as duas tabelas coincidem linha a linha. Por isso o app aceita qualquer resposta equivalente: o que vale é a coluna, não a escrita.', table: null, instruction: null },
  ...EQUIV.map(equivMulti),
  ...NEGATIONS.slice(0, 5).map(negationTokens),
  ...shuffled(NAND_SET).slice(0, 3).map(nandChoice),
  ...shuffled(F2).slice(0, 2).map(inputEquiv),
]);

push('g7_portas', 'Portas, Scheffer e saída acesa', 'Capítulo 6 — Conectivos de Scheffer e portas lógicas', 'migo', 'microchip', [
  { kind: 'theory', title: 'Uma porta chega a tudo', content: '↑ (negação disjunta) é F só quando as duas entradas são V; ↓ (negação conjunta) é V só quando as duas são F. Com uma delas você refaz ~, ^ e v — por isso elas aparecem em circuito.', table: null, instruction: null },
  ...shuffled(NAND_SET).map(nandChoice),
  ...shuffled(['p ↑ q', 'p ↓ q', 'p ⊕ q', '(p ↑ q) v r', '(p ↓ q) → r']).slice(0, 4).map((f) => circuitStep(f, 'V', 'Saída V')),
  ...shuffled(['p ↑ q', 'p ↓ q', 'p ⊕ q', '~(p ↑ q)']).map((f) => tableBuild(f, ['p', 'q'], 'Scheffer')),
  ...[3, 0, 2].map((i) => rowTruth(pick(['p ↑ q', 'p ↓ q', 'p ⊕ q']), i)),
]);

/* ---------- validação e escrita ---------- */

const problems: string[] = [];
for (const l of lessons) {
  l.steps.forEach((s, i) => {
    const st = s as Record<string, unknown>;
    delete st.id;
    const id = `${l.id}#${i}`;
    st.id = id;
    problems.push(...validateStep(st as never, id));
  });
}
if (problems.length) {
  console.error(`GERADOR PRODUZIU CONTEÚDO INVÁLIDO (${problems.length}):`);
  for (const p of problems.slice(0, 25)) console.error('  - ' + p);
  process.exit(1);
}

writeFileSync(outFile, JSON.stringify({ lessons }, null, 2));
const kinds: Record<string, number> = {};
for (const l of lessons) for (const s of l.steps) kinds[(s as { kind: string }).kind] = ((kinds[(s as { kind: string }).kind] || 0) + 1);
console.log(`ok ${outFile}`);
console.log(`lições=${lessons.length} steps=${lessons.reduce((a, l) => a + l.steps.length, 0)}`);
console.log(JSON.stringify(kinds));
