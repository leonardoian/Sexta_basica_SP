export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const programaRows = await sql`SELECT * FROM programas WHERE id = ${params.id}`;
  if (programaRows.length === 0) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  const itens = await sql`
    SELECT pi.*, m.codigo AS material_codigo, m.descricao AS material_descricao
    FROM programa_itens pi
    JOIN materiais m ON m.id = pi.material_id
    WHERE pi.programa_id = ${params.id}
    ORDER BY m.codigo
  `;

  return NextResponse.json({ ...programaRows[0], itens });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { nome, status } = body;

  const rows = await sql`
    UPDATE programas
    SET nome = COALESCE(${nome}, nome), status = COALESCE(${status}, status)
    WHERE id = ${params.id}
    RETURNING *
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rows = await sql`DELETE FROM programas WHERE id = ${params.id} RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}