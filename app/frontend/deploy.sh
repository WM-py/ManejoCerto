#!/bin/bash

# Script de deploy para Vercel/Netlify
# Uso: ./deploy.sh [plataforma]

PLATAFORMA=${1:-vercel}

echo "🚀 Iniciando deploy para $PLATAFORMA..."

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "Copie .env.example para .env e configure suas variáveis."
    exit 1
fi

# Verificar se variáveis estão configuradas
if ! grep -q "VITE_SUPABASE_URL" .env || ! grep -q "VITE_SUPABASE_ANON_KEY" .env; then
    echo "❌ Variáveis do Supabase não configuradas no .env!"
    exit 1
fi

# Build do projeto
echo "📦 Fazendo build do projeto..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build falhou!"
    exit 1
fi

echo "✅ Build concluído!"

if [ "$PLATAFORMA" = "vercel" ]; then
    echo "🔗 Deploy no Vercel:"
    echo "1. Acesse https://vercel.com"
    echo "2. Importe seu projeto do GitHub"
    echo "3. Configure as variáveis de ambiente no dashboard"
    echo "4. O deploy será automático!"
elif [ "$PLATAFORMA" = "netlify" ]; then
    echo "🔗 Deploy no Netlify:"
    echo "1. Acesse https://netlify.com"
    echo "2. Conecte seu repositório Git"
    echo "3. Configure build settings:"
    echo "   - Build command: npm run build"
    echo "   - Publish directory: dist"
    echo "4. Adicione variáveis de ambiente"
fi

echo ""
echo "📋 Não esqueça de configurar no Supabase Dashboard:"
echo "- Site URL: https://seu-dominio.$PLATAFORMA.app"
echo "- Redirect URLs: https://seu-dominio.$PLATAFORMA.app/auth/callback"