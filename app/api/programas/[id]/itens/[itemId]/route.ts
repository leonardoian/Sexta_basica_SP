export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const body = await req.json();
  const { qtdProduzir } = body;

  if (!qtdProduzir || Number(qtdProduzir) <= 0) {
    return NextResponse.json({ error: "qtdProduzir (> 0) é obrigatório" }, { status: 400 });
  }

  const rows = await sql`
    UPDATE programa_itens
    SET qtd_produzir = ${qtdProduzir}
    WHERE id = ${params.itemId} AND programa_id = ${params.id}
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
    DELETE FROM programa_itens WHERE id = ${params.itemId} AND programa_id = ${params.id}
    RETURNING id
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}