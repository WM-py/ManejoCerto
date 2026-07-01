import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ShieldCheck, KeyRound, Loader2, Ban, Info } from 'lucide-react';

type Plano = 'lifetime' | 'annual';

export default function Admin() {
  const { toast } = useToast();
  const [checando, setChecando] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [email, setEmail] = useState('');
  const [plano, setPlano] = useState<Plano>('lifetime');
  const [liberando, setLiberando] = useState(false);
  const [revogando, setRevogando] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    supabase.rpc('mc_is_admin').then(({ data }) => {
      setIsAdmin(Boolean(data));
      setChecando(false);
    });
  }, []);

  const liberar = async () => {
    if (!email.trim()) {
      toast({ title: 'Informe o e-mail do cliente', variant: 'destructive' });
      return;
    }
    setLiberando(true);
    const { data, error } = await supabase.rpc('mc_grant_access', {
      p_email: email.trim(),
      p_plan: plano,
    });
    setLiberando(false);

    if (error) {
      toast({ title: 'Não foi possível liberar', description: error.message, variant: 'destructive' });
      return;
    }
    const nome = (data as { nome_fazenda?: string })?.nome_fazenda;
    toast({
      title: 'Acesso liberado! ✅',
      description: `${email.trim()} agora tem o plano ${plano === 'lifetime' ? 'vitalício' : 'anual'}${nome ? ` (${nome})` : ''}.`,
    });
    setEmail('');
  };

  const revogar = async () => {
    setConfirmRevoke(false);
    if (!email.trim()) {
      toast({ title: 'Informe o e-mail do cliente', variant: 'destructive' });
      return;
    }
    setRevogando(true);
    const { error } = await supabase.rpc('mc_revoke_access', { p_email: email.trim() });
    setRevogando(false);

    if (error) {
      toast({ title: 'Não foi possível revogar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Acesso revogado', description: `${email.trim()} foi bloqueado.` });
  };

  if (checando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <section className="rounded-xl border border-ink-200 bg-white p-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-danger-soft text-danger flex items-center justify-center">
            <Ban className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-ink-900">Acesso restrito</p>
          <p className="text-xs text-ink-500 mt-1">Esta área é somente para administradores.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-12 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-brand" strokeWidth={2.2} />
          Administração
        </h1>
        <p className="text-sm text-ink-500 mt-0.5">
          Liberar ou revogar o acesso de clientes após o pagamento.
        </p>
      </div>

      <div className="rounded-lg bg-info-soft border border-info/20 p-4 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
        <p className="text-xs text-ink-700 leading-relaxed">
          Recebeu o Pix? Digite o e-mail que o cliente usou para <strong>criar a conta</strong> (ele precisa ter se cadastrado antes),
          escolha o plano e clique em <strong>Liberar acesso</strong>. A liberação é imediata.
        </p>
      </div>

      <section className="rounded-xl border border-ink-200 bg-white">
        <div className="px-5 py-4 border-b border-ink-200">
          <h3 className="text-sm font-semibold text-ink-900">Liberar acesso</h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">E-mail do cliente</Label>
            <Input
              type="email"
              placeholder="cliente@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 mt-1.5 rounded-md border-ink-200"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Plano</Label>
            <Select value={plano} onValueChange={(v) => setPlano(v as Plano)}>
              <SelectTrigger className="h-10 mt-1.5 rounded-md border-ink-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lifetime">Vitalício (sem expiração)</SelectItem>
                <SelectItem value="annual">Anual (1 ano)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={liberar}
              disabled={liberando}
              className="h-10 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium px-5"
            >
              {liberando ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <KeyRound className="w-4 h-4 mr-1.5" />}
              Liberar acesso
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmRevoke(true)}
              disabled={revogando}
              className="h-10 rounded-md text-sm border-danger/30 text-danger hover:bg-danger-soft"
            >
              {revogando ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Ban className="w-4 h-4 mr-1.5" />}
              Revogar
            </Button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title="Revogar acesso"
        description={`Bloquear o acesso de ${email.trim() || 'este cliente'}? Ele voltará a ver o paywall.`}
        confirmLabel="Revogar"
        destructive
        onConfirm={revogar}
      />
    </div>
  );
}
