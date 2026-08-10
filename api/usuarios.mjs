export const dynamic = "force-dynamic";

import { setCors, handleOptions, getBody, getSQL, initDB, getAuth, bcrypt } from "./_lib/db.mjs";

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const u = getAuth(req);
  if (!u) return res.status(401).json({ error: "Não autorizado" });

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
      const rows = await sql`SELECT id, login, nome, ativo, criado_em FROM usuarios ORDER BY nome`;
      return res.status(200).json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    const { login, senha, nome } = getBody(req);
    if (!login || !senha || !nome) {
      return res.status(400).json({ error: "login, senha e nome são obrigatórios" });
    }
    if (senha.length < 6) {
      return res.status(400).json({ error: "a senha precisa ter pelo menos 6 caracteres" });
    }
    try {
      const hash = await bcrypt.hash(senha, 10);
      const rows = await sql`
        INSERT INTO usuarios (login, senha_hash, nome)
        VALUES (${login}, ${hash}, ${nome})
        RETURNING id, login, nome, ativo, criado_em
      `;
      return res.status(201).json(rows[0]);
    } catch (e) {
      if (String(e.message).includes("usuarios_login_key")) {
        return res.status(400).json({ error: "já existe um usuário com esse login" });
      }
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "DELETE") {
    const { id } = getBody(req);
    if (!id) return res.status(400).json({ error: "id é obrigatório" });
    try {
      const rows = await sql`UPDATE usuarios SET ativo = false WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}