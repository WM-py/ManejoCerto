-- MANEJO CERTO — Contraparte (fornecedor/comprador) em compras/vendas
-- ----------------------------------------------------------------------------
-- Adiciona campo de texto livre para registrar de quem foi comprado o gado
-- (compra) ou para quem foi vendido (venda). Não existia nenhum conceito de
-- fornecedor/cliente no schema até então (verificado em compras_vendas e
-- transacoes) — este é um campo novo, não um resgate de algo removido.
-- APLICADO EM PROD em 2026-07-07 via MCP do Supabase (migration
-- "add_contraparte_compras_vendas").
-- ----------------------------------------------------------------------------

alter table app_34b6ab49dc_compras_vendas
  add column if not exists contraparte text;

comment on column app_34b6ab49dc_compras_vendas.contraparte is
  'Nome do fornecedor (compra) ou comprador (venda), texto livre.';

-- FIM.
-- Follow-ups de código (fora deste script):
--   • types.ts → CompraVenda.contraparte (feito)
--   • sync/types.ts → CompraPayload/VendaPayload.contraparte (feito)
--   • sync/handlers.ts → grava contraparte no insert de compras_vendas (feito)
--   • loteRepo.ts → registrarCompra/registrarVenda repassam contraparte (feito)
--   • CompraVenda.tsx → campo "Fornecedor"/"Comprador" no formulário (feito)
--   • Relatórios/Financeiro → exibir contraparte nas listagens (pendente, se fizer sentido)
