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
