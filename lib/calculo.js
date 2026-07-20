// ============================================================
// Núcleo do cálculo de necessidade de compra
// JS puro, sem dependência de banco — testável isoladamente.
// ============================================================

/**
 * Necessidade de UM componente para UM item do programa.
 * @param {number} qtdProduzir  peças a produzir do acabado
 * @param {number} pcsPorUmc     peças que consomem 1 unidade do componente (ex: 6 pçs/caixa)
 * @param {boolean} arredondar   arredonda pra cima (default true)
 * @returns {number} unidades do componente (CX, PC, etc)
 */
export function necessidadeItem(qtdProduzir, pcsPorUmc, arredondar = true) {
  const bruta = qtdProduzir / pcsPorUmc;
  return arredondar ? Math.ceil(bruta) : bruta;
}

/**
 * Explode um programa inteiro e agrega a necessidade por componente.
 *
 * @param {Array} programaItens  [{ materialId, qtdProduzir }]
 * @param {Map}   boms           materialId -> [{ componenteId, pcsPorUmc }]
 * @param {Map}   estoque        materialId(componente) -> qtdAtual
 * @param {Object} opts          { arredondarPorItem: true }
 * @returns {Array} [{ componenteId, necessidadeTotal, estoqueAtual, aComprar }]
 *
 * arredondarPorItem=true  -> arredonda cada item e soma (recomendado: você
 *                            produz cada ref separada, não compartilha caixa).
 * arredondarPorItem=false -> soma frações e arredonda no fim.
 */
export function calcularPrograma(programaItens, boms, estoque, opts = {}) {
  const arredondarPorItem = opts.arredondarPorItem ?? true;
  const acc = new Map(); // componenteId -> necessidade acumulada

  for (const { materialId, qtdProduzir } of programaItens) {
    const bom = boms.get(materialId);
    if (!bom) continue; // acabado sem BOM cadastrada — ignora (ou trate fora)

    for (const { componenteId, pcsPorUmc } of bom) {
      const nec = necessidadeItem(qtdProduzir, pcsPorUmc, arredondarPorItem);
      acc.set(componenteId, (acc.get(componenteId) ?? 0) + nec);
    }
  }

  const resultado = [];
  for (const [componenteId, necBruta] of acc) {
    const necessidadeTotal = arredondarPorItem ? necBruta : Math.ceil(necBruta);
    const estoqueAtual = estoque.get(componenteId) ?? 0;
    const aComprar = Math.max(0, necessidadeTotal - estoqueAtual);
    resultado.push({ componenteId, necessidadeTotal, estoqueAtual, aComprar });
  }

  // ordena colocando o que precisa comprar primeiro
  resultado.sort((a, b) => b.aComprar - a.aComprar);
  return resultado;
}
