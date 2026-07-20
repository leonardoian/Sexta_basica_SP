import { setCors, handleOptions, getBody, getSQL, initDB } from "./_lib/db.mjs";

// Cadastra a referência (acabado) e a lista técnica inteira em uma única
// chamada: cria/atualiza o material acabado, cria a BOM e insere cada item,
// criando componentes novos na hora se ainda não estiverem cadastrados.
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

  const { codigo, descricao, umc, itens } = getBody(req);

  if (!codigo || !descricao) {
    return res.status(400).json({ error: "codigo e descricao da referência são obrigatórios" });
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: "informe ao menos um item da lista técnica" });
  }
  for (const item of itens) {
    const temComponente = item.componenteId || item.componenteCodigo;
    if (!temComponente || !item.pcsPorUmc || Number(item.pcsPorUmc) <= 0) {
      return res.status(400).json({ error: "cada item precisa de um componente e pcsPorUmc (> 0)" });
    }
  }

  try {
    const materialRows = await sql`
      INSERT INTO materiais (codigo, descricao, umc, tipo)
      VALUES (${codigo}, ${descricao}, ${umc ?? "PC"}, 'acabado')
      ON CONFLICT (codigo) DO UPDATE
        SET descricao = ${descricao}, umc = ${umc ?? "PC"}, tipo = 'acabado'
      RETURNING id
    `;
    const materialId = materialRows[0].id;

    const bomRows = await sql`
      INSERT INTO boms (material_id)
      VALUES (${materialId})
      ON CONFLICT (material_id) DO UPDATE SET atualizado_em = now()
      RETURNING id
    `;
    const bomId = bomRows[0].id;

    const itensCriados = [];
    for (const item of itens) {
      let componenteId = item.componenteId;

      if (!componenteId) {
        const componenteRows = await sql`
          INSERT INTO materiais (codigo, descricao, umc, tipo)
          VALUES (
            ${item.componenteCodigo},
            ${item.componenteDescricao || item.componenteCodigo},
            ${item.componenteUmc ?? "PC"},
            'componente'
          )
          ON CONFLICT (codigo) DO UPDATE SET descricao = materiais.descricao
          RETURNING id
        `;
        componenteId = componenteRows[0].id;
      }

      const bomItemRows = await sql`
        INSERT INTO bom_itens (bom_id, componente_id, pcs_por_umc)
        VALUES (${bomId}, ${componenteId}, ${item.pcsPorUmc})
        ON CONFLICT (bom_id, componente_id) DO UPDATE SET pcs_por_umc = ${item.pcsPorUmc}
        RETURNING id, componente_id, pcs_por_umc
      `;
      itensCriados.push(bomItemRows[0]);
    }

    return res.status(201).json({ materialId, bomId, itens: itensCriados });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
