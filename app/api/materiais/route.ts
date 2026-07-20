export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { Material } from "@/lib/types";

export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get("tipo");
  const rows = tipo
    ? await sql`SELECT * FROM materiais WHERE tipo = ${tipo} ORDER BY codigo`
    : await sql`SELECT * FROM materiais ORDER BY codigo`;
  return NextResponse.json(rows as Material[]);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { codigo, descricao, umc, tipo } = body;

  if (!codigo || !descricao) {
    return NextResponse.json(
      { error: "codigo e descricao são obrigatórios" },
      { status: 400 }
    );
  }

  const rows = await sql`
    INSERT INTO materiais (codigo, descricao, umc, tipo)
    VALUES (${codigo}, ${descricao}, ${umc ?? "PC"}, ${tipo ?? "componente"})
    RETURNING *
  `;
  return NextResponse.json(rows[0] as Material, { status: 201 });
}