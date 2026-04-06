import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, TABLES, formatBRL, formatDate } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Transacao, CATEGORIA_LABELS, CategoriaTransacao } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  BarChart3,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

const PIE_COLORS = ['#556B2F', '#36454F', '#D97706', '#2563EB', '#DC2626', '#7C3AED', '#059669'];

const ALL_CATEGORIAS: CategoriaTransacao[] = [
  'VENDA_GADO', 'COMPRA_GADO', 'INSUMOS', 'INFRA', 'MAQUINARIO', 'PESSOAL', 'OUTROS',
];

export default function Relatorios() {
  const { user } = useAuth();

  // Date range: default to first day of current month → today
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  const [dataInicial, setDataInicial] = useState(firstOfMonth);
  const [dataFinal, setDataFinal] = useState(today);
  const [selectedCategorias, setSelectedCategorias] = useState<Set<CategoriaTransacao>>(new Set(ALL_CATEGORIAS));
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from(TABLES.transacoes)
      .select('*')
      .gte('data', dataInicial)
      .lte('data', dataFinal)
      .order('data', { ascending: false });

    if (!error && data) {
      setTransacoes(data as Transacao[]);
    }
    setLoading(false);
  }, [user, dataInicial, dataFinal]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCategoria = (cat: CategoriaTransacao) => {
    setSelectedCategorias((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        // Don't allow deselecting all
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  // Filtered transactions
  const filtered = useMemo(
    () => transacoes.filter((t) => selectedCategorias.has(t.categoria as CategoriaTransacao)),
    [transacoes, selectedCategorias]
  );

  const totalEntradas = filtered
    .filter((t) => t.tipo === 'RECEITA')
    .reduce((sum, t) => sum + Number(t.valor), 0);

  const totalSaidas = filtered
    .filter((t) => t.tipo === 'DESPESA')
    .reduce((sum, t) => sum + Number(t.valor), 0);

  const saldoLiquido = totalEntradas - totalSaidas;

  // Pie chart data: despesas by category
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    filtered
      .filter((t) => t.tipo === 'DESPESA')
      .forEach((t) => {
        const label = CATEGORIA_LABELS[t.categoria as CategoriaTransacao] || t.categoria;
        map.set(label, (map.get(label) || 0) + Number(t.valor));
      });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const totalDespesasPie = pieData.reduce((s, d) => s + d.value, 0);

  // Custom pie tooltip
  const PieTooltipContent = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (!active || !payload || payload.length === 0) return null;
    const item = payload[0];
    const pct = totalDespesasPie > 0 ? ((item.value / totalDespesasPie) * 100).toFixed(1) : '0';
    return (
      <div className="bg-white rounded-xl shadow-lg border-0 px-4 py-3">
        <p className="text-sm font-semibold text-[#36454F]">{item.name}</p>
        <p className="text-sm text-gray-500">{formatBRL(item.value)} ({pct}%)</p>
      </div>
    );
  };

  // Custom pie legend
  const renderPieLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => {
    if (!payload) return null;
    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-gray-600">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-8 space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#556B2F]/10 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-[#556B2F]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#36454F]">Relatórios Financeiros</h2>
          <p className="text-xs text-gray-400">Análise detalhada de receitas e despesas</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardContent className="p-5 space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Data Inicial</Label>
              <Input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="h-10 rounded-xl border-gray-200 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Data Final</Label>
              <Input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="h-10 rounded-xl border-gray-200 text-sm"
              />
            </div>
          </div>

          {/* Category Multi-Select */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Categorias</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIAS.map((cat) => {
                const isSelected = selectedCategorias.has(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategoria(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      isSelected
                        ? 'bg-[#556B2F] text-white border-[#556B2F]'
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {CATEGORIA_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 font-medium">Total Entradas</span>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {loading ? '...' : formatBRL(totalEntradas)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 font-medium">Total Saídas</span>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-500">
              {loading ? '...' : formatBRL(totalSaidas)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 font-medium">Saldo Líquido</span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${saldoLiquido >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <Wallet className={`w-5 h-5 ${saldoLiquido >= 0 ? 'text-green-600' : 'text-red-500'}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${saldoLiquido >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {loading ? '...' : formatBRL(saldoLiquido)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pie Chart - Despesas por Categoria */}
      {pieData.length > 0 && (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#36454F] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#556B2F]" />
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltipContent />} />
                  <Legend content={renderPieLegend} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Percentage breakdown */}
            <div className="space-y-2 mt-2">
              {pieData.map((item, idx) => {
                const pct = totalDespesasPie > 0 ? ((item.value / totalDespesasPie) * 100).toFixed(1) : '0';
                return (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-[#36454F]">{formatBRL(item.value)}</span>
                      <Badge className="rounded-full bg-gray-100 text-gray-600 border-0 text-[10px] px-2">
                        {pct}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-[#36454F]">
            Tabela de Transações ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-gray-400">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">Nenhuma transação encontrada no período</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-400 uppercase">Data</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-400 uppercase">Tipo</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-400 uppercase">Categoria</th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-gray-400 uppercase">Valor</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-400 uppercase hidden sm:table-cell">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-2 text-xs text-[#36454F]">{formatDate(t.data)}</td>
                      <td className="py-3 px-2">
                        <Badge
                          className={`rounded-full text-[10px] px-2 py-0.5 font-semibold ${
                            t.tipo === 'RECEITA'
                              ? 'bg-green-50 text-green-600 border-green-200'
                              : 'bg-red-50 text-red-500 border-red-200'
                          }`}
                        >
                          {t.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-xs text-gray-500">
                        {CATEGORIA_LABELS[t.categoria as CategoriaTransacao]}
                      </td>
                      <td className={`py-3 px-2 text-xs font-bold text-right ${
                        t.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-500'
                      }`}>
                        {t.tipo === 'RECEITA' ? '+' : '-'}{formatBRL(Number(t.valor))}
                      </td>
                      <td className="py-3 px-2 text-xs text-gray-400 max-w-[200px] truncate hidden sm:table-cell">
                        {t.descricao || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}