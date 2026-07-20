export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const itens = await sql`
    SELECT pi.*, m.codigo AS material_codigo, m.descricao AS material_descricao
    FROM programa_itens pi
    JOIN materiais m ON m.id = pi.material_id
    WHERE pi.programa_id = ${params.id}
    ORDER BY m.codigo
  `;
  return NextResponse.json(itens);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { materialId, qtdProduzir } = body;

  if (!materialId || !qtdProduzir || Number(qtdProduzir) <= 0) {
    return NextResponse.json(
      { error: "materialId e qtdProduzir (> 0) são obrigatórios" },
      { status: 400 }
    );
  }

  const rows = await sql`
    INSERT INTO programa_itens (programa_id, material_id, qtd_produzir)
    VALUES (${params.id}, ${materialId}, ${qtdProduzir})
    ON CONFLICT (programa_id, material_id) DO UPDATE SET qtd_produzir = ${qtdProduzir}
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}