export const dynamic = "force-dynamic";

import { setCors, handleOptions, getBody, getSQL, initDB, getAuth } from "./_lib/db.mjs";
import { parseEstoqueSheet, parseEstoquePorDeposito } from "./_lib/import.mjs";

// Junta em um arquivo só: listar/editar estoque, importar planilha simples
// e importar por depósito (eram 3 arquivos separados) — só pra ficar dentro
// do limite de 12 Serverless Functions do plano Hobby da Vercel. Lógica
// igual à de antes, diferenciada pela query ?recurso=.
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

  const recurso = req.query.recurso;

  // ---------- importar planilha simples (1 aba, sem depósito) ----------
  if (recurso === "importar-simples") {
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
    const { contentBase64 } = getBody(req);
    if (!contentBase64) return res.status(400).json({ error: "contentBase64 é obrigatório" });

    try {
      const buffer = Buffer.from(contentBase64, "base64");
      const linhas = parseEstoqueSheet(buffer);

      let atualizados = 0;
      let criados = 0;

      for (const linha of linhas) {
        const materialRows = await sql`SELECT id FROM materiais WHERE codigo = ${linha.codigo}`;
        let materialId;

        if (materialRows.length === 0) {
          const novoRows = await sql`
            INSERT INTO materiais (codigo, descricao, umc, tipo)
            VALUES (${linha.codigo}, ${linha.descricao || linha.codigo}, ${linha.umc || "PC"}, 'componente')
            RETURNING id
          `;
          materialId = novoRows[0].id;
          criados++;
        } else {
          materialId = materialRows[0].id;
        }

        await sql`
          INSERT INTO estoque (material_id, qtd_atual, atualizado_em)
          VALUES (${materialId}, ${linha.estoque}, now())
          ON CONFLICT (material_id) DO UPDATE SET qtd_atual = ${linha.estoque}, atualizado_em = now()
        `;
        atualizados++;
      }

      return res.status(200).json({ total: linhas.length, atualizados, criados });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ---------- importar por depósito (varre todas as abas do arquivo) ----------
  if (recurso === "importar-depositos") {
    if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
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

  // ---------- listar / atualizar (padrão) ----------
  if (req.method === "GET") {
    try {
      const rows = await sql`
        SELECT m.id AS material_id, m.codigo, m.descricao, m.umc,
               COALESCE(e.qtd_atual, 0) AS qtd_atual, e.atualizado_em
        FROM materiais m
        LEFT JOIN estoque e ON e.material_id = m.id
        WHERE m.tipo = 'componente'
        ORDER BY m.codigo
      `;
      return res.status(200).json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    const { materialId, qtdAtual } = getBody(req);
    if (!materialId || qtdAtual === undefined || Number(qtdAtual) < 0) {
      return res.status(400).json({ error: "materialId e qtdAtual (>= 0) são obrigatórios" });
    }
    try {
      const rows = await sql`
        INSERT INTO estoque (material_id, qtd_atual, atualizado_em)
        VALUES (${materialId}, ${qtdAtual}, now())
        ON CONFLICT (material_id) DO UPDATE SET qtd_atual = ${qtdAtual}, atualizado_em = now()
        RETURNING *
      `;
      return res.status(200).json(rows[0]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
