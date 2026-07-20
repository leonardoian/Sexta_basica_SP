import { setCors, handleOptions, getSQL, initDB } from "./_lib/db.mjs";

// Mesma query de db/calculo.sql, embutida aqui (em vez de lida do disco)
// pra não depender de nenhum passo extra de empacotamento no deploy.
const CALCULO_SQL = `
SELECT
  c.id                         AS componente_id,
  c.codigo                     AS componente_codigo,
  c.descricao                  AS componente_descricao,
  c.umc                        AS umc,
  SUM(CEIL(pi.qtd_produzir / bi.pcs_por_umc))          AS necessidade_total,
  COALESCE(e.qtd_atual, 0)                             AS estoque_atual,
  GREATEST(
    0,
    SUM(CEIL(pi.qtd_produzir / bi.pcs_por_umc)) - COALESCE(e.qtd_atual, 0)
  )                                                    AS a_comprar
FROM programa_itens pi
JOIN boms       b  ON b.material_id = pi.material_id
JOIN bom_itens  bi ON bi.bom_id = b.id
JOIN materiais  c  ON c.id = bi.componente_id
LEFT JOIN estoque e ON e.material_id = c.id
WHERE pi.programa_id = $1
GROUP BY c.id, c.codigo, c.descricao, c.umc, e.qtd_atual
ORDER BY a_comprar DESC, c.codigo
`;

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido" });

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

  const { programaId } = req.query;
  if (!programaId) return res.status(400).json({ error: "programaId é obrigatório" });

  try {
    const rows = await sql(CALCULO_SQL, [programaId]);
    return res.status(200).json(rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
