import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES, formatBRL } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lote, CATEGORIA_LABELS, CategoriaTransacao } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, TrendingUp, TrendingDown, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function NovoLancamento() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tipo, setTipo] = useState<'RECEITA' | 'DESPESA'>('DESPESA');
  const [categoria, setCategoria] = useState<CategoriaTransacao>('INSUMOS');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [descricao, setDescricao] = useState('');
  const [vincularLote, setVincularLote] = useState(false);
  const [loteId, setLoteId] = useState<string>('');
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLotes = async () => {
      const { data: lotesData } = await supabase
        .from(TABLES.lotes)
        .select('*')
        .eq('status', 'ativo')
        .order('nome_lote');
      if (lotesData) setLotes(lotesData as Lote[]);
    };
    fetchLotes();
  }, []);

  const categoriasDespesa: CategoriaTransacao[] = ['INSUMOS', 'INFRA', 'MAQUINARIO', 'PESSOAL', 'OUTROS'];
  const categoriasReceita: CategoriaTransacao[] = ['VENDA_GADO', 'OUTROS'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !valor || Number(valor) <= 0) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from(TABLES.transacoes).insert({
        user_id: user.id,
        tipo,
        categoria,
        valor: Number(valor),
        data,
        lote_id: vincularLote && loteId ? loteId : null,
        descricao,
      });

      if (error) throw error;

      toast({ title: 'Lançamento registrado!', description: `${tipo === 'RECEITA' ? 'Receita' : 'Despesa'} de ${formatBRL(Number(valor))}` });
      navigate('/');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao salvar', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-12 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Novo lançamento</h1>
        <p className="text-sm text-ink-500 mt-0.5">
          Registre uma receita ou despesa avulsa da fazenda.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tipo segmented */}
        <div className="grid grid-cols-2 gap-2 bg-white border border-ink-200 rounded-md p-1">
          <button
            type="button"
            onClick={() => { setTipo('DESPESA'); setCategoria('INSUMOS'); }}
            className={`h-9 rounded-[5px] text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
              tipo === 'DESPESA'
                ? 'bg-danger text-white shadow-sm'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            Despesa
          </button>
          <button
            type="button"
            onClick={() => { setTipo('RECEITA'); setCategoria('OUTROS'); }}
            className={`h-9 rounded-[5px] text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
              tipo === 'RECEITA'
                ? 'bg-success text-white shadow-sm'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Receita
          </button>
        </div>

        {/* Detalhes */}
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="px-5 py-4 border-b border-ink-200">
            <h3 className="text-sm font-semibold text-ink-900">Detalhes</h3>
          </div>
          <div className="p-5 space-y-4">
            {/* Valor — destaque */}
            <div>
              <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Valor (R$)</Label>
              <div className="mt-1.5 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 text-base font-semibold">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  required
                  className={`h-14 rounded-md text-2xl font-bold pl-12 tabular-nums border-ink-200 focus:border-brand focus:ring-brand ${
                    tipo === 'RECEITA' ? 'text-success' : 'text-danger'
                  }`}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Categoria</Label>
                <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaTransacao)}>
                  <SelectTrigger className="h-10 mt-1.5 rounded-md border-ink-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(tipo === 'DESPESA' ? categoriasDespesa : categoriasReceita).map((cat) => (
                      <SelectItem key={cat} value={cat}>{CATEGORIA_LABELS[cat]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            <div>
              <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Descrição</Label>
              <Textarea
                placeholder="Ex: Conserto de cerca no pasto 3, diesel para trator…"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1.5 rounded-md border-ink-200 min-h-[80px] resize-none text-sm"
              />
            </div>
          </div>
        </section>

        {/* Vincular a Lote */}
        <section className="rounded-xl border border-ink-200 bg-white">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">Vincular a um lote</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {vincularLote ? 'Será contabilizado como custo direto do lote.' : 'Será contabilizado como custo fixo da fazenda.'}
                </p>
              </div>
              <Switch
                checked={vincularLote}
                onCheckedChange={setVincularLote}
                className="data-[state=checked]:bg-brand"
              />
            </div>

            {vincularLote && (
              <div className="mt-4">
                <Select value={loteId} onValueChange={setLoteId}>
                  <SelectTrigger className="h-10 rounded-md border-ink-200">
                    <SelectValue placeholder="Selecione o lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes.map((lote) => (
                      <SelectItem key={lote.id} value={lote.id}>
                        {lote.nome_lote} ({lote.qtd_cabecas} cab.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            className="h-10 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium px-6"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            Salvar lançamento
          </Button>
        </div>
      </form>
    </div>
  );
}