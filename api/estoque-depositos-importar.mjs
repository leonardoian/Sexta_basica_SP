export const dynamic = "force-dynamic";

import { setCors, handleOptions, getBody, getSQL, initDB } from "./_lib/db.mjs";
import { parseEstoquePorDeposito } from "./_lib/import.mjs";

// Importa estoque separado por depósito (varre todas as abas do arquivo,
// ex: 0802/0805/0806). Grava o saldo de cada depósito em estoque_depositos
// e recalcula estoque.qtd_atual (o total, usado no cálculo de compra) como
// a soma de todos os depósitos daquele material — inclusive os que não
// vieram nesta importação, então dá pra alimentar um depósito de cada vez
// em uploads diferentes sem perder o que já tinha nos outros.
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
    const linhas = parseEstoquePorDeposito(buffer);
    if (linhas.length === 0) {
      return res.status(400).json({
        error: "nenhuma aba com formato de estoque (código + saldo) foi reconhecida no arquivo",
      });
    }

    // materiais únicos — cria os que faltam como componente, sem sobrescrever os já cadastrados
    const materiaisMap = new Map();
    for (const l of linhas) {
      if (!materiaisMap.has(l.codigo)) {
        materiaisMap.set(l.codigo, { descricao: l.descricao || l.codigo, umc: l.umc || "PC" });
      }
    }
    const codigos = [...materiaisMap.keys()];
    await sql(
      `INSERT INTO materiais (codigo, descricao, umc, tipo)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
       ON CONFLICT (codigo) DO NOTHING`,
      [
        codigos,
        codigos.map((c) => materiaisMap.get(c).descricao),
        codigos.map((c) => materiaisMap.get(c).umc),
        codigos.map(() => "componente"),
      ]
    );

    const materiaisRows = await sql(
      `SELECT id, codigo FROM materiais WHERE codigo = ANY($1::text[])`,
      [codigos]
    );
    const idPorCodigo = new Map(materiaisRows.map((m) => [m.codigo, m.id]));

    // dedup por (material, depósito) — a última ocorrência no arquivo vence
    const porChave = new Map();
    for (const l of linhas) {
      const materialId = idPorCodigo.get(l.codigo);
      if (!materialId) continue;
      porChave.set(`${materialId}|${l.deposito}`, { materialId, deposito: l.deposito, estoque: l.estoque });
    }
    const registros = [...porChave.values()];

    if (registros.length > 0) {
      await sql(
        `INSERT INTO estoque_depositos (material_id, deposito, qtd_atual, atualizado_em)
         SELECT m, d, q, now()
         FROM unnest($1::bigint[], $2::text[], $3::numeric[]) AS t(m, d, q)
         ON CONFLICT (material_id, deposito) DO UPDATE SET qtd_atual = EXCLUDED.qtd_atual, atualizado_em = now()`,
        [
          registros.map((r) => r.materialId),
          registros.map((r) => r.deposito),
          registros.map((r) => r.estoque),
        ]
      );
    }

    const materiaisAfetados = [...new Set(registros.map((r) => r.materialId))];
    if (materiaisAfetados.length > 0) {
      await sql(
        `INSERT INTO estoque (material_id, qtd_atual, atualizado_em)
         SELECT material_id, SUM(qtd_atual), now()
         FROM estoque_depositos
         WHERE material_id = ANY($1::bigint[])
         GROUP BY material_id
         ON CONFLICT (material_id) DO UPDATE SET qtd_atual = EXCLUDED.qtd_atual, atualizado_em = now()`,
        [materiaisAfetados]
      );
    }

    const depositos = [...new Set(linhas.map((l) => l.deposito))];
    return res.status(200).json({
      totalLinhas: linhas.length,
      depositos,
      materiaisAtualizados: materiaisAfetados.length,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
