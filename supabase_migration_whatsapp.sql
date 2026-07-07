-- ============================================================================
-- MANEJO CERTO — Ingestão WhatsApp (Fase 3): controle de idempotência
-- ----------------------------------------------------------------------------
-- ATENÇÃO: revisar antes de aplicar. NÃO aplicado automaticamente.
-- 100% ADITIVA — cria apenas uma tabela de controle nova. Nada é alterado.
-- Objetivo: a Meta reenvia o webhook em caso de timeout; esta tabela evita que
-- um reenvio duplique lançamentos financeiros (pesagem já é protegida pelo
-- índice único por animal/dia).
-- ============================================================================

create table if not exists app_34b6ab49dc_wpp_processados (
  wamid        text primary key,               -- id da mensagem do WhatsApp
  user_id      uuid not null references auth.users(id) on delete cascade,
  processed_at timestamptz not null default now()
);

create index if not exists ix_wpp_processados_user
  on app_34b6ab49dc_wpp_processados(user_id);

-- RLS no mesmo padrão do resto do app. O servidor grava com service role
-- (ignora RLS); estas políticas protegem caso a tabela seja lida pelo cliente.
alter table app_34b6ab49dc_wpp_processados enable row level security;

drop policy if exists p_sel on app_34b6ab49dc_wpp_processados;
create policy p_sel on app_34b6ab49dc_wpp_processados
  for select using (auth.uid() = user_id);

drop policy if exists p_ins on app_34b6ab49dc_wpp_processados;
create policy p_ins on app_34b6ab49dc_wpp_processados
  for insert with check (auth.uid() = user_id);
