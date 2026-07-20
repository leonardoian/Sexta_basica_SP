export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

interface ItemPayload {
  componenteId?: number;
  componenteCodigo?: string;
  componenteDescricao?: string;
  componenteUmc?: string;
  pcsPorUmc: number;
}

// Cadastra a referência (acabado) e a lista técnica inteira em uma única
// chamada: cria/atualiza o material acabado, cria a BOM e insere cada item,
// criando componentes novos na hora se ainda não estiverem cadastrados.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { codigo, descricao, umc, itens } = body as {
    codigo: string;
    descricao: string;
    umc?: string;
    itens: ItemPayload[];
  };

  if (!codigo || !descricao) {
    return NextResponse.json(
      { error: "codigo e descricao da referência são obrigatórios" },
      { status: 400 }
    );
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json(
      { error: "informe ao menos um item da lista técnica" },
      { status: 400 }
    );
  }
  for (const item of itens) {
    const temComponente = item.componenteId || item.componenteCodigo;
    if (!temComponente || !item.pcsPorUmc || Number(item.pcsPorUmc) <= 0) {
      return NextResponse.json(
        { error: "cada item precisa de um componente e pcsPorUmc (> 0)" },
        { status: 400 }
      );
    }
  }

  const materialRows = await sql`
    INSERT INTO materiais (codigo, descricao, umc, tipo)
    VALUES (${codigo}, ${descricao}, ${umc ?? "PC"}, 'acabado')
    ON CONFLICT (codigo) DO UPDATE
      SET descricao = ${descricao}, umc = ${umc ?? "PC"}, tipo = 'acabado'
    RETURNING id
  `;
  const materialId = materialRows[0].id;

  const bomRows = await sql`
    INSERT INTO boms (material_id)
    VALUES (${materialId})
    ON CONFLICT (material_id) DO UPDATE SET atualizado_em = now()
    RETURNING id
  `;
  const bomId = bomRows[0].id;

  const itensCriados = [];
  for (const item of itens) {
    let componenteId = item.componenteId;

    if (!componenteId) {
      const componenteRows = await sql`
        INSERT INTO materiais (codigo, descricao, umc, tipo)
        VALUES (
          ${item.componenteCodigo},
          ${item.componenteDescricao || item.componenteCodigo},
          ${item.componenteUmc ?? "PC"},
          'componente'
        )
        ON CONFLICT (codigo) DO UPDATE SET descricao = materiais.descricao
        RETURNING id
      `;
      componenteId = componenteRows[0].id;
    }

    const bomItemRows = await sql`
      INSERT INTO bom_itens (bom_id, componente_id, pcs_por_umc)
      VALUES (${bomId}, ${componenteId}, ${item.pcsPorUmc})
      ON CONFLICT (bom_id, componente_id) DO UPDATE SET pcs_por_umc = ${item.pcsPorUmc}
      RETURNING id, componente_id, pcs_por_umc
    `;
    itensCriados.push(bomItemRows[0]);
  }

  return NextResponse.json(
    { materialId, bomId, itens: itensCriados },
    { status: 201 }
  );
}
