import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Beef, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
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
        // If successful, onAuthStateChange in AuthContext will update the user
        // and the ProtectedRoute will redirect to Dashboard
      } else {
        if (password.length < 6) {
          toast({
            title: 'Senha fraca',
            description: 'A senha deve ter pelo menos 6 caracteres.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // Only call signUp - the database trigger handles profile creation
        const { error } = await signUp(email, password);
        if (error) {
          toast({
            title: 'Erro ao cadastrar',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          // Show success message - user may need to confirm email
          // or may be auto-logged in depending on Supabase settings
          setSignUpSuccess(true);
          toast({
            title: 'Conta criada com sucesso!',
            description: 'Verifique seu email para confirmar a conta, ou faça login diretamente.',
          });

          // Wait a moment for the trigger to create the profile,
          // then switch to login mode
          setTimeout(() => {
            setIsLogin(true);
            setSignUpSuccess(false);
          }, 3000);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (signUpSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(https://mgx-backend-cdn.metadl.com/generate/images/1052654/2026-03-23/cefe38d1-27c2-4ccf-9935-ba975f7c62b0.png)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#36454F]/90 via-[#36454F]/70 to-[#556B2F]/80" />

        <Card className="relative z-10 w-full max-w-md mx-4 bg-white/95 backdrop-blur-sm shadow-2xl border-0 rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-xl font-bold text-[#36454F] mb-2">Conta Criada!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Verifique seu email para confirmar a conta. Após confirmar, faça login para acessar o sistema.
            </p>
            <Button
              onClick={() => { setSignUpSuccess(false); setIsLogin(true); }}
              className="w-full h-14 rounded-xl text-base font-semibold bg-[#556B2F] hover:bg-[#3D4F22] text-white"
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(https://mgx-backend-cdn.metadl.com/generate/images/1052654/2026-03-23/cefe38d1-27c2-4ccf-9935-ba975f7c62b0.png)`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#36454F]/90 via-[#36454F]/70 to-[#556B2F]/80" />

      {/* Login Card */}
      <Card className="relative z-10 w-full max-w-md mx-4 bg-white/95 backdrop-blur-sm shadow-2xl border-0 rounded-2xl">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto mb-4 w-16 h-16 bg-[#556B2F] rounded-2xl flex items-center justify-center shadow-lg">
            <Beef className="w-9 h-9 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#36454F]">Manejo Certo</CardTitle>
          <CardDescription className="text-gray-500 text-sm">
            Gestão financeira para pecuária de corte
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#36454F] font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl border-gray-200 focus:border-[#556B2F] focus:ring-[#556B2F]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#36454F] font-medium">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl border-gray-200 focus:border-[#556B2F] focus:ring-[#556B2F] pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-xl text-base font-semibold bg-[#556B2F] hover:bg-[#3D4F22] text-white shadow-lg"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : null}
              {isLogin ? 'Entrar' : 'Criar Conta'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-[#556B2F] hover:text-[#3D4F22] font-medium hover:underline"
            >
              {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}