export interface BomItem {
  componenteId: number;
  pcsPorUmc: number;
}

export interface ProgramaItem {
  materialId: number;
  qtdProduzir: number;
}

export interface CalculoOpts {
  arredondarPorItem?: boolean;
}

export interface ResultadoComponente {
  componenteId: number;
  necessidadeTotal: number;
  estoqueAtual: number;
  aComprar: number;
}

export function necessidadeItem(
  qtdProduzir: number,
  pcsPorUmc: number,
  arredondar?: boolean
): number;

export function calcularPrograma(
  programaItens: ProgramaItem[],
  boms: Map<number, BomItem[]>,
  estoque: Map<number, number>,
  opts?: CalculoOpts
): ResultadoComponente[];
