# Planej. Compras

Planejamento de necessidade de compras a partir de listas técnicas (BOM). A
partir de um programa de produção (várias referências + quantidades), o
sistema explode a BOM de 1 nível de cada referência, soma as necessidades por
componente, aplica um multiplicador de "meses de estoque" e mostra o que
falta comprar (necessidade − estoque atual) — com acompanhamento dos pedidos
de compra feitos pra cada item.

## Funcionalidades

- **Materiais**: cadastro de acabados e componentes, com busca.
- **Nova referência**: cadastra um acabado e a lista técnica completa numa
  única tela.
- **Lista técnica (BOM)**: edita item a item, ou importa de planilha.
- **Estoque**: quantidade atual por componente; importa de planilha simples
  ou por depósito (soma vários depósitos num total).
- **Programa de produção**: quais referências produzir e quanto.
- **Resultado**: necessidade × estoque × a comprar, com:
  - multiplicador de "meses de estoque" (recalcula no navegador, sem ida ao
    servidor);
  - busca por item e filtro por status de pedido;
  - **pedidos de compra** por item — vários pedidos por componente, cada um
    com número, quantidade pedida, previsão de chegada e status de entrega;
  - exportação pra Excel.
- **Importar Programa**: ferramenta de importação em lote — reconhece tanto
  um modelo simples (abas REFERENCIAS/PROGRAMA) quanto um export direto do
  SAP (aba "LISTA TECNICA", programa mensal, estoque por depósito).
- **Usuários**: login/senha (JWT), criação de usuários e troca de senha.

## Stack

- **Vercel Functions** (Node.js) em `api/*.mjs` — sem framework, sem build
  step.
- **Neon (Postgres)** via `@neondatabase/serverless`, SQL puro (tagged
  templates + `unnest()` pra upsert em lote nas importações grandes).
- **Frontend estático** em `public/*.html` — HTML/CSS/JS puro, um
  `<script>` inline por página, sem bundler.
- **SheetJS (xlsx)** pra ler/gerar planilhas, tanto no servidor quanto no
  navegador.
- **JWT + bcrypt** pra autenticação.

## Estrutura

```
api/
  _lib/
    db.mjs            # conexão Neon, auth (JWT), initDB() idempotente (cria as tabelas se não existirem)
    import.mjs         # parsers de planilha (estoque simples, estoque por depósito, BOM, lista técnica SAP)
  auth.mjs              # login (POST) e "quem sou eu" (GET)
  materiais.mjs         # CRUD de materiais (acabados e componentes)
  referencias.mjs       # cadastra acabado + BOM completa numa chamada só
  boms.mjs              # cabeçalho de BOM + ?recurso=itens (CRUD) + ?recurso=importar + ?recurso=lista-tecnica
  estoque.mjs           # listar/editar estoque + ?recurso=importar-simples + ?recurso=importar-depositos
  programas.mjs         # cabeçalho de programa + ?recurso=itens (CRUD)
  pedidos.mjs           # pedidos de compra por (programa, componente) — vários por item
  calculo.mjs           # necessidade × estoque × a comprar de um programa
  usuarios.mjs          # CRUD de usuários + ?recurso=senha (trocar a própria senha)
public/
  index.html            # início (atalhos)
  login.html
  referencias.html      # cadastro de referência + lista técnica
  materiais.html
  boms.html              # editar lista técnica de uma referência já cadastrada
  estoque.html
  programas.html
  resultado.html
  usuarios.html
  importar.html          # importação em lote (modelo simples ou export do SAP)
  app.js                 # sidebar/topbar compartilhados, auth, fetch helpers (api/apiUpload), busca, combo, toast
  style.css
  favicon.svg
db/
  schema.sql             # documentação do schema principal — a criação real acontece via initDB() em api/_lib/db.mjs
  calculo.sql            # documentação da query de cálculo (embutida em api/calculo.mjs)
lib/
  calculo.js             # núcleo do cálculo em JS puro, com testes
test/
  calculo.test.mjs
scripts/
  dev-server.mjs         # servidor local só de desenvolvimento (serve public/ + despacha api/*.mjs)
```

> Os arquivos em `api/` ficam consolidados por assunto (ex: `boms.mjs`
> cobre cabeçalho, itens, import simples e import SAP) usando `?recurso=`
> como sub-rota, em vez de um arquivo por operação — o plano Hobby da
> Vercel tem limite de 12 Serverless Functions, e essa organização mantém
> o projeto bem abaixo disso.

## Rodando localmente

```bash
cp .env.example .env.local   # cole sua DATABASE_URL do Neon e defina um JWT_SECRET
npm install
npm run dev                  # sobe um servidor local em :3000 (api/ + public/)
npm test                     # roda os testes do núcleo de cálculo
```

`npm run dev` usa `scripts/dev-server.mjs`, um servidor Node simples que
serve `public/` como estático e despacha `/api/*` pros handlers em
`api/*.mjs` — só pra desenvolvimento local, não é usado em produção. As
tabelas são criadas automaticamente (`CREATE TABLE IF NOT EXISTS`) na
primeira chamada a qualquer endpoint, e ficam em cache pro resto da vida da
instância (evita pagar esse custo em toda request).

## Login

O sistema pede usuário/senha (`/login.html`) — todas as rotas de API (exceto
o login em si) exigem um token válido (JWT, header
`Authorization: Bearer ...`). No primeiro acesso, se a tabela `usuarios`
estiver vazia, um usuário `admin` / `admin123` é criado automaticamente —
troque a senha assim que entrar, na tela **Usuários**.

## Deploy

Hospedado na Vercel: conecte o repositório, configure `DATABASE_URL` e
`JWT_SECRET` nas Environment Variables do projeto (o `.env.local` é
ignorado pelo git, então precisa cadastrar essas duas manualmente no
painel), e deploy. Não há passo de build — os arquivos em `api/` viram
functions automaticamente e `public/` é servido como estático
(`vercel.json` desliga a detecção de framework).

## Regras de negócio

- **BOM de 1 nível**: cada acabado tem uma lista de componentes com
  `pcs_por_umc` (quantas peças produzidas consomem 1 unidade de compra do
  componente). Necessidade do componente = `Σ ceil(qtd_produzir / pcs_por_umc)`
  por referência que o usa.
- **A comprar** = `max(0, necessidade_ajustada − estoque_atual)`, onde a
  necessidade ajustada já passou pelo multiplicador de "meses de estoque"
  (aplicado no navegador, não recalcula no servidor).
- **Import SAP**: o parser de "LISTA TECNICA" deriva `pcs_por_umc` como
  `1 / CONS.Unit`, arredondando pro inteiro mais próximo só quando a
  diferença é muito pequena (evita corromper proporções genuinamente
  fracionárias, como itens medidos em KG).
