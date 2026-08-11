import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

function getJwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET não configurada");
  return process.env.JWT_SECRET;
}

export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "12h" });
}

// Lê o token do header Authorization: Bearer <token>. Retorna o payload
// (id, login, nome) se válido, ou null (token ausente, expirado ou inválido).
export function getAuth(req) {
  const h = req.headers?.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(h.slice(7), getJwtSecret());
  } catch {
    return null;
  }
}

export { bcrypt };

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
// não depende de um passo de migração separado no deploy. Só executa de
// fato na primeira chamada de cada instância "quente" da function (cada
// CREATE IF NOT EXISTS é uma viagem HTTP à parte pro Neon — ~1s no total —
// e não muda depois que as tabelas já existem, então cachear evita pagar
// esse custo em toda request).
let initPromise = null;

export function initDB(sql) {
  if (!initPromise) {
    initPromise = runInit(sql).catch((err) => {
      initPromise = null; // permite tentar de novo na próxima chamada se falhar
      throw err;
    });
  }
  return initPromise;
}

async function runInit(sql) {
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

  // Estoque por depósito (ex: 0802, 0805, 0806) — usado quando a planilha
  // real traz o saldo separado por depósito. "estoque.qtd_atual" continua
  // sendo o total (soma dos depósitos) e é o que o cálculo de compra usa;
  // esta tabela é só o detalhamento/origem desse total.
  await sql`CREATE TABLE IF NOT EXISTS estoque_depositos (
    material_id   BIGINT NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
    deposito      TEXT NOT NULL,
    qtd_atual     NUMERIC(14,2) NOT NULL DEFAULT 0,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (material_id, deposito)
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

  // Acompanhamento de pedidos de compra por (programa, componente). Um
  // componente pode ter vários pedidos (parciais, de fornecedores diferentes
  // etc.) — cada linha é um pedido: número, quantidade pedida, previsão de
  // chegada e se já foi entregue. Não é uma ordem de compra formal, só o
  // controle manual que o PCP preenche.
  await sql`CREATE TABLE IF NOT EXISTS pedidos_compra (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    programa_id       BIGINT NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
    material_id       BIGINT NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
    numero_pedido     TEXT,
    qtd_pedida        NUMERIC(14,2),
    previsao_entrega  DATE,
    entregue          BOOLEAN NOT NULL DEFAULT false,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  // migração: versão anterior permitia só 1 pedido por (programa, componente)
  // e usava um campo "feito" — agora vira lista, com "entregue" por pedido.
  await sql`ALTER TABLE pedidos_compra DROP CONSTRAINT IF EXISTS pedidos_compra_programa_id_material_id_key`;
  await sql`ALTER TABLE pedidos_compra ADD COLUMN IF NOT EXISTS entregue BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE pedidos_compra ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT now()`;
  await sql`ALTER TABLE pedidos_compra DROP COLUMN IF EXISTS feito`;

  await sql`CREATE INDEX IF NOT EXISTS idx_bom_itens_bom        ON bom_itens(bom_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bom_itens_componente ON bom_itens(componente_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prog_itens_programa  ON programa_itens(programa_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pedidos_programa     ON pedidos_compra(programa_id)`;

  await sql`CREATE TABLE IF NOT EXISTS usuarios (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    login       TEXT NOT NULL UNIQUE,
    senha_hash  TEXT NOT NULL,
    nome        TEXT NOT NULL,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  // primeiro acesso: cria um admin padrão se ainda não existir nenhum usuário
  const existente = await sql`SELECT id FROM usuarios LIMIT 1`;
  if (existente.length === 0) {
    const hash = await bcrypt.hash("admin123", 10);
    await sql`INSERT INTO usuarios (login, senha_hash, nome) VALUES ('admin', ${hash}, 'Administrador')`;
  }
}
