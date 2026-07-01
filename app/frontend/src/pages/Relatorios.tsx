import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, TABLES, formatBRL, formatDate } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Transacao, CATEGORIA_LABELS, CategoriaTransacao } from '@/lib/types';
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

const PIE_COLORS = ['hsl(152, 55%, 23%)', 'hsl(222, 47%, 11%)', '#D97706', '#2563EB', '#DC2626', '#7C3AED', '#059669'];

const ALL_CATEGORIAS: CategoriaTransacao[] = [
  'VENDA_GADO', 'COMPRA_GADO', 'NUTRICAO', 'SANIDADE', 'INSUMOS', 'INFRA',
  'MAQUINARIO', 'COMBUSTIVEL', 'FRETE', 'ARRENDAMENTO', 'PESSOAL', 'IMPOSTOS', 'OUTROS',
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
      <div className="bg-white rounded-md border border-ink-200 shadow-md px-3 py-2">
        <p className="text-xs font-semibold text-ink-900">{item.name}</p>
        <p className="text-xs text-ink-500 tabular-nums">{formatBRL(item.value)} ({pct}%)</p>
      </div>
    );
  };

  // Custom pie legend
  const renderPieLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => {
    if (!payload) return null;
    return (
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[11px] text-ink-500">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-12 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand" strokeWidth={2.2} />
            Relatórios
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Análise detalhada de receitas e despesas por período.
          </p>
        </div>
      </div>

      {/* Filters */}
      <section className="rounded-xl border border-ink-200 bg-white">
        <div className="px-5 py-4 border-b border-ink-200">
          <h3 className="text-sm font-semibold text-ink-900">Filtros</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Data inicial</Label>
              <Input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="h-9 mt-1.5 rounded-md border-ink-200 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Data final</Label>
              <Input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="h-9 mt-1.5 rounded-md border-ink-200 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Categorias</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {ALL_CATEGORIAS.map((cat) => {
                const isSelected = selectedCategorias.has(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategoria(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                      isSelected
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400 hover:text-ink-700'
                    }`}
                  >
                    {CATEGORIA_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiBlock
          label="Total entradas"
          value={loading ? '…' : formatBRL(totalEntradas)}
          icon={<TrendingUp className="w-4 h-4" />}
          tone="success"
        />
        <KpiBlock
          label="Total saídas"
          value={loading ? '…' : formatBRL(totalSaidas)}
          icon={<TrendingDown className="w-4 h-4" />}
          tone="danger"
        />
        <KpiBlock
          label="Saldo líquido"
          value={loading ? '…' : formatBRL(saldoLiquido)}
          icon={<Wallet className="w-4 h-4" />}
          tone={saldoLiquido >= 0 ? 'success' : 'danger'}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Pie + breakdown */}
        {pieData.length > 0 && (
          <section className="lg:col-span-2 rounded-xl border border-ink-200 bg-white">
            <div className="px-5 py-4 border-b border-ink-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand" strokeWidth={2.4} />
              <h3 className="text-sm font-semibold text-ink-900">Despesas por categoria</h3>
            </div>
            <div className="p-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={42} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                      {pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltipContent />} />
                    <Legend content={renderPieLegend} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-3 border-t border-ink-200 pt-3">
                {pieData.map((item, idx) => {
                  const pct = totalDespesasPie > 0 ? ((item.value / totalDespesasPie) * 100).toFixed(1) : '0';
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span className="text-ink-700 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-semibold text-ink-900 tabular-nums">{formatBRL(item.value)}</span>
                        <span className="text-ink-500 tabular-nums w-10 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Transactions Table */}
        <section className={`${pieData.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'} rounded-xl border border-ink-200 bg-white`}>
          <div className="px-5 py-4 border-b border-ink-200">
            <h3 className="text-sm font-semibold text-ink-900">
              Lançamentos <span className="text-ink-400 font-normal tabular-nums">· {filtered.length}</span>
            </h3>
            <p className="text-xs text-ink-500 mt-0.5">
              {dataInicial.split('-').reverse().join('/')} a {dataFinal.split('-').reverse().join('/')}
            </p>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-ink-400">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-10 h-10 text-ink-200 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-ink-500">Nenhuma transação encontrada no período.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-100/40">
                  <tr>
                    <th className="text-left py-2.5 px-4 text-[10.5px] font-semibold text-ink-500 uppercase tracking-wider">Data</th>
                    <th className="text-left py-2.5 px-4 text-[10.5px] font-semibold text-ink-500 uppercase tracking-wider">Tipo</th>
                    <th className="text-left py-2.5 px-4 text-[10.5px] font-semibold text-ink-500 uppercase tracking-wider">Categoria</th>
                    <th className="text-right py-2.5 px-4 text-[10.5px] font-semibold text-ink-500 uppercase tracking-wider">Valor</th>
                    <th className="text-left py-2.5 px-4 text-[10.5px] font-semibold text-ink-500 uppercase tracking-wider hidden md:table-cell">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200">
                  {filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-ink-100/30 transition-colors">
                      <td className="py-3 px-4 text-xs text-ink-700 tabular-nums whitespace-nowrap">{formatDate(t.data)}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`rounded-full text-[10px] px-2 py-0 font-medium ${
                            t.tipo === 'RECEITA'
                              ? 'border-success/30 bg-success-soft text-success'
                              : 'border-danger/30 bg-danger-soft text-danger'
                          }`}
                        >
                          {t.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-ink-500">
                        {CATEGORIA_LABELS[t.categoria as CategoriaTransacao]}
                      </td>
                      <td className={`py-3 px-4 text-sm font-semibold text-right tabular-nums whitespace-nowrap ${
                        t.tipo === 'RECEITA' ? 'text-success' : 'text-danger'
                      }`}>
                        {t.tipo === 'RECEITA' ? '+' : '−'} {formatBRL(Number(t.valor))}
                      </td>
                      <td className="py-3 px-4 text-xs text-ink-500 max-w-[280px] truncate hidden md:table-cell">
                        {t.descricao || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function KpiBlock({ label, value, icon, tone }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'success' | 'danger';
}) {
  const colors = tone === 'success'
    ? { box: 'bg-success-soft text-success', value: 'text-success' }
    : { box: 'bg-danger-soft text-danger',   value: 'text-danger'  };
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10.5px] text-ink-500 font-semibold uppercase tracking-wider">{label}</p>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${colors.box}`}>
          {icon}
        </div>
      </div>
      <p className={`text-xl font-bold tabular-nums tracking-tight ${colors.value}`}>{value}</p>
    </div>
  );
}