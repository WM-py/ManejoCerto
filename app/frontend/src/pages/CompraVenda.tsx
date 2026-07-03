import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, TABLES, formatBRL, kgToArrobas } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lote, Pasto } from '@/lib/types';
import * as loteRepo from '@/lib/repositories/loteRepo';
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
    if (!user) return;
    const fetchData = async () => {
      const [lotesData, pastosData] = await Promise.all([
        loteRepo.listLotesByStatus(user.id, 'ativo'),
        loteRepo.listPastos(user.id),
      ]);
      // Ordena por nome no seletor (o repo devolve por data de entrada).
      setLotes([...lotesData].sort((a, b) => a.nome_lote.localeCompare(b.nome_lote)));
      setPastos(pastosData);
    };
    fetchData();
  }, [user]);

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
        // RPC transacional: cria o lote E gera N animais + vínculos (brinco provisório)
        targetLoteId = await loteRepo.criarLoteComAnimais({
          nomeLote: nomeLote.trim(),
          qtdCabecas: Number(qtdCabecas),
          pesoEntradaKg,
          dataEntrada: data,
          pastoId: pastoId && pastoId !== 'none' ? pastoId : null,
          sexo,
          categoria: categoriaLote,
        });
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
          descricao: descricao || `${operacao === 'COMPRA' ? 'Compra' : 'Venda'} de ${qtdCabecas} cabeças`,
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
        // RPC: fecha N vínculos (motivo='venda'), marca animais e atualiza o cache
        await loteRepo.registrarVendaSaida({
          loteId: targetLoteId,
          qtd: Number(qtdCabecas),
          data,
        });
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
        descricao: descricao || `${operacao === 'COMPRA' ? 'Compra' : 'Venda'} de ${qtdCabecas} cabeças`,
      });

      toast({
        title: operacao === 'COMPRA' ? 'Compra registrada!' : 'Venda registrada!',
        description: operacao === 'COMPRA'
          ? `Lote "${nomeLote}" criado com ${qtdCabecas} cabeças`
          : `${qtdCabecas} cabeças vendidas`,
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
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-12 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Compra / Venda</h1>
        <p className="text-sm text-ink-500 mt-0.5">
          Registre a entrada (compra) ou saída (venda) de gado.
        </p>
      </div>

      {/* Success card */}
      {lastTransaction && (
        <section className="rounded-xl border border-success/30 bg-success-soft p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-success/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" strokeWidth={2.4} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-success">
                {lastTransaction.tipo === 'COMPRA' ? 'Compra registrada!' : 'Venda registrada!'}
              </p>
              <p className="text-xs text-success/80 tabular-nums">
                {lastTransaction.qtdCabecas} cab. · {formatBRL(lastTransaction.valorTotal)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleGerarPDF}
                size="sm"
                className="h-9 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium"
              >
                <FileDown className="w-4 h-4 mr-1.5" />
                Gerar recibo
              </Button>
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                size="sm"
                className="h-9 rounded-md text-sm"
              >
                Concluir
              </Button>
            </div>
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Operacao segmented */}
        <div className="grid grid-cols-2 gap-2 bg-white border border-ink-200 rounded-md p-1">
          <button
            type="button"
            onClick={() => setOperacao('COMPRA')}
            className={`h-9 rounded-[5px] text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
              operacao === 'COMPRA'
                ? 'bg-brand text-white shadow-sm'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Compra
          </button>
          <button
            type="button"
            onClick={() => setOperacao('VENDA')}
            className={`h-9 rounded-[5px] text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
              operacao === 'VENDA'
                ? 'bg-success text-white shadow-sm'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Venda
          </button>
        </div>

        {/* Lote */}
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="px-5 py-4 border-b border-ink-200">
            <h3 className="text-sm font-semibold text-ink-900">
              {operacao === 'COMPRA' ? 'Novo lote' : 'Selecionar lote'}
            </h3>
            <p className="text-xs text-ink-500 mt-0.5">
              {operacao === 'COMPRA' ? 'Um novo lote será criado para essa compra.' : 'Escolha de qual lote sairá o gado.'}
            </p>
          </div>
          <div className="p-5 space-y-4">
            {operacao === 'COMPRA' ? (
              <>
                <div>
                  <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Nome do lote</Label>
                  <Input
                    placeholder="Ex: Lote Nelore Jan/2026"
                    value={nomeLote}
                    onChange={(e) => setNomeLote(e.target.value)}
                    required
                    className="h-10 mt-1.5 rounded-md border-ink-200"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Sexo</Label>
                    <Select value={sexo} onValueChange={setSexo}>
                      <SelectTrigger className="h-10 mt-1.5 rounded-md border-ink-200">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Macho">Macho</SelectItem>
                        <SelectItem value="Fêmea">Fêmea</SelectItem>
                        <SelectItem value="Misto">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {pastos.length > 0 && (
                    <div>
                      <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">
                        Pasto <span className="text-ink-400 normal-case font-medium">(opcional)</span>
                      </Label>
                      <Select value={pastoId} onValueChange={setPastoId}>
                        <SelectTrigger className="h-10 mt-1.5 rounded-md border-ink-200">
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
                </div>
              </>
            ) : (
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Lote</Label>
                <Select value={loteId} onValueChange={setLoteId}>
                  <SelectTrigger className="h-10 mt-1.5 rounded-md border-ink-200">
                    <SelectValue placeholder="Selecione o lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes.map((lote) => (
                      <SelectItem key={lote.id} value={lote.id}>
                        {lote.nome_lote} ({lote.qtd_cabecas - lote.qtd_cabecas_vendidas} cab. disponíveis)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Qtd. cabeças</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={qtdCabecas}
                  onChange={(e) => setQtdCabecas(e.target.value)}
                  required
                  className="h-10 mt-1.5 rounded-md border-ink-200 tabular-nums"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Data</Label>
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="h-10 mt-1.5 rounded-md border-ink-200"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Pesagem e Valor */}
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="px-5 py-4 border-b border-ink-200 flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand" strokeWidth={2.4} />
            <h3 className="text-sm font-semibold text-ink-900">Pesagem e valor</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Peso total (kg)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={pesoTotalKg}
                onChange={(e) => setPesoTotalKg(e.target.value)}
                required
                className="h-10 mt-1.5 rounded-md border-ink-200 tabular-nums"
              />
            </div>

            {Number(pesoTotalKg) > 0 && (
              <div className="bg-brand/[0.04] border border-brand/15 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-500">Total em arrobas (@)</span>
                  <span className="text-base font-semibold text-brand tabular-nums">{arrobas.toFixed(2)} @</span>
                </div>
                {pesoMedioPorCabeca > 0 && (
                  <div className="flex items-center justify-between border-t border-brand/15 pt-2 text-xs">
                    <span className="text-ink-500">Peso médio/cabeça</span>
                    <span className="font-medium text-ink-900 tabular-nums">
                      {pesoMedioPorCabeca.toFixed(1)} kg · {arrobasPorCabeca.toFixed(2)} @
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Valor total (R$)</Label>
              <div className="mt-1.5 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 text-base font-semibold">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  required
                  className="h-14 rounded-md text-2xl font-bold pl-12 tabular-nums border-ink-200 focus:border-brand focus:ring-brand text-ink-900"
                />
              </div>
            </div>

            {valorPorArroba > 0 && (
              <div className="bg-brand/[0.04] border border-brand/15 rounded-md p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-500">Valor por arroba (@)</span>
                  <span className="text-base font-semibold text-brand tabular-nums">{formatBRL(valorPorArroba)}</span>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">
                Descrição <span className="text-ink-400 normal-case font-medium">(opcional)</span>
              </Label>
              <Input
                placeholder="Ex: Compra de 50 novilhas Nelore"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="h-10 mt-1.5 rounded-md border-ink-200"
              />
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/')}
            className="h-10 rounded-md text-sm"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className={`h-10 rounded-md text-sm font-medium px-6 text-white ${
              operacao === 'COMPRA' ? 'bg-brand hover:bg-brand-700' : 'bg-success hover:bg-success/90'
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            {operacao === 'COMPRA' ? 'Registrar compra' : 'Registrar venda'}
          </Button>
        </div>
      </form>
    </div>
  );
}