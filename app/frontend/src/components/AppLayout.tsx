import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  Wallet,
  Beef,
  LogOut,
  Plus,
  Scale,
  BarChart3,
  Settings2,
  Calculator,
  MapPin,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: Wallet },
  { path: '/lotes', label: 'Gestão de Lotes', icon: Beef },
  { path: '/novo-lancamento', label: 'Novo Lançamento', icon: Plus },
  { path: '/compra-venda', label: 'Compra / Venda', icon: Scale },
  { path: '/pastos', label: 'Gestão de Pastos', icon: MapPin },
  { path: '/simulador', label: 'Simulador', icon: Calculator },
  { path: '/parametros', label: 'Parâmetros', icon: Settings2 },
  { path: '/relatorios', label: 'Relatórios Financeiros', icon: BarChart3 },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const [open, setOpen] = useState(false);
  const [nomeFazenda, setNomeFazenda] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase
      .from(TABLES.profiles)
      .select('nome_fazenda')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nome_fazenda) setNomeFazenda(data.nome_fazenda);
      });
  }, [user]);

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleSignOut = () => {
    setOpen(false);
    signOut();
  };

  const NavList = ({ onNavigate }: { onNavigate: (path: string) => void }) => (
    <nav className="flex flex-col flex-1 px-3 py-4">
      <div className="space-y-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#556B2F]/10 text-[#556B2F]'
                  : 'text-[#36454F] hover:bg-gray-100'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#556B2F]' : 'text-gray-400'}`} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="border-t border-gray-200 my-4" />

      <button
        onClick={handleSignOut}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        Sair
      </button>
    </nav>
  );

  const BrandHeader = () => (
    <div className="bg-[#36454F] px-6 py-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#556B2F] rounded-xl flex items-center justify-center">
          <Beef className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white text-lg font-bold leading-tight">Manejo Certo</p>
          <p className="text-xs text-gray-300 truncate">{nomeFazenda || 'Gestão Financeira'}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 bg-[#36454F] text-white px-4 py-3 shadow-lg z-50">
        <div className="flex items-center justify-between lg:pl-64">
          {/* Mobile hamburger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 lg:hidden"
              >
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-white border-r-0">
              <SheetHeader className="p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <BrandHeader />
              </SheetHeader>
              <NavList onNavigate={handleNavigate} />
            </SheetContent>
          </Sheet>

          <h1 className="text-lg font-bold lg:hidden absolute left-1/2 -translate-x-1/2">
            Manejo Certo
          </h1>

          {/* Desktop: farm name */}
          <span className="hidden lg:block text-sm font-semibold text-gray-200">
            {nomeFazenda || 'Manejo Certo'}
          </span>
          <div className="hidden lg:flex items-center gap-2 text-xs text-gray-300">
            <Beef className="w-4 h-4 text-[#9CAF6A]" />
            <span>Gestão Financeira para Pecuária</span>
          </div>

          <div className="w-10 lg:hidden" />
        </div>
      </header>

      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-40">
        <button onClick={() => navigate('/')} className="text-left">
          <BrandHeader />
        </button>
        <NavList onNavigate={(path) => navigate(path)} />
      </aside>

      {/* Main Content */}
      <main className="pt-14 lg:pl-64">{children}</main>
    </div>
  );
}
