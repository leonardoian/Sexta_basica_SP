export const dynamic = "force-dynamic";

import { setCors, handleOptions, getBody, getSQL, initDB, getAuth, bcrypt, signToken } from "./_lib/db.mjs";

// Junta login (POST) e "quem sou eu" (GET) num arquivo só — eram 2 arquivos
// separados — só pra ficar dentro do limite de 12 Serverless Functions do
// plano Hobby da Vercel.
export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method === "GET") {
    const u = getAuth(req);
    if (!u) return res.status(401).json({ error: "Não autorizado" });
    return res.status(200).json({ usuario: { id: u.id, login: u.login, nome: u.nome } });
  }

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

  const { login, senha } = getBody(req);
  if (!login || !senha) return res.status(400).json({ error: "login e senha são obrigatórios" });

  try {
    const rows = await sql`SELECT * FROM usuarios WHERE login = ${login} AND ativo = true LIMIT 1`;
    if (rows.length === 0) return res.status(401).json({ error: "Usuário não encontrado" });
    const u = rows[0];
    const ok = await bcrypt.compare(senha, u.senha_hash);
    if (!ok) return res.status(401).json({ error: "Senha incorreta" });

    const token = signToken({ id: u.id, login: u.login, nome: u.nome });
    return res.status(200).json({ token, usuario: { id: u.id, login: u.login, nome: u.nome } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
