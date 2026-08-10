export const dynamic = "force-dynamic";

import { setCors, handleOptions, getBody, getSQL, initDB, getAuth, bcrypt } from "./_lib/db.mjs";

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

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

  const { senhaAtual, senhaNova } = getBody(req);
  if (!senhaAtual || !senhaNova) {
    return res.status(400).json({ error: "senhaAtual e senhaNova são obrigatórios" });
  }
  if (senhaNova.length < 6) {
    return res.status(400).json({ error: "a nova senha precisa ter pelo menos 6 caracteres" });
  }

  try {
    const rows = await sql`SELECT * FROM usuarios WHERE id = ${u.id} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ error: "usuário não encontrado" });
    const ok = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
    if (!ok) return res.status(401).json({ error: "senha atual incorreta" });

    const novoHash = await bcrypt.hash(senhaNova, 10);
    await sql`UPDATE usuarios SET senha_hash = ${novoHash} WHERE id = ${u.id}`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}