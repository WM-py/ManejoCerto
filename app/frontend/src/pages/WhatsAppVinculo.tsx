import { useState, useEffect } from 'react';
import { supabase, TABLES } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageCircle, Copy, Check, Link2, RefreshCw } from 'lucide-react';

// Número de WhatsApp do Manejo Certo (para onde o produtor envia o código).
// Configurável por ambiente; no teste é o número da Meta.
const NUMERO_WPP = import.meta.env.VITE_WHATSAPP_NUMERO ?? '+1 (555) 619-9360';

// Sem caracteres ambíguos (0/O, 1/I) para o produtor não errar ao digitar.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function gerarCodigoAleatorio(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return s;
}

interface Vinculo {
  codigo: string;
  wa_id: string | null;
  status: 'pendente' | 'vinculado';
}

export default function WhatsAppVinculo() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [vinculo, setVinculo] = useState<Vinculo | null>(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const fetchVinculo = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from(TABLES.whatsapp_vinculos)
      .select('codigo, wa_id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    setVinculo((data as Vinculo) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    fetchVinculo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const gerarCodigo = async () => {
    if (!user) return;
    setGerando(true);
    const codigo = gerarCodigoAleatorio();
    const { error } = await supabase
      .from(TABLES.whatsapp_vinculos)
      .upsert(
        { user_id: user.id, codigo, status: 'pendente', wa_id: null, linked_at: null },
        { onConflict: 'user_id' }
      );
    if (error) {
      toast({ title: 'Erro ao gerar código', description: error.message, variant: 'destructive' });
    } else {
      setVinculo({ codigo, wa_id: null, status: 'pendente' });
    }
    setGerando(false);
  };

  const copiar = async () => {
    if (!vinculo) return;
    await navigator.clipboard.writeText(vinculo.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <section className="rounded-xl border border-ink-200 bg-white">
      <div className="px-5 py-3 border-b border-ink-200 flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-emerald-100 text-emerald-700">
          <MessageCircle className="w-4 h-4" />
        </span>
        <h3 className="text-sm font-semibold text-ink-900">Conectar WhatsApp</h3>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : vinculo?.status === 'vinculado' ? (
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
              <Check className="w-4 h-4" strokeWidth={2.5} />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-900">WhatsApp conectado</p>
              <p className="text-xs text-ink-500 mt-0.5">
                Número {vinculo.wa_id} já registra direto na sua fazenda.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={gerarCodigo}
                disabled={gerando}
                className="mt-3 h-8 rounded-md text-xs"
              >
                {gerando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Desconectar / trocar número
              </Button>
            </div>
          </div>
        ) : vinculo?.status === 'pendente' ? (
          <div>
            <p className="text-sm text-ink-700">
              Envie este código pelo WhatsApp para <strong>{NUMERO_WPP}</strong> para ativar:
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="text-2xl font-bold tracking-[0.25em] text-brand bg-brand/[0.06] rounded-lg px-4 py-2">
                {vinculo.codigo}
              </code>
              <Button variant="outline" size="sm" onClick={copiar} className="h-9 rounded-md text-xs">
                {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-ink-500 mt-3">
              Depois de vincular, é só mandar mensagens do dia a dia (pesagens, nascimentos,
              vacinas, gastos) que registramos automaticamente. Atualize esta página após enviar.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={gerarCodigo}
              disabled={gerando}
              className="mt-2 h-8 rounded-md text-xs text-ink-500"
            >
              {gerando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Gerar novo código
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-ink-700">
              Registre o rebanho por mensagem de texto ou áudio, sem abrir o sistema no curral.
            </p>
            <Button
              onClick={gerarCodigo}
              disabled={gerando}
              size="sm"
              className="mt-3 h-9 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
            >
              {gerando ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Link2 className="w-4 h-4 mr-1.5" />}
              Gerar código de conexão
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
