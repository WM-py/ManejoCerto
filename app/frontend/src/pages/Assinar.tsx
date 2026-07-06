import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Beef, Check, Loader2, ShieldCheck } from 'lucide-react';
import { iniciarCheckout, type MercadoPagoPlan } from '@/lib/mercadopago';
import { useToast } from '@/hooks/use-toast';

const WHATSAPP_COMERCIAL =
  'https://wa.me/5585997314537?text=Ol%C3%A1%2C%20quero%20comprar%20o%20Manejo%20Certo%20e%20receber%20uma%20proposta%20comercial.';

function PlanItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-ink-700">
      <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
      <span>{text}</span>
    </li>
  );
}

export default function Assinar() {
  const [loadingPlan, setLoadingPlan] = useState<MercadoPagoPlan | null>(null);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    if (searchParams.get('pagamento') === 'falhou') {
      toast({
        title: 'Pagamento não concluído',
        description: 'Nenhuma cobrança foi feita. Você pode tentar novamente quando quiser.',
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckout = async (plan: MercadoPagoPlan) => {
    setLoadingPlan(plan);
    try {
      const url = await iniciarCheckout(plan);
      window.location.href = url;
    } catch (err) {
      toast({
        title: 'Não foi possível abrir o pagamento',
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="bg-white border-b border-ink-200">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center">
              <Beef className="w-5 h-5 text-white" strokeWidth={2.4} />
            </div>
            <span className="text-lg font-bold tracking-tight text-ink-900">Manejo Certo</span>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium text-ink-700 hover:bg-ink-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao painel
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 lg:px-8 py-10 lg:py-14">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand">Planos</p>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 mt-3">
            Continue com o Manejo Certo
          </h1>
          <p className="mt-3 text-ink-600">
            Pagamento seguro pelo Mercado Pago — Pix, cartão ou boleto. O plano é ativado
            automaticamente na sua conta assim que o pagamento for aprovado.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Anual */}
          <div className="relative rounded-2xl border-2 border-brand bg-white p-7 flex flex-col shadow-lg shadow-brand/10">
            <span className="absolute -top-3 left-4 rounded-full bg-brand text-white text-xs font-semibold px-3 py-1 uppercase tracking-[0.18em]">
              Mais popular
            </span>
            <p className="text-sm font-semibold text-brand uppercase tracking-wider">Anual</p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight text-ink-900 money">R$ 497</span>
              <span className="text-ink-600 font-medium">/ano</span>
            </div>
            <p className="mt-1 text-sm text-ink-600">menos de R$ 42 por mês</p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {['Todos os recursos liberados', 'Lotes e lançamentos ilimitados', 'Anexo de notas fiscais', 'Atualizações incluídas', 'Suporte por WhatsApp'].map((t) => (
                <PlanItem key={t} text={t} />
              ))}
            </ul>
            <button
              onClick={() => handleCheckout('annual')}
              disabled={loadingPlan !== null}
              className="mt-7 h-11 rounded-md bg-ink-900 text-white hover:bg-ink-700 disabled:opacity-60 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {loadingPlan === 'annual' && <Loader2 className="w-4 h-4 animate-spin" />}
              Pagar anual agora
            </button>
          </div>

          {/* Vitalício */}
          <div className="rounded-2xl border border-ink-200 bg-white p-7 flex flex-col">
            <p className="text-sm font-semibold text-brand uppercase tracking-wider">Vitalício</p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight text-ink-900 money">R$ 997</span>
              <span className="text-ink-500 font-medium">uma vez</span>
            </div>
            <p className="mt-1 text-sm text-ink-500">pague uma vez, use para sempre</p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {['Tudo do plano anual', 'Acesso vitalício, sem renovar', 'Preço de lançamento congelado', 'Prioridade em novos recursos', 'Suporte por WhatsApp'].map((t) => (
                <PlanItem key={t} text={t} />
              ))}
            </ul>
            <button
              onClick={() => handleCheckout('lifetime')}
              disabled={loadingPlan !== null}
              className="mt-7 h-11 rounded-md bg-brand text-white hover:bg-brand-700 disabled:opacity-60 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {loadingPlan === 'lifetime' && <Loader2 className="w-4 h-4 animate-spin" />}
              Pagar vitalício agora
            </button>
          </div>
        </div>

        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-ink-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Pagamento processado pelo Mercado Pago · seus dados protegidos
          </p>
          <p className="text-sm text-ink-600">
            Prefere fechar com a nossa equipe?{' '}
            <a href={WHATSAPP_COMERCIAL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
              Fale no WhatsApp
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
