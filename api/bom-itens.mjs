import { setCors, handleOptions, getBody, getSQL, initDB } from "./_lib/db.mjs";

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

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
