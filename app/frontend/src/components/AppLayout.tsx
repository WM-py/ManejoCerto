import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleSignOut = () => {
    setOpen(false);
    signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Top Header */}
      <header className="fixed top-0 left-0 right-0 bg-[#36454F] text-white px-4 py-3 shadow-lg z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
              >
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-white border-r-0">
              <SheetHeader className="bg-[#36454F] px-6 py-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#556B2F] rounded-xl flex items-center justify-center">
                    <Beef className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <SheetTitle className="text-white text-lg font-bold text-left">
                      Manejo Certo
                    </SheetTitle>
                    <p className="text-xs text-gray-300">Gestão Financeira</p>
                  </div>
                </div>
              </SheetHeader>

              <nav className="flex flex-col flex-1 px-3 py-4">
                <div className="space-y-1 flex-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNavigate(item.path)}
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

                {/* Divider */}
                <div className="border-t border-gray-200 my-4" />

                {/* Logout */}
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sair
                </button>
              </nav>
            </SheetContent>
          </Sheet>

          <h1 className="text-lg font-bold absolute left-1/2 -translate-x-1/2">
            Manejo Certo
          </h1>

          {/* Spacer for centering */}
          <div className="w-10" />
        </div>
      </header>

      {/* Main Content with top padding for fixed header */}
      <main className="pt-14">
        {children}
      </main>
    </div>
  );
}