// Testes do motor proposicional. Roda com `node tools/selftest.mjs`.
// O gerador de conteúdo depende dessas garantias: resposta calculada não erra.
import * as F from '../logiquest/src/engine/formula.ts';

let fails = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

const CLASS = {
  'p v ~p': 'tautologia', 'p ^ ~p': 'contradicao', 'p → q': 'contingencia',
  '(p → q) ↔ (~p v q)': 'tautologia', '~~p ↔ p': 'tautologia', 'p ^ q → p': 'tautologia',
  '(p ^ q) ^ (p → ~q)': 'contradicao', 'p ↔ (p ^ q)': 'contingencia',
};
for (const [f, want] of Object.entries(CLASS)) eq(`classify ${f}`, F.classify(f), want);

const EQUIV = [
  ['p → q', '~p v q'], ['p → q', '~q → ~p'], ['p ↔ q', '(p → q) ^ (q → p)'],
  ['~(p ^ q)', '~p v ~q'], ['~(p v q)', '~p ^ ~q'], ['~(p → q)', 'p ^ ~q'],
  ['p ↑ q', '~(p ^ q)'], ['p ↓ q', '~(p v q)'], ['p ⊕ q', '(p v q) ^ ~(p ^ q)'],
  ['p ^ (q v r)', '(p ^ q) v (p ^ r)'], ['p → (q → r)', '(p ^ q) → r'],
  ['~(p ↔ q)', 'p ↔ ~q'],
];
for (const [a, b] of EQUIV) eq(`equiv ${a} / ${b}`, F.equivalent(a, b), true);
for (const [a, b] of [['p → q', 'q → p'], ['p ^ q', 'p v q'], ['p ↔ q', 'p → q'], ['~(p → q)', '~p v q']])
  eq(`não-equiv ${a} / ${b}`, F.equivalent(a, b), false);

const IMPLIES = [
  ['p ^ (p → q)', 'q', true], ['~q ^ (p → q)', '~p', true], ['p → q', 'p', false],
  ['(p → q) ^ (q → r)', 'p → r', true], ['p', 'p v q', true], ['p ^ q', 'p', true],
  ['(p v q) ^ ~q', 'p', true], ['p → q', '~p → ~q', false],
];
for (const [a, b, want] of IMPLIES) eq(`implies ${a} ⊨ ${b}`, F.implies(a, b), want);

// De Morgan automático: o resultado tem de ser equivalente a ¬(fórmula).
const NEGS = ['p', '~p', 'p ^ q', 'p v q', 'p → q', 'p ↔ q', 'p ⊕ q', '(p ^ q) → r',
  '~(p v ~q) ^ (r → ~s)', '(p → q) ↔ (r v ~p)', 'p ↑ (q ↓ r)'];
for (const f of NEGS) {
  const got = F.pushNegation(f);
  eq(`pushNegation equivale a ¬ em ${f}`, F.equivalent(got, `~(${f})`), true);
}
eq('pushNegation formato', F.pushNegation('p → q'), 'p ^ ~q');
eq('pushNegação aninhada', F.pushNegation('~(p v q) → ~(r ^ s)'), '(~p ^ ~q) ^ (r ^ s)');

eq('colunas p → q', F.truthColumn('p → q'), ['V', 'F', 'V', 'V']);
eq('colunas p ↑ q (NAND)', F.truthColumn('p ↑ q'), ['F', 'V', 'V', 'V']);
eq('colunas p ↓ q (NOR)', F.truthColumn('p ↓ q'), ['F', 'F', 'F', 'V']);
eq('colunas p ⊕ q', F.truthColumn('p ⊕ q'), ['F', 'V', 'V', 'F']);
eq('ordem canônica', F.table('p ^ q').map((r) => r.row.join('') + '=' + r.value), ['VV=V', 'VF=F', 'FV=F', 'FF=F']);
eq('3 varáveis = 8 linhas', F.table('(p v q) → ~r').length, 8);
eq('sinônimos do PDF', F.classify('(p ⇒ q) ∧ (~p ∨ q)'), 'contingencia');
eq('átomos', F.atomsOf('r ^ (p → ~q)'), ['p', 'q', 'r']);
eq('conectivo principal', F.mainConnective('(p ^ q) → r'), 'condicional');

for (const bad of ['p ^', '(p → q', 'p q', '~', '', 'x → y']) {
  try { F.parse(bad); eq(`rejeita ${JSON.stringify(bad)}`, 'aceitou', 'erro'); }
  catch { /* esperado */ }
}

console.log(fails ? `\n${fails} falha(s) no motor de fórmulas` : 'motor de fórmulas: todos os testes passaram');
process.exit(fails ? 1 : 0);
