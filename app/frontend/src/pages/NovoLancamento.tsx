import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES, formatBRL, maskBRLInput, parseBRLInput } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lote, CATEGORIA_LABELS, CategoriaTransacao } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, TrendingUp, TrendingDown, Save, Plus, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const HOJE = new Date().toISOString().split('T')[0];

interface FormErrors {
  valor?: string;
  categoria?: string;
  data?: string;
  descricao?: string;
  lote?: string;
}

export default function NovoLancamento() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const valorRef = useRef<HTMLInputElement>(null);

  const [tipo, setTipo] = useState<'RECEITA' | 'DESPESA'>('DESPESA');
  const [categoria, setCategoria] = useState<CategoriaTransacao>('INSUMOS');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(HOJE);
  const [descricao, setDescricao] = useState('');
  const [vincularLote, setVincularLote] = useState(false);
  const [loteId, setLoteId] = useState<string>('');
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

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

  // Autofoco no campo Valor (é o mais importante desta tela).
  useEffect(() => {
    valorRef.current?.focus();
  }, []);

  const categoriasDespesa: CategoriaTransacao[] = ['INSUMOS', 'INFRA', 'MAQUINARIO', 'PESSOAL', 'OUTROS'];
  const categoriasReceita: CategoriaTransacao[] = ['VENDA_GADO', 'OUTROS'];

  const valorNumerico = parseBRLInput(valor);

  const validar = (): FormErrors => {
    const e: FormErrors = {};
    if (valorNumerico <= 0) e.valor = 'Informe um valor maior que zero.';
    if (!data) e.data = 'Informe a data.';
    else if (data > HOJE) e.data = 'A data não pode ser no futuro.';
    // "Outros" sem descrição vira lançamento sem rastro no relatório.
    if (categoria === 'OUTROS' && !descricao.trim()) {
      e.descricao = 'Descreva o lançamento quando a categoria for "Outros".';
    }
    // Vínculo ligado exige a escolha do lote (senão salva em silêncio como custo da fazenda).
    if (vincularLote && !loteId) e.lote = 'Selecione o lote ou desligue o vínculo.';
    return e;
  };

  const resetForm = () => {
    setValor('');
    setDescricao('');
    setErrors({});
    // Mantém tipo, categoria, data e vínculo para lançamentos em sequência.
    setTimeout(() => valorRef.current?.focus(), 50);
  };

  const salvar = async (continuar: boolean) => {
    if (!user) return;
    const validationErrors = validar();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({ title: 'Revise os campos destacados', variant: 'destructive' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.from(TABLES.transacoes).insert({
        user_id: user.id,
        tipo,
        categoria,
        valor: valorNumerico,
        data,
        lote_id: vincularLote && loteId ? loteId : null,
        descricao: descricao.trim(),
      });

      if (error) throw error;

      toast({
        title: 'Lançamento registrado!',
        description: `${tipo === 'RECEITA' ? 'Receita' : 'Despesa'} de ${formatBRL(valorNumerico)}`,
      });

      if (continuar) {
        resetForm();
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao salvar', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    salvar(false);
  };

  const loteOptions = lotes.map((l) => ({
    value: l.id,
    label: `${l.nome_lote} (${l.qtd_cabecas} cab.)`,
  }));

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
            onClick={() => { setTipo('DESPESA'); setCategoria('INSUMOS'); setErrors({}); }}
            className={`h-9 rounded-[5px] text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
              tipo === 'DESPESA' ? 'bg-danger text-white shadow-sm' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            Despesa
          </button>
          <button
            type="button"
            onClick={() => { setTipo('RECEITA'); setCategoria('OUTROS'); setErrors({}); }}
            className={`h-9 rounded-[5px] text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
              tipo === 'RECEITA' ? 'bg-success text-white shadow-sm' : 'text-ink-500 hover:text-ink-700'
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
              <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Valor</Label>
              <div className="mt-1.5 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 text-base font-semibold pointer-events-none">R$</span>
                <Input
                  ref={valorRef}
                  inputMode="numeric"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => { setValor(maskBRLInput(e.target.value)); if (errors.valor) setErrors((p) => ({ ...p, valor: undefined })); }}
                  className={`h-14 rounded-md text-2xl font-bold pl-12 tabular-nums focus:ring-brand ${
                    errors.valor ? 'border-danger focus:border-danger' : 'border-ink-200 focus:border-brand'
                  } ${tipo === 'RECEITA' ? 'text-success' : 'text-danger'}`}
                />
              </div>
              {errors.valor && <FieldError msg={errors.valor} />}
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
                {tipo === 'RECEITA' && categoria === 'VENDA_GADO' && (
                  <p className="flex items-start gap-1.5 text-xs text-info mt-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Para dar baixa nas cabeças e registrar peso/@, use{' '}
                      <button type="button" onClick={() => navigate('/compra-venda')} className="font-semibold underline hover:text-info/80">
                        Compra / Venda
                      </button>
                      . Aqui a venda entra só como valor.
                    </span>
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Data</Label>
                <Input
                  type="date"
                  max={HOJE}
                  value={data}
                  onChange={(e) => { setData(e.target.value); if (errors.data) setErrors((p) => ({ ...p, data: undefined })); }}
                  className={`h-10 mt-1.5 rounded-md ${errors.data ? 'border-danger' : 'border-ink-200'}`}
                />
                {errors.data && <FieldError msg={errors.data} />}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">
                Descrição
                {categoria === 'OUTROS' && <span className="text-danger ml-1">*</span>}
              </Label>
              <Textarea
                placeholder="Ex: Conserto de cerca no pasto 3, diesel para trator…"
                value={descricao}
                onChange={(e) => { setDescricao(e.target.value); if (errors.descricao) setErrors((p) => ({ ...p, descricao: undefined })); }}
                className={`mt-1.5 rounded-md min-h-[80px] resize-none text-sm ${errors.descricao ? 'border-danger' : 'border-ink-200'}`}
              />
              {errors.descricao && <FieldError msg={errors.descricao} />}
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
                onCheckedChange={(v) => { setVincularLote(v); if (!v) setErrors((p) => ({ ...p, lote: undefined })); }}
                className="data-[state=checked]:bg-brand"
              />
            </div>

            {vincularLote && (
              <div className="mt-4">
                {lotes.length === 0 ? (
                  <p className="text-xs text-ink-500 bg-ink-100/60 rounded-md p-3">
                    Nenhum lote ativo para vincular. Crie um lote em Compra / Venda.
                  </p>
                ) : (
                  <>
                    <Combobox
                      options={loteOptions}
                      value={loteId}
                      onValueChange={(v) => { setLoteId(v); if (errors.lote) setErrors((p) => ({ ...p, lote: undefined })); }}
                      placeholder="Selecione o lote"
                      searchPlaceholder="Buscar lote…"
                      emptyText="Nenhum lote encontrado"
                      className={`h-10 rounded-md font-normal text-ink-900 ${errors.lote ? 'border-danger' : 'border-ink-200'}`}
                    />
                    {errors.lote && <FieldError msg={errors.lote} />}
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Submit */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/')}
            className="h-10 rounded-md text-sm"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => salvar(true)}
            className="h-10 rounded-md text-sm border-brand/40 text-brand hover:bg-brand/5"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Salvar e adicionar outro
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

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="flex items-center gap-1 text-xs text-danger mt-1.5">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {msg}
    </p>
  );
}
