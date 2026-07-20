export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { Material } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rows = await sql`SELECT * FROM materiais WHERE id = ${params.id}`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  return NextResponse.json(rows[0] as Material);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { codigo, descricao, umc, tipo } = body;

  const rows = await sql`
    UPDATE materiais
    SET codigo = ${codigo}, descricao = ${descricao}, umc = ${umc}, tipo = ${tipo}
    WHERE id = ${params.id}
    RETURNING *
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  return NextResponse.json(rows[0] as Material);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rows = await sql`DELETE FROM materiais WHERE id = ${params.id} RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}