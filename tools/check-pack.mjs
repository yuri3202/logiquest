// Verifica UM pack sem depender dos demais: node tools/check-pack.mjs tools/packs/arquivo.json
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateLesson } from './validate-content.mjs';

const file = process.argv[2];
if (!file) {
  console.error('uso: node tools/check-pack.mjs tools/packs/arquivo.json');
  process.exit(2);
}
const pack = JSON.parse(readFileSync(resolve(file), 'utf8'));
const problems = [];
const ids = new Set();
for (const l of pack.lessons || []) {
  if (ids.has(l.id)) problems.push(`id duplicado: ${l.id}`);
  ids.add(l.id);
  problems.push(...validateLesson(l, file));
}
if (problems.length) {
  console.error(`INVÁLIDO ${file} (${problems.length}):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
const kinds = {};
for (const l of pack.lessons || []) for (const s of l.steps) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
console.log(`ok ${file}: ${pack.lessons.map((l) => `${l.id}:${l.steps.length}`).join(' ')}`);
console.log('   ' + JSON.stringify(kinds));
