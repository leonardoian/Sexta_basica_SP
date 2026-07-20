import * as XLSX from "xlsx";

export interface EstoqueImportRow {
  codigo: string;
  descricao?: string;
  estoque: number;
}

const DIACRITICOS = /[\u0300-\u036f]/g;

function normalizarHeader(h: string): string {
  return h.normalize("NFD").replace(DIACRITICOS, "").trim().toUpperCase();
}

// Mapeamento esperado (ajustar quando a planilha real chegar):
// MATERIAL -> codigo | DESCRIÇÃO -> descricao | ESTOQUE -> estoque
// (NEC PROG e SALDO ainda não são usados pelo cálculo)
const CANDIDATOS_CODIGO = ["MATERIAL", "CODIGO", "COD MATERIAL"];
const CANDIDATOS_DESCRICAO = ["DESCRICAO", "DESCRIÇÃO", "DESC"];
const CANDIDATOS_ESTOQUE = ["ESTOQUE", "SALDO", "QTD ESTOQUE"];

export function parseEstoqueSheet(buffer: ArrayBuffer): EstoqueImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  return raw
    .map((linha) => {
      const headers = Object.keys(linha);
      const colCodigo = headers.find((h) =>
        CANDIDATOS_CODIGO.includes(normalizarHeader(h))
      );
      const colDescricao = headers.find((h) =>
        CANDIDATOS_DESCRICAO.includes(normalizarHeader(h))
      );
      const colEstoque = headers.find((h) =>
        CANDIDATOS_ESTOQUE.includes(normalizarHeader(h))
      );

      const codigo = colCodigo ? String(linha[colCodigo] ?? "").trim() : "";
      const estoque = colEstoque ? Number(linha[colEstoque] ?? 0) : 0;

      return {
        codigo,
        descricao: colDescricao ? String(linha[colDescricao] ?? "") : undefined,
        estoque: Number.isFinite(estoque) ? estoque : 0,
      };
    })
    .filter((linha) => linha.codigo.length > 0);
}
