export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const bomRows = await sql`
    SELECT b.*, m.codigo AS material_codigo, m.descricao AS material_descricao
    FROM boms b
    JOIN materiais m ON m.id = b.material_id
    WHERE b.id = ${params.id}
  `;
  if (bomRows.length === 0) {
    return NextResponse.json({ error: "não encontrada" }, { status: 404 });
  }

  const itens = await sql`
    SELECT bi.*, c.codigo AS componente_codigo, c.descricao AS componente_descricao, c.umc AS componente_umc
    FROM bom_itens bi
    JOIN materiais c ON c.id = bi.componente_id
    WHERE bi.bom_id = ${params.id}
    ORDER BY c.codigo
  `;

  return NextResponse.json({ ...bomRows[0], itens });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rows = await sql`DELETE FROM boms WHERE id = ${params.id} RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}