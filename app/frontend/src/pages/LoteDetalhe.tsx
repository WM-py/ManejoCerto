import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, TABLES, formatBRL, formatDate, kgToArrobas, daysBetween } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lote, Transacao, CompraVenda, Pesagem, PesagemLote, Baixa, CATEGORIA_LABELS, CategoriaTransacao } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { gerarReciboPDF } from '@/lib/pdf';
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
    if (!window.confirm('Deseja excluir esta pesagem do lote?')) return;

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
        throw new Error('A pesagem do lote nao foi removida pelo banco. Verifique as permissoes da tabela.');
      }

      setPesagensLote((current) => current.filter((pesagem) => pesagem.id !== pesagemId));
      toast({ title: 'Pesagem do lote excluida com sucesso' });
      await fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao excluir pesagem do lote', description: errorMessage, variant: 'destructive' });
    } finally {
      setDeletingPesagemLoteId(null);
    }
  };

  const handleExcluirPesagem = async (pesagemId: string) => {
    if (!window.confirm('Deseja excluir esta pesagem individual?')) return;

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
        throw new Error('A pesagem individual nao foi removida pelo banco. Verifique as permissoes da tabela.');
      }

      setPesagens((current) => current.filter((pesagem) => pesagem.id !== pesagemId));
      toast({ title: 'Pesagem excluida com sucesso' });
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
        <Loader2 className="w-8 h-8 animate-spin text-[#556B2F]" />
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
    <div className="max-w-4xl mx-auto px-4 py-6 pb-8 space-y-5">
      {/* Lote Title Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/lotes')}
            className="rounded-xl border-gray-200 h-10 w-10"
          >
            <ArrowLeft className="w-5 h-5 text-[#36454F]" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-[#36454F]">{lote.nome_lote}</h2>
            <div className="flex items-center gap-2 mt-1">
              {lote.sexo && (
                <Badge className="bg-green-100 text-green-700 px-2 py-0.5 text-xs font-semibold">
                  {lote.sexo}
                </Badge>
              )}
              {lote.categoria && (
                <Badge className="bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-semibold">
                  {lote.categoria}
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-400">Inteligência do Lote</p>
          </div>
        </div>
        <Badge
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            lote.status === 'ativo'
              ? 'bg-green-50 text-green-600 border-green-200'
              : 'bg-gray-100 text-gray-500 border-gray-200'
          }`}
        >
          {lote.status === 'ativo' ? 'Ativo' : 'Encerrado'}
        </Badge>
      </div>

      {/* Lote Info */}
      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardContent className="p-5">
          <div className="grid grid-cols-5 gap-2 text-center">
            <div>
              <Beef className="w-5 h-5 mx-auto text-[#556B2F] mb-1" />
              <p className="text-lg font-bold text-[#36454F]">{lote.qtd_cabecas}</p>
              <p className="text-[10px] text-gray-400">Cabeças</p>
            </div>
            <div>
              <TrendingUp className="w-5 h-5 mx-auto text-green-500 mb-1" />
              <p className="text-lg font-bold text-[#36454F]">{lote.qtd_cabecas_vendidas}</p>
              <p className="text-[10px] text-gray-400">Vendidas</p>
            </div>
            <div>
              <Skull className="w-5 h-5 mx-auto text-red-400 mb-1" />
              <p className="text-lg font-bold text-red-500">{totalBaixas}</p>
              <p className="text-[10px] text-gray-400">Baixas</p>
            </div>
            <div>
              <Target className="w-5 h-5 mx-auto text-amber-500 mb-1" />
              <p className="text-lg font-bold text-[#36454F]">{cabecasVivas}</p>
              <p className="text-[10px] text-gray-400">Vivas</p>
            </div>
            <div>
              <Calendar className="w-5 h-5 mx-auto text-blue-500 mb-1" />
              <p className="text-lg font-bold text-[#36454F]">
                {daysBetween(lote.data_entrada, new Date().toISOString().split('T')[0])}
              </p>
              <p className="text-[10px] text-gray-400">Dias</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Baixas Section */}
      {lote.status === 'ativo' && (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-[#36454F] flex items-center gap-2">
                <Skull className="w-5 h-5 text-red-400" />
                Baixas (Mortalidade)
              </CardTitle>
              <Button
                size="sm"
                onClick={() => setShowBaixaForm(!showBaixaForm)}
                className="rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs h-8"
              >
                <Plus className="w-3 h-3 mr-1" />
                Registrar Baixa
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showBaixaForm && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Quantidade</Label>
                    <Input
                      type="number"
                      min="1"
                      value={baixaQtd}
                      onChange={(e) => setBaixaQtd(e.target.value)}
                      className="h-10 rounded-lg border-gray-200 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Data</Label>
                    <Input
                      type="date"
                      value={baixaData}
                      onChange={(e) => setBaixaData(e.target.value)}
                      className="h-10 rounded-lg border-gray-200 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Motivo</Label>
                  <Input
                    placeholder="Ex: Doença, acidente..."
                    value={baixaMotivo}
                    onChange={(e) => setBaixaMotivo(e.target.value)}
                    className="h-10 rounded-lg border-gray-200 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleRegistrarBaixa}
                    disabled={savingBaixa}
                    className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm"
                  >
                    {savingBaixa ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Skull className="w-4 h-4 mr-1" />}
                    Registrar
                  </Button>
                  <Button variant="outline" onClick={() => setShowBaixaForm(false)} className="h-10 rounded-xl text-sm">
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {baixas.length > 0 && (
              <div className="space-y-2">
                {baixas.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-2 bg-red-50/50 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <Skull className="w-4 h-4 text-red-400" />
                      <span className="text-gray-500">{formatDate(b.data_baixa)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-red-600">{b.quantidade} cab.</span>
                      <span className="text-gray-400">{b.motivo}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Custo por cabeça viva */}
            {totalBaixas > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-700 font-medium">Custo/Cabeça Viva (absorvendo mortalidade)</span>
                  <span className="text-amber-800 font-bold">{formatBRL(custoPorCabecaViva)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card Financeiro */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-xs text-gray-500 font-medium">Custo Acumulado</span>
            </div>
            <p className="text-xl font-bold text-red-500">{formatBRL(custoAcumulado)}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              Compra: {formatBRL(custoCompra)} + Desp: {formatBRL(custosOperacionais)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Target className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">Ponto de Equilíbrio</span>
            </div>
            <p className="text-xl font-bold text-amber-600">
              {pontoEquilibrio > 0 ? formatBRL(pontoEquilibrio) : '—'}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">Valor mínimo por @</p>
          </CardContent>
        </Card>
      </div>

      {/* Pesagem Lote (Peso Total) Section */}
      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-[#36454F] flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#556B2F]" />
              Pesagens do Lote (Peso Total)
            </CardTitle>
            {lote.status === 'ativo' && (
              <Button
                size="sm"
                onClick={() => setShowPesagemLoteForm(!showPesagemLoteForm)}
                className="rounded-xl bg-[#556B2F] hover:bg-[#3D4F22] text-white text-xs h-8"
              >
                <Plus className="w-3 h-3 mr-1" />
                Nova Pesagem
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showPesagemLoteForm && (
            <div className="bg-[#556B2F]/5 rounded-xl p-4 border border-[#556B2F]/10 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Peso Total do Lote (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={pesagemLotePesoTotal}
                    onChange={(e) => setPesagemLotePesoTotal(e.target.value)}
                    className="h-10 rounded-lg border-gray-200 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Data</Label>
                  <Input
                    type="date"
                    value={pesagemLoteData}
                    onChange={(e) => setPesagemLoteData(e.target.value)}
                    className="h-10 rounded-lg border-gray-200 text-sm"
                  />
                </div>
              </div>
              {Number(pesagemLotePesoTotal) > 0 && cabecasVivas > 0 && (
                <div className="flex items-center justify-between text-xs bg-white/60 rounded-lg p-2">
                  <span className="text-gray-500">Peso Médio/cab</span>
                  <span className="font-bold text-[#556B2F]">
                    {(Number(pesagemLotePesoTotal) / cabecasVivas).toFixed(1)} kg ({kgToArrobas(Number(pesagemLotePesoTotal) / cabecasVivas).toFixed(2)} @)
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleRegistrarPesagemLote}
                  disabled={savingPesagemLote}
                  className="flex-1 h-10 rounded-xl bg-[#556B2F] hover:bg-[#3D4F22] text-white text-sm"
                >
                  {savingPesagemLote ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Scale className="w-4 h-4 mr-1" />}
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setShowPesagemLoteForm(false)} className="h-10 rounded-xl text-sm">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 mb-1">Peso Entrada</p>
              <p className="text-sm font-bold text-[#36454F]">
                {Number(lote.peso_entrada_kg) > 0 ? `${Number(lote.peso_entrada_kg).toFixed(1)} kg` : '—'}
              </p>
              <p className="text-[10px] text-gray-400">
                {Number(lote.peso_entrada_kg) > 0 ? `${kgToArrobas(Number(lote.peso_entrada_kg)).toFixed(2)} @` : ''}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 mb-1">Peso Atual</p>
              <p className="text-sm font-bold text-[#556B2F]">
                {pesoAtualMedio > 0 ? `${pesoAtualMedio.toFixed(1)} kg` : '—'}
              </p>
              <p className="text-[10px] text-gray-400">
                {pesoAtualMedio > 0 ? `${kgToArrobas(pesoAtualMedio).toFixed(2)} @` : ''}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 mb-1">GMD Real</p>
              <p className={`text-sm font-bold ${gmdDisplay > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {gmdDisplay > 0 ? `${gmdDisplay.toFixed(3)}` : '—'}
              </p>
              <p className="text-[10px] text-gray-400">{gmdDisplay > 0 ? 'kg/dia' : ''}</p>
            </div>
          </div>

          {/* Pesagens Lote History */}
          {pesagensLote.length > 0 && (
            <div className="space-y-2 mt-2">
              <p className="text-xs font-medium text-gray-500">Histórico de Pesagens (Peso Total)</p>
              {pesagensLote.map((p, idx) => {
                const pesoMedio = cabecasVivas > 0 ? Number(p.peso_total_kg) / cabecasVivas : 0;
                // Calculate GMD between consecutive pesagens
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
                  <div key={p.id} className="flex items-center justify-between gap-3 p-2 bg-gray-50 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#556B2F]/10 flex items-center justify-center text-[10px] font-bold text-[#556B2F]">
                        {idx + 1}
                      </div>
                      <span className="text-gray-500">{formatDate(p.data_pesagem)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[#36454F]">
                        {Number(p.peso_total_kg).toFixed(0)} kg (méd: {pesoMedio.toFixed(1)} kg)
                      </span>
                      {gmdItem > 0 && (
                        <Badge className="rounded-full bg-green-50 text-green-600 border-green-200 text-[10px] px-2">
                          <Activity className="w-3 h-3 mr-0.5" />
                          GMD {gmdItem.toFixed(3)}
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => handleExcluirPesagemLote(p.id)}
                        disabled={deletingPesagemLoteId === p.id}
                        className="p-1 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Excluir pesagem do lote"
                      >
                        {deletingPesagemLoteId === p.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-500" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pesagem & GMD Section (Legacy - peso médio) */}
      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-[#36454F] flex items-center gap-2">
              <Weight className="w-5 h-5 text-[#556B2F]" />
              Pesagens Individuais (Peso Médio)
            </CardTitle>
            {lote.status === 'ativo' && (
              <Button
                size="sm"
                onClick={() => setShowPesagemForm(!showPesagemForm)}
                className="rounded-xl bg-[#556B2F] hover:bg-[#3D4F22] text-white text-xs h-8"
              >
                <Plus className="w-3 h-3 mr-1" />
                Registrar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showPesagemForm && (
            <div className="bg-[#556B2F]/5 rounded-xl p-4 border border-[#556B2F]/10 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Peso Médio (kg/cab)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={pesagemPeso}
                    onChange={(e) => setPesagemPeso(e.target.value)}
                    className="h-10 rounded-lg border-gray-200 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Data</Label>
                  <Input
                    type="date"
                    value={pesagemData}
                    onChange={(e) => setPesagemData(e.target.value)}
                    className="h-10 rounded-lg border-gray-200 text-sm"
                  />
                </div>
              </div>
              {Number(pesagemPeso) > 0 && (
                <div className="flex items-center justify-between text-xs bg-white/60 rounded-lg p-2">
                  <span className="text-gray-500">Equivalente em @</span>
                  <span className="font-bold text-[#556B2F]">
                    {kgToArrobas(Number(pesagemPeso)).toFixed(2)} @/cab
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleRegistrarPesagem}
                  disabled={savingPesagem}
                  className="flex-1 h-10 rounded-xl bg-[#556B2F] hover:bg-[#3D4F22] text-white text-sm"
                >
                  {savingPesagem ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Scale className="w-4 h-4 mr-1" />}
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setShowPesagemForm(false)} className="h-10 rounded-xl text-sm">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {pesagens.length > 0 && (
            <div className="space-y-2">
              {pesagens.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-2 bg-gray-50 rounded-lg text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#556B2F]/10 flex items-center justify-center text-[10px] font-bold text-[#556B2F]">
                      {idx + 1}
                    </div>
                    <span className="text-gray-500">{formatDate(p.data_pesagem)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-[#36454F]">
                      {Number(p.peso_media_kg).toFixed(1)} kg ({kgToArrobas(Number(p.peso_media_kg)).toFixed(2)} @)
                    </span>
                    {Number(p.gmd_calculado) > 0 && (
                      <Badge className="rounded-full bg-green-50 text-green-600 border-green-200 text-[10px] px-2">
                        <Activity className="w-3 h-3 mr-0.5" />
                        GMD {Number(p.gmd_calculado).toFixed(3)}
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExcluirPesagem(p.id)}
                      disabled={deletingPesagemId === p.id}
                      className="p-1 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Excluir pesagem individual"
                    >
                      {deletingPesagemId === p.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-500" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DRE Summary */}
      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-[#36454F] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#556B2F]" />
            DRE - Demonstrativo de Resultado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">Receitas (Vendas)</span>
              </div>
              <span className="text-lg font-bold text-green-600">{formatBRL(receitasDiretas)}</span>
            </div>
          </div>

          <div className="bg-red-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                <span className="text-sm font-medium text-red-800">Custos Diretos</span>
              </div>
              <span className="text-lg font-bold text-red-500">{formatBRL(custoAcumulado)}</span>
            </div>
            <div className="border-t border-red-100 pt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-red-600">Custo de Compra</span>
                <span className="text-red-600 font-medium">{formatBRL(custoCompra)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-red-600">Custos Operacionais</span>
                <span className="text-red-600 font-medium">{formatBRL(custosOperacionais)}</span>
              </div>
              {totalBaixas > 0 && (
                <div className="flex justify-between text-xs border-t border-red-100 pt-1">
                  <span className="text-amber-600 font-medium">Custo/Cab. Viva (c/ mortalidade)</span>
                  <span className="text-amber-700 font-bold">{formatBRL(custoPorCabecaViva)}</span>
                </div>
              )}
            </div>
          </div>

          {lote.status === 'encerrado' ? (
            <div className={`rounded-xl p-4 ${lucroLiquido >= 0 ? 'bg-[#556B2F]/10' : 'bg-red-100'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className={`w-5 h-5 ${lucroLiquido >= 0 ? 'text-[#556B2F]' : 'text-red-600'}`} />
                  <span className={`text-sm font-medium ${lucroLiquido >= 0 ? 'text-[#556B2F]' : 'text-red-800'}`}>
                    Lucro Líquido Real
                  </span>
                </div>
                <span className={`text-xl font-bold ${lucroLiquido >= 0 ? 'text-[#556B2F]' : 'text-red-600'}`}>
                  {formatBRL(lucroLiquido)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/60 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Lucro por Cabeça</p>
                  <p className={`text-lg font-bold ${lucroPorCabeca >= 0 ? 'text-[#556B2F]' : 'text-red-600'}`}>
                    {formatBRL(lucroPorCabeca)}
                  </p>
                </div>
                <div className="bg-white/60 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Margem de Lucro</p>
                  <p className={`text-lg font-bold ${margemLucro >= 0 ? 'text-[#556B2F]' : 'text-red-600'}`}>
                    {margemLucro.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-4 bg-blue-50 border border-blue-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Lucro Projetado</span>
                </div>
                <span className="text-xl font-bold text-blue-600">
                  {pesoAtualMedio > 0 ? formatBRL(lucroProjetado) : '—'}
                </span>
              </div>
              <p className="text-xs text-blue-500">
                Baseado no peso atual de {pesoAtualMedio.toFixed(1)} kg/cab ({kgToArrobas(pesoAtualMedio).toFixed(2)} @) com margem de 15% acima do ponto de equilíbrio
              </p>
              {receitasDiretas > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-white/60 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Lucro Parcial</p>
                    <p className={`text-lg font-bold ${lucroLiquido >= 0 ? 'text-[#556B2F]' : 'text-red-600'}`}>
                      {formatBRL(lucroLiquido)}
                    </p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Lucro/Cabeça (parcial)</p>
                    <p className={`text-lg font-bold ${lucroPorCabeca >= 0 ? 'text-[#556B2F]' : 'text-red-600'}`}>
                      {formatBRL(lucroPorCabeca)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Despesas Vinculadas */}
      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-[#36454F]">
            Despesas Vinculadas ao Lote
          </CardTitle>
        </CardHeader>
        <CardContent>
          {despesasVinculadas.length === 0 ? (
            <p className="text-center py-4 text-gray-400 text-sm">Nenhuma despesa operacional vinculada</p>
          ) : (
            <div className="space-y-2">
              {despesasVinculadas.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#36454F]">
                        {t.descricao || CATEGORIA_LABELS[t.categoria as CategoriaTransacao]}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(t.data)} • {CATEGORIA_LABELS[t.categoria as CategoriaTransacao]}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-red-500">
                    -{formatBRL(Number(t.valor))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compras & Vendas with PDF */}
      {(compras.length > 0 || vendas.length > 0) && (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#36454F] flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#556B2F]" />
              Compras & Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...compras, ...vendas].map((cv) => {
              const trans = transacoes.find((t) => t.id === cv.transacao_id);
              const isCompra = trans?.categoria === 'COMPRA_GADO';
              const pesoMedio = Number(cv.qtd_cabecas) > 0 ? Number(cv.peso_total_kg) / Number(cv.qtd_cabecas) : 0;
              return (
                <div key={cv.id} className="p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={`rounded-full text-xs ${isCompra ? 'bg-[#556B2F]/10 text-[#556B2F]' : 'bg-green-50 text-green-600'}`}>
                      {isCompra ? 'Compra' : 'Venda'}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{trans ? formatDate(trans.data) : ''}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleGerarPDFCompraVenda(cv)}
                        className="h-7 px-2 text-[#556B2F] hover:text-[#3D4F22] hover:bg-[#556B2F]/10"
                      >
                        <FileDown className="w-3 h-3 mr-1" />
                        <span className="text-[10px]">PDF</span>
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <p className="text-gray-400">Cabeças</p>
                      <p className="font-bold text-[#36454F]">{cv.qtd_cabecas}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Peso Total</p>
                      <p className="font-bold text-[#36454F]">
                        {Number(cv.peso_total_kg).toFixed(0)} kg ({kgToArrobas(Number(cv.peso_total_kg)).toFixed(1)} @)
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Peso Médio/Cab</p>
                      <p className="font-bold text-[#36454F]">
                        {pesoMedio.toFixed(1)} kg ({kgToArrobas(pesoMedio).toFixed(2)} @)
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">R$/Arroba</p>
                      <p className="font-bold text-[#556B2F]">{formatBRL(Number(cv.valor_por_arroba))}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* All Transactions */}
      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-[#36454F]">
            Todas as Transações do Lote
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transacoes.length === 0 ? (
            <p className="text-center py-6 text-gray-400 text-sm">Nenhuma transação registrada</p>
          ) : (
            <div className="space-y-2">
              {transacoes.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        t.tipo === 'RECEITA' ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      {t.tipo === 'RECEITA' ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#36454F]">
                        {t.descricao || CATEGORIA_LABELS[t.categoria as CategoriaTransacao]}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(t.data)}</p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      t.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {t.tipo === 'RECEITA' ? '+' : '-'}{formatBRL(Number(t.valor))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
