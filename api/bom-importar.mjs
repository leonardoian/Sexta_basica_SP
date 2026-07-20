import { setCors, handleOptions, getBody, getSQL, initDB } from "./_lib/db.mjs";
import { parseBomSheet } from "./_lib/import.mjs";

// Estrutura provisória: o código do acabado é informado junto do upload
// (campo materialCodigo) até sabermos exatamente onde ele aparece no
// layout exportado do SAP. O arquivo chega em base64 (lido no navegador).
export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
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
