-- Migração: RPC de listagem de clientes/leads para o painel Admin.
-- APLICADA em produção via MCP em 2026-07-06 (migration admin_mc_list_clientes).
--
-- Junta auth.users (e-mail + metadados de lead do cadastro: full_name,
-- telefone, cidade, rebanho) com os perfis (plano/status/vencimento).
-- SECURITY DEFINER para poder ler auth.users; o gate é o mc_is_admin()
-- na primeira linha (mesmo padrão de mc_grant_access/mc_revoke_access).

create or replace function public.mc_list_clientes()
returns table (
  user_id uuid,
  email text,
  criado_em timestamptz,
  nome_fazenda text,
  nome_completo text,
  telefone text,
  cidade text,
  rebanho text,
  plan text,
  plan_status text,
  trial_end timestamptz
)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.mc_is_admin() then
    raise exception 'Acesso negado: apenas administradores.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    p.nome_fazenda,
    (u.raw_user_meta_data->>'full_name')::text,
    (u.raw_user_meta_data->>'telefone')::text,
    (u.raw_user_meta_data->>'cidade')::text,
    (u.raw_user_meta_data->>'rebanho')::text,
    p.plan,
    p.plan_status,
    p.trial_end
  from auth.users u
  left join app_34b6ab49dc_profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.mc_list_clientes() from public, anon;
grant execute on function public.mc_list_clientes() to authenticated;
