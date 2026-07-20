export type TipoMaterial = "acabado" | "componente";
export type StatusPrograma = "rascunho" | "calculado" | "fechado";

export interface Material {
  id: number;
  codigo: string;
  descricao: string;
  umc: string;
  tipo: TipoMaterial;
  criado_em: string;
}

export interface Bom {
  id: number;
  material_id: number;
  criado_em: string;
  atualizado_em: string;
}

export interface BomItemRow {
  id: number;
  bom_id: number;
  componente_id: number;
  pcs_por_umc: string;
}

export interface Estoque {
  material_id: number;
  qtd_atual: string;
  atualizado_em: string;
}

export interface Programa {
  id: number;
  nome: string;
  status: StatusPrograma;
  criado_em: string;
}

export interface ProgramaItemRow {
  id: number;
  programa_id: number;
  material_id: number;
  qtd_produzir: string;
}

export interface ResultadoCalculoRow {
  componente_id: number;
  componente_codigo: string;
  componente_descricao: string;
  umc: string;
  necessidade_total: string;
  estoque_atual: string;
  a_comprar: string;
}
