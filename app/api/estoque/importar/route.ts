export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { parseEstoqueSheet } from "@/lib/import/estoque";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "arquivo não enviado" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const linhas = parseEstoqueSheet(buffer);

  let atualizados = 0;
  const naoEncontrados: string[] = [];

  for (const linha of linhas) {
    const materialRows = await sql`
      SELECT id FROM materiais WHERE codigo = ${linha.codigo}
    `;
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

  return NextResponse.json({
    total: linhas.length,
    atualizados,
    naoEncontrados,
  });
}