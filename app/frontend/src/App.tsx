import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import AppLayout from '@/components/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import RedefinirSenha from '@/pages/RedefinirSenha';
import Dashboard from '@/pages/Dashboard';
import NovoLancamento from '@/pages/NovoLancamento';
import CompraVenda from '@/pages/CompraVenda';
import LoteDetalhe from '@/pages/LoteDetalhe';
import Lotes from '@/pages/Lotes';
import Relatorios from '@/pages/Relatorios';
import Parametros from '@/pages/Parametros';
import Simulador from '@/pages/Simulador';
import Pastos from '@/pages/Pastos';
import Privacy from '@/pages/Privacy';

function TrialGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading } = useAuth();

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mx-auto mb-3 animate-pulse">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const trialEnd = profile?.trial_end ? new Date(profile.trial_end) : null;
  const isExpired = trialEnd ? trialEnd.getTime() < Date.now() : profile?.plan_status === 'expired';

  if (isExpired) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4 py-10">
        <div className="max-w-xl w-full rounded-3xl border border-ink-200 bg-white p-10 text-center shadow-xl">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-danger-soft text-danger flex items-center justify-center">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Seu período de teste expirou</h1>
          <p className="mt-3 text-sm text-ink-600">
            O acesso ao Manejo Certo foi bloqueado porque o trial de 14 dias chegou ao fim.
            Para continuar usando, escolha um plano ou entre em contato com o suporte.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <a
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-ink-200 px-5 text-sm font-medium text-ink-700 hover:bg-ink-100"
            >
              Voltar para Landing
            </a>
            <a
              href="mailto:suporte@manejocerto.com.br"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Contatar suporte
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route
        path="/"
        element={
          user ? (
            <TrialGate>
              <Dashboard />
            </TrialGate>
          ) : (
            <Landing />
          )
        }
      />
      <Route
        path="/novo-lancamento"
        element={
          <TrialGate>
            <NovoLancamento />
          </TrialGate>
        }
      />
      <Route
        path="/compra-venda"
        element={
          <TrialGate>
            <CompraVenda />
          </TrialGate>
        }
      />
      <Route
        path="/lote/:id"
        element={
          <TrialGate>
            <LoteDetalhe />
          </TrialGate>
        }
      />
      <Route
        path="/lotes"
        element={
          <TrialGate>
            <Lotes />
          </TrialGate>
        }
      />
      <Route
        path="/relatorios"
        element={
          <TrialGate>
            <Relatorios />
          </TrialGate>
        }
      />
      <Route
        path="/parametros"
        element={
          <TrialGate>
            <Parametros />
          </TrialGate>
        }
      />
      <Route
        path="/simulador"
        element={
          <TrialGate>
            <Simulador />
          </TrialGate>
        }
      />
      <Route
        path="/pastos"
        element={
          <TrialGate>
            <Pastos />
          </TrialGate>
        }
      />
      <Route path="/privacidade" element={<Privacy />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;