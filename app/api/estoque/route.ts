export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const rows = await sql`
    SELECT m.id AS material_id, m.codigo, m.descricao, m.umc,
           COALESCE(e.qtd_atual, 0) AS qtd_atual, e.atualizado_em
    FROM materiais m
    LEFT JOIN estoque e ON e.material_id = m.id
    ORDER BY m.codigo
  `;
  return NextResponse.json(rows);
}