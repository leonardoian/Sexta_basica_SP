import * as XLSX from "xlsx";

const DIACRITICOS = /[̀-ͯ]/g;

function normalizarHeader(h) {
  return h.normalize("NFD").replace(DIACRITICOS, "").trim().toUpperCase();
}

// Mapeamento esperado (ajustar quando a planilha real chegar):
// MATERIAL -> codigo | DESCRIÇÃO -> descricao | ESTOQUE -> estoque
// (NEC PROG e SALDO ainda não são usados pelo cálculo)
const CANDIDATOS_CODIGO = ["MATERIAL", "CODIGO", "COD MATERIAL"];
const CANDIDATOS_DESCRICAO = ["DESCRICAO", "DESCRIÇÃO", "DESC"];
const CANDIDATOS_ESTOQUE = ["ESTOQUE", "SALDO", "QTD ESTOQUE"];

export function parseEstoqueSheet(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: null });

  return raw
    .map((linha) => {
      const headers = Object.keys(linha);
      const colCodigo = headers.find((h) => CANDIDATOS_CODIGO.includes(normalizarHeader(h)));
      const colDescricao = headers.find((h) =>
        CANDIDATOS_DESCRICAO.includes(normalizarHeader(h))
      );
      const colEstoque = headers.find((h) => CANDIDATOS_ESTOQUE.includes(normalizarHeader(h)));

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

// Layout SAP típico: material acabado no cabeçalho da planilha/relatório,
// componentes um por linha, com quantidade por UMC. Nomes de coluna e a
// célula exata do cabeçalho ainda não são conhecidos — ajustar assim que
// a planilha real (export SAP) chegar.
const CANDIDATOS_COMPONENTE = ["COMPONENTE", "MATERIAL", "COD COMPONENTE"];
const CANDIDATOS_QTD = ["QTD", "QUANTIDADE", "QTD UMC", "QTDE"];

export function parseBomSheet(buffer, materialAcabadoCodigo) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const itens = raw
    .map((linha) => {
      const headers = Object.keys(linha);
      const colComponente = headers.find((h) =>
        CANDIDATOS_COMPONENTE.includes(normalizarHeader(h))
      );
      const colQtd = headers.find((h) => CANDIDATOS_QTD.includes(normalizarHeader(h)));

      const componenteCodigo = colComponente ? String(linha[colComponente] ?? "").trim() : "";
      const pcsPorUmc = colQtd ? Number(linha[colQtd] ?? 0) : 0;

      return { componenteCodigo, pcsPorUmc };
    })
    .filter((item) => item.componenteCodigo.length > 0 && item.pcsPorUmc > 0);

  return { materialAcabadoCodigo, itens };
}
