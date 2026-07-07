-- ============================================================================
-- Sprint 2 — Pesagem INDIVIDUAL no curral + etiquetagem de brinco.
--
-- Aditivo ao Sprint 0. Não altera schema (as tabelas animais / pesagem_eventos /
-- pesagens_animal e as views v_gmd_animal / v_gmd_lote_individual já existem).
-- Só adiciona 1 RPC transacional para gravar peso por animal.
--
-- A etiquetagem de brinco é um UPDATE simples em animais (coberto pela policy
-- p_upd do Sprint 0) e NÃO precisa de RPC — é feita direto pelo cliente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC — registrar pesagem INDIVIDUAL de um animal.
--   • Encontra (ou cria) o evento de pesagem do dia (tipo='individual').
--   • Faz UPSERT do peso do animal: repesar o mesmo brinco no mesmo dia apenas
--     corrige o valor (usa o índice único ux_pesagens_animal_data).
--   • O GMD NÃO é calculado aqui — é derivado on-the-fly pela view v_gmd_animal.
--   • Transacional e idempotente por (animal_id, data): seguro para replay da
--     fila offline.
-- ----------------------------------------------------------------------------
create or replace function app_34b6ab49dc_registrar_pesagem_individual(
  p_lote_id   uuid,
  p_animal_id uuid,
  p_data      date,
  p_peso_kg   numeric
) returns uuid
language plpgsql security invoker
set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_evento_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_peso_kg is null or p_peso_kg <= 0 then
    raise exception 'peso_kg deve ser > 0';
  end if;

  -- o animal precisa ter vínculo ATIVO neste lote (protege contra dados órfãos)
  if not exists (
    select 1 from app_34b6ab49dc_lote_animais
    where animal_id = p_animal_id and lote_id = p_lote_id
      and data_saida is null and deleted_at is null
  ) then
    raise exception 'animal % não está ativo no lote %', p_animal_id, p_lote_id;
  end if;

  -- encontra o evento individual do dia; cria se ainda não houver
  select id into v_evento_id
  from app_34b6ab49dc_pesagem_eventos
  where lote_id = p_lote_id and data_pesagem = p_data
    and tipo = 'individual' and deleted_at is null
  limit 1;

  if v_evento_id is null then
    insert into app_34b6ab49dc_pesagem_eventos
      (id, user_id, lote_id, data_pesagem, tipo)
    values
      (gen_random_uuid(), v_uid, p_lote_id, p_data, 'individual')
    returning id into v_evento_id;
  end if;

  -- upsert do peso do animal (corrige repesagem no mesmo dia)
  insert into app_34b6ab49dc_pesagens_animal
    (id, user_id, animal_id, lote_id, evento_id, data_pesagem, peso_kg)
  values
    (gen_random_uuid(), v_uid, p_animal_id, p_lote_id, v_evento_id, p_data, p_peso_kg)
  on conflict (animal_id, data_pesagem) where deleted_at is null
  do update set peso_kg = excluded.peso_kg, evento_id = excluded.evento_id;

  return v_evento_id;
end $$;

grant execute on function
  app_34b6ab49dc_registrar_pesagem_individual(uuid,uuid,date,numeric)
  to authenticated;

-- ============================================================================
-- FIM.
-- Follow-ups de código (fora deste script):
--   • supabase.ts       → RPC.registrarPesagemIndividual
--   • sync/*            → OutboxKind PESAGEM_INDIVIDUAL + ETIQUETAR_ANIMAL
--   • loteRepo.ts       → listAnimaisDoLote, etiquetarAnimal, registrarPesagemIndividual,
--                          getUltimoPesoAnimal, listGmdAnimalByLote, listGmdLoteIndividual
--   • LoteDetalhe.tsx   → botões "Etiquetar" e "Pesagem individual" + Sheets
-- ============================================================================
