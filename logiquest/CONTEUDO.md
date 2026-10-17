# LogiQuest — guia de autoria de conteúdo

Todo arquivo em `tools/packs/<nome>.json` vira lição jogável depois de `node tools/build-content.mjs`.
O validador **recusa** o build se qualquer regra abaixo falhar, então escreva pouco e certo.

## Forma do arquivo

```json
{
  "lessons": [
    {
      "id": "c1_proposicoes",
      "title": "Proposições e valores lógicos",
      "unitTitle": "Capítulo 1 — Proposições. Conectivos",
      "char": "bit",
      "icon": "circleQuestion",
      "steps": [ /* ver abaixo */ ]
    }
  ]
}
```

`id`: minúsculo, com `_`, único no projeto, prefixo do capítulo (`c1_`, `c6_`, `ava_`, `mult_`).
`char`: um de `bit, turing, boole, sofia, migo, ada, memo`.
`icon`: um dos nomes em `src/components/Icon.tsx` (`star, bolt, table, brain, flask, gavel, scaleBalanced,
lightbulb, puzzle, microchip, infinity, atom, squareRootVariable, sitemap, layers/layerGroup, crown, medal,
trophy, target→bullseye, compass, key, lock, eye, filter, fire, gem, language, listCheck, magic, palette,
seedling, shieldHalved, shuffle, sliders, snowflake, sun, tableCells, tableColumns, tableList, terminal,
users, wandMagicSparkles, wandSparkles, quoteLeft, paperPlane, bug, calculator, calendar, chartSimple, clock,
code, codeBranch, comments, compass, cube, diagramProject, dumbbell, flask, graduationCap, hourglassHalf,
mapLocationDot, paperPlane, rotateLeft, rotateRight, xmark, check, circleCheck, circleInfo, circleXmark,
arrowsSplitUpAndLeft, arrowsSplit…`).

## Passos (12 a 16 por lição)

Campos **obrigatórios em todo passo avaliativo**: `kind`, `instruction`, `explanation`, `source`.
Campos **opcionais visuais** em qualquer passo: `art` (chave de ilustração), `mascot` (`bit|turing|boole|sofia|migo|ada|memo`), `say` (fala curta do mascote, ≤ 60 caracteres).

| kind | para que serve | campos |
|---|---|---|
| `theory` | tela de regra antes de praticar | `title`, `content`, `table` (`null` ou matriz de strings) |
| `choice` | múltipla escolha clássica | `options: [{text, isCorrect}]` — **exatamente uma** correta, 3 a 5 opções |
| `swipe` | verdadeiro/falso | `statement`, `subtext` (`null`), `isTrue` |
| `multi` | "marque **todas** as corretas" | `options: string[]`, `correct: [índices]` (2 ou 3) |
| `input` | digitar a resposta | `prompt` (frase/ctx), `accepted: string[]` (sinônimos aceitos), `hint`, `placeholder` |
| `order` | colocar na ordem (linhas de prova, precedência) | `items: string[]` **já na ordem correta** |
| `tokens` | word bank: montar a fórmula com blocos | `promptBox`, `tokens: string[]`, `correctSequence: string[]`, `hint` |
| `table-build` | completar a coluna final da tabela-verdade | `vars: ["p","q"]`, `formula`, `columnLabel` — **a resposta é calculada** |
| `circuit` | quais entradas deixam a saída em V/F | `vars`, `formula`, `target: "V"\|"F"` — **a resposta é calculada** |
| `row-truth` | valor de uma linha da tabela | `rowContext: {"p":"V","q":"F"}`, `options: string[]`, `correctIndex` |
| `truth-grid` | grade de tabela com células em branco | `headers: string[]`, `rows: [["V","V",{"ans":"F"}], …]` |
| `match` | ligar pares (esquerda ↔ direita) | `pairs: [{left, right}]` — a i-ésima esquerda casa com a i-ésima direita |
| `sagittal` | diagrama sagital V/F | `formula`, `mappings: [{pair, to}]` (`to` pode ser `"?"`), `options` com 1 correta |
| `venn` | pintar região de Venn | `title`, `targetRegion: "intersection"\|"union"\|"difference"\|"exclusive"` |
| `counterexample` | achar o contra-exemplo | `items: [{id, shape, color, label, isCounter?}]` — **algum** `isCounter` |
| `proof-step` | completar a linha de uma dedução | `proofState: [{line, text, rule}]`, `exprOptions`, `ruleOptions`, `correctExpr`, `correctRule` |
| `code-blank` | completar condição de um `SE` (estilo Mimo) | `codePrefix`, `codeSuffix`, `options`, `correctIndex` |

Fórmulas dos passos calculados (`table-build`, `circuit`, `multi.formula`, `input.formula`) usam **somente**
as letras `p q r s t`, os símbolos `~ ^ v → ↔ ⊕ ↑ ↓` e parênteses. Se o parser reprovar, o build quebra.

## Regras de conteúdo (a barra de qualidade do projeto)

1. **Português do Brasil**, tom direto de app de exercício ("Niegue:", "Traduza:", "Classifique:").
2. **`source` cita de verdade.** Formato: `"Alencar Filho, Cap. 3, exercício 4"` / `"Lista I IFES, questão 2b"` /
   `"Aula Quantificadores (Profa. Kelly Gazolli), slide 'Enunciados Categóricos'"`. Quando a questão é
   derivada do material e não cópia literal, escreva `"adaptado de: …"`. **Nunca** invente número de página.
3. Reaproveite **as frases originais dos PDFs** (gatos pardos, Miau, Júlia/admira manteiga, fluxo_ext,
   barbeiro de Sevilha, abacates, "Rosas são vermelhas"…). É isso que faz o app treinar a lista do curso.
4. Em `choice`, as alternativas erradas têm de ser **erros plausíveis** (trocar contrapositiva pela inversa,
   esquecer o "~" só no antecedente, inverter ∀/∃), nunca absurdos.
5. `explanation` diz **por que** a correta é correta em 1–3 frases, citando a regra ("por Condicional: p → q ≡ ~p v q").
6. Variedade: cada lição usa **pelo menos 4 kinds diferentes** e pelo menos um `table-build`, `circuit`,
   `tokens` ou `match` quando o tema for proposicional. Lição de tradução = pelo menos 3 `tokens`.
   Lição de tabela-verdade = pelo menos 3 `table-build`.
7. Ilustre: use `art` em passos que ganham com a figura. Chaves válidas:
   `tree2n, sagittal, associadas, scheffer, eulerPrime, truthColumns, demorgan, condTable, bicondTable,
   lawsLadder, inferenceRules, argForm, vennQuant, nestedQuant, quantNegation, openSentence, setOps,
   induction, circuit, dnfCnf, transMap, fallacies, proofColumns, numberLine, gateMatrix, squareLogic`.
8. Personagem: `mascot` + `say` em até 4 passos por lição, sempre que a fala **ajudar** (dica, aviso de armadilha).
9. Nada de HTML nas strings, exceto `<b>`, `<i>`, `<u>` e `<br/>`.
10. Escreva o JSON com `Write` e valide **o seu arquivo** antes de terminar:
    `cd C:/Users/yurir/Downloads/logica && node tools/check-pack.mjs tools/packs/<nome>.json`
    (só esse comando checa conteúdo; ele imprime `INVÁLIDO` + a lista de passos ruins).

## Capítulos do livro (use estes títulos em `unitTitle`)

| Cap. | Título |
|---|---|
| 1 | Proposições. Conectivos |
| 2 | Operações lógicas sobre proposições |
| 3 | Construção de tabelas-verdade |
| 4 | Tautologias, contradições e contingências |
| 5 | Implicação lógica |
| 6 | Equivalência lógica |
| 7 | Álgebra das proposições |
| 8 | Método dedutivo |
| 9 | Argumentos. Regras de inferência |
| 10 | Validade mediante tabelas-verdade |
| 11 | Validade mediante regras de inferência |
| 12 | Validade mediante regras de inferência e equivalências |
| 13 | Demonstração condicional e demonstração indireta |
| 14 | Sentenças abertas |
| 15 | Operações lógicas sobre sentenças abertas |
| 16 | Quantificadores |
| 17 | Quantificação de sentenças abertas com mais de uma variável |

## Limite do motor (importante nos Caps. 14–17)

O motor que **calcula** respostas é só proposicional: aceita `p q r s t` e nada de predicado.
Por isso, em lições de sentenças abertas / quantificadores **não use** `table-build`, `circuit`,
`multi.formula`, `input.formula` nem `tokens.check = "equiv"`. Nesses capítulos use
`choice`, `swipe`, `match`, `order`, `venn`, `counterexample`, `truth-grid`, `row-truth`,
`tokens` (sequência literal) e `input` **apenas** com `accepted` curto e inconfundível
(3+ variações possíveis da mesma resposta → prefira `choice`).
Texto de predicado (`∀x(P(x) → Q(x))`, `Vp = {2, 3}`) é bem-vindo em `statement`, `options`,
`pairs`, `content` — ali ele é apenas exibido, não interpretado.
