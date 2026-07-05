import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSync } from '@/hooks/useSync';
import { startSync } from '@/lib/sync/engine';
import { supabase, TABLES } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Menu,
  LayoutDashboard,
  Beef,
  LogOut,
  Plus,
  Scale,
  BarChart3,
  Settings2,
  Calculator,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

const NAV_GROUPS = [
  {
    label: 'Geral',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    label: 'Operação',
    items: [
      { path: '/novo-lancamento', label: 'Novo lançamento', icon: Plus },
      { path: '/compra-venda', label: 'Compra / Venda', icon: Scale },
      { path: '/lotes', label: 'Lotes', icon: Beef },
      { path: '/pastos', label: 'Pastos', icon: MapPin },
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      { path: '/simulador', label: 'Simulador', icon: Calculator },
      { path: '/parametros', label: 'Parâmetros', icon: Settings2 },
    ],
  },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center shadow-sm">
        <Beef className="w-5 h-5 text-white" strokeWidth={2.4} />
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-bold text-ink-900 tracking-tight whitespace-nowrap">Manejo Certo</p>
        <p className="text-[10.5px] uppercase tracking-widest text-ink-400 font-semibold whitespace-nowrap">Gestão Pecuária</p>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [open, setOpen] = useState(false);
  const [nomeFazenda, setNomeFazenda] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isOnline = useOnlineStatus();
  const { pending, syncing, failed } = useSync();

  // Inicia o motor de sync uma vez: drena pendências e passa a drenar ao reconectar.
  useEffect(() => {
    startSync();
  }, []);

  // Estado do selo de conectividade/sincronização no cabeçalho.
  const conn = (() => {
    if (!isOnline) {
      return {
        label: pending > 0 ? `Offline · ${pending} pendente${pending === 1 ? '' : 's'}` : 'Offline',
        chip: 'bg-amber-100 text-amber-900',
        dot: 'bg-amber-500',
        title: 'Sem conexão — as alterações serão sincronizadas ao reconectar',
      };
    }
    if (syncing) {
      return {
        label: 'Sincronizando…',
        chip: 'bg-sky-100 text-sky-900',
        dot: 'bg-sky-500 animate-pulse',
        title: 'Enviando alterações pendentes',
      };
    }
    if (pending > 0) {
      return {
        label: `${pending} pendente${pending === 1 ? '' : 's'}`,
        chip: 'bg-amber-100 text-amber-900',
        dot: 'bg-amber-500',
        title: 'Alterações aguardando sincronização',
      };
    }
    if (failed > 0) {
      return {
        label: `${failed} com erro`,
        chip: 'bg-danger-soft text-danger',
        dot: 'bg-danger',
        title: 'Algumas alterações falharam ao sincronizar',
      };
    }
    return {
      label: 'Conectado',
      chip: 'bg-success-soft text-success',
      dot: 'bg-success',
      title: 'Conectado e sincronizado',
    };
  })();

  useEffect(() => {
    if (!user) return;
    supabase.rpc('mc_is_admin').then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user]);

  const navGroups = isAdmin
    ? [...NAV_GROUPS, { label: 'Administração', items: [{ path: '/admin', label: 'Liberar acesso', icon: ShieldCheck }] }]
    : NAV_GROUPS;

  useEffect(() => {
    if (!user) return;
    supabase
      .from(TABLES.profiles)
      .select('nome_fazenda, trial_end, plan, plan_status')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.nome_fazenda) setNomeFazenda(data.nome_fazenda);

        const plan = data.plan;
        const planStatus = data.plan_status;
        const trialEnd = data.trial_end ? new Date(data.trial_end) : null;
        if (trialEnd && planStatus === 'trialing') {
          const diffMs = trialEnd.getTime() - Date.now();
          const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          setProfileStatus(`Teste grátis • ${days} dia${days === 1 ? '' : 's'} restantes`);
          return;
        }

        if (plan === 'annual') {
          setProfileStatus('Plano anual ativo');
          return;
        }

        if (plan === 'lifetime') {
          setProfileStatus('Plano vitalício ativo');
          return;
        }

        if (planStatus === 'active') {
          setProfileStatus('Plano ativo');
          return;
        }

        setProfileStatus('Acesso liberado');
      });
  }, [user]);

  const NavList = ({ onNavigate }: { onNavigate: (path: string) => void }) => (
    <nav className="flex flex-col flex-1 px-3 py-4 overflow-y-auto">
      <div className="flex-1 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => onNavigate(item.path)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand/8 text-brand'
                        : 'text-ink-700 hover:bg-ink-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand' : 'text-ink-400'}`} strokeWidth={2.2} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 mt-4 border-t border-ink-200">
        <button
          onClick={() => { setOpen(false); signOut(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-ink-500 hover:bg-danger-soft hover:text-danger transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={2.2} />
          Sair
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-ink-200 z-50 lg:pl-64">
        <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden -ml-2 text-ink-700">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-white border-r-0 flex flex-col">
                <SheetHeader className="p-4 border-b border-ink-200">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <BrandMark />
                </SheetHeader>
                <NavList
                  onNavigate={(path) => {
                    navigate(path);
                    setOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>

            <div className="lg:hidden shrink-0">
              <BrandMark />
            </div>

            <div className="hidden lg:flex flex-col leading-tight min-w-0">
              <span className="text-[11px] text-ink-400 font-medium uppercase tracking-wider">Fazenda</span>
              <span className="text-sm font-semibold text-ink-900 truncate">
                {nomeFazenda || 'Sua Fazenda'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full text-[11px] font-semibold px-2.5 py-1 shrink-0 ${conn.chip}`}
              title={conn.title}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${conn.dot}`} />
              {conn.label}
            </span>
            {profileStatus && (
              <span className="hidden sm:inline-flex items-center gap-1.5 min-w-0 max-w-[220px] truncate rounded-full bg-amber-100 text-amber-900 text-[11px] font-semibold px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="truncate">{profileStatus}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-ink-200 z-40">
        <button
          onClick={() => navigate('/')}
          className="text-left p-4 border-b border-ink-200 hover:bg-ink-100/50 transition-colors"
        >
          <BrandMark />
        </button>
        <NavList onNavigate={(path) => navigate(path)} />
      </aside>

      <main className="pt-14 lg:pl-64">{children}</main>
    </div>
  );
}
