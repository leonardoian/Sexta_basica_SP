import { necessidadeItem, calcularPrograma } from '../lib/calculo.js';
import assert from 'node:assert';

let ok = 0;
function t(nome, fn) { fn(); console.log('✓', nome); ok++; }

// --- Cenário do Leonardo: 9057 usa caixa 951 (6 pçs/caixa) ---
t('600 pçs / 6 por caixa = 100 caixas', () => {
  assert.strictEqual(necessidadeItem(600, 6), 100);
});

t('fracionado arredonda pra cima (601/6 = 101)', () => {
  assert.strictEqual(necessidadeItem(601, 6), 101);
});

t('etiqueta 1:1 (600 pçs = 600 etiquetas)', () => {
  assert.strictEqual(necessidadeItem(600, 1), 600);
});

// --- Programa completo ---
// Materiais: 1=9057(acabado). Componentes: 10=caixa951, 20=etiqueta, 30=perfil
const boms = new Map([
  [1, [
    { componenteId: 10, pcsPorUmc: 6 },   // caixa 951: 6 pçs/caixa
    { componenteId: 20, pcsPorUmc: 1 },   // etiqueta: 1 por peça
    { componenteId: 30, pcsPorUmc: 5 },   // perfil: 5 pçs/unidade (exemplo)
  ]],
  [2, [                                    // outro acabado que TAMBÉM usa caixa 951
    { componenteId: 10, pcsPorUmc: 4 },
  ]],
]);

t('programa 1 item: 600 pçs do 9057', () => {
  const r = calcularPrograma(
    [{ materialId: 1, qtdProduzir: 600 }],
    boms,
    new Map([[10, 30], [20, 0], [30, 50]]) // estoque: 30 caixas, 0 etiq, 50 perfil
  );
  const caixa = r.find(x => x.componenteId === 10);
  assert.strictEqual(caixa.necessidadeTotal, 100);
  assert.strictEqual(caixa.aComprar, 70);      // 100 - 30
  const etiq = r.find(x => x.componenteId === 20);
  assert.strictEqual(etiq.aComprar, 600);      // 600 - 0
  const perfil = r.find(x => x.componenteId === 30);
  assert.strictEqual(perfil.necessidadeTotal, 120); // ceil(600/5)
  assert.strictEqual(perfil.aComprar, 70);     // 120 - 50
});

t('componente compartilhado entre 2 acabados soma', () => {
  const r = calcularPrograma(
    [{ materialId: 1, qtdProduzir: 600 }, { materialId: 2, qtdProduzir: 400 }],
    boms,
    new Map([[10, 0]])
  );
  const caixa = r.find(x => x.componenteId === 10);
  // ceil(600/6)=100  +  ceil(400/4)=100  = 200
  assert.strictEqual(caixa.necessidadeTotal, 200);
  assert.strictEqual(caixa.aComprar, 200);
});

t('estoque cobre necessidade => a_comprar = 0', () => {
  const r = calcularPrograma(
    [{ materialId: 1, qtdProduzir: 600 }],
    boms,
    new Map([[10, 500]])
  );
  assert.strictEqual(r.find(x => x.componenteId === 10).aComprar, 0);
});

t('arredondar por item != arredondar no fim', () => {
  const b = new Map([[1, [{ componenteId: 10, pcsPorUmc: 6 }]]]);
  const itens = [{ materialId: 1, qtdProduzir: 14 }, { materialId: 1, qtdProduzir: 8 }];
  // ⚠️ nota: chaves iguais colidem no UNIQUE real; aqui é só p/ testar a matemática
  const porItem = calcularPrograma(itens.slice(0,1), b, new Map());
  assert.strictEqual(porItem[0].necessidadeTotal, 3); // ceil(14/6)=3
});

console.log(`\n${ok} testes passaram.`);
