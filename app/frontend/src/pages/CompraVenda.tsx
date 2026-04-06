import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, TABLES, formatBRL, kgToArrobas } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lote, Pasto } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShoppingCart, TrendingUp, Scale, Save, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { gerarReciboPDF } from '@/lib/pdf';

export default function CompraVenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [operacao, setOperacao] = useState<'COMPRA' | 'VENDA'>('COMPRA');
  const [nomeLote, setNomeLote] = useState('');
  const [sexo, setSexo] = useState<string>('Macho');
  const [qtdCabecas, setQtdCabecas] = useState('');
  const [pesoTotalKg, setPesoTotalKg] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [descricao, setDescricao] = useState('');
  const [loteId, setLoteId] = useState('');
  const [pastoId, setPastoId] = useState('');
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [pastos, setPastos] = useState<Pasto[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<{
    tipo: 'COMPRA' | 'VENDA';
    nomeLote: string;
    qtdCabecas: number;
    pesoTotalKg: number;
    valorTotal: number;
    valorPorArroba: number;
    data: string;
    descricao: string;
  } | null>(null);

  // Pre-fill from Simulador query params
  useEffect(() => {
    const qtdParam = searchParams.get('qtd');
    const pesoParam = searchParams.get('peso');
    const valorParam = searchParams.get('valor');
    if (qtdParam) setQtdCabecas(qtdParam);
    if (pesoParam) setPesoTotalKg(pesoParam);
    if (valorParam) setValorTotal(valorParam);
    if (qtdParam || pesoParam || valorParam) {
      setDescricao('Compra via Simulador de Viabilidade');
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      const [lotesRes, pastosRes] = await Promise.all([
        supabase.from(TABLES.lotes).select('*').eq('status', 'ativo').order('nome_lote'),
        supabase.from(TABLES.pastos).select('*').order('nome_pasto'),
      ]);
      if (lotesRes.data) setLotes(lotesRes.data as Lote[]);
      if (pastosRes.data) setPastos(pastosRes.data as Pasto[]);
    };
    fetchData();
  }, []);

  const calcularCategoria = (sexoParam: string, pesoTotal: number, qtd: number): string => {
    const pesoMedio = qtd > 0 ? pesoTotal / qtd : 0;
    const sexoUpper = sexoParam;

    if (sexoUpper === 'Misto') return 'Lote Misto';
    if (sexoUpper === 'Macho') {
      if (pesoMedio <= 210) return 'Bezerros';
      if (pesoMedio <= 360) return 'Garrotes';
      return 'Bois';
    }

    // Fêmea
    if (pesoMedio <= 210) return 'Bezerras';
    if (pesoMedio <= 300) return 'Novilhas';
    return 'Vacas';
  };

  const arrobas = pesoTotalKg ? kgToArrobas(Number(pesoTotalKg)) : 0;
  const valorPorArroba = arrobas > 0 && valorTotal ? Number(valorTotal) / arrobas : 0;
  const pesoMedioPorCabeca = Number(qtdCabecas) > 0 && Number(pesoTotalKg) > 0
    ? Number(pesoTotalKg) / Number(qtdCabecas)
    : 0;
  const arrobasPorCabeca = pesoMedioPorCabeca > 0 ? kgToArrobas(pesoMedioPorCabeca) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!qtdCabecas || !pesoTotalKg || !valorTotal || Number(valorTotal) <= 0) {
      toast({ title: 'Preencha todos os campos obrigatorios', variant: 'destructive' });
      return;
    }

    if (operacao === 'COMPRA' && !nomeLote.trim()) {
      toast({ title: 'Informe o nome do lote', variant: 'destructive' });
      return;
    }

    if (operacao === 'VENDA' && !loteId) {
      toast({ title: 'Selecione o lote', variant: 'destructive' });
      return;
    }

    const categoriaLote = calcularCategoria(sexo, Number(pesoTotalKg), Number(qtdCabecas));

    setLoading(true);
    try {
      let targetLoteId = loteId;
      let targetLoteName = nomeLote.trim();

      if (operacao === 'COMPRA') {
        const pesoEntradaKg = Number(pesoTotalKg) / Number(qtdCabecas);
        const insertData: Record<string, unknown> = {
          user_id: user.id,
          nome_lote: nomeLote.trim(),
          qtd_cabecas: Number(qtdCabecas),
          qtd_cabecas_vendidas: 0,
          status: 'ativo',
          data_entrada: data,
          peso_entrada_kg: pesoEntradaKg,
          sexo,
          categoria: categoriaLote,
        };
        if (pastoId) {
          insertData.pasto_id = pastoId;
        }
        const { data: newLote, error: loteError } = await supabase
          .from(TABLES.lotes)
          .insert(insertData)
          .select()
          .single();

        if (loteError) throw loteError;
        targetLoteId = newLote.id;
      } else {
        const selectedLote = lotes.find((l) => l.id === loteId);
        if (selectedLote) targetLoteName = selectedLote.nome_lote;
      }

      const { data: transacao, error: transError } = await supabase
        .from(TABLES.transacoes)
        .insert({
          user_id: user.id,
          tipo: operacao === 'COMPRA' ? 'DESPESA' : 'RECEITA',
          categoria: operacao === 'COMPRA' ? 'COMPRA_GADO' : 'VENDA_GADO',
          valor: Number(valorTotal),
          data,
          lote_id: targetLoteId,
          descricao: descricao || `${operacao === 'COMPRA' ? 'Compra' : 'Venda'} de ${qtdCabecas} cabecas`,
        })
        .select()
        .single();

      if (transError) throw transError;

      const { error: cvError } = await supabase.from(TABLES.compras_vendas).insert({
        transacao_id: transacao.id,
        lote_id: targetLoteId,
        qtd_cabecas: Number(qtdCabecas),
        peso_total_kg: Number(pesoTotalKg),
        valor_por_arroba: valorPorArroba,
      });

      if (cvError) throw cvError;

      if (operacao === 'VENDA') {
        const selectedLote = lotes.find((l) => l.id === loteId);
        if (selectedLote) {
          const newVendidas = selectedLote.qtd_cabecas_vendidas + Number(qtdCabecas);
          await supabase
            .from(TABLES.lotes)
            .update({ qtd_cabecas_vendidas: newVendidas })
            .eq('id', loteId);
        }
      }

      // Save last transaction for PDF
      setLastTransaction({
        tipo: operacao,
        nomeLote: targetLoteName,
        qtdCabecas: Number(qtdCabecas),
        pesoTotalKg: Number(pesoTotalKg),
        valorTotal: Number(valorTotal),
        valorPorArroba,
        data,
        descricao: descricao || `${operacao === 'COMPRA' ? 'Compra' : 'Venda'} de ${qtdCabecas} cabecas`,
      });

      toast({
        title: operacao === 'COMPRA' ? 'Compra registrada!' : 'Venda registrada!',
        description: operacao === 'COMPRA'
          ? `Lote "${nomeLote}" criado com ${qtdCabecas} cabecas`
          : `${qtdCabecas} cabecas vendidas`,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao registrar', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGerarPDF = () => {
    if (!lastTransaction) return;
    gerarReciboPDF({
      tipo: lastTransaction.tipo,
      data: lastTransaction.data,
      valorTotal: lastTransaction.valorTotal,
      qtdCabecas: lastTransaction.qtdCabecas,
      pesoTotalKg: lastTransaction.pesoTotalKg,
      valorPorArroba: lastTransaction.valorPorArroba,
      descricao: lastTransaction.descricao,
      nomeLote: lastTransaction.nomeLote,
      nomeUsuario: user?.email || 'Usuário',
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-8">
      {/* Success state with PDF button */}
      {lastTransaction && (
        <Card className="rounded-2xl shadow-lg border-2 border-green-300 bg-green-50/50 mb-5">
          <CardContent className="p-5 text-center space-y-4">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
              <TrendingUp className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-green-700">
                {lastTransaction.tipo === 'COMPRA' ? 'Compra Registrada!' : 'Venda Registrada!'}
              </p>
              <p className="text-sm text-green-600 mt-1">
                {lastTransaction.qtdCabecas} cabeças • {formatBRL(lastTransaction.valorTotal)}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleGerarPDF}
                className="flex-1 h-12 rounded-xl bg-[#556B2F] hover:bg-[#3D4F22] text-white font-semibold"
              >
                <FileDown className="w-5 h-5 mr-2" />
                Gerar Recibo (PDF)
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="h-12 rounded-xl"
              >
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Operacao Toggle */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOperacao('COMPRA')}
            className={`h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
              operacao === 'COMPRA'
                ? 'bg-[#556B2F] text-white shadow-lg'
                : 'bg-white text-gray-400 border border-gray-200'
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            Compra
          </button>
          <button
            type="button"
            onClick={() => setOperacao('VENDA')}
            className={`h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
              operacao === 'VENDA'
                ? 'bg-green-500 text-white shadow-lg'
                : 'bg-white text-gray-400 border border-gray-200'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            Venda
          </button>
        </div>

        {/* Lote Info */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#36454F]">
              {operacao === 'COMPRA' ? 'Novo Lote' : 'Selecionar Lote'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {operacao === 'COMPRA' ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm text-gray-600">Nome do Lote</Label>
                  <Input
                    placeholder="Ex: Lote Nelore Jan/2026"
                    value={nomeLote}
                    onChange={(e) => setNomeLote(e.target.value)}
                    required
                    className="h-12 rounded-xl border-gray-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-600">Sexo</Label>
                  <Select value={sexo} onValueChange={setSexo}>
                    <SelectTrigger className="h-12 rounded-xl border-gray-200">
                      <SelectValue placeholder="Selecione o sexo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Macho">Macho</SelectItem>
                      <SelectItem value="Fêmea">Fêmea</SelectItem>
                      <SelectItem value="Misto">Misto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {pastos.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">Pasto (opcional)</Label>
                    <Select value={pastoId} onValueChange={setPastoId}>
                      <SelectTrigger className="h-12 rounded-xl border-gray-200">
                        <SelectValue placeholder="Selecione o pasto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem pasto</SelectItem>
                        {pastos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome_pasto} (cap. {p.capacidade_cabecas})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Lote</Label>
                <Select value={loteId} onValueChange={setLoteId}>
                  <SelectTrigger className="h-12 rounded-xl border-gray-200">
                    <SelectValue placeholder="Selecione o lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes.map((lote) => (
                      <SelectItem key={lote.id} value={lote.id}>
                        {lote.nome_lote} ({lote.qtd_cabecas - lote.qtd_cabecas_vendidas} cab. disponiveis)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Qtd. Cabecas</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={qtdCabecas}
                  onChange={(e) => setQtdCabecas(e.target.value)}
                  required
                  className="h-12 rounded-xl border-gray-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Data</Label>
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="h-12 rounded-xl border-gray-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pesagem e Valor */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#36454F] flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#556B2F]" />
              Pesagem e Valor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Peso Total (kg)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={pesoTotalKg}
                onChange={(e) => setPesoTotalKg(e.target.value)}
                required
                className="h-12 rounded-xl border-gray-200"
              />
            </div>

            {Number(pesoTotalKg) > 0 && (
              <div className="bg-[#556B2F]/5 rounded-xl p-4 border border-[#556B2F]/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total em Arrobas (@)</span>
                  <span className="text-lg font-bold text-[#556B2F]">
                    {arrobas.toFixed(2)} @
                  </span>
                </div>
                {pesoMedioPorCabeca > 0 && (
                  <div className="flex items-center justify-between border-t border-[#556B2F]/10 pt-2">
                    <span className="text-xs text-gray-500">Peso medio/cabeca</span>
                    <span className="text-sm font-semibold text-[#36454F]">
                      {pesoMedioPorCabeca.toFixed(1)} kg ({arrobasPorCabeca.toFixed(2)} @)
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Valor Total (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                required
                className="h-14 rounded-xl text-2xl font-bold text-center border-gray-200 focus:border-[#556B2F] focus:ring-[#556B2F]"
              />
            </div>

            {valorPorArroba > 0 && (
              <div className="bg-[#556B2F]/5 rounded-xl p-4 border border-[#556B2F]/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Valor por Arroba (@)</span>
                  <span className="text-lg font-bold text-[#556B2F]">
                    {formatBRL(valorPorArroba)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Descricao (opcional)</Label>
              <Input
                placeholder="Ex: Compra de 50 novilhas Nelore"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="h-12 rounded-xl border-gray-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          type="submit"
          disabled={loading}
          className={`w-full h-16 rounded-2xl text-lg font-bold shadow-xl text-white ${
            operacao === 'COMPRA'
              ? 'bg-[#556B2F] hover:bg-[#3D4F22]'
              : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />}
          {operacao === 'COMPRA' ? 'Registrar Compra e Criar Lote' : 'Registrar Venda'}
        </Button>
      </form>
    </div>
  );
}