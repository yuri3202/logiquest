// Fatia o texto extraído do livro em um arquivo por capítulo, para que cada
// questão autoral cite um capítulo/página de forma verificável.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../content-extracted/pdf/AlencarFilho_full.txt');
const outDir = resolve(here, '../content-extracted/pdf/alencar');

const lines = readFileSync(src, 'utf8').split('\n');
const titles = [
  'Proposições. Conectivos', 'Operações lógicas sobre proposições', 'Construção de tabelas-verdade',
  'Tautologias, contradições e contingências', 'Implicação lógica', 'Equivalência lógica',
  'Álgebra das proposições', 'Método dedutivo', 'Argumentos. Regras de inferência',
  'Validade mediante tabelas-verdade', 'Validade mediante regras de inferência',
  'Validade mediante regras de inferência e equivalências',
  'Demonstração condicional e demonstração indireta', 'Sentenças abertas',
  'Operações lógicas sobre sentenças abertas', 'Quantificadores',
  'Quantificação de sentenças abertas com mais de uma variável',
];

// O OCR trocava "8 Capítulo" por "Capítulo O"; varremos depois do sumário e
// contamos em ordem, ignorando ocorrências dentro do próprio índice.
const HEAD = /(?:^|\s)(\d{1,2})\s+Cap[íi]tulo\s*$|^\s*Cap[íi]tulo\s+(?:O\s*$|(\d{1,2})\s*$)/i;
const anchors = [];
let expect = 1;
lines.forEach((line, i) => {
  if (i < 270) return;
  const m = HEAD.exec(line);
  if (!m) return;
  const num = Number(m[1] ?? m[2]);
  const ch = Number.isFinite(num) && num >= expect && num <= 17 ? num : expect;
  if (anchors.some((a) => a.ch === ch)) return;
  anchors.push({ ch, line: i });
  expect = ch + 1;
});

const answerIdx = lines.reduce((acc, l, i) => (/RESPOSTAS DOS EXERC/i.test(l) ? i : acc), -1);
// Só os 17 capítulos; "Capítulo n" também aparece nas referências bibliográficas.
anchors.splice(17);

mkdirSync(outDir, { recursive: true });
anchors.forEach((a, k) => {
  const end = k + 1 < anchors.length ? anchors[k + 1].line : (answerIdx > a.line ? answerIdx : lines.length);
  const body = lines.slice(a.line, end).join('\n').replace(/\f/g, '').trim();
  writeFileSync(resolve(outDir, `cap${String(a.ch).padStart(2, '0')}.txt`),
    `# Capítulo ${a.ch} — ${titles[a.ch - 1] ?? ''}\n# Fonte: Alencar Filho, texto extraído do PDF (linhas ${a.line + 1}–${end} do dump)\n\n${body}\n`);
});
if (answerIdx > 0) {
  writeFileSync(resolve(outDir, 'respostas.txt'),
    `# RESPOSTAS DOS EXERCÍCIOS — Alencar Filho\n\n${lines.slice(answerIdx).join('\n')}\n`);
}
console.log(`capítulos=${anchors.length} respostasNaLinha=${answerIdx + 1}`);
for (const a of anchors) console.log(`  cap ${a.ch}: linha ${a.line + 1}`);
