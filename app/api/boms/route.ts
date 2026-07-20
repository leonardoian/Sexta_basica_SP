export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const materialId = req.nextUrl.searchParams.get("materialId");

  const rows = materialId
    ? await sql`
        SELECT b.*, m.codigo AS material_codigo, m.descricao AS material_descricao
        FROM boms b
        JOIN materiais m ON m.id = b.material_id
        WHERE b.material_id = ${materialId}
      `
    : await sql`
        SELECT b.*, m.codigo AS material_codigo, m.descricao AS material_descricao
        FROM boms b
        JOIN materiais m ON m.id = b.material_id
        ORDER BY m.codigo
      `;

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { materialId } = body;

  if (!materialId) {
    return NextResponse.json({ error: "materialId é obrigatório" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO boms (material_id)
    VALUES (${materialId})
    ON CONFLICT (material_id) DO UPDATE SET atualizado_em = now()
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}