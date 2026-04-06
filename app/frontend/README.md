# Manejo Certo - Sistema de Gestão Financeira para Pecuária

## Tecnologias Utilizadas

Este projeto foi construído com:

- **Vite** - Build tool e dev server
- **TypeScript** - Tipagem estática
- **React 18** - Framework frontend
- **shadcn-ui** - Componentes UI
- **Tailwind CSS** - Estilização
- **Supabase** - Backend como serviço (Auth, Database, Storage)

## Estrutura do Projeto

- `index.html` - Ponto de entrada HTML
- `vite.config.ts` - Configuração do Vite
- `tailwind.config.ts` - Configuração do Tailwind
- `package.json` - Dependências e scripts
- `src/main.tsx` - Ponto de entrada da aplicação
- `src/App.tsx` - Componente de roteamento
- `src/pages/` - Páginas da aplicação
- `src/components/ui/` - Componentes shadcn/ui
- `src/lib/` - Utilitários e configurações

## Configuração do Ambiente

1. **Instalar dependências:**
   ```bash
   npm install
   # ou
   pnpm install
   ```

2. **Configurar variáveis de ambiente:**
   ```bash
   cp .env.example .env
   ```
   Edite o arquivo `.env` com suas chaves do Supabase.

3. **Executar em desenvolvimento:**
   ```bash
   npm run dev
   ```

## Deploy para Produção

### Opção 1: Vercel (Recomendado - Gratuito)

1. **Criar conta no Vercel:**
   - Acesse [vercel.com](https://vercel.com)
   - Faça login com GitHub

2. **Importar projeto:**
   - Clique em "New Project"
   - Conecte seu repositório GitHub
   - Configure as variáveis de ambiente no dashboard do Vercel:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

3. **Deploy automático:**
   - O Vercel fará o build e deploy automaticamente
   - Você receberá uma URL como `seu-projeto.vercel.app`

### Opção 2: Netlify

1. **Criar conta no Netlify:**
   - Acesse [netlify.com](https://netlify.com)

2. **Deploy via Git:**
   - Conecte seu repositório
   - Configure build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Adicione variáveis de ambiente no dashboard

### Configuração do Supabase

Após o deploy, atualize as configurações no Supabase Dashboard:

1. **Authentication > URL Configuration:**
   - Site URL: `https://seu-dominio.vercel.app`
   - Redirect URLs: `https://seu-dominio.vercel.app/auth/callback`

2. **CORS Settings:**
   - Adicione seu domínio de produção à lista de origens permitidas

## Comandos Disponíveis

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview do build local
npm run lint         # Executa ESLint

# Testes (se configurados)
npm run test         # Executa testes
```

## Desenvolvimento

- Importe componentes de `@/components/ui`
- Personalize estilos usando classes Tailwind
- O alias `@/` aponta para o diretório `src/`

**Start Preview**

```shell
pnpm run dev
```

**To build**

```shell
pnpm run build
```
