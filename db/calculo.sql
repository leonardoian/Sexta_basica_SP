-- ============================================================
-- Cálculo de necessidade de compra — direto no Postgres.
-- Parâmetro: $1 = programa_id
-- Estratégia: arredonda por item (CEIL antes de somar).
-- ============================================================

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
ORDER BY a_comprar DESC, c.codigo;
