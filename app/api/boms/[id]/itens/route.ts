export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const itens = await sql`
    SELECT bi.*, c.codigo AS componente_codigo, c.descricao AS componente_descricao, c.umc AS componente_umc
    FROM bom_itens bi
    JOIN materiais c ON c.id = bi.componente_id
    WHERE bi.bom_id = ${params.id}
    ORDER BY c.codigo
  `;
  return NextResponse.json(itens);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { componenteId, pcsPorUmc } = body;

  if (!componenteId || !pcsPorUmc || Number(pcsPorUmc) <= 0) {
    return NextResponse.json(
      { error: "componenteId e pcsPorUmc (> 0) são obrigatórios" },
      { status: 400 }
    );
  }

  const rows = await sql`
    INSERT INTO bom_itens (bom_id, componente_id, pcs_por_umc)
    VALUES (${params.id}, ${componenteId}, ${pcsPorUmc})
    ON CONFLICT (bom_id, componente_id) DO UPDATE SET pcs_por_umc = ${pcsPorUmc}
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}