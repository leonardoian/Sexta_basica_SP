export const dynamic = "force-dynamic";

import { setCors, handleOptions, getAuth } from "./_lib/db.mjs";

// Usado pelo front pra confirmar que o token salvo ainda é válido e pra
// mostrar o nome de quem está logado, sem precisar decodificar o JWT no
// navegador.
export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const u = getAuth(req);
  if (!u) return res.status(401).json({ error: "Não autorizado" });

  return res.status(200).json({ usuario: { id: u.id, login: u.login, nome: u.nome } });
}