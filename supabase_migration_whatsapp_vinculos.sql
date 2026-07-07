-- ============================================================================
-- MANEJO CERTO — Ingestão WhatsApp: multi-tenant (vínculo wa_id <-> cliente)
-- ----------------------------------------------------------------------------
-- ATENÇÃO: revisar antes de aplicar. NÃO aplicado automaticamente.
-- 100% ADITIVA — cria apenas uma tabela nova.
-- ----------------------------------------------------------------------------
-- Fluxo: o cliente gera um código curto dentro do app (Parâmetros). Manda esse
-- código, uma única vez, para o número de WhatsApp do Manejo Certo. O backend
-- vincula o wa_id de quem mandou a esse user_id. Depois disso, toda mensagem
-- daquele número é gravada na fazenda certa, sem precisar repetir o código.
-- ============================================================================

create table if not exists app_34b6ab49dc_whatsapp_vinculos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  codigo     text not null unique,           -- ex.: "AB3X9K" — gerado pelo app
  wa_id      text unique,                    -- preenchido só após vincular
  status     text not null default 'pendente'
             check (status in ('pendente','vinculado')),
  created_at timestamptz not null default now(),
  linked_at  timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists ix_wpp_vinculos_wa_id
  on app_34b6ab49dc_whatsapp_vinculos(wa_id) where status = 'vinculado';

create trigger trg_touch before update on app_34b6ab49dc_whatsapp_vinculos
  for each row execute function app_34b6ab49dc_touch_updated_at();

-- RLS: o cliente só vê/gera o PRÓPRIO código. O campo wa_id só é escrito pelo
-- backend com service role (que ignora RLS) — o cliente nunca escreve nele.
alter table app_34b6ab49dc_whatsapp_vinculos enable row level security;

drop policy if exists p_sel on app_34b6ab49dc_whatsapp_vinculos;
create policy p_sel on app_34b6ab49dc_whatsapp_vinculos
  for select using (auth.uid() = user_id);

drop policy if exists p_ins on app_34b6ab49dc_whatsapp_vinculos;
create policy p_ins on app_34b6ab49dc_whatsapp_vinculos
  for insert with check (auth.uid() = user_id);

drop policy if exists p_upd on app_34b6ab49dc_whatsapp_vinculos;
create policy p_upd on app_34b6ab49dc_whatsapp_vinculos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists p_del on app_34b6ab49dc_whatsapp_vinculos;
create policy p_del on app_34b6ab49dc_whatsapp_vinculos
  for delete using (auth.uid() = user_id);
