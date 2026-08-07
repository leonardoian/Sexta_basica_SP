import * as XLSX from "xlsx";

const DIACRITICOS = /[̀-ͯ]/g;

function normalizarHeader(h) {
  return String(h ?? "")
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .trim()
    .toUpperCase();
}

// Mapeamento esperado — inclui os nomes de coluna reais vistos em exports
// SAP (Material / Texto breve material / Utilização livre / UMB / Depósito),
// além dos nomes "simples" de planilha feita à mão.
const CANDIDATOS_CODIGO = ["MATERIAL", "CODIGO", "COD MATERIAL"];
const CANDIDATOS_DESCRICAO = ["DESCRICAO", "DESC", "TEXTO BREVE MATERIAL"];
const CANDIDATOS_ESTOQUE = ["ESTOQUE", "SALDO", "QTD ESTOQUE", "UTILIZACAO LIVRE"];
const CANDIDATOS_UMC = ["UMC", "UMB"];
const CANDIDATOS_DEPOSITO = ["DEPOSITO"];

// Planilha simples de estoque: 1 aba, 1 material por linha, sem depósito.
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
      const colUmc = headers.find((h) => CANDIDATOS_UMC.includes(normalizarHeader(h)));

      const codigo = colCodigo ? String(linha[colCodigo] ?? "").trim() : "";
      const estoque = colEstoque ? Number(linha[colEstoque] ?? 0) : 0;

      return {
        codigo,
        descricao: colDescricao ? String(linha[colDescricao] ?? "").trim() : "",
        umc: colUmc ? String(linha[colUmc] ?? "").trim() : "",
        estoque: Number.isFinite(estoque) ? estoque : 0,
      };
    })
    .filter((linha) => linha.codigo.length > 0);
}

// Planilha de estoque por depósito: varre TODAS as abas do arquivo e usa
// qualquer uma que tenha o formato de relatório de saldo (código + saldo).
// O depósito vem da coluna "Depósito" quando existe; senão usa o nome da
// aba (ex: abas "0802"/"0805"/"0806", um relatório por depósito).
export function parseEstoquePorDeposito(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const linhas = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: null });
    if (raw.length === 0) continue;

    const headers = Object.keys(raw[0]);
    const colCodigo = headers.find((h) => CANDIDATOS_CODIGO.includes(normalizarHeader(h)));
    const colEstoque = headers.find((h) => CANDIDATOS_ESTOQUE.includes(normalizarHeader(h)));
    if (!colCodigo || !colEstoque) continue; // essa aba não é de estoque

    const colDescricao = headers.find((h) => CANDIDATOS_DESCRICAO.includes(normalizarHeader(h)));
    const colUmc = headers.find((h) => CANDIDATOS_UMC.includes(normalizarHeader(h)));
    const colDeposito = headers.find((h) => CANDIDATOS_DEPOSITO.includes(normalizarHeader(h)));

    for (const linha of raw) {
      const codigo = colCodigo ? String(linha[colCodigo] ?? "").trim() : "";
      if (!codigo) continue;
      const estoque = Number(linha[colEstoque] ?? 0);
      linhas.push({
        codigo,
        descricao: colDescricao ? String(linha[colDescricao] ?? "").trim() : "",
        umc: colUmc ? String(linha[colUmc] ?? "").trim() : "",
        deposito: colDeposito ? String(linha[colDeposito] ?? "").trim() || sheetName.trim() : sheetName.trim(),
        estoque: Number.isFinite(estoque) ? estoque : 0,
      });
    }
  }

  return linhas;
}

// Layout SAP de BOM de UM acabado só (relatório avulso, sem coluna de
// referência — o acabado é informado fora, na hora do upload).
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

// Layout SAP de explosão de lista técnica com TODAS as referências juntas
// numa aba só (relatório "LISTA TECNICA"). Cada linha é um componente de
// uma referência; a referência (2ª coluna "Material") se repete em todas
// as linhas do seu grupo. "CONS.Unit" é o consumo do componente por 1
// peça produzida (ex: 0,1667 = 1/6 → 6 peças por caixa; 2 = 2 unidades
// do componente por peça). pcs_por_umc = 1 / CONS.Unit, arredondado pra
// inteiro quando estiver bem perto de um (ruído de arredondamento do
// próprio SAP), senão mantido com casas decimais.
export function parseListaTecnicaSheet(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames.find((n) => normalizarHeader(n).includes("LISTA TECNICA"));
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const linha = rows[i].map(normalizarHeader);
    if (linha.filter((c) => c === "MATERIAL").length >= 2 && linha.some((c) => c.includes("CONS"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const header = rows[headerIdx].map(normalizarHeader);
  const idxMaterial = [];
  const idxTexto = [];
  header.forEach((h, i) => {
    if (h === "MATERIAL") idxMaterial.push(i);
    if (h === "TEXTO BREVE MATERIAL") idxTexto.push(i);
  });
  const idxUmb = header.findIndex((h) => h === "UMB");
  const idxCons = header.findIndex((h) => h.includes("CONS"));

  if (idxMaterial.length < 2 || idxTexto.length < 2 || idxCons < 0) return [];

  const [colAcabado, colComponente] = idxMaterial;
  const [colAcabadoDesc, colComponenteDesc] = idxTexto;

  const itens = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const acabadoCodigo = String(r[colAcabado] ?? "").trim();
    const componenteCodigo = String(r[colComponente] ?? "").trim();
    const consUnit = Number(r[idxCons]);
    if (!acabadoCodigo || !componenteCodigo || !Number.isFinite(consUnit) || consUnit <= 0) continue;

    let pcsPorUmc = 1 / consUnit;
    const arredondado = Math.round(pcsPorUmc);
    pcsPorUmc = Math.abs(pcsPorUmc - arredondado) < 0.02 ? arredondado : Math.round(pcsPorUmc * 10000) / 10000;

    itens.push({
      acabadoCodigo,
      acabadoDescricao: String(r[colAcabadoDesc] ?? "").trim() || acabadoCodigo,
      componenteCodigo,
      componenteDescricao: String(r[colComponenteDesc] ?? "").trim() || componenteCodigo,
      componenteUmc: idxUmb >= 0 ? String(r[idxUmb] ?? "").trim() || "PC" : "PC",
      pcsPorUmc,
    });
  }

  return itens;
}
