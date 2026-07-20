import * as XLSX from "xlsx";

export interface BomImportItem {
  componenteCodigo: string;
  pcsPorUmc: number;
}

export interface BomImportResult {
  materialAcabadoCodigo: string;
  itens: BomImportItem[];
}

const DIACRITICOS = /[̀-ͯ]/g;

function normalizarHeader(h: string): string {
  return h.normalize("NFD").replace(DIACRITICOS, "").trim().toUpperCase();
}

// Layout SAP típico: material acabado no cabeçalho da planilha/relatório,
// componentes um por linha, com quantidade por UMC. Nomes de coluna e a
// célula exata do cabeçalho ainda não são conhecidos — ajustar assim que
// a planilha real (export SAP) chegar.
const CANDIDATOS_COMPONENTE = ["COMPONENTE", "MATERIAL", "COD COMPONENTE"];
const CANDIDATOS_QTD = ["QTD", "QUANTIDADE", "QTD UMC", "QTDE"];

/**
 * @param buffer        conteúdo do arquivo .xlsx
 * @param materialAcabadoCodigo  código do acabado (ainda extraído fora do parser,
 *                               já que a posição exata no layout SAP é desconhecida)
 */
export function parseBomSheet(
  buffer: ArrayBuffer,
  materialAcabadoCodigo: string
): BomImportResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const itens = raw
    .map((linha) => {
      const headers = Object.keys(linha);
      const colComponente = headers.find((h) =>
        CANDIDATOS_COMPONENTE.includes(normalizarHeader(h))
      );
      const colQtd = headers.find((h) => CANDIDATOS_QTD.includes(normalizarHeader(h)));

      const componenteCodigo = colComponente
        ? String(linha[colComponente] ?? "").trim()
        : "";
      const pcsPorUmc = colQtd ? Number(linha[colQtd] ?? 0) : 0;

      return { componenteCodigo, pcsPorUmc };
    })
    .filter((item) => item.componenteCodigo.length > 0 && item.pcsPorUmc > 0);

  return { materialAcabadoCodigo, itens };
}
