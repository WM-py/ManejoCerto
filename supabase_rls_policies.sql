-- ============================================================================
-- SUPABASE RLS POLICIES - Manejo Certo v7
-- ============================================================================
-- Copie e execute este script completo no SQL Editor do Supabase Dashboard
-- ============================================================================

-- ============================================================================
-- 1. PROFILES - Gerenciamento de perfis de usuário
-- ============================================================================

CREATE POLICY "Users can view their own profile"
ON app_34b6ab49dc_profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON app_34b6ab49dc_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON app_34b6ab49dc_profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
ON app_34b6ab49dc_profiles
FOR DELETE
USING (auth.uid() = id);

-- ============================================================================
-- 2. LOTES - Gerenciamento de lotes de gado
-- ============================================================================

CREATE POLICY "Users can view their own lots"
ON app_34b6ab49dc_lotes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lots"
ON app_34b6ab49dc_lotes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lots"
ON app_34b6ab49dc_lotes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lots"
ON app_34b6ab49dc_lotes
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 3. PESAGENS_LOTE - Pesagens por lote (peso total)
-- ============================================================================

CREATE POLICY "Users can view their own lot weighing records"
ON app_34b6ab49dc_pesagens_lote
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert weighing records for their lots"
ON app_34b6ab49dc_pesagens_lote
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weighing records"
ON app_34b6ab49dc_pesagens_lote
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weighing records"
ON app_34b6ab49dc_pesagens_lote
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 4. PESAGENS - Pesagens individuais (peso médio)
-- ============================================================================

CREATE POLICY "Users can view their own individual weighing records"
ON app_34b6ab49dc_pesagens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert individual weighing records"
ON app_34b6ab49dc_pesagens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own individual weighing"
ON app_34b6ab49dc_pesagens
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own individual weighing"
ON app_34b6ab49dc_pesagens
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 5. BAIXAS - Removals/deaths/sales
-- ============================================================================

CREATE POLICY "Users can view their own removal records"
ON app_34b6ab49dc_baixas
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert removal records"
ON app_34b6ab49dc_baixas
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own removal records"
ON app_34b6ab49dc_baixas
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own removal records"
ON app_34b6ab49dc_baixas
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 6. TRANSACOES - Financial transactions
-- ============================================================================

CREATE POLICY "Users can view their own transactions"
ON app_34b6ab49dc_transacoes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
ON app_34b6ab49dc_transacoes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
ON app_34b6ab49dc_transacoes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
ON app_34b6ab49dc_transacoes
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 7. COMPRAS_VENDAS - Purchase/sales records
-- ============================================================================
-- Nota: Esta tabela referencia transacao_id, não user_id diretamente
-- Consultamos a transacao associada para validar propriedade

CREATE POLICY "Users can view their own purchase/sale records"
ON app_34b6ab49dc_compras_vendas
FOR SELECT
USING (
  transacao_id IN (
    SELECT id FROM app_34b6ab49dc_transacoes 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert purchase/sale records"
ON app_34b6ab49dc_compras_vendas
FOR INSERT
WITH CHECK (
  transacao_id IN (
    SELECT id FROM app_34b6ab49dc_transacoes 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own purchase/sale records"
ON app_34b6ab49dc_compras_vendas
FOR UPDATE
USING (
  transacao_id IN (
    SELECT id FROM app_34b6ab49dc_transacoes 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  transacao_id IN (
    SELECT id FROM app_34b6ab49dc_transacoes 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own purchase/sale records"
ON app_34b6ab49dc_compras_vendas
FOR DELETE
USING (
  transacao_id IN (
    SELECT id FROM app_34b6ab49dc_transacoes 
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- 8. PASTOS - Pasture management
-- ============================================================================

CREATE POLICY "Users can view their own pastures"
ON app_34b6ab49dc_pastos
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pastures"
ON app_34b6ab49dc_pastos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pastures"
ON app_34b6ab49dc_pastos
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pastures"
ON app_34b6ab49dc_pastos
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 9. PARAMETROS_FAZENDA - Farm parameters/settings
-- ============================================================================

CREATE POLICY "Users can view their own farm parameters"
ON app_34b6ab49dc_parametros_fazenda
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own farm parameters"
ON app_34b6ab49dc_parametros_fazenda
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own farm parameters"
ON app_34b6ab49dc_parametros_fazenda
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own farm parameters"
ON app_34b6ab49dc_parametros_fazenda
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- VERIFICAÇÃO: Confirme que RLS está habilitado em todas as tabelas
-- ============================================================================
-- Execute esta query para verificar o status RLS de cada tabela:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
-- ORDER BY tablename;
-- 
-- Ou vá em Database > Tables e confirme que o toggle de RLS está ON 
-- (verde) para cada tabela acima.

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
