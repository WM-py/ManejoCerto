import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Beef, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RedefinirSenha() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { user, loading: authLoading, updatePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // O link do e-mail de recuperação cria uma sessão temporária.
  // Se não houver sessão após o carregamento, o link é inválido ou expirou.
  const linkInvalido = !authLoading && !user && !success;

  useEffect(() => {
    if (linkInvalido) {
      toast({
        title: 'Link inválido ou expirado',
        description: 'Solicite um novo link de redefinição de senha.',
        variant: 'destructive',
      });
    }
  }, [linkInvalido, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: 'Senha fraca',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'As senhas não conferem',
        description: 'Digite a mesma senha nos dois campos.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      toast({ title: 'Erro ao redefinir senha', description: error.message, variant: 'destructive' });
      return;
    }

    setSuccess(true);
    toast({ title: 'Senha redefinida com sucesso!' });
    setTimeout(() => navigate('/'), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#36454F]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#36454F] via-[#36454F] to-[#556B2F]/80" />

      <Card className="relative z-10 w-full max-w-md mx-4 bg-white/95 backdrop-blur-sm shadow-2xl border-0 rounded-2xl">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto mb-4 w-16 h-16 bg-[#556B2F] rounded-2xl flex items-center justify-center shadow-lg">
            <Beef className="w-9 h-9 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#36454F]">Redefinir Senha</CardTitle>
          <CardDescription className="text-gray-500 text-sm">
            Escolha uma nova senha para sua conta
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          {success ? (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-white" />
              </div>
              <p className="text-gray-500 text-sm">Senha alterada! Redirecionando...</p>
            </div>
          ) : linkInvalido ? (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm mb-6">
                Este link não é mais válido. Volte ao login e solicite um novo.
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full h-14 rounded-xl text-base font-semibold bg-[#556B2F] hover:bg-[#3D4F22] text-white"
              >
                Voltar ao Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#36454F] font-medium">
                  Nova senha
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

              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-[#36454F] font-medium">
                  Confirmar nova senha
                </Label>
                <Input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl border-gray-200 focus:border-[#556B2F] focus:ring-[#556B2F]"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || authLoading}
                className="w-full h-14 rounded-xl text-base font-semibold bg-[#556B2F] hover:bg-[#3D4F22] text-white shadow-lg"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                Salvar nova senha
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
