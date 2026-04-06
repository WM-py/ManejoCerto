import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES, formatBRL, formatDate, kgToArrobas } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Transacao, Lote, Pesagem, PesagemLote, CATEGORIA_LABELS, CategoriaTransacao } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Scale,
  Beef,
  BarChart3,
  ChevronRight,
  Filter,
  ShoppingCart,
  Eye,
  DollarSign,
  Pencil,
  Trash2,
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

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [pesagensMap, setPesagensMap] = useState<Record<string, Pesagem[]>>({});
  const [pesagensLoteMap, setPesagensLoteMap] = useState<Record<string, PesagemLote[]>>({});
  const [loading, setLoading] = useState(true);
  const [filterCategoria, setFilterCategoria] = useState<string>('ALL');
  const [filterPeriodo, setFilterPeriodo] = useState<string>('mes_atual');
  const [activeTab, setActiveTab] = useState<'financeiro' | 'raio_x'>('financeiro');
  const [cotacaoArroba, setCotacaoArroba] = useState('320');

  const [transacaoEmEdicao, setTransacaoEmEdicao] = useState<Transacao | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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

    const [transRes, lotesRes] = await Promise.all([
      query,
      supabase.from(TABLES.lotes).select('*').eq('status', 'ativo').order('data_entrada', { ascending: false }),
    ]);

    if (transRes.data) setTransacoes(transRes.data as Transacao[]);
    const activeLotes = (lotesRes.data || []) as Lote[];
    setLotes(activeLotes);

    // Fetch pesagens for all active lotes
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

  const handleDeleteTransacao = async (id: string) => {
    const confirmed = window.confirm('Tem certeza que deseja excluir este lançamento?');
    if (!confirmed) return;

    const { error } = await supabase.from(TABLES.transacoes).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir transação', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Lançamento excluído com sucesso!' });
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

  const receitas = transacoes
    .filter((t) => t.tipo === 'RECEITA')
    .reduce((sum, t) => sum + Number(t.valor), 0);

  const despesas = transacoes
    .filter((t) => t.tipo === 'DESPESA')
    .reduce((sum, t) => sum + Number(t.valor), 0);

  const saldo = receitas - despesas;

  // Raio-X da Fazenda calculations
  const totalCabecas = lotes.reduce((sum, l) => sum + (l.qtd_cabecas - l.qtd_cabecas_vendidas), 0);

  const totalArrobasEstimadas = lotes.reduce((sum, l) => {
    const cabecasVivas = l.qtd_cabecas - l.qtd_cabecas_vendidas;
    let pesoMedio = Number(l.peso_entrada_kg) || 0;

    // Use pesagens_lote first
    const plArr = pesagensLoteMap[l.id];
    if (plArr && plArr.length > 0) {
      const lastPL = plArr[plArr.length - 1];
      pesoMedio = cabecasVivas > 0 ? Number(lastPL.peso_total_kg) / cabecasVivas : 0;
    } else {
      const pArr = pesagensMap[l.id];
      if (pArr && pArr.length > 0) {
        pesoMedio = Number(pArr[pArr.length - 1].peso_media_kg);
      }
    }

    return sum + kgToArrobas(pesoMedio * cabecasVivas);
  }, 0);

  const valorRebanho = totalArrobasEstimadas * Number(cotacaoArroba);

  const getChartData = (): MonthlyData[] => {
    const months: MonthlyData[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      months.push({ month: monthStr, Receitas: 0, Despesas: 0 });
    }

    transacoes.forEach((t) => {
      const tDate = new Date(t.data);
      const now2 = new Date();
      const diffMonths = (now2.getFullYear() - tDate.getFullYear()) * 12 + (now2.getMonth() - tDate.getMonth());
      if (diffMonths >= 0 && diffMonths < 6) {
        const idx = 5 - diffMonths;
        if (idx >= 0 && idx < months.length) {
          if (t.tipo === 'RECEITA') months[idx].Receitas += Number(t.valor);
          else months[idx].Despesas += Number(t.valor);
        }
      }
    });

    return months;
  };

  const chartData = getChartData();

  const renderLegend = () => (
    <div className="flex items-center justify-center gap-6 mt-2">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-sm bg-[#22C55E]" />
        <span className="text-xs font-medium text-gray-600">Receitas</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-sm bg-[#EF4444]" />
        <span className="text-xs font-medium text-gray-600">Despesas</span>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-8 space-y-6">
      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => navigate('/novo-lancamento')}
          className="h-16 rounded-2xl bg-[#556B2F] hover:bg-[#3D4F22] text-white text-base font-semibold shadow-lg"
        >
          <Plus className="w-6 h-6 mr-2" />
          Novo Lancamento
        </Button>
        <Button
          onClick={() => navigate('/compra-venda')}
          className="h-16 rounded-2xl bg-[#36454F] hover:bg-[#2a363e] text-white text-base font-semibold shadow-lg"
        >
          <Scale className="w-6 h-6 mr-2" />
          Compra / Venda
        </Button>
      </div>

      {/* Tab Toggle */}
      <div className="grid grid-cols-2 gap-2 bg-gray-100 rounded-2xl p-1">
        <button
          onClick={() => setActiveTab('financeiro')}
          className={`h-10 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'financeiro'
              ? 'bg-white text-[#36454F] shadow-sm'
              : 'text-gray-400'
          }`}
        >
          <Wallet className="w-4 h-4 inline mr-1" />
          Financeiro
        </button>
        <button
          onClick={() => setActiveTab('raio_x')}
          className={`h-10 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'raio_x'
              ? 'bg-white text-[#36454F] shadow-sm'
              : 'text-gray-400'
          }`}
        >
          <Eye className="w-4 h-4 inline mr-1" />
          Raio-X da Fazenda
        </button>
      </div>

      {activeTab === 'raio_x' ? (
        /* ── Raio-X da Fazenda ── */
        <div className="space-y-4">
          {/* Patrimônio Vivo */}
          <Card className="rounded-2xl shadow-sm border-2 border-[#556B2F]/20 bg-gradient-to-br from-[#556B2F]/5 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-[#36454F] flex items-center gap-2">
                <Beef className="w-5 h-5 text-[#556B2F]" />
                Patrimônio Vivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <Beef className="w-6 h-6 mx-auto text-[#556B2F] mb-2" />
                  <p className="text-2xl font-bold text-[#36454F]">{totalCabecas}</p>
                  <p className="text-xs text-gray-500">Cabeças em Pasto</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <Scale className="w-6 h-6 mx-auto text-[#556B2F] mb-2" />
                  <p className="text-2xl font-bold text-[#36454F]">{totalArrobasEstimadas.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">@ Estimadas</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <DollarSign className="w-6 h-6 mx-auto text-green-600 mb-2" />
                  <p className="text-xl font-bold text-green-600">{formatBRL(valorRebanho)}</p>
                  <p className="text-xs text-gray-500">Valor Rebanho</p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <Label className="text-xs text-gray-500 mb-2 block">Cotação da @ (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cotacaoArroba}
                  onChange={(e) => setCotacaoArroba(e.target.value)}
                  className="h-12 rounded-xl border-gray-200 text-lg font-bold text-center text-[#556B2F]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Lotes breakdown */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-[#36454F]">
                Detalhamento por Lote
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lotes.length === 0 ? (
                <p className="text-center py-6 text-gray-400 text-sm">Nenhum lote ativo</p>
              ) : (
                <div className="space-y-3">
                  {lotes.map((l) => {
                    const cabVivas = l.qtd_cabecas - l.qtd_cabecas_vendidas;
                    let pesoMed = Number(l.peso_entrada_kg) || 0;
                    const plArr = pesagensLoteMap[l.id];
                    if (plArr && plArr.length > 0) {
                      pesoMed = cabVivas > 0 ? Number(plArr[plArr.length - 1].peso_total_kg) / cabVivas : 0;
                    } else {
                      const pArr = pesagensMap[l.id];
                      if (pArr && pArr.length > 0) pesoMed = Number(pArr[pArr.length - 1].peso_media_kg);
                    }
                    const arrobas = kgToArrobas(pesoMed * cabVivas);
                    const valor = arrobas * Number(cotacaoArroba);
                    return (
                      <button
                        key={l.id}
                        onClick={() => navigate(`/lote/${l.id}`)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-[#556B2F]/5 rounded-xl transition-colors text-left"
                      >
                        <div>
                          <p className="font-semibold text-[#36454F] text-sm">{l.nome_lote}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {l.sexo && (
                              <Badge className="bg-green-100 text-green-700 px-2 py-0.5 text-xs font-semibold">
                                {l.sexo}
                              </Badge>
                            )}
                            {l.categoria && (
                              <Badge className="bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-semibold">
                                {l.categoria}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {cabVivas} cab. • {pesoMed.toFixed(1)} kg/cab • {arrobas.toFixed(1)} @
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">{formatBRL(valor)}</p>
                          <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ── Financeiro Tab ── */
        <>
          {/* Filters */}
          <div className="flex gap-3 items-center">
            <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
              <SelectTrigger className="h-10 rounded-xl bg-white border-gray-200 text-sm">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_atual">Mes Atual</SelectItem>
                <SelectItem value="mes_passado">Mes Passado</SelectItem>
                <SelectItem value="trimestre">Ultimo Trimestre</SelectItem>
                <SelectItem value="ano">Este Ano</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger className="h-10 rounded-xl bg-white border-gray-200 text-sm">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                {Object.entries(CATEGORIA_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-2xl shadow-sm border-0 bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500 font-medium">Saldo</span>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${saldo >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <Wallet className={`w-5 h-5 ${saldo >= 0 ? 'text-green-600' : 'text-red-500'}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatBRL(saldo)}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-0 bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500 font-medium">Receitas</span>
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-600">{formatBRL(receitas)}</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-0 bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500 font-medium">Despesas</span>
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-red-500">{formatBRL(despesas)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-[#36454F] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#556B2F]" />
                Fluxo de Caixa Mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatBRL(value), name]}
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend content={renderLegend} />
                    <Bar dataKey="Receitas" fill="#22C55E" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Active Lots */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-[#36454F] flex items-center gap-2">
                  <Beef className="w-5 h-5 text-[#556B2F]" />
                  Lotes Ativos
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/lotes')}
                  className="text-[#556B2F] hover:text-[#3D4F22] text-sm"
                >
                  Ver todos
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-400">Carregando...</div>
              ) : lotes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-4 bg-[#556B2F]/10 rounded-2xl flex items-center justify-center">
                    <ShoppingCart className="w-10 h-10 text-[#556B2F]/40" />
                  </div>
                  <p className="text-gray-500 text-sm mb-4">Nenhum lote ativo</p>
                  <Button
                    onClick={() => navigate('/compra-venda')}
                    className="h-14 px-8 rounded-2xl bg-[#556B2F] hover:bg-[#3D4F22] text-white font-semibold text-base shadow-lg"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Iniciar Novo Lote
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {lotes.map((lote) => (
                    <button
                      key={lote.id}
                      onClick={() => navigate(`/lote/${lote.id}`)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-[#556B2F]/5 rounded-xl transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#556B2F]/10 rounded-xl flex items-center justify-center">
                          <Beef className="w-5 h-5 text-[#556B2F]" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#36454F] text-sm">{lote.nome_lote}</p>
                          <p className="text-xs text-gray-400">
                            {lote.qtd_cabecas} cabecas - Entrada: {formatDate(lote.data_entrada)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-[#36454F]">
                Transacoes Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transacoes.length === 0 ? (
                <p className="text-center py-6 text-gray-400 text-sm">Nenhuma transacao no periodo</p>
              ) : (
                <div className="space-y-2">
                  {transacoes.slice(0, 10).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
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
                          <p className="text-xs text-gray-400">
                            {formatDate(t.data)} - {CATEGORIA_LABELS[t.categoria as CategoriaTransacao]}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            t.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-500'
                          }`}
                        >
                          {t.tipo === 'RECEITA' ? '+' : '-'}{formatBRL(Number(t.valor))}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEditClick(t)}
                          className="p-1 rounded-md hover:bg-gray-100"
                        >
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTransacao(t.id)}
                          className="p-1 rounded-md hover:bg-gray-100"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Lançamento</DialogTitle>
                <DialogDescription>Atualize os dados da transação</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 pt-2">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editValor}
                    onChange={(e) => setEditValor(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={editTipo} onValueChange={(value) => setEditTipo(value as 'RECEITA' | 'DESPESA')}>
                    <SelectTrigger className="h-10 rounded-xl border-gray-200">
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
                  <Select value={editCategoria} onValueChange={(value) => setEditCategoria(value as CategoriaTransacao)}>
                    <SelectTrigger className="h-10 rounded-xl border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIA_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key as CategoriaTransacao}>
                          {label}
                        </SelectItem>
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
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateTransacao}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}