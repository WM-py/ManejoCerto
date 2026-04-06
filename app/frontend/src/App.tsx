import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import NovoLancamento from '@/pages/NovoLancamento';
import CompraVenda from '@/pages/CompraVenda';
import LoteDetalhe from '@/pages/LoteDetalhe';
import Lotes from '@/pages/Lotes';
import Relatorios from '@/pages/Relatorios';
import Parametros from '@/pages/Parametros';
import Simulador from '@/pages/Simulador';
import Pastos from '@/pages/Pastos';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-[#556B2F] rounded-2xl flex items-center justify-center mx-auto mb-3 animate-pulse">
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
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/novo-lancamento"
        element={
          <ProtectedRoute>
            <NovoLancamento />
          </ProtectedRoute>
        }
      />
      <Route
        path="/compra-venda"
        element={
          <ProtectedRoute>
            <CompraVenda />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lote/:id"
        element={
          <ProtectedRoute>
            <LoteDetalhe />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lotes"
        element={
          <ProtectedRoute>
            <Lotes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/relatorios"
        element={
          <ProtectedRoute>
            <Relatorios />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parametros"
        element={
          <ProtectedRoute>
            <Parametros />
          </ProtectedRoute>
        }
      />
      <Route
        path="/simulador"
        element={
          <ProtectedRoute>
            <Simulador />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pastos"
        element={
          <ProtectedRoute>
            <Pastos />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;