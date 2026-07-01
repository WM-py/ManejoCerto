import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES, formatBRL, formatDate, kgToArrobas } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Transacao, Lote, Pesagem, PesagemLote, CATEGORIA_LABELS, CategoriaTransacao } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ComprovanteButton } from '@/components/ComprovanteButton';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Scale,
  Beef,
  ArrowRight,
  ShoppingCart,
  Pencil,
  Trash2,
  Wallet,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface MonthlyData {
  month: string;
  Receitas: number;
  Despesas: number;
}

const PERIODOS = [
  { value: 'mes_atual', label: 'Mês atual' },
  { value: 'mes_passado', label: 'Mês passado' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'ano', label: 'Ano' },
] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [chartTransacoes, setChartTransacoes] = useState<Transacao[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [pesagensMap, setPesagensMap] = useState<Record<string, Pesagem[]>>({});
  const [pesagensLoteMap, setPesagensLoteMap] = useState<Record<string, PesagemLote[]>>({});
  const [loading, setLoading] = useState(true);
  const [filterCategoria, setFilterCategoria] = useState<string>('ALL');
  const [filterPeriodo, setFilterPeriodo] = useState<string>('mes_atual');
  const [cotacaoArroba, setCotacaoArroba] = useState('320');

  const [transacaoEmEdicao, setTransacaoEmEdicao] = useState<Transacao | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [transacaoParaExcluir, setTransacaoParaExcluir] = useState<Transacao | null>(null);
  const [excluindoTransacao, setExcluindoTransacao] = useState(false);
  const [editValor, setEditValor] = useState('');
  const [editData, setEditData] = useState(new Date().toISOString().split('T')[0]);
  const [editCategoria, setEditCategoria] = useState<CategoriaTransacao>('OUTROS');
  const [editTipo, setEditTipo] = useState<'RECEITA' | 'DESPESA'>('DESPESA');
  const [editDescricao, setEditDescricao] = useState('');

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (filterPeriodo) {
      case 'mes_atual': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
      }
      case 'mes_passado': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
      }
      case 'trimestre': {
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
      }
      case 'ano': {
        const start = new Date(now.getFullYear(), 0, 1);
        return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
      }
      default: {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
      }
    }
  }, [filterPeriodo]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { start, end } = getDateRange();

    let query = supabase
      .from(TABLES.transacoes)
      .select('*')
      .gte('data', start)
      .lte('data', end)
      .order('data', { ascending: false });

    if (filterCategoria !== 'ALL') {
      query = query.eq('categoria', filterCategoria);
    }

    // Janela de 6 meses para o gráfico, independente do filtro de período acima.
    const now = new Date();
    const chartStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    const chartEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [transRes, lotesRes, chartRes] = await Promise.all([
      query,
      supabase.from(TABLES.lotes).select('*').eq('status', 'ativo').order('data_entrada', { ascending: false }),
      supabase.from(TABLES.transacoes).select('*').gte('data', chartStart).lte('data', chartEnd),
    ]);

    if (transRes.data) setTransacoes(transRes.data as Transacao[]);
    if (chartRes.data) setChartTransacoes(chartRes.data as Transacao[]);
    const activeLotes = (lotesRes.data || []) as Lote[];
    setLotes(activeLotes);

    if (activeLotes.length > 0) {
      const loteIds = activeLotes.map((l) => l.id);
      const [pesRes, pesLoteRes] = await Promise.all([
        supabase.from(TABLES.pesagens).select('*').in('lote_id', loteIds).order('data_pesagem', { ascending: true }),
        supabase.from(TABLES.pesagens_lote).select('*').in('lote_id', loteIds).order('data_pesagem', { ascending: true }),
      ]);

      const pesMap: Record<string, Pesagem[]> = {};
      ((pesRes.data || []) as Pesagem[]).forEach((p) => {
        if (!pesMap[p.lote_id]) pesMap[p.lote_id] = [];
        pesMap[p.lote_id].push(p);
      });
      setPesagensMap(pesMap);

      const pesLoteMap: Record<string, PesagemLote[]> = {};
      ((pesLoteRes.data || []) as PesagemLote[]).forEach((p) => {
        if (!pesLoteMap[p.lote_id]) pesLoteMap[p.lote_id] = [];
        pesLoteMap[p.lote_id].push(p);
      });
      setPesagensLoteMap(pesLoteMap);
    }

    setLoading(false);
  }, [user, getDateRange, filterCategoria]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const confirmarExclusaoTransacao = async () => {
    if (!transacaoParaExcluir) return;
    setExcluindoTransacao(true);
    const { error } = await supabase.from(TABLES.transacoes).delete().eq('id', transacaoParaExcluir.id);
    setExcluindoTransacao(false);

    if (error) {
      toast({ title: 'Erro ao excluir transação', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Lançamento excluído com sucesso!' });
    setTransacaoParaExcluir(null);
    fetchData();
  };

  const handleEditClick = (t: Transacao) => {
    setTransacaoEmEdicao(t);
    setEditValor(String(t.valor));
    setEditData(t.data);
    setEditCategoria(t.categoria);
    setEditTipo(t.tipo);
    setEditDescricao(t.descricao);
    setIsEditDialogOpen(true);
  };

  const handleUpdateTransacao = async () => {
    if (!transacaoEmEdicao) return;

    const dadosAtualizados = {
      valor: Number(editValor),
      data: editData,
      categoria: editCategoria,
      tipo: editTipo,
      descricao: editDescricao,
    };

    const { error } = await supabase
      .from(TABLES.transacoes)
      .update(dadosAtualizados)
      .eq('id', transacaoEmEdicao.id);

    if (error) {
      toast({ title: 'Erro ao editar transação', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Transação atualizada com sucesso!' });
    setIsEditDialogOpen(false);
    setTransacaoEmEdicao(null);
    fetchData();
  };

  // ── Cálculos ──
  const receitas = transacoes.filter((t) => t.tipo === 'RECEITA').reduce((s, t) => s + Number(t.valor), 0);
  const despesas = transacoes.filter((t) => t.tipo === 'DESPESA').reduce((s, t) => s + Number(t.valor), 0);
  const saldo = receitas - despesas;

  const totalCabecas = lotes.reduce((sum, l) => sum + (l.qtd_cabecas - l.qtd_cabecas_vendidas), 0);

  const pesoMedioLote = (l: Lote): number => {
    const cabVivas = l.qtd_cabecas - l.qtd_cabecas_vendidas;
    const plArr = pesagensLoteMap[l.id];
    if (plArr && plArr.length > 0) {
      return cabVivas > 0 ? Number(plArr[plArr.length - 1].peso_total_kg) / cabVivas : 0;
    }
    const pArr = pesagensMap[l.id];
    if (pArr && pArr.length > 0) return Number(pArr[pArr.length - 1].peso_media_kg);
    return Number(l.peso_entrada_kg) || 0;
  };

  const totalArrobasEstimadas = lotes.reduce((sum, l) => {
    const cabVivas = l.qtd_cabecas - l.qtd_cabecas_vendidas;
    return sum + kgToArrobas(pesoMedioLote(l) * cabVivas);
  }, 0);

  const valorRebanho = totalArrobasEstimadas * Number(cotacaoArroba);

  const chartData = ((): MonthlyData[] => {
    const months: MonthlyData[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      months.push({ month: monthStr, Receitas: 0, Despesas: 0 });
    }
    chartTransacoes.forEach((t) => {
      const tDate = new Date(t.data);
      const now2 = new Date();
      const diffMonths = (now2.getFullYear() - tDate.getFullYear()) * 12 + (now2.getMonth() - tDate.getMonth());
      if (diffMonths >= 0 && diffMonths < 6) {
        const idx = 5 - diffMonths;
        if (t.tipo === 'RECEITA') months[idx].Receitas += Number(t.valor);
        else months[idx].Despesas += Number(t.valor);
      }
    });
    return months;
  })();

  // Estado vazio total (nem lote, nem transação no período)
  const semDadosNenhum = !loading && lotes.length === 0 && transacoes.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-12 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Visão geral</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Acompanhe receitas, despesas e o patrimônio vivo da fazenda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
            <SelectTrigger className="h-9 w-[160px] rounded-md border-ink-200 text-sm bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => navigate('/compra-venda')}
            variant="outline"
            className="h-9 rounded-md border-ink-200 text-ink-700 hover:bg-ink-100 hover:text-ink-900 text-sm font-medium"
          >
            <Scale className="w-4 h-4 mr-1.5" strokeWidth={2.2} />
            Compra/Venda
          </Button>
          <Button
            onClick={() => navigate('/novo-lancamento')}
            className="h-9 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4 mr-1.5" strokeWidth={2.4} />
            Novo lançamento
          </Button>
        </div>
      </div>

      {/* Empty state — primeira vez */}
      {semDadosNenhum && (
        <div className="rounded-xl border border-ink-200 bg-white p-8 lg:p-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-xl bg-brand/10 flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-brand" strokeWidth={2.2} />
          </div>
          <h2 className="text-lg font-semibold text-ink-900">Bem-vindo ao Manejo Certo</h2>
          <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
            Comece registrando sua primeira compra de gado. Você poderá acompanhar custos, pesagens e rentabilidade por lote.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <Button
              onClick={() => navigate('/compra-venda')}
              className="h-10 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium"
            >
              <Scale className="w-4 h-4 mr-1.5" />
              Registrar primeira compra
            </Button>
            <Button
              onClick={() => navigate('/parametros')}
              variant="outline"
              className="h-10 rounded-md text-sm font-medium"
            >
              Configurar parâmetros
            </Button>
          </div>
        </div>
      )}

      {!semDadosNenhum && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Saldo do período"
              value={formatBRL(saldo)}
              tone={saldo >= 0 ? 'success' : 'danger'}
              icon={<Wallet className="w-4 h-4" />}
            />
            <KpiCard
              label="Receitas"
              value={formatBRL(receitas)}
              tone="success"
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <KpiCard
              label="Despesas"
              value={formatBRL(despesas)}
              tone="danger"
              icon={<TrendingDown className="w-4 h-4" />}
            />
            <KpiCard
              label="Patrimônio vivo"
              value={formatBRL(valorRebanho)}
              hint={`${totalCabecas} cab. · ${totalArrobasEstimadas.toFixed(0)} @`}
              tone="brand"
              icon={<Beef className="w-4 h-4" />}
            />
          </div>

          {/* Grid principal */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Coluna esquerda 2/3 */}
            <div className="lg:col-span-2 space-y-6">
              {/* Chart */}
              <section className="rounded-xl border border-ink-200 bg-white">
                <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-ink-900">Fluxo de caixa mensal</h3>
                    <p className="text-xs text-ink-500 mt-0.5">Últimos 6 meses</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(215, 16%, 47%)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 16%, 47%)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(value: number, name: string) => [formatBRL(value), name]}
                          contentStyle={{ borderRadius: 8, border: '1px solid hsl(214, 32%, 91%)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: 12 }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 12 }}
                          iconType="circle"
                          iconSize={8}
                        />
                        <Bar dataKey="Receitas" fill="hsl(152, 70%, 38%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Despesas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              {/* Transactions */}
              <section className="rounded-xl border border-ink-200 bg-white">
                <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-ink-900">Lançamentos recentes</h3>
                    <p className="text-xs text-ink-500 mt-0.5">{transacoes.length} no período</p>
                  </div>
                  <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                    <SelectTrigger className="h-8 w-[140px] rounded-md border-ink-200 text-xs bg-white">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas categorias</SelectItem>
                      {Object.entries(CATEGORIA_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {loading ? (
                  <div className="p-8 text-center text-sm text-ink-400">Carregando...</div>
                ) : transacoes.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-ink-500">Nenhum lançamento no período selecionado.</p>
                    <Button
                      onClick={() => navigate('/novo-lancamento')}
                      variant="outline"
                      size="sm"
                      className="mt-3 h-8 rounded-md text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Novo lançamento
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-ink-200">
                    {transacoes.slice(0, 8).map((t) => (
                      <li key={t.id} className="px-5 py-3 hover:bg-ink-100/40 group">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                            t.tipo === 'RECEITA' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
                          }`}>
                            {t.tipo === 'RECEITA' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink-900 truncate">
                              {t.descricao || CATEGORIA_LABELS[t.categoria as CategoriaTransacao]}
                            </p>
                            <p className="text-xs text-ink-500">
                              {formatDate(t.data)} · {CATEGORIA_LABELS[t.categoria as CategoriaTransacao]}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold tabular-nums ${
                              t.tipo === 'RECEITA' ? 'text-success' : 'text-danger'
                            }`}>
                              {t.tipo === 'RECEITA' ? '+' : '−'} {formatBRL(Number(t.valor))}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {t.comprovante_path && <ComprovanteButton path={t.comprovante_path} />}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleEditClick(t)}
                              className="p-1.5 rounded hover:bg-ink-200"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5 text-ink-500" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setTransacaoParaExcluir(t)}
                              className="p-1.5 rounded hover:bg-danger-soft"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-danger" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Coluna direita 1/3 */}
            <div className="space-y-6">
              {/* Patrimônio vivo */}
              <section className="rounded-xl border border-ink-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-ink-200">
                  <h3 className="text-sm font-semibold text-ink-900">Patrimônio vivo</h3>
                  <p className="text-xs text-ink-500 mt-0.5">Avaliação baseada na cotação da @</p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-ink-900 tabular-nums tracking-tight">
                      {formatBRL(valorRebanho)}
                    </p>
                    <p className="text-xs text-ink-500 mt-1">
                      {totalCabecas} cab. · {totalArrobasEstimadas.toFixed(1)} @
                    </p>
                  </div>
                  <div>
                    <Label className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">
                      Cotação da @ (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cotacaoArroba}
                      onChange={(e) => setCotacaoArroba(e.target.value)}
                      className="h-10 mt-1.5 rounded-md border-ink-200 text-center font-semibold text-ink-900 tabular-nums"
                    />
                  </div>
                </div>
              </section>

              {/* Lotes ativos */}
              <section className="rounded-xl border border-ink-200 bg-white">
                <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-ink-900">Lotes ativos</h3>
                    <p className="text-xs text-ink-500 mt-0.5">{lotes.length} no plantel</p>
                  </div>
                  <button
                    onClick={() => navigate('/lotes')}
                    className="text-xs font-medium text-brand hover:text-brand-700 flex items-center gap-0.5"
                  >
                    Ver todos
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                {lotes.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 bg-ink-100 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-ink-400" />
                    </div>
                    <p className="text-sm text-ink-500">Nenhum lote ativo.</p>
                    <Button
                      onClick={() => navigate('/compra-venda')}
                      size="sm"
                      className="mt-3 h-8 rounded-md bg-brand hover:bg-brand-700 text-white text-xs"
                    >
                      Criar lote
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-ink-200">
                    {lotes.slice(0, 5).map((l) => {
                      const cabVivas = l.qtd_cabecas - l.qtd_cabecas_vendidas;
                      const arr = kgToArrobas(pesoMedioLote(l) * cabVivas);
                      const valor = arr * Number(cotacaoArroba);
                      return (
                        <li key={l.id}>
                          <button
                            onClick={() => navigate(`/lote/${l.id}`)}
                            className="w-full px-5 py-3 hover:bg-ink-100/40 text-left flex items-center gap-3"
                          >
                            <div className="w-8 h-8 rounded-md bg-brand/10 flex items-center justify-center flex-shrink-0">
                              <Beef className="w-4 h-4 text-brand" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink-900 truncate">{l.nome_lote}</p>
                              <p className="text-xs text-ink-500">
                                {cabVivas} cab. · {arr.toFixed(1)} @
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-ink-900 tabular-nums">
                              {formatBRL(valor)}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={transacaoParaExcluir !== null}
        onOpenChange={(o) => !o && setTransacaoParaExcluir(null)}
        title="Excluir lançamento"
        description={
          transacaoParaExcluir
            ? `Deseja excluir "${transacaoParaExcluir.descricao || CATEGORIA_LABELS[transacaoParaExcluir.categoria]}" (${formatBRL(Number(transacaoParaExcluir.valor))})? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        destructive
        loading={excluindoTransacao}
        onConfirm={confirmarExclusaoTransacao}
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar lançamento</DialogTitle>
            <DialogDescription>Atualize os dados da transação.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={editValor} onChange={(e) => setEditValor(e.target.value)} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={editTipo} onValueChange={(v) => setEditTipo(v as 'RECEITA' | 'DESPESA')}>
                <SelectTrigger className="h-10 rounded-md border-ink-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEITA">Receita</SelectItem>
                  <SelectItem value="DESPESA">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={editCategoria} onValueChange={(v) => setEditCategoria(v as CategoriaTransacao)}>
                <SelectTrigger className="h-10 rounded-md border-ink-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIA_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key as CategoriaTransacao}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateTransacao} className="bg-brand hover:bg-brand-700">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── KPI Card ──
type Tone = 'success' | 'danger' | 'brand' | 'neutral';
const TONE_COLOR: Record<Tone, { icon: string; value: string }> = {
  success: { icon: 'bg-success-soft text-success', value: 'text-success' },
  danger:  { icon: 'bg-danger-soft text-danger',   value: 'text-danger'  },
  brand:   { icon: 'bg-brand/10 text-brand',       value: 'text-ink-900' },
  neutral: { icon: 'bg-ink-100 text-ink-700',      value: 'text-ink-900' },
};

function KpiCard({ label, value, hint, icon, tone = 'neutral' }: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: Tone;
}) {
  const colors = TONE_COLOR[tone];
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10.5px] text-ink-500 font-semibold uppercase tracking-wider truncate">{label}</p>
        {icon && (
          <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
            {icon}
          </div>
        )}
      </div>
      <p className={`text-lg sm:text-xl lg:text-[22px] font-bold tabular-nums tracking-tight ${colors.value} whitespace-nowrap`}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-ink-500 mt-1 truncate">{hint}</p>}
    </div>
  );
}
