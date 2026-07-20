import { neon } from "@neondatabase/serverless";

export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    setCors(res);
    res.status(200).end();
    return true;
  }
  return false;
}

export function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export function getSQL() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
  return neon(process.env.DATABASE_URL);
}

// Mesmo schema de db/schema.sql, em versão idempotente (IF NOT EXISTS) —
// roda a cada request, então o deploy não depende de um passo de migração.
export async function initDB(sql) {
  await sql`CREATE TABLE IF NOT EXISTS materiais (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      TEXT NOT NULL UNIQUE,
    descricao   TEXT NOT NULL,
    umc         TEXT NOT NULL DEFAULT 'PC',
    tipo        TEXT NOT NULL DEFAULT 'componente'
                CHECK (tipo IN ('acabado','componente')),
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS boms (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    material_id  BIGINT NOT NULL UNIQUE REFERENCES materiais(id) ON DELETE CASCADE,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS bom_itens (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bom_id        BIGINT NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    componente_id BIGINT NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
    pcs_por_umc   NUMERIC(14,4) NOT NULL CHECK (pcs_por_umc > 0),
    UNIQUE (bom_id, componente_id)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS estoque (
    material_id   BIGINT PRIMARY KEY REFERENCES materiais(id) ON DELETE CASCADE,
    qtd_atual     NUMERIC(14,2) NOT NULL DEFAULT 0,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS programas (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'rascunho'
               CHECK (status IN ('rascunho','calculado','fechado')),
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS programa_itens (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    programa_id  BIGINT NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
    material_id  BIGINT NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
    qtd_produzir NUMERIC(14,2) NOT NULL CHECK (qtd_produzir > 0),
    UNIQUE (programa_id, material_id)
  )`;

  await sql`CREATE INDEX IF NOT EXISTS idx_bom_itens_bom        ON bom_itens(bom_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bom_itens_componente ON bom_itens(componente_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prog_itens_programa  ON programa_itens(programa_id)`;
}
