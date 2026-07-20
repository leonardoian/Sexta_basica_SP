export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: { materialId: string } }
) {
  const body = await req.json();
  const { qtdAtual } = body;

  if (qtdAtual === undefined || Number(qtdAtual) < 0) {
    return NextResponse.json({ error: "qtdAtual (>= 0) é obrigatório" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO estoque (material_id, qtd_atual, atualizado_em)
    VALUES (${params.materialId}, ${qtdAtual}, now())
    ON CONFLICT (material_id) DO UPDATE SET qtd_atual = ${qtdAtual}, atualizado_em = now()
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}