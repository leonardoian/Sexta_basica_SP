export const dynamic = "force-dynamic";

import { setCors, handleOptions, getBody, getSQL, initDB, getAuth } from "./_lib/db.mjs";

// Junta cabeçalho do programa + itens do programa num arquivo só (eram 2
// arquivos separados) — só pra ficar dentro do limite de 12 Serverless
// Functions do plano Hobby da Vercel. Lógica igual à de antes, diferenciada
// pela query ?recurso=itens.
export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (!getAuth(req)) return res.status(401).json({ error: "Não autorizado" });

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

  if (req.query.recurso === "itens") {
    if (req.method === "GET") {
      const { programaId } = req.query;
      if (!programaId) return res.status(400).json({ error: "programaId é obrigatório" });
      try {
        const itens = await sql`
          SELECT pi.*, m.codigo AS material_codigo, m.descricao AS material_descricao
          FROM programa_itens pi
          JOIN materiais m ON m.id = pi.material_id
          WHERE pi.programa_id = ${programaId}
          ORDER BY m.codigo
        `;
        return res.status(200).json(itens);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    if (req.method === "POST") {
      const { programaId, materialId, qtdProduzir } = getBody(req);
      if (!programaId || !materialId || !qtdProduzir || Number(qtdProduzir) <= 0) {
        return res.status(400).json({ error: "programaId, materialId e qtdProduzir (> 0) são obrigatórios" });
      }
      try {
        const rows = await sql`
          INSERT INTO programa_itens (programa_id, material_id, qtd_produzir)
          VALUES (${programaId}, ${materialId}, ${qtdProduzir})
          ON CONFLICT (programa_id, material_id) DO UPDATE SET qtd_produzir = ${qtdProduzir}
          RETURNING *
        `;
        return res.status(201).json(rows[0]);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    if (req.method === "DELETE") {
      const { itemId } = getBody(req);
      if (!itemId) return res.status(400).json({ error: "itemId é obrigatório" });
      try {
        const rows = await sql`DELETE FROM programa_itens WHERE id = ${itemId} RETURNING id`;
        if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    return res.status(405).json({ error: "Método não permitido" });
  }

  // ---------- cabeçalho do programa (padrão) ----------
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
