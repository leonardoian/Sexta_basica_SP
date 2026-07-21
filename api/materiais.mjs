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
    try {
      const rows = tipo
        ? await sql`SELECT * FROM materiais WHERE tipo = ${tipo} ORDER BY codigo`
        : await sql`SELECT * FROM materiais ORDER BY codigo`;
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
