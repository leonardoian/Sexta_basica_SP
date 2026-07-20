export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const body = await req.json();
  const { pcsPorUmc } = body;

  if (!pcsPorUmc || Number(pcsPorUmc) <= 0) {
    return NextResponse.json({ error: "pcsPorUmc (> 0) é obrigatório" }, { status: 400 });
  }

  const rows = await sql`
    UPDATE bom_itens
    SET pcs_por_umc = ${pcsPorUmc}
    WHERE id = ${params.itemId} AND bom_id = ${params.id}
    RETURNING *
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const rows = await sql`
    DELETE FROM bom_itens WHERE id = ${params.itemId} AND bom_id = ${params.id}
    RETURNING id
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}