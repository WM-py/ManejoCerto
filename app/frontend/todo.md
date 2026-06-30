# Manejo Certo - App de Gestão Financeira para Pecuária de Corte

## Design Guidelines

### Design References
- **Nubank/Inter**: Clean financial dashboard, card-based layout
- **Style**: Modern Financial Dashboard + Agro Theme

### Color Palette
- Primary: #556B2F (Verde Oliva - main accent)
- Primary Dark: #3D4F22 (Verde Oliva escuro - hover states)
- Secondary: #36454F (Cinza Grafite - text, sidebar)
- Background: #F8F9FA (Light gray background)
- Card BG: #FFFFFF (White cards)
- Success: #22C55E (Green - receitas)
- Danger: #EF4444 (Red - despesas)
- Warning: #F59E0B (Amber - alerts)
- Text Primary: #1A1A1A
- Text Secondary: #6B7280

### Typography
- Font: Inter (sans-serif)
- Headings: font-weight 700
- Body: font-weight 400

### Key Component Styles
- Cards: White bg, rounded-xl, shadow-sm, border border-gray-100
- Buttons: Large (min-h-14), rounded-xl, Verde Oliva bg for primary actions
- Sidebar: Cinza Grafite bg, white text, Verde Oliva active state
- Mobile: Bottom navigation bar with large touch targets

### Images to Generate
1. **hero-farm-landscape.jpg** - Aerial view of Brazilian cattle ranch with green pastures at golden hour (photorealistic)
2. **logo-manejo-certo.png** - Minimalist cattle/bull head logo icon in olive green color (minimalist)
3. **bg-login-cattle.jpg** - Beautiful cattle grazing in lush green pasture, soft morning light (photorealistic)
4. **icon-empty-state.png** - Simple illustration of a fence with a cow silhouette, minimalist style (minimalist)

---

## Database Tables (Supabase - DONE)
- app_34b6ab49dc_profiles
- app_34b6ab49dc_lotes
- app_34b6ab49dc_transacoes
- app_34b6ab49dc_compras_vendas
- Triggers: auto_close_lote, handle_new_user

## Code Files to Create

1. **src/lib/supabase.ts** - Supabase client configuration
2. **src/lib/types.ts** - TypeScript interfaces for all entities
3. **src/contexts/AuthContext.tsx** - Auth context with login/signup/logout
4. **src/pages/Login.tsx** - Login/Signup page with agro theme
5. **src/pages/Dashboard.tsx** - Main dashboard with cash flow cards, chart, active lots
6. **src/pages/NovoLancamento.tsx** - Quick entry form for income/expenses with optional lot linking
7. **src/pages/CompraVenda.tsx** - Buy/Sell cattle interface with auto lot creation and arroba calc
8. **src/pages/LoteDetalhe.tsx** - DRE per lot with direct costs, revenue, profit per head
9. **src/App.tsx** - Router setup with auth guard