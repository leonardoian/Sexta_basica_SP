export const dynamic = "force-dynamic";

import { setCors, handleOptions, getBody, getSQL, initDB, getAuth } from "./_lib/db.mjs";
import { parseListaTecnicaSheet } from "./_lib/import.mjs";

// Importa a lista técnica inteira (todas as referências) de uma vez, a
// partir de um export SAP com a aba "LISTA TECNICA". Diferente do
// bom-importar.mjs (que importa a BOM de UM acabado por vez), este
// endpoint processa milhares de linhas de uma vez, então usa upsert em
// lote (unnest) em vez de um loop de query por linha — senão não
// terminaria dentro do tempo de uma function serverless.
export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (!getAuth(req)) return res.status(401).json({ error: "Não autorizado" });
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  let sql;
  try {
    sql = getSQL();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  try {
    await initDB(sql);
  } catch (e) {
    return res.status(500).json({ error: "Erro initDB: " + e.message });
  }

  const { contentBase64 } = getBody(req);
  if (!contentBase64) return res.status(400).json({ error: "contentBase64 é obrigatório" });

  try {
    const buffer = Buffer.from(contentBase64, "base64");
    const itens = parseListaTecnicaSheet(buffer);
    if (itens.length === 0) {
      return res
        .status(400)
        .json({ error: "aba LISTA TECNICA não encontrada ou sem itens reconhecíveis" });
    }

    // materiais únicos (primeira descrição vista de cada código)
    const acabadosMap = new Map();
    const componentesMap = new Map();
    for (const it of itens) {
      if (!acabadosMap.has(it.acabadoCodigo)) acabadosMap.set(it.acabadoCodigo, it.acabadoDescricao);
      if (!componentesMap.has(it.componenteCodigo)) {
        componentesMap.set(it.componenteCodigo, {
          descricao: it.componenteDescricao,
          umc: it.componenteUmc,
        });
      }
    }

    const acabadosCodigos = [...acabadosMap.keys()];
    const acabadosDescricoes = acabadosCodigos.map((c) => acabadosMap.get(c));

    // acabados: upsert autoritativo — essa planilha é a fonte oficial da lista técnica
    await sql(
      `INSERT INTO materiais (codigo, descricao, umc, tipo)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
       ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao, tipo = 'acabado'`,
      [
        acabadosCodigos,
        acabadosDescricoes,
        acabadosCodigos.map(() => "PC"),
        acabadosCodigos.map(() => "acabado"),
      ]
    );

    const componentesCodigos = [...componentesMap.keys()];
    const componentesDescricoes = componentesCodigos.map((c) => componentesMap.get(c).descricao);
    const componentesUmcs = componentesCodigos.map((c) => componentesMap.get(c).umc || "PC");

    // componentes: só cria os que faltam — nunca sobrescreve um material já cadastrado
    await sql(
      `INSERT INTO materiais (codigo, descricao, umc, tipo)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
       ON CONFLICT (codigo) DO NOTHING`,
      [
        componentesCodigos,
        componentesDescricoes,
        componentesUmcs,
        componentesCodigos.map(() => "componente"),
      ]
    );

    const todosCodigos = [...new Set([...acabadosCodigos, ...componentesCodigos])];
    const materiaisRows = await sql(
      `SELECT id, codigo FROM materiais WHERE codigo = ANY($1::text[])`,
      [todosCodigos]
    );
    const idPorCodigo = new Map(materiaisRows.map((m) => [m.codigo, m.id]));

    const acabadoIds = acabadosCodigos.map((c) => idPorCodigo.get(c)).filter(Boolean);
    const bomRows = await sql(
      `INSERT INTO boms (material_id)
       SELECT unnest($1::bigint[])
       ON CONFLICT (material_id) DO UPDATE SET atualizado_em = now()
       RETURNING id, material_id`,
      [acabadoIds]
    );
    const bomIdPorMaterialId = new Map(bomRows.map((b) => [String(b.material_id), b.id]));

    const bomIdsItens = [];
    const componenteIdsItens = [];
    const pcsItens = [];

    for (const it of itens) {
      const acabadoId = idPorCodigo.get(it.acabadoCodigo);
      const componenteId = idPorCodigo.get(it.componenteCodigo);
      if (!acabadoId || !componenteId) continue;
      const bomId = bomIdPorMaterialId.get(String(acabadoId));
      if (!bomId) continue;
      bomIdsItens.push(bomId);
      componenteIdsItens.push(componenteId);
      pcsItens.push(it.pcsPorUmc);
    }

    if (bomIdsItens.length > 0) {
      await sql(
        `INSERT INTO bom_itens (bom_id, componente_id, pcs_por_umc)
         SELECT * FROM unnest($1::bigint[], $2::bigint[], $3::numeric[])
         ON CONFLICT (bom_id, componente_id) DO UPDATE SET pcs_por_umc = EXCLUDED.pcs_por_umc`,
        [bomIdsItens, componenteIdsItens, pcsItens]
      );
    }

    return res.status(200).json({
      totalLinhas: itens.length,
      acabados: acabadosCodigos.length,
      componentes: componentesCodigos.length,
      itensGravados: bomIdsItens.length,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
