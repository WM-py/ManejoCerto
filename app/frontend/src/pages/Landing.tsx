import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Beef, Scale, Calculator, BarChart3, Paperclip,
  Target, Activity, Check, ArrowRight, Menu, X, ShieldCheck,
  Smartphone, Wallet, ChevronDown, Users, ClipboardList, Sparkles,
} from 'lucide-react';

const WHATSAPP = 'https://wa.me/55859997314537?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20Manejo%20Certo%20e%20como%20come%C3%A7ar.';

const FEATURES = [
  { icon: BarChart3, title: 'DRE por lote', desc: 'Veja o lucro real de cada lote: custo de compra, engorda, despesas e margem — sem planilha.' },
  { icon: Target, title: 'Ponto de equilíbrio', desc: 'Saiba o valor mínimo da @ para não ter prejuízo antes de fechar qualquer venda.' },
  { icon: Activity, title: 'GMD e pesagens', desc: 'Acompanhe o ganho médio diário e a evolução de peso lote a lote.' },
  { icon: Calculator, title: 'Simulador de compra', desc: 'Projete a rentabilidade de uma compra antes de gastar um centavo.' },
  { icon: Wallet, title: 'Fluxo de caixa', desc: 'Receitas e despesas organizadas por categoria, com relatórios prontos.' },
  { icon: Paperclip, title: 'Notas fiscais anexadas', desc: 'Fotografe a nota e guarde junto do lançamento. Nunca mais perca um comprovante.' },
];

const TESTIMONIALS = [
  {
    quote: 'Antes do Manejo Certo eu vendia no chute; hoje sei o ponto exato da arroba e já melhorei minha margem em 12%.',
    name: 'José Almeida, produtor em Quixadá',
  },
  {
    quote: 'O sistema trouxe clareza para cada lote. O fluxo de caixa ficou fácil de entender e a venda ficou mais segura.',
    name: 'Mariana Silva, fazenda São Pedro',
  },
  {
    quote: 'Em 7 dias já identifiquei custos ocultos e otimizei a compra de ração. Meu controlador adorou.',
    name: 'Pedro Costa, pecuária de corte',
  },
];

const ONBOARDING_STEPS = [
  {
    icon: ClipboardList,
    title: 'Cadastre sua fazenda',
    desc: 'Registre lotes, animais e despesas em minutos para ter o controle desde o primeiro dia.',
  },
  {
    icon: Calculator,
    title: 'Veja o lucro por lote',
    desc: 'Acompanhe DRE, custo por arroba e ponto de equilíbrio sem abrir planilha.',
  },
  {
    icon: Sparkles,
    title: 'Decida com confiança',
    desc: 'Venda na hora certa, evite prejuízo e aumente sua margem com dados reais.',
  },
];

const FAQ = [
  { q: 'Preciso instalar alguma coisa?', a: 'Não. O Manejo Certo funciona direto no navegador do computador ou do celular. Você acessa de qualquer lugar, inclusive no campo.' },
  { q: 'Meus dados ficam seguros?', a: 'Sim. Cada fazenda tem seus dados isolados e protegidos. Ninguém além de você acessa seus lançamentos e comprovantes.' },
  { q: 'Serve para qualquer tamanho de fazenda?', a: 'Sim. Seja com 30 ou 3.000 cabeças, o controle de custo por @, GMD e rentabilidade por lote funciona igual.' },
  { q: 'Como funciona o teste grátis?', a: 'Você usa o sistema completo por 14 dias sem pagar nada e sem cartão. Se gostar, escolhe um plano; se não, é só parar.' },
  { q: 'Posso exportar meus dados?', a: 'Os recibos de compra e venda saem em PDF. A exportação completa para planilha está no nosso roteiro de melhorias.' },
];

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white text-ink-900">
      {/* Top nav */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-ink-200">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <a href="#topo" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center shadow-sm">
              <Beef className="w-5 h-5 text-white" strokeWidth={2.4} />
            </div>
            <span className="text-lg font-bold tracking-tight">Manejo Certo</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-ink-700">
            <a href="#recursos" className="hover:text-brand transition-colors">Recursos</a>
            <a href="#planos" className="hover:text-brand transition-colors">Planos</a>
            <a href="#duvidas" className="hover:text-brand transition-colors">Dúvidas</a>
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/login" className="h-9 px-4 rounded-md text-sm font-medium text-ink-700 hover:bg-ink-100 flex items-center transition-colors">
              Entrar
            </Link>
            <Link to="/login?novo=1" className="h-9 px-4 rounded-md text-sm font-semibold bg-brand hover:bg-brand-700 text-white flex items-center transition-colors">
              Teste grátis
            </Link>
          </div>

          <button className="md:hidden p-2 -mr-2 text-ink-700" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-ink-200 bg-white px-4 py-4 space-y-1">
            <a href="#recursos" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-ink-100">Recursos</a>
            <a href="#planos" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-ink-100">Planos</a>
            <a href="#duvidas" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-ink-100">Dúvidas</a>
            <div className="pt-2 flex gap-2">
              <Link to="/login" className="flex-1 h-10 rounded-md border border-ink-200 text-sm font-medium flex items-center justify-center">Entrar</Link>
              <Link to="/login?novo=1" className="flex-1 h-10 rounded-md bg-brand text-white text-sm font-semibold flex items-center justify-center">Teste grátis</Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="topo" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand/[0.06] to-white" />
        <div className="relative max-w-6xl mx-auto px-4 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 text-brand text-xs font-semibold px-3 py-1 mb-5">
              <ShieldCheck className="w-3.5 h-3.5" /> Gestão financeira para pecuária de corte
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">
              Saiba o <span className="text-brand">lucro real</span> de cada lote da sua fazenda.
            </h1>
            <p className="mt-5 text-lg text-ink-600 leading-relaxed">
              Chega de planilha e caderno. Controle custo por arroba, ponto de equilíbrio, GMD e
              rentabilidade lote a lote — no computador ou no celular, direto do campo.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/login?novo=1" className="h-12 px-6 rounded-md bg-brand hover:bg-brand-700 text-white text-base font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors">
                Criar conta grátis
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="h-12 px-6 rounded-md border border-ink-200 text-ink-700 hover:bg-ink-100 text-base font-medium flex items-center justify-center transition-colors">
                Falar no WhatsApp
              </a>
            </div>
            <p className="mt-4 text-sm text-ink-500 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-success" /> Sem instalação · sem cartão · acesso em poucos minutos
            </p>
          </div>

          {/* Product mock */}
          <div className="relative">
            <div className="rounded-2xl border border-ink-200 bg-white shadow-xl shadow-ink-900/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Fazenda Boa Vista</p>
                  <p className="text-sm font-bold">Visão geral</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft text-success text-[11px] font-semibold px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" /> Ao vivo
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                <MockKpi label="Saldo" value="R$ 48,2k" tone="text-success" />
                <MockKpi label="Cabeças" value="312" tone="text-ink-900" />
                <MockKpi label="Patrimônio" value="R$ 1,4M" tone="text-brand" />
              </div>
              <div className="rounded-lg border border-ink-200 p-3">
                <p className="text-xs font-semibold text-ink-700 mb-2">Fluxo de caixa</p>
                <div className="flex items-end gap-2 h-24">
                  {[40, 65, 45, 80, 55, 95].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end gap-0.5">
                      <div className="w-full rounded-t bg-success/80" style={{ height: `${h}%` }} />
                      <div className="w-full rounded-b bg-danger/50" style={{ height: `${h / 3}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 hidden sm:flex items-center gap-2 rounded-lg border border-ink-200 bg-white shadow-lg px-3 py-2">
              <div className="w-8 h-8 rounded-md bg-brand/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-brand" />
              </div>
              <div>
                <p className="text-[10px] text-ink-500 font-semibold uppercase">Equilíbrio</p>
                <p className="text-sm font-bold tabular-nums">R$ 168,27/@</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problema */}
      <section className="border-y border-ink-200 bg-ink-50">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 py-14 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">
            Você sabe exatamente quanto ganhou no último lote?
          </h2>
          <p className="mt-4 text-ink-600 text-lg leading-relaxed">
            A maioria dos pecuaristas descobre o resultado só no fim — e no chute. Sem custo por @,
            sem ponto de equilíbrio e sem GMD, dá pra vender no prejuízo achando que teve lucro.
            O Manejo Certo põe o número na sua frente <span className="font-semibold text-ink-900">antes</span> de você decidir.
          </p>
        </div>
      </section>

      {/* Benefícios de venda */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 py-16 lg:py-20">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 text-brand text-xs font-semibold px-3 py-1 mb-4">
              <ShieldCheck className="w-3.5 h-3.5" /> Mais controle, menos improviso
            </span>
            <h2 className="text-3xl font-bold tracking-tight">O sistema que ajuda o produtor a decidir com segurança</h2>
            <p className="mt-4 text-lg text-ink-600 leading-relaxed">
              Em vez de depender de planilha solta e memória, você acompanha custo, margem, peso e fluxo de caixa em um só lugar.
              Isso significa menos dúvida na hora de vender, comprar e organizar a fazenda.
            </p>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              {[
                'Veja lucro real por lote antes de fechar qualquer operação.',
                'Acompanhe custo por arroba, GMD e ponto de equilíbrio sem complicação.',
                'Organize lançamentos, notas e fluxo de caixa no celular ou no computador.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg bg-ink-50 p-3">
                  <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-700 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Prova social */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand">Clientes satisfeitos</p>
          <h2 className="text-3xl font-bold tracking-tight mt-3">Quem já usa o Manejo Certo decide com mais segurança</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <div key={item.name} className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-ink-600 leading-relaxed">“{item.quote}”</p>
              <p className="mt-5 text-sm font-semibold text-ink-900">{item.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Processo de início */}
      <section className="bg-ink-50">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-16 lg:py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand">Como começar</p>
            <h2 className="text-3xl font-bold tracking-tight mt-3">Comece em 3 passos simples</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {ONBOARDING_STEPS.map((step) => (
              <div key={step.title} className="rounded-3xl border border-ink-200 bg-white p-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-4">
                  <step.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-3 text-sm text-ink-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="max-w-6xl mx-auto px-4 lg:px-8 py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Tudo que a fazenda precisa, num só lugar</h2>
          <p className="mt-3 text-ink-600 text-lg">Do lançamento da despesa ao lucro por cabeça.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-ink-200 bg-white p-6 hover:shadow-md hover:shadow-ink-900/[0.04] transition-shadow">
              <div className="w-11 h-11 rounded-lg bg-brand/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-brand" strokeWidth={2.2} />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-ink-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Destaque */}
      <section className="bg-ink-900 text-white">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-16 lg:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-brand-200 text-xs font-semibold px-3 py-1 mb-4">
              <Scale className="w-3.5 h-3.5" /> Decisão com número, não no achismo
            </span>
            <h2 className="text-3xl font-bold tracking-tight leading-tight">
              O Raio-X da sua fazenda em tempo real
            </h2>
            <p className="mt-4 text-ink-200/90 text-lg leading-relaxed">
              Quantas cabeças, quantas arrobas e quanto vale seu rebanho hoje — atualizado pela cotação da @.
              Some a isso o DRE de cada lote e você vende na hora certa, pelo preço certo.
            </p>
            <ul className="mt-6 space-y-2.5">
              {['Patrimônio vivo avaliado pela cotação atual', 'Lucro projetado por lote antes de encerrar', 'Custo que absorve a mortalidade automaticamente'].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-ink-100">
                  <Check className="w-5 h-5 text-brand-200 flex-shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MockDark icon={Beef} label="Cabeças em pasto" value="312" />
            <MockDark icon={Scale} label="@ estimadas" value="4.180" />
            <MockDark icon={Wallet} label="Valor do rebanho" value="R$ 1,4M" accent />
            <MockDark icon={Activity} label="GMD médio" value="0,92 kg/d" />
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="max-w-6xl mx-auto px-4 lg:px-8 py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Planos que cabem no bolso do produtor</h2>
          <p className="mt-3 text-ink-600 text-lg">
            Comece grátis por 14 dias. Uma negociação de @ melhor já paga o ano inteiro.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Anual */}
          <div className="relative rounded-2xl border-2 border-brand bg-brand-50 p-7 flex flex-col shadow-lg shadow-brand/10">
            <span className="absolute -top-3 left-4 rounded-full bg-brand text-white text-xs font-semibold px-3 py-1 uppercase tracking-[0.18em]">
              Mais popular
            </span>
            <p className="text-sm font-semibold text-brand uppercase tracking-wider">Anual</p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight text-ink-900">R$ 497</span>
              <span className="text-ink-600 font-medium">/ano</span>
            </div>
            <p className="mt-1 text-sm text-ink-600">menos de R$ 42 por mês</p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {['Todos os recursos liberados', 'Lotes e lançamentos ilimitados', 'Anexo de notas fiscais', 'Atualizações incluídas', 'Suporte por WhatsApp'].map((t) => (
                <PlanItem key={t} text={t} />
              ))}
            </ul>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="mt-7 h-11 rounded-md bg-ink-900 text-white hover:bg-ink-800 font-semibold text-sm flex items-center justify-center transition-colors">
              Falar no WhatsApp
            </a>
          </div>

          {/* Vitalício */}
          <div className="rounded-2xl border border-ink-200 bg-white p-7 flex flex-col">
            <p className="text-sm font-semibold text-brand uppercase tracking-wider">Vitalício</p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight">R$ 997</span>
              <span className="text-ink-500 font-medium">uma vez</span>
            </div>
            <p className="mt-1 text-sm text-ink-500">pague uma vez, use para sempre</p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {['Tudo do plano anual', 'Acesso vitalício, sem renovar', 'Preço de lançamento congelado', 'Prioridade em novos recursos', 'Suporte por WhatsApp'].map((t) => (
                <PlanItem key={t} text={t} />
              ))}
            </ul>
            <Link to="/login?novo=1" className="mt-7 h-11 rounded-md border border-brand text-brand hover:bg-brand/5 font-semibold text-sm flex items-center justify-center transition-colors">
              Garantir acesso vitalício
            </Link>
          </div>
        </div>
        <p className="text-center text-xs text-ink-500 mt-6 flex items-center justify-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5" /> Funciona no celular e no computador · seus dados protegidos
        </p>
      </section>

      {/* FAQ */}
      <section id="duvidas" className="border-t border-ink-200 bg-ink-50">
        <div className="max-w-3xl mx-auto px-4 lg:px-8 py-16 lg:py-20">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-10">Dúvidas frequentes</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="rounded-xl border border-ink-200 bg-white overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold">{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-ink-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <p className="px-5 pb-4 text-sm text-ink-600 leading-relaxed">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 py-16 lg:py-20">
        <div className="rounded-2xl bg-brand text-white px-6 py-12 lg:px-16 lg:py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Pare de decidir no escuro.</h2>
          <p className="mt-3 text-brand-100 text-lg max-w-xl mx-auto">
            Comece hoje e veja o lucro real do seu próximo lote. Grátis por 14 dias.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/login?novo=1" className="inline-flex h-12 px-8 rounded-md bg-white text-brand hover:bg-brand-50 text-base font-semibold items-center justify-center gap-2 transition-colors">
              Criar minha conta grátis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 px-8 rounded-md border border-white/30 text-white hover:bg-white/10 text-base font-semibold items-center justify-center transition-colors">
              Falar com um consultor
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-200">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
              <Beef className="w-4 h-4 text-white" strokeWidth={2.4} />
            </div>
            <span className="font-bold">Manejo Certo</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-ink-500">
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="hover:text-brand transition-colors">Suporte</a>
            <Link to="/privacidade" className="hover:text-brand transition-colors">Privacidade</Link>
            <Link to="/login" className="hover:text-brand transition-colors">Entrar</Link>
          </div>
          <p className="text-xs text-ink-400">© {new Date().getFullYear()} Manejo Certo</p>
        </div>
      </footer>
    </div>
  );
}

function MockKpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-ink-200 p-2.5">
      <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function MockDark({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.06] border border-white/10 p-4">
      <Icon className={`w-5 h-5 mb-2 ${accent ? 'text-brand-200' : 'text-ink-300'}`} />
      <p className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${accent ? 'text-brand-200' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function PlanItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
      <span className="text-ink-700">{text}</span>
    </li>
  );
}
