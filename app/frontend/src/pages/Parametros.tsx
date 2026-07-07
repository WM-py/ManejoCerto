import { useState, useEffect } from 'react';
import { supabase, TABLES } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ParametroFazenda, FASES_MANEJO } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Settings2, Trash2, Plus, X } from 'lucide-react';
import WhatsAppVinculo from './WhatsAppVinculo';

export default function Parametros() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [parametros, setParametros] = useState<ParametroFazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Form state for new parameter
  const [showNew, setShowNew] = useState(false);
  const [newFase, setNewFase] = useState('Engorda');
  const [newCusto, setNewCusto] = useState('');
  const [newGmd, setNewGmd] = useState('');
  const [newRendimento, setNewRendimento] = useState('50');
  const [newMortalidade, setNewMortalidade] = useState('2');
  const [addingNew, setAddingNew] = useState(false);

  const fetchParametros = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLES.parametros_fazenda)
      .select('*')
      .eq('user_id', user.id)
      .order('fase_manejo');
    if (error) {
      toast({ title: 'Erro ao carregar parâmetros', description: error.message, variant: 'destructive' });
    } else {
      setParametros((data || []) as ParametroFazenda[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchParametros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAdd = async () => {
    if (!user) return;
    if (!newCusto || !newGmd) {
      toast({ title: 'Preencha Custo Diário e GMD', variant: 'destructive' });
      return;
    }

    // Check if fase already exists
    const exists = parametros.find((p) => p.fase_manejo === newFase);
    if (exists) {
      toast({ title: `Fase "${newFase}" já cadastrada. Edite o existente.`, variant: 'destructive' });
      return;
    }

    setAddingNew(true);
    const { error } = await supabase.from(TABLES.parametros_fazenda).insert({
      user_id: user.id,
      fase_manejo: newFase,
      custo_diario_cabeca: Number(newCusto),
      gmd_esperado_kg: Number(newGmd),
      rendimento_carcaca_perc: Number(newRendimento),
      mortalidade_esperada_perc: Number(newMortalidade),
    });

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Parâmetro adicionado!' });
      setShowNew(false);
      setNewCusto('');
      setNewGmd('');
      setNewRendimento('50');
      setNewMortalidade('2');
      await fetchParametros();
    }
    setAddingNew(false);
  };

  const handleUpdate = async (param: ParametroFazenda, field: string, value: string) => {
    setSaving(param.id);
    const { error } = await supabase
      .from(TABLES.parametros_fazenda)
      .update({ [field]: Number(value) })
      .eq('id', param.id);

    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } else {
      setParametros((prev) =>
        prev.map((p) => (p.id === param.id ? { ...p, [field]: Number(value) } : p))
      );
    }
    setSaving(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from(TABLES.parametros_fazenda).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Parâmetro excluído' });
      setParametros((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const availableFases = FASES_MANEJO.filter(
    (f) => !parametros.find((p) => p.fase_manejo === f)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-12 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Parâmetros</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Métricas zootécnicas por fase de manejo. Edição automática ao sair do campo.
          </p>
        </div>
        {availableFases.length > 0 && (
          <Button
            onClick={() => {
              setNewFase(availableFases[0]);
              setShowNew(true);
            }}
            className="h-9 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium self-start"
          >
            <Plus className="w-4 h-4 mr-1.5" strokeWidth={2.4} />
            Nova fase
          </Button>
        )}
      </div>

      {/* Conexão com o WhatsApp (registro por mensagem) */}
      <WhatsAppVinculo />

      {/* Add new form */}
      {showNew && (
        <section className="rounded-xl border border-brand/30 bg-brand/[0.03]">
          <div className="px-5 py-3 border-b border-brand/15 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand">Nova fase de manejo</h3>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="p-1 rounded hover:bg-brand/10 text-ink-500"
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Fase de manejo</Label>
              <select
                value={newFase}
                onChange={(e) => setNewFase(e.target.value)}
                className="w-full h-10 mt-1.5 rounded-md border border-ink-200 px-3 text-sm bg-white"
              >
                {availableFases.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Custo R$/cab/dia</Label>
                <Input
                  type="number" step="0.01" min="0" placeholder="0,00"
                  value={newCusto} onChange={(e) => setNewCusto(e.target.value)}
                  className="h-10 mt-1.5 rounded-md border-ink-200 tabular-nums"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">GMD (kg/dia)</Label>
                <Input
                  type="number" step="0.001" min="0" placeholder="0,000"
                  value={newGmd} onChange={(e) => setNewGmd(e.target.value)}
                  className="h-10 mt-1.5 rounded-md border-ink-200 tabular-nums"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Rend. carcaça (%)</Label>
                <Input
                  type="number" step="0.1" min="0" max="100" placeholder="50"
                  value={newRendimento} onChange={(e) => setNewRendimento(e.target.value)}
                  className="h-10 mt-1.5 rounded-md border-ink-200 tabular-nums"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Mortalidade (%)</Label>
                <Input
                  type="number" step="0.1" min="0" max="100" placeholder="2"
                  value={newMortalidade} onChange={(e) => setNewMortalidade(e.target.value)}
                  className="h-10 mt-1.5 rounded-md border-ink-200 tabular-nums"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleAdd}
                disabled={addingNew}
                size="sm"
                className="h-9 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium"
              >
                {addingNew ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                Salvar fase
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowNew(false)} className="h-9 rounded-md text-sm">
                Cancelar
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {parametros.length === 0 && !showNew ? (
        <section className="rounded-xl border border-ink-200 bg-white p-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-brand/10 rounded-lg flex items-center justify-center">
            <Settings2 className="w-6 h-6 text-brand" />
          </div>
          <p className="text-sm text-ink-700 font-medium">Nenhum parâmetro cadastrado.</p>
          <p className="text-xs text-ink-500 mt-1">Configure as fases de manejo para usar o simulador de viabilidade.</p>
          <Button
            onClick={() => { setNewFase(availableFases[0]); setShowNew(true); }}
            size="sm"
            className="mt-4 h-8 rounded-md bg-brand hover:bg-brand-700 text-white text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Adicionar primeira fase
          </Button>
        </section>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {parametros.map((param) => (
            <section key={param.id} className="rounded-xl border border-ink-200 bg-white">
              <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-brand/10 text-brand text-xs font-bold">
                    {param.fase_manejo.charAt(0)}
                  </span>
                  <h3 className="text-sm font-semibold text-ink-900">{param.fase_manejo}</h3>
                </div>
                <div className="flex items-center gap-1">
                  {saving === param.id && (
                    <span className="text-[11px] text-brand flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> salvando
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(param.id)}
                    className="p-1.5 rounded hover:bg-danger-soft"
                    title="Excluir fase"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-danger" />
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">Custo R$/cab/dia</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      defaultValue={param.custo_diario_cabeca}
                      onBlur={(e) => handleUpdate(param, 'custo_diario_cabeca', e.target.value)}
                      className="h-9 mt-1 rounded-md border-ink-200 tabular-nums text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">GMD (kg/dia)</Label>
                    <Input
                      type="number" step="0.001" min="0"
                      defaultValue={param.gmd_esperado_kg}
                      onBlur={(e) => handleUpdate(param, 'gmd_esperado_kg', e.target.value)}
                      className="h-9 mt-1 rounded-md border-ink-200 tabular-nums text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">Rend. carcaça (%)</Label>
                    <Input
                      type="number" step="0.1" min="0" max="100"
                      defaultValue={param.rendimento_carcaca_perc}
                      onBlur={(e) => handleUpdate(param, 'rendimento_carcaca_perc', e.target.value)}
                      className="h-9 mt-1 rounded-md border-ink-200 tabular-nums text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">Mortalidade (%)</Label>
                    <Input
                      type="number" step="0.1" min="0" max="100"
                      defaultValue={param.mortalidade_esperada_perc}
                      onBlur={(e) => handleUpdate(param, 'mortalidade_esperada_perc', e.target.value)}
                      className="h-9 mt-1 rounded-md border-ink-200 tabular-nums text-sm"
                    />
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}