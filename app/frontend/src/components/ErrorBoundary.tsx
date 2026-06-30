import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Em produção, integrar com um serviço de monitoramento (Sentry etc.)
    console.error('ErrorBoundary capturou:', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  private handleHome = () => {
    this.setState({ error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-9 h-9 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-ink-900 mb-2">
            Ops, algo deu errado
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Encontramos um problema ao carregar esta tela. Tente recarregar ou voltar ao início.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={this.handleReload}
              className="flex-1 h-12 rounded-xl bg-brand hover:bg-brand-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recarregar
            </Button>
            <Button
              onClick={this.handleHome}
              variant="outline"
              className="flex-1 h-12 rounded-xl"
            >
              <Home className="w-4 h-4 mr-2" />
              Ir ao Início
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
