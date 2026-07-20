export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "@/lib/db";

// lido uma vez por cold start; mesma query usada em db/calculo.sql
const CALCULO_SQL = readFileSync(
  path.join(process.cwd(), "db", "calculo.sql"),
  "utf8"
);

export async function GET(req: NextRequest) {
  const programaId = req.nextUrl.searchParams.get("programaId");

  if (!programaId) {
    return NextResponse.json({ error: "programaId é obrigatório" }, { status: 400 });
  }

  const rows = await sql(CALCULO_SQL, [programaId]);
  return NextResponse.json(rows);
}