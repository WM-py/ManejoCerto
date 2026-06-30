import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, TABLES, formatBRL, formatDate, kgToArrobas, daysBetween } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lote, Transacao, CompraVenda, Pesagem, PesagemLote, Baixa, CATEGORIA_LABELS, CategoriaTransacao } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { gerarReciboPDF } from '@/lib/pdf';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  ArrowLeft,
  Beef,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  Target,
  BarChart3,
  Weight,
  Calendar,
  Loader2,
  Plus,
  Activity,
  Skull,
  FileDown,
  Trash2,
} from 'lucide-react';

export default function LoteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [lote, setLote] = useState<Lote | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [comprasVendas, setComprasVendas] = useState<CompraVenda[]>([]);
  const [pesagens, setPesagens] = useState<Pesagem[]>([]);
  const [pesagensLote, setPesagensLote] = useState<PesagemLote[]>([]);
  const [baixas, setBaixas] = useState<Baixa[]>([]);
  const [loading, setLoading] = useState(true);

  // Weighing form state (peso médio - legacy)
  const [showPesagemForm, setShowPesagemForm] = useState(false);
  const [pesagemPeso, setPesagemPeso] = useState('');
  const [pesagemData, setPesagemData] = useState(new Date().toISOString().split('T')[0]);
  const [savingPesagem, setSavingPesagem] = useState(false);

  // Pesagem Lote form (peso total)
  const [showPesagemLoteForm, setShowPesagemLoteForm] = useState(false);
  const [pesagemLotePesoTotal, setPesagemLotePesoTotal] = useState('');
  const [pesagemLoteData, setPesagemLoteData] = useState(new Date().toISOString().split('T')[0]);
  const [savingPesagemLote, setSavingPesagemLote] = useState(false);
  const [deletingPesagemLoteId, setDeletingPesagemLoteId] = useState<string | null>(null);

  // Baixa form
  const [showBaixaForm, setShowBaixaForm] = useState(false);
  const [baixaQtd, setBaixaQtd] = useState('1');
  const [baixaMotivo, setBaixaMotivo] = useState('');
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split('T')[0]);
  const [savingBaixa, setSavingBaixa] = useState(false);
  const [deletingPesagemId, setDeletingPesagemId] = useState<string | null>(null);
  const [pesagemLoteParaExcluir, setPesagemLoteParaExcluir] = useState<string | null>(null);
  const [pesagemParaExcluir, setPesagemParaExcluir] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);

    const [loteRes, transRes, cvRes, pesRes, pesLoteRes, baixasRes] = await Promise.all([
      supabase.from(TABLES.lotes).select('*').eq('id', id).single(),
      supabase.from(TABLES.transacoes).select('*').eq('user_id', user?.id).eq('lote_id', id).order('data', { ascending: false }),
      supabase.from(TABLES.compras_vendas).select('*').eq('lote_id', id).order('created_at', { ascending: false }),
      supabase.from(TABLES.pesagens).select('*').eq('user_id', user?.id).eq('lote_id', id).order('data_pesagem', { ascending: true }),
      supabase.from(TABLES.pesagens_lote).select('*').eq('user_id', user?.id).eq('lote_id', id).order('data_pesagem', { ascending: true }),
      supabase.from(TABLES.baixas).select('*').eq('user_id', user?.id).eq('lote_id', id).order('data_baixa', { ascending: false }),
    ]);

    if (loteRes.data) setLote(loteRes.data as Lote);
    if (transRes.data) setTransacoes(transRes.data as Transacao[]);
    if (cvRes.data) setComprasVendas(cvRes.data as CompraVenda[]);
    if (pesRes.data) setPesagens(pesRes.data as Pesagem[]);
    if (pesLoteRes.data) setPesagensLote(pesLoteRes.data as PesagemLote[]);
    if (baixasRes.data) setBaixas(baixasRes.data as Baixa[]);
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Baixa Handler ──
  const handleRegistrarBaixa = async () => {
    if (!user || !lote || !baixaQtd || Number(baixaQtd) <= 0) {
      toast({ title: 'Informe a quantidade', variant: 'destructive' });
      return;
    }

    const totalBaixas = baixas.reduce((sum, b) => sum + b.quantidade, 0);
    const cabecasVivas = lote.qtd_cabecas - lote.qtd_cabecas_vendidas - totalBaixas;

    if (Number(baixaQtd) > cabecasVivas) {
      toast({ title: 'Quantidade maior que cabeças vivas', variant: 'destructive' });
      return;
    }

    setSavingBaixa(true);
    try {
      const { error } = await supabase.from(TABLES.baixas).insert({
        lote_id: lote.id,
        user_id: user.id,
        data_baixa: baixaData,
        quantidade: Number(baixaQtd),
        motivo: baixaMotivo || 'Mortalidade',
      });
      if (error) throw error;

      // Update qtd_cabecas on the lote (subtract baixa)
      const newQtd = lote.qtd_cabecas - Number(baixaQtd);
      const { error: updateErr } = await supabase
        .from(TABLES.lotes)
        .update({ qtd_cabecas: newQtd })
        .eq('id', lote.id);
      if (updateErr) throw updateErr;

      toast({ title: 'Baixa registrada!', description: `${baixaQtd} cabeça(s) - ${baixaMotivo || 'Mortalidade'}` });
      setBaixaQtd('1');
      setBaixaMotivo('');
      setShowBaixaForm(false);
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao registrar baixa', description: errorMessage, variant: 'destructive' });
    } finally {
      setSavingBaixa(false);
    }
  };

  // ── Pesagem média Handler (legacy) ──
  const handleRegistrarPesagem = async () => {
    if (!user || !lote || !pesagemPeso || Number(pesagemPeso) <= 0) {
      toast({ title: 'Informe o peso médio', variant: 'destructive' });
      return;
    }

    setSavingPesagem(true);
    try {
      const pesoAtual = Number(pesagemPeso);
      let gmd = 0;
      const lastPesagem = pesagens.length > 0 ? pesagens[pesagens.length - 1] : null;

      if (lastPesagem) {
        const dias = daysBetween(lastPesagem.data_pesagem, pesagemData);
        if (dias > 0) gmd = (pesoAtual - Number(lastPesagem.peso_media_kg)) / dias;
      } else if (Number(lote.peso_entrada_kg) > 0) {
        const dias = daysBetween(lote.data_entrada, pesagemData);
        if (dias > 0) gmd = (pesoAtual - Number(lote.peso_entrada_kg)) / dias;
      }

      const { error } = await supabase.from(TABLES.pesagens).insert({
        lote_id: lote.id,
        user_id: user.id,
        data_pesagem: pesagemData,
        peso_media_kg: pesoAtual,
        gmd_calculado: Math.max(0, Number(gmd.toFixed(4))),
      });
      if (error) throw error;

      toast({ title: 'Pesagem registrada!', description: `GMD: ${gmd.toFixed(3)} kg/dia` });
      setPesagemPeso('');
      setShowPesagemForm(false);
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao salvar pesagem', description: errorMessage, variant: 'destructive' });
    } finally {
      setSavingPesagem(false);
    }
  };

  // ── Pesagem Lote (peso total) Handler ──
  const handleRegistrarPesagemLote = async () => {
    if (!user || !lote || !pesagemLotePesoTotal || Number(pesagemLotePesoTotal) <= 0) {
      toast({ title: 'Informe o peso total', variant: 'destructive' });
      return;
    }

    setSavingPesagemLote(true);
    try {
      const { error } = await supabase.from(TABLES.pesagens_lote).insert({
        lote_id: lote.id,
        user_id: user.id,
        data_pesagem: pesagemLoteData,
        peso_total_kg: Number(pesagemLotePesoTotal),
      });
      if (error) throw error;

      toast({ title: 'Pesagem do lote registrada!' });
      setPesagemLotePesoTotal('');
      setShowPesagemLoteForm(false);
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao salvar pesagem', description: errorMessage, variant: 'destructive' });
    } finally {
      setSavingPesagemLote(false);
    }
  };

  const handleExcluirPesagemLote = async (pesagemId: string) => {
    setDeletingPesagemLoteId(pesagemId);
    try {
      const { data, error } = await supabase
        .from(TABLES.pesagens_lote)
        .delete()
        .eq('id', pesagemId)
        .eq('user_id', user?.id)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('A pesagem do lote não foi removida pelo banco. Verifique as permissões da tabela.');
      }

      setPesagensLote((current) => current.filter((pesagem) => pesagem.id !== pesagemId));
      toast({ title: 'Pesagem do lote excluída com sucesso' });
      await fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao excluir pesagem do lote', description: errorMessage, variant: 'destructive' });
    } finally {
      setDeletingPesagemLoteId(null);
    }
  };

  const handleExcluirPesagem = async (pesagemId: string) => {
    setDeletingPesagemId(pesagemId);
    try {
      const { data, error } = await supabase
        .from(TABLES.pesagens)
        .delete()
        .eq('id', pesagemId)
        .eq('user_id', user?.id)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('A pesagem individual não foi removida pelo banco. Verifique as permissões da tabela.');
      }

      setPesagens((current) => current.filter((pesagem) => pesagem.id !== pesagemId));
      toast({ title: 'Pesagem excluída com sucesso' });
      await fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao excluir pesagem', description: errorMessage, variant: 'destructive' });
    } finally {
      setDeletingPesagemId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!lote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Lote não encontrado</p>
      </div>
    );
  }

  // ── DRE Calculations ──
  const totalBaixas = baixas.reduce((sum, b) => sum + b.quantidade, 0);
  const cabecasVivas = lote.qtd_cabecas - lote.qtd_cabecas_vendidas;

  const receitasDiretas = transacoes
    .filter((t) => t.tipo === 'RECEITA')
    .reduce((sum, t) => sum + Number(t.valor), 0);

  const custoCompra = transacoes
    .filter((t) => t.tipo === 'DESPESA' && t.categoria === 'COMPRA_GADO')
    .reduce((sum, t) => sum + Number(t.valor), 0);

  const custosOperacionais = transacoes
    .filter((t) => t.tipo === 'DESPESA' && t.categoria !== 'COMPRA_GADO')
    .reduce((sum, t) => sum + Number(t.valor), 0);

  const custoAcumulado = custoCompra + custosOperacionais;

  // Use pesagens_lote for peso atual if available, otherwise fallback to pesagens (peso médio)
  let pesoAtualMedio = 0;
  if (pesagensLote.length > 0) {
    const lastPL = pesagensLote[pesagensLote.length - 1];
    pesoAtualMedio = cabecasVivas > 0 ? Number(lastPL.peso_total_kg) / cabecasVivas : 0;
  } else if (pesagens.length > 0) {
    pesoAtualMedio = Number(pesagens[pesagens.length - 1].peso_media_kg);
  } else {
    pesoAtualMedio = Number(lote.peso_entrada_kg) || 0;
  }

  // Custo por cabeça viva (absorve custo dos mortos)
  const custoPorCabecaViva = cabecasVivas > 0 ? custoAcumulado / cabecasVivas : 0;

  const arrobasRestantes = kgToArrobas(pesoAtualMedio * cabecasVivas);
  const pontoEquilibrio = arrobasRestantes > 0 ? custoAcumulado / arrobasRestantes : 0;

  const lucroLiquido = receitasDiretas - custoAcumulado;
  const lucroPorCabeca = lote.qtd_cabecas > 0 ? lucroLiquido / lote.qtd_cabecas : 0;
  const margemLucro = receitasDiretas > 0 ? (lucroLiquido / receitasDiretas) * 100 : 0;

  const lucroProjetado = lote.status === 'ativo' && pontoEquilibrio > 0
    ? (arrobasRestantes * pontoEquilibrio * 1.15) - custoAcumulado
    : 0;

  // GMD Real from pesagens_lote
  let gmdRealLote = 0;
  if (pesagensLote.length >= 2) {
    const first = pesagensLote[0];
    const last = pesagensLote[pesagensLote.length - 1];
    const dias = daysBetween(first.data_pesagem, last.data_pesagem);
    if (dias > 0 && cabecasVivas > 0) {
      const pesoMedioFirst = Number(first.peso_total_kg) / (lote.qtd_cabecas - lote.qtd_cabecas_vendidas + totalBaixas);
      const pesoMedioLast = Number(last.peso_total_kg) / cabecasVivas;
      gmdRealLote = (pesoMedioLast - pesoMedioFirst) / dias;
    }
  } else if (pesagensLote.length === 1 && Number(lote.peso_entrada_kg) > 0) {
    const last = pesagensLote[0];
    const dias = daysBetween(lote.data_entrada, last.data_pesagem);
    if (dias > 0 && cabecasVivas > 0) {
      const pesoMedioLast = Number(last.peso_total_kg) / cabecasVivas;
      gmdRealLote = (pesoMedioLast - Number(lote.peso_entrada_kg)) / dias;
    }
  }

  // GMD from pesagens (legacy)
  const gmdAtual = pesagens.length > 0
    ? Number(pesagens[pesagens.length - 1].gmd_calculado)
    : 0;

  const gmdDisplay = gmdRealLote > 0 ? gmdRealLote : gmdAtual;

  // Compras/Vendas
  const compras = comprasVendas.filter((cv) => {
    const trans = transacoes.find((t) => t.id === cv.transacao_id);
    return trans?.categoria === 'COMPRA_GADO';
  });

  const vendas = comprasVendas.filter((cv) => {
    const trans = transacoes.find((t) => t.id === cv.transacao_id);
    return trans?.categoria === 'VENDA_GADO';
  });

  const despesasVinculadas = transacoes.filter(
    (t) => t.tipo === 'DESPESA' && t.categoria !== 'COMPRA_GADO'
  );

  // PDF for compra/venda
  const handleGerarPDFCompraVenda = (cv: CompraVenda) => {
    const trans = transacoes.find((t) => t.id === cv.transacao_id);
    if (!trans) return;
    const isCompra = trans.categoria === 'COMPRA_GADO';
    gerarReciboPDF({
      tipo: isCompra ? 'COMPRA' : 'VENDA',
      data: trans.data,
      valorTotal: Number(trans.valor),
      qtdCabecas: cv.qtd_cabecas,
      pesoTotalKg: Number(cv.peso_total_kg),
      valorPorArroba: Number(cv.valor_por_arroba),
      descricao: trans.descricao || '',
      nomeLote: lote.nome_lote,
      nomeUsuario: user?.email || 'Usuário',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-12 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/lotes')}
            className="rounded-md border-ink-200 h-9 w-9"
          >
            <ArrowLeft className="w-4 h-4 text-ink-700" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-ink-900 tracking-tight">{lote.nome_lote}</h1>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge
                variant="outline"
                className={`rounded-full text-[10.5px] px-2 py-0 font-medium ${
                  lote.status === 'ativo'
                    ? 'border-success/30 bg-success-soft text-success'
                    : 'border-ink-200 bg-ink-100 text-ink-500'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${lote.status === 'ativo' ? 'bg-success' : 'bg-ink-400'}`} />
                {lote.status === 'ativo' ? 'Ativo' : 'Encerrado'}
              </Badge>
              {lote.sexo && (
                <Badge variant="outline" className="rounded-full text-[10.5px] px-2 py-0 border-ink-200 text-ink-500 font-medium">
                  {lote.sexo}
                </Badge>
              )}
              {lote.categoria && (
                <Badge variant="outline" className="rounded-full text-[10.5px] px-2 py-0 border-ink-200 text-ink-500 font-medium">
                  {lote.categoria}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <section className="rounded-xl border border-ink-200 bg-white">
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-ink-200">
          <StatBox icon={<Beef className="w-4 h-4 text-brand" />} label="Cabeças" value={lote.qtd_cabecas} />
          <StatBox icon={<TrendingUp className="w-4 h-4 text-success" />} label="Vendidas" value={lote.qtd_cabecas_vendidas} />
          <StatBox icon={<Skull className="w-4 h-4 text-danger" />} label="Baixas" value={totalBaixas} valueTone="text-danger" />
          <StatBox icon={<Target className="w-4 h-4 text-warning" />} label="Vivas" value={cabecasVivas} />
          <StatBox icon={<Calendar className="w-4 h-4 text-info" />} label="Dias" value={daysBetween(lote.data_entrada, new Date().toISOString().split('T')[0])} />
        </div>
      </section>

      {/* KPIs financeiros + DRE */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coluna esquerda (2/3): pesagens, baixas */}
        <div className="lg:col-span-2 space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-ink-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-danger-soft text-danger flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
                <p className="text-[10.5px] text-ink-500 font-semibold uppercase tracking-wider">Custo acumulado</p>
              </div>
              <p className="text-xl font-bold text-danger tabular-nums tracking-tight">{formatBRL(custoAcumulado)}</p>
              <p className="text-[10.5px] text-ink-500 mt-1 tabular-nums">
                Compra {formatBRL(custoCompra)} · Op {formatBRL(custosOperacionais)}
              </p>
            </div>

            <div className="rounded-xl border border-ink-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-warning-soft text-warning flex items-center justify-center">
                  <Target className="w-3.5 h-3.5" />
                </div>
                <p className="text-[10.5px] text-ink-500 font-semibold uppercase tracking-wider">Ponto de equilíbrio</p>
              </div>
              <p className="text-xl font-bold text-ink-900 tabular-nums tracking-tight">
                {pontoEquilibrio > 0 ? formatBRL(pontoEquilibrio) : '—'}
              </p>
              <p className="text-[10.5px] text-ink-500 mt-1">Valor mínimo por @</p>
            </div>
          </div>

          {/* Baixas */}
          {lote.status === 'ativo' && (
            <section className="rounded-xl border border-ink-200 bg-white">
              <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skull className="w-4 h-4 text-danger" strokeWidth={2.4} />
                  <div>
                    <h3 className="text-sm font-semibold text-ink-900">Baixas (mortalidade)</h3>
                    <p className="text-xs text-ink-500 mt-0.5 tabular-nums">{totalBaixas} cabeças</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowBaixaForm(!showBaixaForm)}
                  className="h-8 rounded-md bg-danger hover:bg-danger/90 text-white text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Registrar
                </Button>
              </div>

              {showBaixaForm && (
                <div className="p-5 border-b border-ink-200 bg-danger-soft/40 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider">Quantidade</Label>
                      <Input
                        type="number" min="1"
                        value={baixaQtd} onChange={(e) => setBaixaQtd(e.target.value)}
                        className="h-9 mt-1 rounded-md border-ink-200 text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider">Data</Label>
                      <Input
                        type="date" value={baixaData} onChange={(e) => setBaixaData(e.target.value)}
                        className="h-9 mt-1 rounded-md border-ink-200 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider">Motivo</Label>
                    <Input
                      placeholder="Ex: Doença, acidente…"
                      value={baixaMotivo} onChange={(e) => setBaixaMotivo(e.target.value)}
                      className="h-9 mt-1 rounded-md border-ink-200 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={handleRegistrarBaixa}
                      disabled={savingBaixa}
                      size="sm"
                      className="h-9 rounded-md bg-danger hover:bg-danger/90 text-white text-sm font-medium"
                    >
                      {savingBaixa ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Skull className="w-4 h-4 mr-1.5" />}
                      Registrar baixa
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowBaixaForm(false)} className="h-9 rounded-md text-sm">
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {baixas.length > 0 && (
                <ul className="divide-y divide-ink-200">
                  {baixas.map((b) => (
                    <li key={b.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Skull className="w-3.5 h-3.5 text-danger flex-shrink-0" />
                        <span className="text-ink-500 tabular-nums whitespace-nowrap">{formatDate(b.data_baixa)}</span>
                        <span className="text-ink-500 truncate">· {b.motivo}</span>
                      </div>
                      <span className="font-semibold text-danger tabular-nums whitespace-nowrap">{b.quantidade} cab.</span>
                    </li>
                  ))}
                </ul>
              )}

              {totalBaixas > 0 && (
                <div className="px-5 py-3 bg-warning-soft border-t border-warning/20 flex items-center justify-between text-xs">
                  <span className="text-warning font-medium">Custo/cabeça viva (absorvendo mortalidade)</span>
                  <span className="font-bold text-warning tabular-nums">{formatBRL(custoPorCabecaViva)}</span>
                </div>
              )}
            </section>
          )}

          {/* Pesagens do Lote (peso total) */}
          <section className="rounded-xl border border-ink-200 bg-white">
            <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-brand" strokeWidth={2.4} />
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">Pesagens do lote</h3>
                  <p className="text-xs text-ink-500 mt-0.5">Peso total da arroba</p>
                </div>
              </div>
              {lote.status === 'ativo' && (
                <Button
                  size="sm"
                  onClick={() => setShowPesagemLoteForm(!showPesagemLoteForm)}
                  className="h-8 rounded-md bg-brand hover:bg-brand-700 text-white text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Nova pesagem
                </Button>
              )}
            </div>

            {showPesagemLoteForm && (
              <div className="p-5 border-b border-ink-200 bg-brand/[0.03] space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider">Peso total (kg)</Label>
                    <Input
                      type="number" step="0.01" min="0" placeholder="0,00"
                      value={pesagemLotePesoTotal} onChange={(e) => setPesagemLotePesoTotal(e.target.value)}
                      className="h-9 mt-1 rounded-md border-ink-200 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider">Data</Label>
                    <Input
                      type="date" value={pesagemLoteData} onChange={(e) => setPesagemLoteData(e.target.value)}
                      className="h-9 mt-1 rounded-md border-ink-200 text-sm"
                    />
                  </div>
                </div>
                {Number(pesagemLotePesoTotal) > 0 && cabecasVivas > 0 && (
                  <div className="flex items-center justify-between text-xs bg-white rounded-md p-2.5 border border-ink-200">
                    <span className="text-ink-500">Peso médio por cabeça</span>
                    <span className="font-semibold text-brand tabular-nums">
                      {(Number(pesagemLotePesoTotal) / cabecasVivas).toFixed(1)} kg · {kgToArrobas(Number(pesagemLotePesoTotal) / cabecasVivas).toFixed(2)} @
                    </span>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleRegistrarPesagemLote}
                    disabled={savingPesagemLote}
                    size="sm"
                    className="h-9 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium"
                  >
                    {savingPesagemLote ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Scale className="w-4 h-4 mr-1.5" />}
                    Salvar pesagem
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowPesagemLoteForm(false)} className="h-9 rounded-md text-sm">
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Summary peso */}
            <div className="grid grid-cols-3 divide-x divide-ink-200 border-b border-ink-200">
              <StatBox icon={<Weight className="w-3.5 h-3.5 text-ink-400" />} label="Peso entrada" value={Number(lote.peso_entrada_kg) > 0 ? `${Number(lote.peso_entrada_kg).toFixed(0)} kg` : '—'} sub={Number(lote.peso_entrada_kg) > 0 ? `${kgToArrobas(Number(lote.peso_entrada_kg)).toFixed(2)} @` : undefined} compact />
              <StatBox icon={<Weight className="w-3.5 h-3.5 text-brand" />} label="Peso atual" value={pesoAtualMedio > 0 ? `${pesoAtualMedio.toFixed(0)} kg` : '—'} sub={pesoAtualMedio > 0 ? `${kgToArrobas(pesoAtualMedio).toFixed(2)} @` : undefined} valueTone="text-brand" compact />
              <StatBox icon={<Activity className="w-3.5 h-3.5 text-success" />} label="GMD real" value={gmdDisplay > 0 ? gmdDisplay.toFixed(3) : '—'} sub={gmdDisplay > 0 ? 'kg/dia' : undefined} valueTone={gmdDisplay > 0 ? 'text-success' : 'text-ink-400'} compact />
            </div>

            {/* Histórico pesagens lote */}
            {pesagensLote.length > 0 && (
              <ul className="divide-y divide-ink-200">
                {pesagensLote.map((p, idx) => {
                  const pesoMedio = cabecasVivas > 0 ? Number(p.peso_total_kg) / cabecasVivas : 0;
                  let gmdItem = 0;
                  if (idx > 0) {
                    const prev = pesagensLote[idx - 1];
                    const prevPesoMedio = cabecasVivas > 0 ? Number(prev.peso_total_kg) / cabecasVivas : 0;
                    const dias = daysBetween(prev.data_pesagem, p.data_pesagem);
                    if (dias > 0) gmdItem = (pesoMedio - prevPesoMedio) / dias;
                  } else if (Number(lote.peso_entrada_kg) > 0) {
                    const dias = daysBetween(lote.data_entrada, p.data_pesagem);
                    if (dias > 0) gmdItem = (pesoMedio - Number(lote.peso_entrada_kg)) / dias;
                  }
                  return (
                    <li key={p.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                      <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center text-[10px] font-bold text-brand flex-shrink-0">
                        {idx + 1}
                      </div>
                      <span className="text-ink-500 tabular-nums whitespace-nowrap">{formatDate(p.data_pesagem)}</span>
                      <span className="font-medium text-ink-900 tabular-nums flex-1 truncate">
                        {Number(p.peso_total_kg).toFixed(0)} kg <span className="text-ink-500 font-normal">(méd {pesoMedio.toFixed(0)} kg)</span>
                      </span>
                      {gmdItem > 0 && (
                        <Badge variant="outline" className="rounded-full bg-success-soft border-success/20 text-success text-[10px] px-2 py-0 font-medium tabular-nums">
                          GMD {gmdItem.toFixed(3)}
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => setPesagemLoteParaExcluir(p.id)}
                        disabled={deletingPesagemLoteId === p.id}
                        className="p-1 rounded hover:bg-danger-soft disabled:opacity-50"
                        title="Excluir pesagem do lote"
                      >
                        {deletingPesagemLoteId === p.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-danger" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-danger" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Pesagens individuais (legacy) */}
          <section className="rounded-xl border border-ink-200 bg-white">
            <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Weight className="w-4 h-4 text-brand" strokeWidth={2.4} />
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">Pesagens individuais</h3>
                  <p className="text-xs text-ink-500 mt-0.5">Peso médio direto (legado)</p>
                </div>
              </div>
              {lote.status === 'ativo' && (
                <Button
                  size="sm"
                  onClick={() => setShowPesagemForm(!showPesagemForm)}
                  variant="outline"
                  className="h-8 rounded-md text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Registrar
                </Button>
              )}
            </div>

            {showPesagemForm && (
              <div className="p-5 border-b border-ink-200 bg-brand/[0.03] space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider">Peso médio (kg/cab)</Label>
                    <Input
                      type="number" step="0.01" min="0" placeholder="0,00"
                      value={pesagemPeso} onChange={(e) => setPesagemPeso(e.target.value)}
                      className="h-9 mt-1 rounded-md border-ink-200 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider">Data</Label>
                    <Input
                      type="date" value={pesagemData} onChange={(e) => setPesagemData(e.target.value)}
                      className="h-9 mt-1 rounded-md border-ink-200 text-sm"
                    />
                  </div>
                </div>
                {Number(pesagemPeso) > 0 && (
                  <div className="flex items-center justify-between text-xs bg-white rounded-md p-2.5 border border-ink-200">
                    <span className="text-ink-500">Equivalente em @</span>
                    <span className="font-semibold text-brand tabular-nums">{kgToArrobas(Number(pesagemPeso)).toFixed(2)} @/cab</span>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleRegistrarPesagem}
                    disabled={savingPesagem}
                    size="sm"
                    className="h-9 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium"
                  >
                    {savingPesagem ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Scale className="w-4 h-4 mr-1.5" />}
                    Salvar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowPesagemForm(false)} className="h-9 rounded-md text-sm">
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {pesagens.length > 0 ? (
              <ul className="divide-y divide-ink-200">
                {pesagens.map((p, idx) => (
                  <li key={p.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                    <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center text-[10px] font-bold text-brand flex-shrink-0">
                      {idx + 1}
                    </div>
                    <span className="text-ink-500 tabular-nums whitespace-nowrap">{formatDate(p.data_pesagem)}</span>
                    <span className="font-medium text-ink-900 tabular-nums flex-1 truncate">
                      {Number(p.peso_media_kg).toFixed(1)} kg <span className="text-ink-500 font-normal">({kgToArrobas(Number(p.peso_media_kg)).toFixed(2)} @)</span>
                    </span>
                    {Number(p.gmd_calculado) > 0 && (
                      <Badge variant="outline" className="rounded-full bg-success-soft border-success/20 text-success text-[10px] px-2 py-0 font-medium tabular-nums">
                        GMD {Number(p.gmd_calculado).toFixed(3)}
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => setPesagemParaExcluir(p.id)}
                      disabled={deletingPesagemId === p.id}
                      className="p-1 rounded hover:bg-danger-soft disabled:opacity-50"
                      title="Excluir pesagem individual"
                    >
                      {deletingPesagemId === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-danger" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-danger" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : !showPesagemForm && (
              <div className="px-5 py-6 text-center">
                <p className="text-xs text-ink-400">Nenhuma pesagem individual registrada.</p>
              </div>
            )}
          </section>
        </div>

        {/* Coluna direita (1/3): DRE */}
        <div className="space-y-6">
          <section className="rounded-xl border border-ink-200 bg-white sticky top-20">
            <div className="px-5 py-4 border-b border-ink-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand" strokeWidth={2.4} />
              <div>
                <h3 className="text-sm font-semibold text-ink-900">DRE — Resultado</h3>
                <p className="text-xs text-ink-500 mt-0.5">
                  {lote.status === 'encerrado' ? 'Lote encerrado · resultado real' : 'Lote ativo · projeção'}
                </p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {/* Receitas */}
              <div className="bg-success-soft border border-success/15 rounded-md p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-success flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Receitas (vendas)
                  </span>
                  <span className="text-sm font-bold text-success tabular-nums">{formatBRL(receitasDiretas)}</span>
                </div>
              </div>

              {/* Custos */}
              <div className="bg-danger-soft border border-danger/15 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-danger flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5" /> Custos diretos
                  </span>
                  <span className="text-sm font-bold text-danger tabular-nums">{formatBRL(custoAcumulado)}</span>
                </div>
                <div className="border-t border-danger/15 pt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-ink-700">Custo de compra</span>
                    <span className="text-ink-900 font-medium tabular-nums">{formatBRL(custoCompra)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-700">Custos operacionais</span>
                    <span className="text-ink-900 font-medium tabular-nums">{formatBRL(custosOperacionais)}</span>
                  </div>
                  {totalBaixas > 0 && (
                    <div className="flex justify-between pt-1 border-t border-danger/15">
                      <span className="text-warning font-medium">Custo/cab viva</span>
                      <span className="text-warning font-bold tabular-nums">{formatBRL(custoPorCabecaViva)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Resultado */}
              {lote.status === 'encerrado' ? (
                <div className={`rounded-md p-3 border ${lucroLiquido >= 0 ? 'bg-brand/[0.04] border-brand/20' : 'bg-danger-soft border-danger/20'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold flex items-center gap-1.5 ${lucroLiquido >= 0 ? 'text-brand' : 'text-danger'}`}>
                      <DollarSign className="w-3.5 h-3.5" /> Lucro líquido real
                    </span>
                    <span className={`text-base font-bold tabular-nums ${lucroLiquido >= 0 ? 'text-brand' : 'text-danger'}`}>
                      {formatBRL(lucroLiquido)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-ink-200/40">
                    <div className="text-center">
                      <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">Por cabeça</p>
                      <p className={`text-sm font-bold tabular-nums mt-0.5 ${lucroPorCabeca >= 0 ? 'text-brand' : 'text-danger'}`}>
                        {formatBRL(lucroPorCabeca)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">Margem</p>
                      <p className={`text-sm font-bold tabular-nums mt-0.5 ${margemLucro >= 0 ? 'text-brand' : 'text-danger'}`}>
                        {margemLucro.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md p-3 bg-info-soft border border-info/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-info flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" /> Lucro projetado
                    </span>
                    <span className="text-base font-bold text-info tabular-nums">
                      {pesoAtualMedio > 0 ? formatBRL(lucroProjetado) : '—'}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-info/80">
                    Peso atual {pesoAtualMedio.toFixed(0)} kg/cab ({kgToArrobas(pesoAtualMedio).toFixed(2)} @) · margem 15% sobre ponto de equilíbrio
                  </p>
                  {receitasDiretas > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-info/20">
                      <div className="text-center">
                        <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">Lucro parcial</p>
                        <p className={`text-sm font-bold tabular-nums mt-0.5 ${lucroLiquido >= 0 ? 'text-brand' : 'text-danger'}`}>
                          {formatBRL(lucroLiquido)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">por cabeça</p>
                        <p className={`text-sm font-bold tabular-nums mt-0.5 ${lucroPorCabeca >= 0 ? 'text-brand' : 'text-danger'}`}>
                          {formatBRL(lucroPorCabeca)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Compras & Vendas */}
      {(compras.length > 0 || vendas.length > 0) && (
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="px-5 py-4 border-b border-ink-200 flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand" strokeWidth={2.4} />
            <h3 className="text-sm font-semibold text-ink-900">Compras e vendas</h3>
          </div>
          <ul className="divide-y divide-ink-200">
            {[...compras, ...vendas].map((cv) => {
              const trans = transacoes.find((t) => t.id === cv.transacao_id);
              const isCompra = trans?.categoria === 'COMPRA_GADO';
              const pesoMedio = Number(cv.qtd_cabecas) > 0 ? Number(cv.peso_total_kg) / Number(cv.qtd_cabecas) : 0;
              return (
                <li key={cv.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`rounded-full text-[10.5px] px-2 py-0 font-medium ${
                          isCompra ? 'border-brand/30 bg-brand/[0.06] text-brand' : 'border-success/30 bg-success-soft text-success'
                        }`}
                      >
                        {isCompra ? 'Compra' : 'Venda'}
                      </Badge>
                      <span className="text-xs text-ink-500 tabular-nums">
                        {trans ? formatDate(trans.data) : ''}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGerarPDFCompraVenda(cv)}
                      className="h-7 px-2 rounded-md text-[11px] font-medium border-ink-200"
                    >
                      <FileDown className="w-3 h-3 mr-1" />
                      Recibo PDF
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">Cabeças</p>
                      <p className="font-semibold text-ink-900 tabular-nums mt-0.5">{cv.qtd_cabecas}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">Peso total</p>
                      <p className="font-semibold text-ink-900 tabular-nums mt-0.5">
                        {Number(cv.peso_total_kg).toFixed(0)} kg · {kgToArrobas(Number(cv.peso_total_kg)).toFixed(1)} @
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">Peso médio/cab</p>
                      <p className="font-semibold text-ink-900 tabular-nums mt-0.5">
                        {pesoMedio.toFixed(1)} kg · {kgToArrobas(pesoMedio).toFixed(2)} @
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">R$/arroba</p>
                      <p className="font-semibold text-brand tabular-nums mt-0.5">{formatBRL(Number(cv.valor_por_arroba))}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Despesas vinculadas + Transações (2 col em lg) */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="px-5 py-4 border-b border-ink-200">
            <h3 className="text-sm font-semibold text-ink-900">Despesas vinculadas</h3>
            <p className="text-xs text-ink-500 mt-0.5 tabular-nums">{despesasVinculadas.length} lançamento(s)</p>
          </div>
          {despesasVinculadas.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-ink-400">
              Nenhuma despesa operacional vinculada.
            </div>
          ) : (
            <ul className="divide-y divide-ink-200">
              {despesasVinculadas.map((t) => (
                <li key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-danger-soft text-danger flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">
                      {t.descricao || CATEGORIA_LABELS[t.categoria as CategoriaTransacao]}
                    </p>
                    <p className="text-xs text-ink-500 tabular-nums">
                      {formatDate(t.data)} · {CATEGORIA_LABELS[t.categoria as CategoriaTransacao]}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-danger tabular-nums whitespace-nowrap">
                    − {formatBRL(Number(t.valor))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="px-5 py-4 border-b border-ink-200">
            <h3 className="text-sm font-semibold text-ink-900">Todas as transações</h3>
            <p className="text-xs text-ink-500 mt-0.5 tabular-nums">{transacoes.length} lançamento(s)</p>
          </div>
          {transacoes.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-ink-400">
              Nenhuma transação registrada.
            </div>
          ) : (
            <ul className="divide-y divide-ink-200 max-h-[400px] overflow-y-auto">
              {transacoes.map((t) => (
                <li key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                    t.tipo === 'RECEITA' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
                  }`}>
                    {t.tipo === 'RECEITA' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">
                      {t.descricao || CATEGORIA_LABELS[t.categoria as CategoriaTransacao]}
                    </p>
                    <p className="text-xs text-ink-500 tabular-nums">{formatDate(t.data)}</p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                    t.tipo === 'RECEITA' ? 'text-success' : 'text-danger'
                  }`}>
                    {t.tipo === 'RECEITA' ? '+' : '−'} {formatBRL(Number(t.valor))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={pesagemLoteParaExcluir !== null}
        onOpenChange={(o) => !o && setPesagemLoteParaExcluir(null)}
        title="Excluir pesagem do lote"
        description="Esta pesagem (peso total) será removida do histórico. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        loading={deletingPesagemLoteId !== null}
        onConfirm={async () => {
          if (pesagemLoteParaExcluir) {
            const id = pesagemLoteParaExcluir;
            setPesagemLoteParaExcluir(null);
            await handleExcluirPesagemLote(id);
          }
        }}
      />

      <ConfirmDialog
        open={pesagemParaExcluir !== null}
        onOpenChange={(o) => !o && setPesagemParaExcluir(null)}
        title="Excluir pesagem individual"
        description="Esta pesagem (peso médio) será removida do histórico. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        loading={deletingPesagemId !== null}
        onConfirm={async () => {
          if (pesagemParaExcluir) {
            const id = pesagemParaExcluir;
            setPesagemParaExcluir(null);
            await handleExcluirPesagem(id);
          }
        }}
      />
    </div>
  );
}

function StatBox({ icon, label, value, sub, valueTone, compact }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  valueTone?: string;
  compact?: boolean;
}) {
  return (
    <div className={`text-center ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {icon}
        <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-base font-bold tabular-nums ${valueTone || 'text-ink-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-500 tabular-nums mt-0.5">{sub}</p>}
    </div>
  );
}
