import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  ShieldCheck,
  KeyRound,
  Loader2,
  Ban,
  Info,
  Search,
  RefreshCw,
  MessageCircle,
  Users,
} from 'lucide-react';

type Plano = 'lifetime' | 'annual';

interface Cliente {
  user_id: string;
  email: string;
  criado_em: string;
  nome_fazenda: string | null;
  nome_completo: string | null;
  telefone: string | null;
  cidade: string | null;
  rebanho: string | null;
  plan: string | null;
  plan_status: string | null;
  trial_end: string | null;
}

/** Situação comercial derivada do plano/status/vencimento. */
function situacao(c: Cliente): { label: string; tone: string } {
  const venc = c.trial_end ? new Date(c.trial_end) : null;
  const vencido = venc ? venc.getTime() < Date.now() : false;

  if (c.plan === 'lifetime' && c.plan_status === 'active') {
    return { label: 'Vitalício', tone: 'bg-brand/10 text-brand' };
  }
  if (c.plan === 'annual' && c.plan_status === 'active') {
    if (vencido) return { label: 'Anual vencido', tone: 'bg-danger-soft text-danger' };
    return {
      label: `Anual até ${venc ? venc.toLocaleDateString('pt-BR') : '—'}`,
      tone: 'bg-brand/10 text-brand',
    };
  }
  if (c.plan_status === 'trialing' && venc) {
    if (vencido) return { label: 'Trial expirado', tone: 'bg-danger-soft text-danger' };
    const dias = Math.max(0, Math.ceil((venc.getTime() - Date.now()) / 86400000));
    return { label: `Trial • ${dias}d restantes`, tone: 'bg-amber-100 text-amber-900' };
  }
  if (c.plan_status === 'expired' || vencido) {
    return { label: 'Expirado', tone: 'bg-danger-soft text-danger' };
  }
  return { label: c.plan_status || 'Sem plano', tone: 'bg-ink-100 text-ink-700' };
}

/** Monta o link wa.me a partir do telefone digitado no cadastro. */
function whatsappUrl(telefone: string, nome: string | null): string | null {
  const digits = telefone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const full = digits.startsWith('55') ? digits : `55${digits}`;
  const msg = encodeURIComponent(
    `Olá${nome ? ` ${nome.split(' ')[0]}` : ''}! Aqui é do Manejo Certo. Vi seu cadastro e queria te ajudar a começar. Pode falar?`
  );
  return `https://wa.me/${full}?text=${msg}`;
}

export default function Admin() {
  const { toast } = useToast();
  const [checando, setChecando] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');

  const [acao, setAcao] = useState<{ tipo: 'liberar' | 'revogar'; cliente: Cliente; plano?: Plano } | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.rpc('mc_list_clientes');
    setCarregando(false);
    if (error) {
      toast({ title: 'Não foi possível listar os clientes', description: error.message, variant: 'destructive' });
      return;
    }
    setClientes((data as Cliente[]) || []);
  }, [toast]);

  useEffect(() => {
    supabase.rpc('mc_is_admin').then(({ data }) => {
      const ok = Boolean(data);
      setIsAdmin(ok);
      setChecando(false);
      if (ok) void carregar();
    });
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      [c.email, c.nome_completo, c.nome_fazenda, c.cidade, c.telefone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [clientes, busca]);

  const executarAcao = async () => {
    if (!acao) return;
    const { tipo, cliente, plano } = acao;
    setAcao(null);
    setProcessando(cliente.user_id);
    const { error } =
      tipo === 'liberar'
        ? await supabase.rpc('mc_grant_access', { p_email: cliente.email, p_plan: plano })
        : await supabase.rpc('mc_revoke_access', { p_email: cliente.email });
    setProcessando(null);
    if (error) {
      toast({ title: `Não foi possível ${tipo === 'liberar' ? 'liberar' : 'revogar'}`, description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: tipo === 'liberar' ? 'Acesso liberado! ✅' : 'Acesso revogado',
      description:
        tipo === 'liberar'
          ? `${cliente.email} agora tem o plano ${plano === 'lifetime' ? 'vitalício' : 'anual'}.`
          : `${cliente.email} voltará a ver o paywall.`,
    });
    void carregar();
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

  const totalTrial = clientes.filter((c) => c.plan_status === 'trialing').length;
  const totalPagantes = clientes.filter((c) => c.plan_status === 'active').length;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-12 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand" strokeWidth={2.2} />
            Administração
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Leads, clientes e liberação de acesso.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void carregar()}
          disabled={carregando}
          className="h-9 rounded-md text-sm border-ink-200"
        >
          {carregando ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Cadastros', value: clientes.length },
          { label: 'Em trial', value: totalTrial },
          { label: 'Pagantes', value: totalPagantes },
        ].map((kpi) => (
          <section key={kpi.label} className="rounded-xl border border-ink-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{kpi.label}</p>
            <p className="text-2xl font-bold text-ink-900 tabular-nums mt-0.5">{kpi.value}</p>
          </section>
        ))}
      </div>

      <div className="rounded-lg bg-info-soft border border-info/20 p-4 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
        <p className="text-xs text-ink-700 leading-relaxed">
          O checkout do Mercado Pago ativa o plano <strong>automaticamente</strong> após o pagamento.
          Use <strong>Liberar</strong> apenas para vendas manuais (ex.: Pix direto) e <strong>Revogar</strong> para bloquear um acesso.
          O botão do WhatsApp abre conversa com o número informado no cadastro.
        </p>
      </div>

      {/* Lista de clientes/leads */}
      <section className="rounded-xl border border-ink-200 bg-white">
        <div className="px-5 py-4 border-b border-ink-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" />
            Clientes e leads
            <span className="text-ink-400 font-normal">({filtrados.length})</span>
          </h3>
          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por nome, e-mail, cidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 pl-9 rounded-md border-ink-200 text-sm"
            />
          </div>
        </div>

        {carregando && clientes.length === 0 ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="w-5 h-5 animate-spin text-brand" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm font-medium text-ink-700">
              {busca ? 'Nenhum cliente encontrado para essa busca.' : 'Nenhum cadastro ainda.'}
            </p>
            <p className="text-xs text-ink-500 mt-1">
              {busca ? 'Tente outro termo.' : 'Os cadastros do teste grátis aparecem aqui automaticamente.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-200">
            {filtrados.map((c) => {
              const st = situacao(c);
              const wa = c.telefone ? whatsappUrl(c.telefone, c.nome_completo) : null;
              const ocupado = processando === c.user_id;
              return (
                <li key={c.user_id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-ink-900 truncate">
                        {c.nome_completo || c.nome_fazenda || c.email}
                      </p>
                      <span className={`inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 ${st.tone}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-ink-500 mt-0.5 truncate">
                      {c.email}
                      {c.nome_fazenda ? ` · ${c.nome_fazenda}` : ''}
                      {c.cidade ? ` · ${c.cidade}` : ''}
                      {c.rebanho ? ` · ${c.rebanho}` : ''}
                    </p>
                    <p className="text-[11px] text-ink-400 mt-0.5">
                      Cadastro em {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                      {c.telefone ? ` · ${c.telefone}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center h-8 px-3 rounded-md bg-success-soft text-success text-xs font-semibold hover:opacity-80 transition-opacity"
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                        WhatsApp
                      </a>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setAcao({ tipo: 'liberar', cliente: c, plano: 'annual' })}
                      disabled={ocupado}
                      className="h-8 rounded-md bg-brand hover:bg-brand-700 text-white text-xs px-3"
                    >
                      {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5 mr-1.5" />}
                      Liberar anual
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAcao({ tipo: 'liberar', cliente: c, plano: 'lifetime' })}
                      disabled={ocupado}
                      className="h-8 rounded-md text-xs border-brand/40 text-brand hover:bg-brand/5 px-3"
                    >
                      Vitalício
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAcao({ tipo: 'revogar', cliente: c })}
                      disabled={ocupado}
                      className="h-8 rounded-md text-xs border-danger/30 text-danger hover:bg-danger-soft px-3"
                    >
                      <Ban className="w-3.5 h-3.5 mr-1.5" />
                      Revogar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={acao !== null}
        onOpenChange={(open) => { if (!open) setAcao(null); }}
        title={acao?.tipo === 'revogar' ? 'Revogar acesso' : `Liberar plano ${acao?.plano === 'lifetime' ? 'vitalício' : 'anual'}`}
        description={
          acao?.tipo === 'revogar'
            ? `Bloquear o acesso de ${acao?.cliente.email}? Ele voltará a ver o paywall.`
            : `Ativar o plano ${acao?.plano === 'lifetime' ? 'vitalício (sem expiração)' : 'anual (365 dias)'} para ${acao?.cliente.email}?`
        }
        confirmLabel={acao?.tipo === 'revogar' ? 'Revogar' : 'Liberar'}
        destructive={acao?.tipo === 'revogar'}
        onConfirm={executarAcao}
      />
    </div>
  );
}
