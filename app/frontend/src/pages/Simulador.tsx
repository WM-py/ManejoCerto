import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES, formatBRL, kgToArrobas } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ParametroFazenda, FASES_MANEJO } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        <Loader2 className="w-8 h-8 animate-spin text-[#556B2F]" />
      </div>
    );
  }

  if (parametros.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 pb-8">
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold text-lg">Parâmetros não cadastrados</p>
            <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
              Para usar o simulador, primeiro cadastre os parâmetros zootécnicos da sua fazenda
              (Custo Diário, GMD, Rendimento de Carcaça).
            </p>
            <Button
              onClick={() => navigate('/parametros')}
              className="mt-6 bg-[#556B2F] hover:bg-[#3D4F22] text-white rounded-xl"
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Ir para Parâmetros
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#556B2F] rounded-xl flex items-center justify-center">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#36454F]">Simulador de Viabilidade</h2>
          <p className="text-xs text-gray-500">Simule a compra de gado antes de efetivar</p>
        </div>
      </div>

      {/* Fase de Manejo Selector */}
      <Card className="rounded-2xl shadow-sm border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#36454F]">Fase de Manejo</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={faseManejo}
            onChange={(e) => setFaseManejo(e.target.value)}
            className="w-full h-12 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#556B2F]/30"
          >
            {parametros.map((p) => (
              <option key={p.id} value={p.fase_manejo}>
                {p.fase_manejo}
              </option>
            ))}
          </select>

          {selectedParam && (
            <div className="mt-3 bg-[#556B2F]/5 rounded-xl p-4 border border-[#556B2F]/10">
              <p className="text-xs font-semibold text-[#556B2F] mb-2">Parâmetros da fase "{selectedParam.fase_manejo}":</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Custo/cab/dia:</span>
                  <span className="font-semibold text-[#36454F]">{formatBRL(selectedParam.custo_diario_cabeca)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GMD:</span>
                  <span className="font-semibold text-[#36454F]">{selectedParam.gmd_esperado_kg} kg/dia</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Rend. Carcaça:</span>
                  <span className="font-semibold text-[#36454F]">{selectedParam.rendimento_carcaca_perc}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mortalidade:</span>
                  <span className="font-semibold text-[#36454F]">{selectedParam.mortalidade_esperada_perc}%</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Input Form */}
      <Card className="rounded-2xl shadow-sm border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#36454F]">Dados da Simulação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Qtd. Cabeças</Label>
              <Input
                type="number"
                min="1"
                placeholder="0"
                value={qtdCabecas}
                onChange={(e) => setQtdCabecas(e.target.value)}
                className="h-12 rounded-xl border-gray-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Peso Inicial (@/cab)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={pesoInicialArrobas}
                onChange={(e) => setPesoInicialArrobas(e.target.value)}
                className="h-12 rounded-xl border-gray-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Valor Compra @(R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valorCompraArroba}
                onChange={(e) => setValorCompraArroba(e.target.value)}
                className="h-12 rounded-xl border-gray-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Dias de Engorda</Label>
              <Input
                type="number"
                min="1"
                placeholder="0"
                value={diasEngorda}
                onChange={(e) => setDiasEngorda(e.target.value)}
                className="h-12 rounded-xl border-gray-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-gray-600">Preço Venda Esperado @ (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={precoVendaArroba}
              onChange={(e) => setPrecoVendaArroba(e.target.value)}
              className="h-14 rounded-xl text-xl font-bold text-center border-gray-200 focus:border-[#556B2F] focus:ring-[#556B2F]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      {calc && (
        <Card
          className={`rounded-2xl shadow-lg border-2 ${
            calc.isLucro ? 'border-green-300 bg-green-50/50' : 'border-red-300 bg-red-50/50'
          }`}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {calc.isLucro ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
              <span className={calc.isLucro ? 'text-green-700' : 'text-red-700'}>
                Resultado da Simulação
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <ResultRow
                label="Investimento de Compra"
                value={formatBRL(calc.investimentoCompra)}
                muted
              />
              <ResultRow
                label="Custo de Engorda"
                value={formatBRL(calc.custoEngorda)}
                muted
              />
              <div className="border-t border-gray-200 pt-2">
                <ResultRow
                  label="Custo Total"
                  value={formatBRL(calc.custoTotal)}
                  bold
                />
              </div>
              <div className="border-t border-gray-200 pt-2">
                <ResultRow
                  label="@ Produzidas (total)"
                  value={`${calc.totalArrobasProduzidas.toFixed(2)} @`}
                  muted
                />
                <ResultRow
                  label="@ Final/cabeça"
                  value={`${calc.arrobasFinalPorCabeca.toFixed(2)} @`}
                  muted
                />
              </div>
              <div className="border-t border-gray-200 pt-2">
                <ResultRow
                  label="Faturamento Bruto"
                  value={formatBRL(calc.faturamentoBruto)}
                  bold
                />
              </div>
              <div className="border-t-2 border-gray-300 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#36454F]">Lucro Líquido Projetado</span>
                  <span
                    className={`text-xl font-extrabold ${
                      calc.isLucro ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatBRL(calc.lucroLiquido)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div
                  className={`rounded-xl p-3 text-center ${
                    calc.isLucro ? 'bg-green-100' : 'bg-red-100'
                  }`}
                >
                  <p className="text-xs text-gray-500">Rentabilidade</p>
                  <p
                    className={`text-lg font-bold ${
                      calc.isLucro ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {calc.rentabilidade.toFixed(2)}%
                  </p>
                </div>
                <div
                  className={`rounded-xl p-3 text-center ${
                    calc.isLucro ? 'bg-green-100' : 'bg-red-100'
                  }`}
                >
                  <p className="text-xs text-gray-500">Rentabilidade a.m.</p>
                  <p
                    className={`text-lg font-bold ${
                      calc.isLucro ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {calc.rentabilidadeMensal.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Efetivar Compra Button */}
            <Button
              onClick={handleEfetivarCompra}
              className="w-full h-16 rounded-2xl text-lg font-bold shadow-xl bg-[#556B2F] hover:bg-[#3D4F22] text-white mt-4"
            >
              <ArrowRight className="w-6 h-6 mr-2" />
              Efetivar Compra
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${muted ? 'text-gray-500' : 'text-[#36454F]'} ${bold ? 'font-semibold' : ''}`}>
        {label}
      </span>
      <span className={`text-sm ${bold ? 'font-bold text-[#36454F]' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}