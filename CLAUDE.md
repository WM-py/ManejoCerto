# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

O código, os comentários e o domínio deste projeto são em português — escreva no mesmo idioma.

## Use npm, nunca pnpm

O `app/frontend/package.json` declara `"packageManager": "pnpm@8.10.0"` e o `.wiki.md` manda rodar `pnpm install`. **Ambos estão errados** — são resíduo do template gerador (ver `.mgx/`, `template_config.json`). Não existe `pnpm-lock.yaml`; o lockfile real é `package-lock.json`, e o `vercel.json` da raiz builda com `npm install`. Rodar pnpm ignora o lockfile e resolve uma árvore de dependências diferente da testada.

## Comandos

Tudo a partir de `app/frontend/`:

```bash
npm ci                              # instala respeitando o lockfile
npm run dev                         # dev server na porta 3000 (não 5173 — ver vite.config.ts)
npm run build                       # build de produção
npm run lint                        # eslint --quiet ./src
npm test                            # vitest run (suíte completa)
npx vitest run src/lib/dre.test.ts  # um arquivo só
npm run test:watch                  # modo watch
```

Avisos do npm sobre install scripts bloqueados (`esbuild`, `@swc/core`, `sharp`, `core-js`) são inofensivos — o esbuild recebe o binário nativo via dependência opcional e o build passa mesmo assim.

## Rodar sem credenciais

`VITE_PREVIEW_MOCK=true` no `.env` substitui o Supabase por um backend simulado em memória (`src/lib/mockSupabase.ts` + `mockData.ts`, ligados pelo bloco de mock em `src/lib/supabase.ts`). O app sobe inteiro com dados fictícios, sem nenhuma chave. Esses três pedaços são marcados como descartáveis no próprio código.

Sem o mock, o app precisa de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Arquitetura

Três executáveis independentes, sem workspace compartilhado:

| Onde | O quê |
|---|---|
| `app/frontend/` | SPA Vite + React 18 + TS + Tailwind + shadcn/ui. É o produto. |
| `backend/` | Serviço Python/FastAPI separado: ingestão de manejo por WhatsApp (texto e áudio) via OpenAI + Whisper. Pin de Python 3.12. Ver `backend/README.md`. |
| `app/backend/edge_functions/` | Edge functions Deno do Supabase (checkout Mercado Pago). |

### Nomes de tabela têm prefixo — sempre use as constantes

Toda tabela no Supabase é prefixada com `app_34b6ab49dc_`. **Nunca escreva o nome literal.** Use os mapas exportados de `src/lib/supabase.ts`:

- `TABLES` — tabelas. `pesagens` e `pesagens_lote` estão marcadas como legado a depreciar; o modelo atual é por animal (`animais`, `lote_animais`, `pesagem_eventos`, `pesagens_animal`).
- `VIEWS` — views somente leitura (GMD por animal/lote).
- `RPC` — funções do Postgres. Operações compostas (criar lote com animais, registrar pesagem/baixa/venda, excluir lote) são **RPC, não INSERT direto**.

### As páginas não falam com o Supabase

Elas falam com o repositório (`src/lib/repositories/loteRepo.ts`), que é o único ponto de acesso a dados de lote/pesagem/rebanho. Leituras retornam o dado (ou `[]`/`null`); escritas retornam void/id; erro sempre vira exceção. Ao adicionar acesso a dados, estenda o repositório — não importe `supabase` numa página.

### Offline-first: duas camadas distintas

**Leitura** — `src/lib/cache/readThrough.ts` sobre Dexie/IndexedDB (`cache/db.ts`, DB `manejo-certo`). Online busca na rede, grava no cache e devolve o fresco; se a rede falhar no meio, cai no cache; offline serve o cache direto. Falha de cache nunca quebra a leitura.

**Escrita** — fila outbox em `src/lib/sync/engine.ts`. `enqueue(kind, payload)` grava a intenção e:
- offline → projeta otimista no cache e resolve (nunca lança);
- online → tenta na hora. **Erro de negócio é propagado e a intenção é removida da fila** (a tela mostra o erro, nada fica pendente); **falha de rede fica na fila** e é redrenada.

`drain()` reexecuta em FIFO ao reconectar, com backoff (20s), teto de 5 tentativas e dead-letter (`status: 'failed'`). Uma COMPRA offline cria um lote com id temporário; ao sincronizar, `reconcileLoteTempId` troca pelo id real **e reescreve as intenções seguintes na fila que referenciam aquele lote** — quebrar isso corrompe silenciosamente lotes criados offline. Estado (`pending`/`failed`/`syncing`) sai por `subscribe`/`getSnapshot` e alimenta o badge do cabeçalho via `useSync`.

Ao adicionar um tipo de escrita: novo valor em `OutboxKind` (`cache/db.ts`), payload em `sync/types.ts`, execução em `sync/handlers.ts`, projeção em `sync/optimistic.ts`.

### Auth e acesso

`AuthContext` (`src/contexts/`) + dois guards em `App.tsx`:
- `TrialGate` — exige login **e** trial válido; envolve quase todas as rotas e aplica o `AppLayout`.
- `RequireUser` — só exige login. Usado em `/assinar`, que precisa funcionar justamente com o trial expirado.

`/` é dual: `Landing` para anônimo, `Dashboard` para logado.

### PWA

`vite-plugin-pwa` com `registerType: 'autoUpdate'`. O service worker **só existe no build de produção** (`devOptions.enabled: false`), então não interfere no `dev` nem no modo preview. GETs em `/rest/v1/` do Supabase usam StaleWhileRevalidate. `PwaUpdater` cuida do prompt de atualização.

### Git LFS

O `.gitattributes` manda imagens/vídeos/SVG para LFS. Baixar o repo como ZIP pelo GitHub entrega esses arquivos como ponteiros de texto quebrados — sempre clone, e rode `git lfs pull` se alguma imagem parecer um arquivo de ~100 bytes.

## Testes

Vitest com `environment: 'node'` e `include: ['src/**/*.test.ts']` — **só `.ts`, não `.tsx`**. Não há setup de DOM nem testing-library; a cobertura é da lógica pura (`dre.ts`, `format.ts`, `brinco.ts`, `types.ts`). Um teste de componente `.test.tsx` seria silenciosamente ignorado.

## Deploy

- **Frontend** → Vercel pelo `vercel.json` da raiz (builda `app/frontend`, saída em `app/frontend/dist`, rewrite de SPA para `index.html`).
- **Edge functions** → o caminho principal é o **MCP do Supabase na sessão de desenvolvimento**. O workflow `.github/workflows/deploy-mercadopago-webhook.yml` é backup manual (`workflow_dispatch`).
- **Backend Python** → não é deployado junto; ver seção de produção em `backend/README.md` (Railway recomendado; `Procfile` e `.python-version` já prontos).

## Migrations

Os `supabase_migration_*.sql` e `supabase_rls_policies.sql` na raiz são o histórico de schema, aplicados manualmente/via MCP — não há CLI do Supabase configurado nem pasta `supabase/migrations` neste repo.
