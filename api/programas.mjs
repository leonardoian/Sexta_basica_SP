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
    const { id } = req.query;
    try {
      if (id) {
        const rows = await sql`SELECT * FROM programas WHERE id = ${id}`;
        if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
        const itens = await sql`
          SELECT pi.*, m.codigo AS material_codigo, m.descricao AS material_descricao
          FROM programa_itens pi
          JOIN materiais m ON m.id = pi.material_id
          WHERE pi.programa_id = ${id}
          ORDER BY m.codigo
        `;
        return res.status(200).json({ ...rows[0], itens });
      }
      const rows = await sql`SELECT * FROM programas ORDER BY criado_em DESC`;
      return res.status(200).json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    const { nome } = getBody(req);
    if (!nome) return res.status(400).json({ error: "nome é obrigatório" });
    try {
      const rows = await sql`INSERT INTO programas (nome) VALUES (${nome}) RETURNING *`;
      return res.status(201).json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "PUT") {
    const { id, nome, status } = getBody(req);
    if (!id) return res.status(400).json({ error: "id é obrigatório" });
    try {
      const rows = await sql`
        UPDATE programas
        SET nome = COALESCE(${nome}, nome), status = COALESCE(${status}, status)
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
      const rows = await sql`DELETE FROM programas WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
