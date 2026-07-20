export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { parseBomSheet } from "@/lib/import/bom";

// Estrutura provisória: o código do acabado é informado junto do upload
// (campo materialCodigo) até sabermos exatamente onde ele aparece no
// layout exportado do SAP.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const materialCodigo = form.get("materialCodigo");

  if (!(file instanceof File) || typeof materialCodigo !== "string" || !materialCodigo) {
    return NextResponse.json(
      { error: "arquivo e materialCodigo são obrigatórios" },
      { status: 400 }
    );
  }

  const materialRows = await sql`
    SELECT id FROM materiais WHERE codigo = ${materialCodigo}
  `;
  if (materialRows.length === 0) {
    return NextResponse.json(
      { error: `material acabado ${materialCodigo} não encontrado` },
      { status: 404 }
    );
  }
  const materialId = materialRows[0].id;

  const bomRows = await sql`
    INSERT INTO boms (material_id)
    VALUES (${materialId})
    ON CONFLICT (material_id) DO UPDATE SET atualizado_em = now()
    RETURNING id
  `;
  const bomId = bomRows[0].id;

  const buffer = await file.arrayBuffer();
  const { itens } = parseBomSheet(buffer, materialCodigo);

  let importados = 0;
  const naoEncontrados: string[] = [];

  for (const item of itens) {
    const componenteRows = await sql`
      SELECT id FROM materiais WHERE codigo = ${item.componenteCodigo}
    `;
    if (componenteRows.length === 0) {
      naoEncontrados.push(item.componenteCodigo);
      continue;
    }
    const componenteId = componenteRows[0].id;
    await sql`
      INSERT INTO bom_itens (bom_id, componente_id, pcs_por_umc)
      VALUES (${bomId}, ${componenteId}, ${item.pcsPorUmc})
      ON CONFLICT (bom_id, componente_id) DO UPDATE SET pcs_por_umc = ${item.pcsPorUmc}
    `;
    importados++;
  }

  return NextResponse.json({
    bomId,
    total: itens.length,
    importados,
    naoEncontrados,
  });
}