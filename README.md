# Planej. Compras

Planejamento de necessidade de compras a partir de listas técnicas (BOM). A
partir de um programa de produção (várias referências + quantidades), o
sistema explode a BOM de 1 nível de cada referência, soma as necessidades por
componente e mostra o que falta comprar (necessidade − estoque atual).

## Stack

- **Vercel Functions** (Node.js) em `api/*.mjs` — sem framework, um arquivo por
  recurso.
- **Neon (Postgres)** via `@neondatabase/serverless`, SQL puro.
- **Frontend estático** em `public/*.html` — HTML/CSS/JS puro, sem build step.
- **SheetJS (xlsx)** para importar planilhas (estoque e BOM).

## Estrutura

```
api/
  _lib/
    db.mjs        # conexão Neon + initDB() idempotente (cria as tabelas se não existirem)
    import.mjs     # parsers de planilha (estoque e BOM)
  materiais.mjs
  referencias.mjs   # cadastra acabado + BOM completa em uma chamada
  boms.mjs
  bom-itens.mjs
  bom-importar.mjs
  estoque.mjs
  estoque-importar.mjs
  programas.mjs
  programa-itens.mjs
  calculo.mjs
public/
  index.html
  referencias.html  # cadastro de referência + lista técnica
  materiais.html
  boms.html
  estoque.html
  programas.html
  resultado.html
  style.css
  app.js            # nav compartilhada + helper fetch
db/
  schema.sql        # documentação do schema (a criação real acontece via initDB())
  calculo.sql        # documentação da query (embutida em api/calculo.mjs)
lib/
  calculo.js         # núcleo do cálculo em JS puro, com testes
test/
  calculo.test.mjs
```

## Rodando localmente

```bash
cp .env.example .env.local   # cole sua DATABASE_URL do Neon
npm install
npm run dev                  # sobe um servidor local em :3000 (api/ + public/)
npm test                     # roda os testes do núcleo de cálculo
```

O `npm run dev` usa `scripts/dev-server.mjs`, um servidor Node simples que
serve `public/` como estático e despacha `/api/*` pros handlers em `api/*.mjs`
— só para desenvolvimento local, não é usado em produção. As tabelas são
criadas automaticamente (`CREATE TABLE IF NOT EXISTS`) na primeira chamada a
qualquer endpoint.

## Deploy

Hospedado na Vercel: conecte o repositório, configure `DATABASE_URL` nas
Environment Variables do projeto, e deploy. Não há passo de build — os
arquivos em `api/` viram functions automaticamente e `public/` é servido como
estático.
