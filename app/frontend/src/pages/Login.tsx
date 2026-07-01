import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Beef, Eye, EyeOff, Loader2, CheckCircle2, MailCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Mode = 'login' | 'signup' | 'forgot';

export default function Login() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get('novo') === '1' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeFazenda, setNomeFazenda] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nomeFazendaRef = useRef<HTMLInputElement>(null);
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (mode === 'signup') {
      nomeFazendaRef.current?.focus();
    } else {
      emailRef.current?.focus();
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: 'Erro ao entrar',
            description: error.message === 'Invalid login credentials'
              ? 'Email ou senha incorretos.'
              : error.message,
            variant: 'destructive',
          });
        }
        // Se sucesso, onAuthStateChange atualiza o usuário e o ProtectedRoute redireciona.
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          toast({ title: 'Erro ao enviar e-mail', description: error.message, variant: 'destructive' });
        } else {
          setResetSent(true);
        }
      } else {
        // signup
        if (!nomeFazenda.trim()) {
          toast({
            title: 'Informe o nome da fazenda',
            description: 'Esse nome aparecerá no seu painel.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          toast({
            title: 'Senha fraca',
            description: 'A senha deve ter pelo menos 6 caracteres.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, nomeFazenda.trim());
        if (error) {
          toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' });
        } else {
          setSignUpSuccess(true);
          toast({
            title: 'Conta criada com sucesso!',
            description: 'Verifique seu email para confirmar a conta, ou faça login diretamente.',
          });
          setTimeout(() => {
            setMode('login');
            setSignUpSuccess(false);
          }, 3000);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const BackgroundWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(/login-bg.png)`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-ink-900/90 via-ink-900/70 to-brand/80" />
      {children}
    </div>
  );

  if (signUpSuccess) {
    return (
      <BackgroundWrapper>
        <Card className="relative z-10 w-full max-w-md mx-4 bg-white/95 backdrop-blur-sm shadow-2xl border-0 rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-xl font-bold text-ink-900 mb-2">Conta Criada!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Verifique seu email para confirmar a conta. Após confirmar, faça login para acessar o sistema.
            </p>
            <Button
              onClick={() => { setSignUpSuccess(false); setMode('login'); }}
              className="w-full h-14 rounded-xl text-base font-semibold bg-brand hover:bg-brand-700 text-white"
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </BackgroundWrapper>
    );
  }

  if (resetSent) {
    return (
      <BackgroundWrapper>
        <Card className="relative z-10 w-full max-w-md mx-4 bg-white/95 backdrop-blur-sm shadow-2xl border-0 rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-brand rounded-full flex items-center justify-center">
              <MailCheck className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-xl font-bold text-ink-900 mb-2">E-mail enviado!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Se houver uma conta com <strong>{email}</strong>, você receberá um link para redefinir a senha.
              Verifique também a caixa de spam.
            </p>
            <Button
              onClick={() => { setResetSent(false); setMode('login'); }}
              className="w-full h-14 rounded-xl text-base font-semibold bg-brand hover:bg-brand-700 text-white"
            >
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper>
      <Card className="relative z-10 w-full max-w-md mx-4 bg-white/95 backdrop-blur-sm shadow-2xl border-0 rounded-2xl">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto mb-4 w-16 h-16 bg-brand rounded-2xl flex items-center justify-center shadow-lg">
            <Beef className="w-9 h-9 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-ink-900">Manejo Certo</CardTitle>
          <CardDescription className="text-gray-500 text-sm">
            {mode === 'forgot'
              ? 'Informe seu e-mail para recuperar o acesso'
              : 'Gestão financeira para pecuária de corte'}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="nomeFazenda" className="text-ink-900 font-medium">
                  Nome da fazenda
                </Label>
                <Input
                  ref={nomeFazendaRef}
                  id="nomeFazenda"
                  type="text"
                  placeholder="Ex: Fazenda Boa Vista"
                  value={nomeFazenda}
                  onChange={(e) => setNomeFazenda(e.target.value)}
                  autoComplete="organization"
                  required
                  className="h-12 rounded-xl border-gray-200 focus:border-brand focus:ring-brand"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-ink-900 font-medium">
                Email
              </Label>
              <Input
                ref={emailRef}
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-12 rounded-xl border-gray-200 focus:border-brand focus:ring-brand"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-ink-900 font-medium">
                    Senha
                  </Label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs text-brand hover:text-brand-700 font-medium hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    ref={passwordRef}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    className="h-12 rounded-xl border-gray-200 focus:border-brand focus:ring-brand pr-12"
                  />
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-xl text-base font-semibold bg-brand hover:bg-brand-700 text-white shadow-lg"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar Conta' : 'Enviar link de recuperação'}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {mode === 'forgot' ? (
              <button
                onClick={() => setMode('login')}
                className="text-sm text-brand hover:text-brand-700 font-medium hover:underline"
              >
                Voltar ao login
              </button>
            ) : (
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-sm text-brand hover:text-brand-700 font-medium hover:underline"
              >
                {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </BackgroundWrapper>
  );
}
