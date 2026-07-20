-- ============================================================
-- PLANEJ. COMPRAS — Schema (Neon / Postgres)
-- ============================================================

-- Materiais: acabados e componentes ficam na mesma tabela
CREATE TABLE materiais (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      TEXT NOT NULL UNIQUE,          -- ex: '9057', '4002386'
  descricao   TEXT NOT NULL,
  umc         TEXT NOT NULL DEFAULT 'PC',    -- unidade de estoque/compra: PC, CX, KG...
  tipo        TEXT NOT NULL DEFAULT 'componente'
              CHECK (tipo IN ('acabado','componente')),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOM (lista técnica) — cabeçalho, 1 por material acabado
CREATE TABLE boms (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  material_id  BIGINT NOT NULL UNIQUE REFERENCES materiais(id) ON DELETE CASCADE,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens da BOM (1 nível). pcs_por_umc = quantas peças produzidas
-- consomem 1 unidade do componente. Ex: caixa 951 = 6 (6 pçs por caixa).
-- Para itens 1:1 (etiqueta, 1 por peça), pcs_por_umc = 1.
CREATE TABLE bom_itens (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bom_id        BIGINT NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
  componente_id BIGINT NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
  pcs_por_umc   NUMERIC(14,4) NOT NULL CHECK (pcs_por_umc > 0),
  UNIQUE (bom_id, componente_id)
);

-- Estoque atual por material
CREATE TABLE estoque (
  material_id   BIGINT PRIMARY KEY REFERENCES materiais(id) ON DELETE CASCADE,
  qtd_atual     NUMERIC(14,2) NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Programa de produção (cabeçalho)
CREATE TABLE programas (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'rascunho'
             CHECK (status IN ('rascunho','calculado','fechado')),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens do programa: quais refs produzir e quanto
CREATE TABLE programa_itens (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  programa_id  BIGINT NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  material_id  BIGINT NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
  qtd_produzir NUMERIC(14,2) NOT NULL CHECK (qtd_produzir > 0),
  UNIQUE (programa_id, material_id)
);

CREATE INDEX idx_bom_itens_bom        ON bom_itens(bom_id);
CREATE INDEX idx_bom_itens_componente ON bom_itens(componente_id);
CREATE INDEX idx_prog_itens_programa  ON programa_itens(programa_id);
