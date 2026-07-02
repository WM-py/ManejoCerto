-- ============================================================================
-- MANEJO CERTO — Sprint 0: Fundação de dados
-- Pesagem POR ANIMAL (brinco) + vínculo animal↔lote por período + fix do GMD
-- + auto-geração de animais na criação do lote + snapshot automático de pesagem
-- ----------------------------------------------------------------------------
-- ATENÇÃO: revisar antes de aplicar. NÃO aplicado automaticamente.
-- Faça backup (pg_dump / snapshot) antes de rodar no SQL Editor.
-- Estratégia: 100% ADITIVA — nada é renomeado/apagado. As tabelas antigas
-- (pesagens, pesagens_lote) permanecem para o legado (Dashboard) até migrarem.
-- Idempotente onde possível.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- Trigger genérico de updated_at (base para o sync offline futuro) -------------
create or replace function app_34b6ab49dc_touch_updated_at()
returns trigger language plpgsql
set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================================
-- 1. ANIMAIS — identidade individual, persiste entre lotes
-- ============================================================================
create table if not exists app_34b6ab49dc_animais (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  brinco_visual   text,
  brinco_rfid     text,
  sexo            text check (sexo in ('Macho','Fêmea')),
  raca            text,
  data_nascimento date,
  origem          text,                    -- 'compra' | 'nascimento' | ...
  status          text not null default 'ativo'
                  check (status in ('ativo','vendido','morto','transferido')),
  observacao      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
-- brinco é único por usuário, mas só quando preenchido (permite provisório nulo)
create unique index if not exists ux_animais_user_rfid
  on app_34b6ab49dc_animais(user_id, brinco_rfid)
  where brinco_rfid is not null and deleted_at is null;
create unique index if not exists ux_animais_user_visual
  on app_34b6ab49dc_animais(user_id, brinco_visual)
  where brinco_visual is not null and deleted_at is null;
create index if not exists ix_animais_user
  on app_34b6ab49dc_animais(user_id) where deleted_at is null;

-- ============================================================================
-- 2. LOTE_ANIMAIS — vínculo animal↔lote por período (rastreio + rateio)
--    "O animal pertence a um lote em um determinado período."
--    Fonte para ratear a nutrição (Sprint 2) entre os animais ATIVOS no dia.
-- ============================================================================
create table if not exists app_34b6ab49dc_lote_animais (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  animal_id       uuid not null references app_34b6ab49dc_animais(id) on delete cascade,
  lote_id         uuid not null references app_34b6ab49dc_lotes(id) on delete cascade,
  data_entrada    date not null,
  peso_entrada_kg numeric(10,3),           -- âncora do 1º GMD do animal no lote
  data_saida      date,                    -- null = animal ATIVO no lote
  motivo_saida    text,                    -- 'venda' | 'baixa' | 'transferencia'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
-- um animal só pode ter UM vínculo aberto por vez
create unique index if not exists ux_lote_animais_aberto
  on app_34b6ab49dc_lote_animais(animal_id)
  where data_saida is null and deleted_at is null;
create index if not exists ix_lote_animais_lote
  on app_34b6ab49dc_lote_animais(lote_id) where deleted_at is null;
create index if not exists ix_lote_animais_periodo
  on app_34b6ab49dc_lote_animais(lote_id, data_entrada, data_saida);

-- ============================================================================
-- 3. PESAGEM_EVENTOS — sessão de pesagem (curral)
--    Para pesagem de LOTE TOTAL, guarda o SNAPSHOT de cabeças pesadas.
--    É esse snapshot que elimina o bug do GMD histórico.
-- ============================================================================
create table if not exists app_34b6ab49dc_pesagem_eventos (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  lote_id             uuid not null references app_34b6ab49dc_lotes(id) on delete cascade,
  data_pesagem        date not null,
  tipo                text not null default 'individual'
                      check (tipo in ('individual','lote_total')),
  -- preenchidos SÓ quando tipo='lote_total' (sem brinco individual):
  peso_total_kg       numeric(12,3),
  qtd_cabecas_pesadas integer,             -- << SNAPSHOT congelado
  observacao          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  check (
    (tipo = 'lote_total'
      and peso_total_kg is not null and qtd_cabecas_pesadas is not null
      and qtd_cabecas_pesadas > 0)
    or tipo = 'individual'
  )
);
create index if not exists ix_pesagem_eventos_lote
  on app_34b6ab49dc_pesagem_eventos(lote_id, data_pesagem) where deleted_at is null;

-- ============================================================================
-- 4. PESAGENS_ANIMAL — UMA linha por animal por pesagem. Base do ML.
--    Tabela NOVA (aditiva). Sem coluna de gmd: GMD é SEMPRE derivado.
-- ============================================================================
create table if not exists app_34b6ab49dc_pesagens_animal (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  animal_id    uuid not null references app_34b6ab49dc_animais(id) on delete cascade,
  lote_id      uuid references app_34b6ab49dc_lotes(id) on delete set null, -- lote no momento da pesagem
  evento_id    uuid references app_34b6ab49dc_pesagem_eventos(id) on delete set null,
  data_pesagem date not null,
  peso_kg      numeric(10,3) not null check (peso_kg > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists ix_pesagens_animal_animal
  on app_34b6ab49dc_pesagens_animal(animal_id, data_pesagem) where deleted_at is null;
create index if not exists ix_pesagens_animal_lote
  on app_34b6ab49dc_pesagens_animal(lote_id, data_pesagem) where deleted_at is null;
create unique index if not exists ux_pesagens_animal_data
  on app_34b6ab49dc_pesagens_animal(animal_id, data_pesagem) where deleted_at is null;

-- ============================================================================
-- 5. TRIGGERS updated_at (tabelas novas)
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'app_34b6ab49dc_animais','app_34b6ab49dc_lote_animais',
    'app_34b6ab49dc_pesagem_eventos','app_34b6ab49dc_pesagens_animal'
  ] loop
    execute format('drop trigger if exists trg_touch on %I', t);
    execute format('create trigger trg_touch before update on %I
                    for each row execute function app_34b6ab49dc_touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- 6. RLS — isolamento por usuário (mesmo padrão do resto do app)
-- ============================================================================
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'app_34b6ab49dc_animais','app_34b6ab49dc_lote_animais',
    'app_34b6ab49dc_pesagem_eventos','app_34b6ab49dc_pesagens_animal'
  ] loop
    execute format('alter table %I enable row level security', tbl);
    execute format($f$drop policy if exists p_sel on %I$f$, tbl);
    execute format($f$create policy p_sel on %I for select using (auth.uid() = user_id)$f$, tbl);
    execute format($f$drop policy if exists p_ins on %I$f$, tbl);
    execute format($f$create policy p_ins on %I for insert with check (auth.uid() = user_id)$f$, tbl);
    execute format($f$drop policy if exists p_upd on %I$f$, tbl);
    execute format($f$create policy p_upd on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)$f$, tbl);
    execute format($f$drop policy if exists p_del on %I$f$, tbl);
    execute format($f$create policy p_del on %I for delete using (auth.uid() = user_id)$f$, tbl);
  end loop;
end $$;

-- ============================================================================
-- 7. SYNC-READINESS — updated_at/deleted_at nas tabelas legadas
--    (pré-requisito do motor offline do Sprint 1)
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'app_34b6ab49dc_lotes','app_34b6ab49dc_transacoes','app_34b6ab49dc_compras_vendas',
    'app_34b6ab49dc_pastos','app_34b6ab49dc_baixas','app_34b6ab49dc_parametros_fazenda'
  ] loop
    execute format('alter table %I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('alter table %I add column if not exists deleted_at timestamptz', t);
    execute format('drop trigger if exists trg_touch on %I', t);
    execute format('create trigger trg_touch before update on %I
                    for each row execute function app_34b6ab49dc_touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- 8. BACKFILL — pesagens_lote existentes → pesagem_eventos
--    reconstruindo o Nº DE CABEÇAS NAQUELE DIA (nunca o "vivo atual").
--    entrada_original = qtd_cabecas_atual + Σ baixas   (baixas já subtraídas)
--    vivas_na_data(d) = entrada_original − Σ baixas(≤d) − Σ vendas(≤d)
--    A partir daqui, o snapshot é capturado nativamente pelo RPC.
-- ============================================================================
insert into app_34b6ab49dc_pesagem_eventos
  (id, user_id, lote_id, data_pesagem, tipo, peso_total_kg, qtd_cabecas_pesadas, created_at)
select
  pl.id, pl.user_id, pl.lote_id, pl.data_pesagem, 'lote_total', pl.peso_total_kg,
  greatest(1, (
      ( l.qtd_cabecas
        + coalesce((select sum(b.quantidade) from app_34b6ab49dc_baixas b
                    where b.lote_id = pl.lote_id), 0) )
      - coalesce((select sum(b.quantidade) from app_34b6ab49dc_baixas b
                  where b.lote_id = pl.lote_id and b.data_baixa <= pl.data_pesagem), 0)
      - coalesce((select sum(cv.qtd_cabecas)
                  from app_34b6ab49dc_compras_vendas cv
                  join app_34b6ab49dc_transacoes t on t.id = cv.transacao_id
                  where cv.lote_id = pl.lote_id
                    and t.categoria = 'VENDA_GADO'
                    and t.data <= pl.data_pesagem), 0)
  ))::int,
  pl.created_at
from app_34b6ab49dc_pesagens_lote pl
join app_34b6ab49dc_lotes l on l.id = pl.lote_id
on conflict (id) do nothing;

-- ============================================================================
-- 9. VIEWS DERIVADAS (GMD nunca é persistido; rebanho é derivado do vínculo)
-- ============================================================================

-- 9a. GMD individual — entre pesagens consecutivas do MESMO animal
create or replace view app_34b6ab49dc_v_gmd_animal
with (security_invoker = true) as
with p as (
  select
    ps.animal_id, ps.lote_id, ps.data_pesagem, ps.peso_kg,
    lag(ps.peso_kg)      over w as peso_ant,
    lag(ps.data_pesagem) over w as data_ant
  from app_34b6ab49dc_pesagens_animal ps
  where ps.deleted_at is null
  window w as (partition by ps.animal_id order by ps.data_pesagem)
)
select
  animal_id, lote_id, data_pesagem, peso_kg, peso_ant, data_ant,
  case when data_ant is not null and data_pesagem > data_ant
       then round((peso_kg - peso_ant) / (data_pesagem - data_ant)::numeric, 4)
  end as gmd_kg_dia
from p;

-- 9b. GMD do lote via evento de peso total — usa o SNAPSHOT congelado
create or replace view app_34b6ab49dc_v_gmd_lote_evento
with (security_invoker = true) as
with e as (
  select
    lote_id, data_pesagem,
    (peso_total_kg / nullif(qtd_cabecas_pesadas, 0))            as peso_medio,
    lag(peso_total_kg / nullif(qtd_cabecas_pesadas, 0)) over w  as peso_medio_ant,
    lag(data_pesagem)                                    over w  as data_ant
  from app_34b6ab49dc_pesagem_eventos
  where tipo = 'lote_total' and deleted_at is null
  window w as (partition by lote_id order by data_pesagem)
)
select
  lote_id, data_pesagem, peso_medio, peso_medio_ant,
  case when data_ant is not null and data_pesagem > data_ant
       then round((peso_medio - peso_medio_ant) / (data_pesagem - data_ant)::numeric, 4)
  end as gmd_kg_dia
from e;

-- 9c. GMD do lote agregando pesagens individuais (média dos GMDs dos animais)
create or replace view app_34b6ab49dc_v_gmd_lote_individual
with (security_invoker = true) as
select
  lote_id,
  data_pesagem,
  round(avg(gmd_kg_dia), 4) as gmd_medio_kg_dia,
  count(*)                  as animais_considerados
from app_34b6ab49dc_v_gmd_animal
where gmd_kg_dia is not null and lote_id is not null
group by lote_id, data_pesagem;

-- 9d. REBANHO do lote — contagens derivadas do vínculo (fonte de verdade)
create or replace view app_34b6ab49dc_v_lote_rebanho
with (security_invoker = true) as
select
  la.lote_id,
  count(*) filter (where la.data_saida is null)                          as cabecas_vivas,
  count(*)                                                               as cabecas_total,
  count(*) filter (where la.motivo_saida = 'venda')                      as cabecas_vendidas,
  count(*) filter (where la.motivo_saida = 'baixa')                      as cabecas_baixa
from app_34b6ab49dc_lote_animais la
where la.deleted_at is null
group by la.lote_id;

-- ============================================================================
-- 10. RPC — criar lote e gerar N animais automaticamente (requisito inegociável)
--     Brinco fica nulo (provisório); "match" do RFID acontece depois no curral.
--     Transacional: ou cria tudo, ou nada.
-- ============================================================================
-- p_peso_entrada_kg = PESO MÉDIO POR CABEÇA (kg), mesma semântica de lotes.peso_entrada_kg.
create or replace function app_34b6ab49dc_criar_lote_com_animais(
  p_nome_lote       text,
  p_qtd_cabecas     int,
  p_peso_entrada_kg numeric,          -- média por cabeça
  p_data_entrada    date,
  p_pasto_id        uuid  default null,
  p_sexo            text  default 'Misto',
  p_categoria       text  default null
) returns uuid
language plpgsql security invoker
set search_path = public as $$
declare
  v_uid          uuid := auth.uid();
  v_lote_id      uuid;
  v_sexo_animal  text;
  v_peso_cab     numeric;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_qtd_cabecas <= 0 then raise exception 'qtd_cabecas deve ser > 0'; end if;

  -- o parâmetro JÁ é a média por cabeça → é a própria âncora de cada animal
  v_peso_cab    := p_peso_entrada_kg;
  -- sexo do lote 'Misto' → animais sem sexo definido (define-se no match do brinco)
  v_sexo_animal := case when p_sexo in ('Macho','Fêmea') then p_sexo end;

  insert into app_34b6ab49dc_lotes
    (id, user_id, nome_lote, qtd_cabecas, qtd_cabecas_vendidas, status,
     data_entrada, peso_entrada_kg, pasto_id, sexo, categoria)
  values
    (gen_random_uuid(), v_uid, p_nome_lote, p_qtd_cabecas, 0, 'ativo',
     p_data_entrada, p_peso_entrada_kg, p_pasto_id, p_sexo, p_categoria)
  returning id into v_lote_id;

  with novos as (
    insert into app_34b6ab49dc_animais (id, user_id, sexo, origem, status)
    select gen_random_uuid(), v_uid, v_sexo_animal, 'compra', 'ativo'
    from generate_series(1, p_qtd_cabecas)
    returning id
  )
  insert into app_34b6ab49dc_lote_animais
    (id, user_id, animal_id, lote_id, data_entrada, peso_entrada_kg)
  select gen_random_uuid(), v_uid, n.id, v_lote_id, p_data_entrada, v_peso_cab
  from novos n;

  return v_lote_id;
end $$;

-- ============================================================================
-- 11. RPC — registrar pesagem de LOTE TOTAL com snapshot automático de cabeças
--     O app NUNCA calcula a contagem → o bug do GMD não pode reaparecer.
-- ============================================================================
create or replace function app_34b6ab49dc_registrar_pesagem_lote_total(
  p_lote_id       uuid,
  p_data          date,
  p_peso_total_kg numeric,
  p_observacao    text default null
) returns uuid
language plpgsql security invoker
set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_qtd int;
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_peso_total_kg is null or p_peso_total_kg <= 0 then
    raise exception 'peso_total_kg deve ser > 0';
  end if;

  -- fonte de verdade: rebanho derivado do vínculo
  select coalesce(cabecas_vivas, 0) into v_qtd
  from app_34b6ab49dc_v_lote_rebanho where lote_id = p_lote_id;

  -- fallback p/ lotes legados ainda sem animais cadastrados
  if v_qtd is null or v_qtd <= 0 then
    select (qtd_cabecas - qtd_cabecas_vendidas) into v_qtd
    from app_34b6ab49dc_lotes where id = p_lote_id;
  end if;

  if v_qtd is null or v_qtd <= 0 then raise exception 'lote sem cabeças vivas'; end if;

  insert into app_34b6ab49dc_pesagem_eventos
    (id, user_id, lote_id, data_pesagem, tipo, peso_total_kg, qtd_cabecas_pesadas, observacao)
  values
    (gen_random_uuid(), v_uid, p_lote_id, p_data, 'lote_total', p_peso_total_kg, v_qtd, p_observacao)
  returning id into v_id;

  return v_id;
end $$;

-- ============================================================================
-- 12. RPC — registrar baixa (mortalidade) fechando N vínculos ativos
--     Mantém coerência entre lote_animais, animais.status e o cache lotes.qtd
-- ============================================================================
create or replace function app_34b6ab49dc_registrar_baixa(
  p_lote_id uuid,
  p_qtd     int,
  p_data    date,
  p_motivo  text default 'Mortalidade'
) returns void
language plpgsql security invoker
set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_vivas  int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_qtd <= 0 then raise exception 'quantidade deve ser > 0'; end if;

  select coalesce(cabecas_vivas, 0) into v_vivas
  from app_34b6ab49dc_v_lote_rebanho where lote_id = p_lote_id;
  if v_vivas is not null and p_qtd > v_vivas then
    raise exception 'quantidade (%) maior que cabeças vivas (%)', p_qtd, v_vivas;
  end if;

  insert into app_34b6ab49dc_baixas (id, lote_id, user_id, data_baixa, quantidade, motivo)
  values (gen_random_uuid(), p_lote_id, v_uid, p_data, p_qtd, p_motivo);

  -- fecha N vínculos ativos (sem brinco ainda, escolhe quaisquer ativos)
  with alvo as (
    select id, animal_id
    from app_34b6ab49dc_lote_animais
    where lote_id = p_lote_id and data_saida is null and deleted_at is null
    order by created_at
    limit p_qtd
    for update
  ),
  fecha as (
    update app_34b6ab49dc_lote_animais la
    set data_saida = p_data, motivo_saida = 'baixa'
    from alvo where la.id = alvo.id
    returning alvo.animal_id
  )
  update app_34b6ab49dc_animais a
  set status = 'morto'
  from fecha where a.id = fecha.animal_id;

  -- mantém o cache de cabeças do lote (legado)
  update app_34b6ab49dc_lotes
  set qtd_cabecas = greatest(0, qtd_cabecas - p_qtd)
  where id = p_lote_id;
end $$;

-- ============================================================================
-- 12b. RPC — registrar SAÍDA por venda: fecha N vínculos (motivo='venda')
--      marca animais como 'vendido' e incrementa o cache qtd_cabecas_vendidas.
--      A transação financeira + compras_vendas seguem sendo gravadas pela UI.
-- ============================================================================
create or replace function app_34b6ab49dc_registrar_venda_saida(
  p_lote_id uuid,
  p_qtd     int,
  p_data    date
) returns void
language plpgsql security invoker
set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_vivas int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_qtd <= 0 then raise exception 'quantidade deve ser > 0'; end if;

  select coalesce(cabecas_vivas, 0) into v_vivas
  from app_34b6ab49dc_v_lote_rebanho where lote_id = p_lote_id;
  if v_vivas is not null and v_vivas > 0 and p_qtd > v_vivas then
    raise exception 'quantidade (%) maior que cabeças vivas (%)', p_qtd, v_vivas;
  end if;

  -- fecha N vínculos ativos (enquanto não há brinco, escolhe quaisquer ativos)
  with alvo as (
    select id, animal_id
    from app_34b6ab49dc_lote_animais
    where lote_id = p_lote_id and data_saida is null and deleted_at is null
    order by created_at
    limit p_qtd
    for update
  ),
  fecha as (
    update app_34b6ab49dc_lote_animais la
    set data_saida = p_data, motivo_saida = 'venda'
    from alvo where la.id = alvo.id
    returning alvo.animal_id
  )
  update app_34b6ab49dc_animais a
  set status = 'vendido'
  from fecha where a.id = fecha.animal_id;

  -- mantém o cache de vendidas do lote (legado)
  update app_34b6ab49dc_lotes
  set qtd_cabecas_vendidas = qtd_cabecas_vendidas + p_qtd
  where id = p_lote_id;
end $$;

-- ============================================================================
-- 12c. RPC — excluir lote em cascata (novo modelo + legado), transacional.
--      Remove animais EXCLUSIVOS deste lote; preserva os que migraram p/ outro.
-- ============================================================================
create or replace function app_34b6ab49dc_excluir_lote(p_lote_id uuid)
returns void
language plpgsql security invoker
set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from app_34b6ab49dc_lotes where id = p_lote_id and user_id = v_uid) then
    raise exception 'lote não encontrado';
  end if;

  -- animais exclusivos deste lote (cascata remove seus vínculos e pesagens)
  delete from app_34b6ab49dc_animais a
   where a.user_id = v_uid
     and exists (select 1 from app_34b6ab49dc_lote_animais la
                 where la.animal_id = a.id and la.lote_id = p_lote_id)
     and not exists (select 1 from app_34b6ab49dc_lote_animais la2
                     where la2.animal_id = a.id and la2.lote_id <> p_lote_id);

  -- vínculos e pesagens restantes ligados ao lote
  delete from app_34b6ab49dc_lote_animais   where lote_id = p_lote_id;
  delete from app_34b6ab49dc_pesagens_animal where lote_id = p_lote_id and user_id = v_uid;
  delete from app_34b6ab49dc_pesagem_eventos where lote_id = p_lote_id and user_id = v_uid;

  -- financeiro
  delete from app_34b6ab49dc_compras_vendas
   where lote_id = p_lote_id
      or transacao_id in (select id from app_34b6ab49dc_transacoes
                          where lote_id = p_lote_id and user_id = v_uid);
  delete from app_34b6ab49dc_transacoes where lote_id = p_lote_id and user_id = v_uid;
  delete from app_34b6ab49dc_baixas      where lote_id = p_lote_id and user_id = v_uid;

  -- legado (registros antigos, se houver)
  delete from app_34b6ab49dc_pesagens      where lote_id = p_lote_id and user_id = v_uid;
  delete from app_34b6ab49dc_pesagens_lote where lote_id = p_lote_id and user_id = v_uid;
  delete from entradas_compras             where lote_id = p_lote_id and user_id = v_uid;

  delete from app_34b6ab49dc_lotes where id = p_lote_id and user_id = v_uid;
end $$;

-- ============================================================================
-- 13. GRANTS — permitir execução pelo usuário autenticado
-- ============================================================================
grant execute on function app_34b6ab49dc_criar_lote_com_animais(text,int,numeric,date,uuid,text,text) to authenticated;
grant execute on function app_34b6ab49dc_registrar_pesagem_lote_total(uuid,date,numeric,text) to authenticated;
grant execute on function app_34b6ab49dc_registrar_baixa(uuid,int,date,text) to authenticated;
grant execute on function app_34b6ab49dc_registrar_venda_saida(uuid,int,date) to authenticated;
grant execute on function app_34b6ab49dc_excluir_lote(uuid) to authenticated;

-- ============================================================================
-- FIM.
-- Follow-ups de código (fora deste script):
--   • CompraVenda.tsx → compra usa criar_lote_com_animais; venda usa registrar_venda_saida (feito)
--   • LoteDetalhe.tsx → consome v_lote_rebanho + v_gmd_* + RPCs (feito)
--   • Dashboard.tsx → migrar leituras de pesagens_lote p/ pesagem_eventos/views (pendente)
-- ============================================================================
