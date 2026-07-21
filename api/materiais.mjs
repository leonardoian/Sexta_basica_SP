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
    const { tipo } = req.query;
    // caixa: heurística — pega o item da BOM cujo componente parece ser a
    // caixa (código/descrição com "CX" ou "CAIXA"). Só faz sentido pra
    // acabados; vem tudo null pra componentes (não têm BOM). Traz o id do
    // componente junto (não só a quantidade) pra dar pra editar o item
    // certo em vez de criar um duplicado.
    try {
      const rows = tipo
        ? await sql`
            SELECT m.*, caixa.componente_id AS caixa_componente_id, caixa.pcs_por_umc AS pecas_por_caixa
            FROM materiais m
            LEFT JOIN LATERAL (
              SELECT bi.pcs_por_umc, c.id AS componente_id
              FROM bom_itens bi
              JOIN boms b ON b.id = bi.bom_id
              JOIN materiais c ON c.id = bi.componente_id
              WHERE b.material_id = m.id
                AND (c.codigo ILIKE '%CX%' OR c.codigo ILIKE '%CAIXA%' OR c.descricao ILIKE '%CAIXA%')
              ORDER BY bi.id
              LIMIT 1
            ) caixa ON true
            WHERE m.tipo = ${tipo} ORDER BY m.codigo
          `
        : await sql`
            SELECT m.*, caixa.componente_id AS caixa_componente_id, caixa.pcs_por_umc AS pecas_por_caixa
            FROM materiais m
            LEFT JOIN LATERAL (
              SELECT bi.pcs_por_umc, c.id AS componente_id
              FROM bom_itens bi
              JOIN boms b ON b.id = bi.bom_id
              JOIN materiais c ON c.id = bi.componente_id
              WHERE b.material_id = m.id
                AND (c.codigo ILIKE '%CX%' OR c.codigo ILIKE '%CAIXA%' OR c.descricao ILIKE '%CAIXA%')
              ORDER BY bi.id
              LIMIT 1
            ) caixa ON true
            ORDER BY m.codigo
          `;
      return res.status(200).json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    const { codigo, descricao, umc, tipo } = getBody(req);
    if (!codigo || !descricao) {
      return res.status(400).json({ error: "codigo e descricao são obrigatórios" });
    }
    try {
      const rows = await sql`
        INSERT INTO materiais (codigo, descricao, umc, tipo)
        VALUES (${codigo}, ${descricao}, ${umc ?? "PC"}, ${tipo ?? "componente"})
        ON CONFLICT (codigo) DO UPDATE
          SET descricao = ${descricao}, umc = ${umc ?? "PC"}, tipo = ${tipo ?? "componente"}
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "PUT") {
    const { id, codigo, descricao, umc, tipo } = getBody(req);
    if (!id || !codigo || !descricao) {
      return res.status(400).json({ error: "id, codigo e descricao são obrigatórios" });
    }
    try {
      const rows = await sql`
        UPDATE materiais
        SET codigo = ${codigo}, descricao = ${descricao}, umc = ${umc ?? "PC"}, tipo = ${tipo ?? "componente"}
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
      return res.status(200).json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "DELETE") {
    const { id } = getBody(req);
    if (!id) return res.status(400).json({ error: "id é obrigatório" });
    try {
      const rows = await sql`DELETE FROM materiais WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
