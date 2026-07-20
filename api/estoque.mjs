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
    try {
      const rows = await sql`
        SELECT m.id AS material_id, m.codigo, m.descricao, m.umc,
               COALESCE(e.qtd_atual, 0) AS qtd_atual, e.atualizado_em
        FROM materiais m
        LEFT JOIN estoque e ON e.material_id = m.id
        ORDER BY m.codigo
      `;
      return res.status(200).json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    const { materialId, qtdAtual } = getBody(req);
    if (!materialId || qtdAtual === undefined || Number(qtdAtual) < 0) {
      return res.status(400).json({ error: "materialId e qtdAtual (>= 0) são obrigatórios" });
    }
    try {
      const rows = await sql`
        INSERT INTO estoque (material_id, qtd_atual, atualizado_em)
        VALUES (${materialId}, ${qtdAtual}, now())
        ON CONFLICT (material_id) DO UPDATE SET qtd_atual = ${qtdAtual}, atualizado_em = now()
        RETURNING *
      `;
      return res.status(200).json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
