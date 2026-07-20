import { setCors, handleOptions, getBody, getSQL, initDB } from "./_lib/db.mjs";
import { parseEstoqueSheet } from "./_lib/import.mjs";

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
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

  const { contentBase64 } = getBody(req);
  if (!contentBase64) return res.status(400).json({ error: "contentBase64 é obrigatório" });

  try {
    const buffer = Buffer.from(contentBase64, "base64");
    const linhas = parseEstoqueSheet(buffer);

    let atualizados = 0;
    const naoEncontrados = [];

    for (const linha of linhas) {
      const materialRows = await sql`SELECT id FROM materiais WHERE codigo = ${linha.codigo}`;
      if (materialRows.length === 0) {
        naoEncontrados.push(linha.codigo);
        continue;
      }
      const materialId = materialRows[0].id;
      await sql`
        INSERT INTO estoque (material_id, qtd_atual, atualizado_em)
        VALUES (${materialId}, ${linha.estoque}, now())
        ON CONFLICT (material_id) DO UPDATE SET qtd_atual = ${linha.estoque}, atualizado_em = now()
      `;
      atualizados++;
    }

    return res.status(200).json({ total: linhas.length, atualizados, naoEncontrados });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
