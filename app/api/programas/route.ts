export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const rows = await sql`SELECT * FROM programas ORDER BY criado_em DESC`;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nome } = body;

  if (!nome) {
    return NextResponse.json({ error: "nome é obrigatório" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO programas (nome)
    VALUES (${nome})
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}