export const dynamic = "force-dynamic";

import { setCors, handleOptions, getBody, getSQL, initDB, getAuth } from "./_lib/db.mjs";

// Acompanhamento manual de pedidos de compra por (programa, componente).
// Um componente pode ter vários pedidos (parciais, fornecedores diferentes).
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
      const rows = await sql`
        SELECT * FROM pedidos_compra WHERE programa_id = ${programaId} ORDER BY criado_em
      `;
      return res.status(200).json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    const { programaId, materialId, numeroPedido, qtdPedida, previsaoEntrega } = getBody(req);
    if (!programaId || !materialId) {
      return res.status(400).json({ error: "programaId e materialId são obrigatórios" });
    }
    try {
      const rows = await sql`
        INSERT INTO pedidos_compra (programa_id, material_id, numero_pedido, qtd_pedida, previsao_entrega)
        VALUES (${programaId}, ${materialId}, ${numeroPedido || null}, ${qtdPedida || null}, ${previsaoEntrega || null})
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "PUT") {
    const body = getBody(req);
    const { id } = body;
    if (!id) return res.status(400).json({ error: "id é obrigatório" });
    try {
      // busca o valor atual e só troca os campos que vieram no corpo —
      // permite tanto atualizar só "entregue" (sem mexer no resto) quanto
      // editar os campos e realmente limpar um deles (valor vazio = null),
      // o que COALESCE não conseguia diferenciar de "não mandei esse campo".
      const atualRows = await sql`SELECT * FROM pedidos_compra WHERE id = ${id}`;
      if (atualRows.length === 0) return res.status(404).json({ error: "não encontrado" });
      const atual = atualRows[0];

      const numeroPedido = "numeroPedido" in body ? body.numeroPedido || null : atual.numero_pedido;
      const qtdPedida = "qtdPedida" in body ? body.qtdPedida ?? null : atual.qtd_pedida;
      const previsaoEntrega = "previsaoEntrega" in body ? body.previsaoEntrega || null : atual.previsao_entrega;
      const entregue = "entregue" in body ? !!body.entregue : atual.entregue;

      const rows = await sql`
        UPDATE pedidos_compra SET
          numero_pedido = ${numeroPedido},
          qtd_pedida = ${qtdPedida},
          previsao_entrega = ${previsaoEntrega},
          entregue = ${entregue},
          atualizado_em = now()
        WHERE id = ${id}
        RETURNING *
      `;
      return res.status(200).json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "DELETE") {
    const { id } = getBody(req);
    if (!id) return res.status(400).json({ error: "id é obrigatório" });
    try {
      const rows = await sql`DELETE FROM pedidos_compra WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
