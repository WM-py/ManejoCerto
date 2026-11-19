-- ============================================================================
-- MANEJO CERTO — Proteção das colunas de plano/trial do perfil
-- ----------------------------------------------------------------------------
-- A policy "Users can update their own profile" (supabase_rls_policies.sql)
-- deixa o usuário dar UPDATE no próprio perfil. Quem impede que ele se dê um
-- plano pago são os dois triggers abaixo, que JÁ EXISTIAM em produção mas não
-- estavam versionados neste repo. Eles foram copiados do banco em 2026-11-19
-- (pg_get_functiondef) para que o histórico de schema reflita a realidade.
-- Os CREATE OR REPLACE são idempotentes: reaplicar não muda nada.
--
-- A única mudança nova é a parte 3 (remoção da policy de DELETE), APLICADA em
-- produção via MCP em 2026-11-19 (migration profiles_remove_delete_policy).
--
-- Testado em produção, dentro de transação desfeita, como papel authenticated:
--   - UPDATE de plan/plan_status/trial_end → ignorado; nome_fazenda → aplicado.
--   - DELETE do próprio perfil → 0 linhas.
--
-- Quem continua podendo mexer no plano: webhook do Mercado Pago
-- (service_role) e mc_grant_access / mc_revoke_access (SECURITY DEFINER,
-- dono postgres → current_user não é 'authenticated').
-- ============================================================================

-- 1. INSERT: perfil criado pelo cliente sempre nasce em trial de 14 dias -----
create or replace function public.mc_profile_init_trial()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.plan := 'trial';
    NEW.plan_status := 'trialing';
    NEW.trial_start := COALESCE(NEW.trial_start, now());
    NEW.trial_end := now() + interval '14 days';
  ELSE
    NEW.plan := COALESCE(NEW.plan, 'trial');
    NEW.plan_status := COALESCE(NEW.plan_status, 'trialing');
    NEW.trial_start := COALESCE(NEW.trial_start, now());
    NEW.trial_end := COALESCE(NEW.trial_end, now() + interval '14 days');
  END IF;
  RETURN NEW;
END;
$function$;

drop trigger if exists trg_profile_init_trial on public.app_34b6ab49dc_profiles;
create trigger trg_profile_init_trial
  before insert on public.app_34b6ab49dc_profiles
  for each row execute function mc_profile_init_trial();

-- 2. UPDATE: cliente não altera plano/trial (mudança é descartada em silêncio)
create or replace function public.mc_profile_protect_billing()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.plan := OLD.plan;
    NEW.plan_status := OLD.plan_status;
    NEW.trial_start := OLD.trial_start;
    NEW.trial_end := OLD.trial_end;
  END IF;
  RETURN NEW;
END;
$function$;

drop trigger if exists trg_profile_protect_billing on public.app_34b6ab49dc_profiles;
create trigger trg_profile_protect_billing
  before update on public.app_34b6ab49dc_profiles
  for each row execute function mc_profile_protect_billing();

-- 3. DELETE: sem policy, o cliente não apaga o próprio perfil ---------------
-- Antes, apagar o perfil e recarregar o app fazia o AuthContext recriá-lo, e o
-- trigger da parte 1 dava 14 dias novos: trial infinito. O app nunca apaga
-- perfil; a exclusão da conta (auth.users) segue funcionando por cascade.
drop policy if exists "Users can delete their own profile" on app_34b6ab49dc_profiles;
