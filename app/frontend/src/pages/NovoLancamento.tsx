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

      toast({ title: 'Lancamento registrado!', description: `${tipo === 'RECEITA' ? 'Receita' : 'Despesa'} de ${formatBRL(Number(valor))}` });
      navigate('/');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao salvar', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tipo Toggle */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setTipo('DESPESA'); setCategoria('INSUMOS'); }}
            className={`h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
              tipo === 'DESPESA'
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-white text-gray-400 border border-gray-200'
            }`}
          >
            <TrendingDown className="w-5 h-5" />
            Despesa
          </button>
          <button
            type="button"
            onClick={() => { setTipo('RECEITA'); setCategoria('OUTROS'); }}
            className={`h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
              tipo === 'RECEITA'
                ? 'bg-green-500 text-white shadow-lg'
                : 'bg-white text-gray-400 border border-gray-200'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            Receita
          </button>
        </div>

        {/* Form Fields */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#36454F]">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
                className="h-14 rounded-xl text-2xl font-bold text-center border-gray-200 focus:border-[#556B2F] focus:ring-[#556B2F]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaTransacao)}>
                <SelectTrigger className="h-12 rounded-xl border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(tipo === 'DESPESA' ? categoriasDespesa : categoriasReceita).map((cat) => (
                    <SelectItem key={cat} value={cat}>{CATEGORIA_LABELS[cat]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Descricao</Label>
              <Textarea
                placeholder="Ex: Conserto de cerca no pasto 3, diesel para trator..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="rounded-xl border-gray-200 min-h-[80px] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Vincular a Lote */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#36454F] text-sm">Vincular a um Lote</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {vincularLote ? 'Custo direto do lote' : 'Custo fixo da fazenda'}
                </p>
              </div>
              <Switch
                checked={vincularLote}
                onCheckedChange={setVincularLote}
                className="data-[state=checked]:bg-[#556B2F]"
              />
            </div>

            {vincularLote && (
              <div className="mt-4">
                <Select value={loteId} onValueChange={setLoteId}>
                  <SelectTrigger className="h-12 rounded-xl border-gray-200">
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
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-16 rounded-2xl text-lg font-bold bg-[#556B2F] hover:bg-[#3D4F22] text-white shadow-xl"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />}
          Salvar Lancamento
        </Button>
      </form>
    </div>
  );
}