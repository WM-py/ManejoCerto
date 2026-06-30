import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES, formatBRL, kgToArrobas } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ParametroFazenda } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Calculator,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  Settings2,
} from 'lucide-react';

export default function Simulador() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [parametros, setParametros] = useState<ParametroFazenda[]>([]);
  const [loading, setLoading] = useState(true);

  // Form inputs
  const [faseManejo, setFaseManejo] = useState('');
  const [qtdCabecas, setQtdCabecas] = useState('');
  const [pesoInicialArrobas, setPesoInicialArrobas] = useState('');
  const [valorCompraArroba, setValorCompraArroba] = useState('');
  const [diasEngorda, setDiasEngorda] = useState('');
  const [precoVendaArroba, setPrecoVendaArroba] = useState('');

  // Selected parameter (auto-filled from DB)
  const selectedParam = useMemo(
    () => parametros.find((p) => p.fase_manejo === faseManejo),
    [parametros, faseManejo]
  );

  useEffect(() => {
    const fetchParametros = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from(TABLES.parametros_fazenda)
        .select('*')
        .eq('user_id', user.id)
        .order('fase_manejo');
      if (error) {
        toast({ title: 'Erro ao carregar parâmetros', description: error.message, variant: 'destructive' });
      } else {
        const params = (data || []) as ParametroFazenda[];
        setParametros(params);
        if (params.length > 0) {
          setFaseManejo(params[0].fase_manejo);
        }
      }
      setLoading(false);
    };
    fetchParametros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Calculations
  const calc = useMemo(() => {
    const cabecas = Number(qtdCabecas) || 0;
    const pesoInicial = Number(pesoInicialArrobas) || 0; // in @
    const valorCompra = Number(valorCompraArroba) || 0;
    const dias = Number(diasEngorda) || 0;
    const precoVenda = Number(precoVendaArroba) || 0;
    const custoDiario = selectedParam?.custo_diario_cabeca || 0;
    const gmd = selectedParam?.gmd_esperado_kg || 0;

    if (cabecas <= 0 || pesoInicial <= 0 || valorCompra <= 0 || dias <= 0 || precoVenda <= 0) {
      return null;
    }

    // Investimento de Compra = Qtd * Peso Inicial @ * Valor Compra @
    const investimentoCompra = cabecas * pesoInicial * valorCompra;

    // Custo de Engorda = Qtd * Dias * Custo Diário da Fase
    const custoEngorda = cabecas * dias * custoDiario;

    // Total de @ Produzidas = (GMD * Dias) / 30 per head, then * cabecas
    const kgGanhosPorCabeca = gmd * dias;
    const arrobasProduzidasPorCabeca = kgToArrobas(kgGanhosPorCabeca);
    const totalArrobasProduzidas = arrobasProduzidasPorCabeca * cabecas;

    // Faturamento Bruto = Qtd * (@ Inicial + @ Produzidas por cab) * Preço Venda @
    const arrobasFinalPorCabeca = pesoInicial + arrobasProduzidasPorCabeca;
    const faturamentoBruto = cabecas * arrobasFinalPorCabeca * precoVenda;

    // Lucro Líquido = Faturamento - (Investimento + Custo Engorda)
    const custoTotal = investimentoCompra + custoEngorda;
    const lucroLiquido = faturamentoBruto - custoTotal;

    // Rentabilidade (%) = (Lucro / Custo Total) * 100
    const rentabilidade = custoTotal > 0 ? (lucroLiquido / custoTotal) * 100 : 0;

    // Rentabilidade a.m. (%) = Rentabilidade / (Dias / 30)
    const meses = dias / 30;
    const rentabilidadeMensal = meses > 0 ? rentabilidade / meses : 0;

    // Peso final total in kg (for pre-fill)
    const pesoFinalTotalKg = cabecas * (pesoInicial * 30 + kgGanhosPorCabeca);

    return {
      investimentoCompra,
      custoEngorda,
      custoTotal,
      totalArrobasProduzidas,
      arrobasProduzidasPorCabeca,
      arrobasFinalPorCabeca,
      faturamentoBruto,
      lucroLiquido,
      rentabilidade,
      rentabilidadeMensal,
      pesoFinalTotalKg,
      isLucro: lucroLiquido >= 0,
    };
  }, [qtdCabecas, pesoInicialArrobas, valorCompraArroba, diasEngorda, precoVendaArroba, selectedParam]);

  const handleEfetivarCompra = () => {
    if (!calc) return;
    // Navigate to CompraVenda with pre-filled values via query params
    const params = new URLSearchParams({
      qtd: qtdCabecas,
      peso: String(Math.round(Number(qtdCabecas) * Number(pesoInicialArrobas) * 30)),
      valor: String(Math.round(calc.investimentoCompra * 100) / 100),
    });
    navigate(`/compra-venda?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  if (parametros.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <section className="rounded-xl border border-warning/40 bg-warning-soft p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-warning/15 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-warning" />
          </div>
          <p className="text-base font-semibold text-ink-900">Parâmetros não cadastrados</p>
          <p className="text-sm text-ink-500 mt-1 max-w-sm mx-auto">
            Para usar o simulador, cadastre antes os parâmetros zootécnicos da sua fazenda (custo diário, GMD, rendimento de carcaça).
          </p>
          <Button
            onClick={() => navigate('/parametros')}
            size="sm"
            className="mt-5 h-9 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium"
          >
            <Settings2 className="w-4 h-4 mr-1.5" />
            Ir para parâmetros
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-12 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight flex items-center gap-2">
          <Calculator className="w-6 h-6 text-brand" strokeWidth={2.2} />
          Simulador de viabilidade
        </h1>
        <p className="text-sm text-ink-500 mt-0.5">
          Projete o resultado de uma compra antes de efetivar a operação.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Coluna esquerda: inputs */}
        <div className="lg:col-span-3 space-y-5">
          {/* Fase de Manejo */}
          <section className="rounded-xl border border-ink-200 bg-white">
            <div className="px-5 py-4 border-b border-ink-200">
              <h3 className="text-sm font-semibold text-ink-900">Fase de manejo</h3>
              <p className="text-xs text-ink-500 mt-0.5">Define os parâmetros zootécnicos da simulação.</p>
            </div>
            <div className="p-5 space-y-3">
              <select
                value={faseManejo}
                onChange={(e) => setFaseManejo(e.target.value)}
                className="w-full h-10 rounded-md border border-ink-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {parametros.map((p) => (
                  <option key={p.id} value={p.fase_manejo}>{p.fase_manejo}</option>
                ))}
              </select>

              {selectedParam && (
                <div className="bg-brand/[0.04] border border-brand/15 rounded-md p-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-500">Custo/cab/dia</span>
                      <span className="font-semibold text-ink-900 tabular-nums">{formatBRL(selectedParam.custo_diario_cabeca)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-500">GMD</span>
                      <span className="font-semibold text-ink-900 tabular-nums">{selectedParam.gmd_esperado_kg} kg/d</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-500">Rend. carcaça</span>
                      <span className="font-semibold text-ink-900 tabular-nums">{selectedParam.rendimento_carcaca_perc}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-500">Mortalidade</span>
                      <span className="font-semibold text-ink-900 tabular-nums">{selectedParam.mortalidade_esperada_perc}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Inputs */}
          <section className="rounded-xl border border-ink-200 bg-white">
            <div className="px-5 py-4 border-b border-ink-200">
              <h3 className="text-sm font-semibold text-ink-900">Dados da simulação</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Qtd. cabeças</Label>
                  <Input
                    type="number" min="1" placeholder="0"
                    value={qtdCabecas} onChange={(e) => setQtdCabecas(e.target.value)}
                    className="h-10 mt-1.5 rounded-md border-ink-200 tabular-nums"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Peso inicial (@/cab)</Label>
                  <Input
                    type="number" step="0.01" min="0" placeholder="0,00"
                    value={pesoInicialArrobas} onChange={(e) => setPesoInicialArrobas(e.target.value)}
                    className="h-10 mt-1.5 rounded-md border-ink-200 tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Valor compra @ (R$)</Label>
                  <Input
                    type="number" step="0.01" min="0" placeholder="0,00"
                    value={valorCompraArroba} onChange={(e) => setValorCompraArroba(e.target.value)}
                    className="h-10 mt-1.5 rounded-md border-ink-200 tabular-nums"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Dias de engorda</Label>
                  <Input
                    type="number" min="1" placeholder="0"
                    value={diasEngorda} onChange={(e) => setDiasEngorda(e.target.value)}
                    className="h-10 mt-1.5 rounded-md border-ink-200 tabular-nums"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Preço venda esperado @ (R$)</Label>
                <Input
                  type="number" step="0.01" min="0" placeholder="0,00"
                  value={precoVendaArroba} onChange={(e) => setPrecoVendaArroba(e.target.value)}
                  className="h-12 mt-1.5 rounded-md text-lg font-bold tabular-nums text-center border-ink-200 focus:border-brand focus:ring-brand text-brand"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Coluna direita: resultado */}
        <div className="lg:col-span-2">
          {calc ? (
            <section className={`rounded-xl border bg-white sticky top-20 ${
              calc.isLucro ? 'border-success/40' : 'border-danger/40'
            }`}>
              <div className={`px-5 py-3 border-b flex items-center gap-2 ${
                calc.isLucro ? 'border-success/30 bg-success-soft' : 'border-danger/30 bg-danger-soft'
              }`}>
                {calc.isLucro ? (
                  <TrendingUp className="w-4 h-4 text-success" strokeWidth={2.4} />
                ) : (
                  <TrendingDown className="w-4 h-4 text-danger" strokeWidth={2.4} />
                )}
                <h3 className={`text-sm font-semibold ${calc.isLucro ? 'text-success' : 'text-danger'}`}>
                  Resultado da simulação
                </h3>
              </div>
              <div className="p-5 space-y-3">
                <ResultRow label="Investimento de compra" value={formatBRL(calc.investimentoCompra)} muted />
                <ResultRow label="Custo de engorda" value={formatBRL(calc.custoEngorda)} muted />
                <div className="border-t border-ink-200 pt-2.5">
                  <ResultRow label="Custo total" value={formatBRL(calc.custoTotal)} bold />
                </div>
                <div className="border-t border-ink-200 pt-2.5 space-y-1.5">
                  <ResultRow label="@ produzidas (total)" value={`${calc.totalArrobasProduzidas.toFixed(2)} @`} muted />
                  <ResultRow label="@ final/cabeça" value={`${calc.arrobasFinalPorCabeca.toFixed(2)} @`} muted />
                </div>
                <div className="border-t border-ink-200 pt-2.5">
                  <ResultRow label="Faturamento bruto" value={formatBRL(calc.faturamentoBruto)} bold />
                </div>
                <div className="border-t-2 border-ink-200 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-ink-700 uppercase tracking-wider">
                      Lucro líquido projetado
                    </span>
                    <span className={`text-xl font-extrabold tabular-nums ${
                      calc.isLucro ? 'text-success' : 'text-danger'
                    }`}>
                      {formatBRL(calc.lucroLiquido)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className={`rounded-md p-2.5 text-center ${
                    calc.isLucro ? 'bg-success-soft' : 'bg-danger-soft'
                  }`}>
                    <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">Rentab.</p>
                    <p className={`text-base font-bold tabular-nums mt-0.5 ${
                      calc.isLucro ? 'text-success' : 'text-danger'
                    }`}>
                      {calc.rentabilidade.toFixed(1)}%
                    </p>
                  </div>
                  <div className={`rounded-md p-2.5 text-center ${
                    calc.isLucro ? 'bg-success-soft' : 'bg-danger-soft'
                  }`}>
                    <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">a.m.</p>
                    <p className={`text-base font-bold tabular-nums mt-0.5 ${
                      calc.isLucro ? 'text-success' : 'text-danger'
                    }`}>
                      {calc.rentabilidadeMensal.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleEfetivarCompra}
                  className="w-full h-10 mt-2 rounded-md text-sm font-medium bg-brand hover:bg-brand-700 text-white"
                >
                  Efetivar compra
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-dashed border-ink-200 bg-white p-8 text-center">
              <Calculator className="w-10 h-10 text-ink-200 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-ink-500">Preencha os dados ao lado para ver o resultado.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${muted ? 'text-ink-500' : 'text-ink-700'} ${bold ? 'font-semibold' : ''}`}>
        {label}
      </span>
      <span className={`text-sm tabular-nums ${bold ? 'font-bold text-ink-900' : 'text-ink-700'}`}>{value}</span>
    </div>
  );
}