export const dynamic = "force-dynamic";

import { setCors, handleOptions, getBody, getSQL, initDB, getAuth } from "./_lib/db.mjs";
import { parseBomSheet, parseListaTecnicaSheet } from "./_lib/import.mjs";

// Junta em um arquivo só: cabeçalho da BOM, itens da BOM, importação de BOM
// de 1 acabado e importação em massa (lista técnica inteira). São 4 rotas
// que eram arquivos separados, unidas aqui só pra ficar dentro do limite de
// 12 Serverless Functions do plano Hobby da Vercel — a lógica de cada uma
// é a mesma de antes. Diferenciadas pela query ?recurso=.
export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (!getAuth(req)) return res.status(401).json({ error: "Não autorizado" });

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

  const recurso = req.query.recurso || "header";

  // ---------- itens da BOM ----------
  if (recurso === "itens") {
    if (req.method === "GET") {
      const { bomId } = req.query;
      if (!bomId) return res.status(400).json({ error: "bomId é obrigatório" });
      try {
        const itens = await sql`
          SELECT bi.*, c.codigo AS componente_codigo, c.descricao AS componente_descricao,
                 c.umc AS componente_umc
          FROM bom_itens bi
          JOIN materiais c ON c.id = bi.componente_id
          WHERE bi.bom_id = ${bomId}
          ORDER BY c.codigo
        `;
        return res.status(200).json(itens);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    if (req.method === "POST") {
      const { bomId, componenteId, pcsPorUmc } = getBody(req);
      if (!bomId || !componenteId || !pcsPorUmc || Number(pcsPorUmc) <= 0) {
        return res.status(400).json({ error: "bomId, componenteId e pcsPorUmc (> 0) são obrigatórios" });
      }
      try {
        const rows = await sql`
          INSERT INTO bom_itens (bom_id, componente_id, pcs_por_umc)
          VALUES (${bomId}, ${componenteId}, ${pcsPorUmc})
          ON CONFLICT (bom_id, componente_id) DO UPDATE SET pcs_por_umc = ${pcsPorUmc}
          RETURNING *
        `;
        return res.status(201).json(rows[0]);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    if (req.method === "DELETE") {
      const { itemId } = getBody(req);
      if (!itemId) return res.status(400).json({ error: "itemId é obrigatório" });
      try {
        const rows = await sql`DELETE FROM bom_itens WHERE id = ${itemId} RETURNING id`;
        if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    return res.status(405).json({ error: "Método não permitido" });
  }

  // ---------- importar BOM de 1 acabado (relatório avulso) ----------
  if (recurso === "importar") {
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
    const { materialCodigo, contentBase64 } = getBody(req);
    if (!materialCodigo || !contentBase64) {
      return res.status(400).json({ error: "materialCodigo e contentBase64 são obrigatórios" });
    }
    try {
      const materialRows = await sql`SELECT id FROM materiais WHERE codigo = ${materialCodigo}`;
      if (materialRows.length === 0) {
        return res.status(404).json({ error: `material acabado ${materialCodigo} não encontrado` });
      }
      const materialId = materialRows[0].id;

      const bomRows = await sql`
        INSERT INTO boms (material_id)
        VALUES (${materialId})
        ON CONFLICT (material_id) DO UPDATE SET atualizado_em = now()
        RETURNING id
      `;
      const bomId = bomRows[0].id;

      const buffer = Buffer.from(contentBase64, "base64");
      const { itens } = parseBomSheet(buffer, materialCodigo);

      let importados = 0;
      const naoEncontrados = [];

      for (const item of itens) {
        const componenteRows = await sql`SELECT id FROM materiais WHERE codigo = ${item.componenteCodigo}`;
        if (componenteRows.length === 0) {
          naoEncontrados.push(item.componenteCodigo);
          continue;
        }
        const componenteId = componenteRows[0].id;
        await sql`
          INSERT INTO bom_itens (bom_id, componente_id, pcs_por_umc)
          VALUES (${bomId}, ${componenteId}, ${item.pcsPorUmc})
          ON CONFLICT (bom_id, componente_id) DO UPDATE SET pcs_por_umc = ${item.pcsPorUmc}
        `;
        importados++;
      }

      return res.status(200).json({ bomId, total: itens.length, importados, naoEncontrados });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ---------- importar lista técnica inteira (todas as referências, em lote) ----------
  if (recurso === "lista-tecnica") {
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
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

  // ---------- cabeçalho da BOM (padrão) ----------
  if (req.method === "GET") {
    const { materialId } = req.query;
    try {
      if (materialId) {
        const bomRows = await sql`
          SELECT b.*, m.codigo AS material_codigo, m.descricao AS material_descricao
          FROM boms b
          JOIN materiais m ON m.id = b.material_id
          WHERE b.material_id = ${materialId}
        `;
        if (bomRows.length === 0) return res.status(200).json(null);

        const itens = await sql`
          SELECT bi.*, c.codigo AS componente_codigo, c.descricao AS componente_descricao,
                 c.umc AS componente_umc
          FROM bom_itens bi
          JOIN materiais c ON c.id = bi.componente_id
          WHERE bi.bom_id = ${bomRows[0].id}
          ORDER BY c.codigo
        `;
        return res.status(200).json({ ...bomRows[0], itens });
      }

      const rows = await sql`
        SELECT b.*, m.codigo AS material_codigo, m.descricao AS material_descricao
        FROM boms b
        JOIN materiais m ON m.id = b.material_id
        ORDER BY m.codigo
      `;
      return res.status(200).json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    const { materialId } = getBody(req);
    if (!materialId) return res.status(400).json({ error: "materialId é obrigatório" });
    try {
      const rows = await sql`
        INSERT INTO boms (material_id)
        VALUES (${materialId})
        ON CONFLICT (material_id) DO UPDATE SET atualizado_em = now()
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "DELETE") {
    const { id } = getBody(req);
    if (!id) return res.status(400).json({ error: "id é obrigatório" });
    try {
      const rows = await sql`DELETE FROM boms WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) return res.status(404).json({ error: "não encontrada" });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
