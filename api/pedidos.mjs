export const dynamic = "force-dynamic";

import { setCors, handleOptions, getBody, getSQL, initDB, getAuth } from "./_lib/db.mjs";

// Acompanhamento manual de pedido de compra por (programa, componente):
// se já foi feito, número do pedido, quantidade pedida e previsão de chegada.
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

  if (req.method === "GET") {
    const { programaId } = req.query;
    if (!programaId) return res.status(400).json({ error: "programaId é obrigatório" });
    try {
      const rows = await sql`SELECT * FROM pedidos_compra WHERE programa_id = ${programaId}`;
      return res.status(200).json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    const { programaId, materialId, feito, numeroPedido, qtdPedida, previsaoEntrega } = getBody(req);
    if (!programaId || !materialId) {
      return res.status(400).json({ error: "programaId e materialId são obrigatórios" });
    }
    try {
      const rows = await sql`
        INSERT INTO pedidos_compra (programa_id, material_id, feito, numero_pedido, qtd_pedida, previsao_entrega, atualizado_em)
        VALUES (${programaId}, ${materialId}, ${!!feito}, ${numeroPedido || null}, ${qtdPedida || null}, ${previsaoEntrega || null}, now())
        ON CONFLICT (programa_id, material_id) DO UPDATE SET
          feito = ${!!feito},
          numero_pedido = ${numeroPedido || null},
          qtd_pedida = ${qtdPedida || null},
          previsao_entrega = ${previsaoEntrega || null},
          atualizado_em = now()
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
