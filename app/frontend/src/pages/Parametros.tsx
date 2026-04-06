import { useState, useEffect } from 'react';
import { supabase, TABLES } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ParametroFazenda, FASES_MANEJO } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Settings2, Trash2, Plus } from 'lucide-react';

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
        <Loader2 className="w-8 h-8 animate-spin text-[#556B2F]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#556B2F] rounded-xl flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#36454F]">Parâmetros da Fazenda</h2>
            <p className="text-xs text-gray-500">Métricas zootécnicas por fase de manejo</p>
          </div>
        </div>
        {availableFases.length > 0 && (
          <Button
            onClick={() => {
              setNewFase(availableFases[0]);
              setShowNew(true);
            }}
            className="bg-[#556B2F] hover:bg-[#3D4F22] text-white rounded-xl"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nova Fase
          </Button>
        )}
      </div>

      {/* Add New Form */}
      {showNew && (
        <Card className="rounded-2xl shadow-sm border-2 border-[#556B2F]/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#556B2F]">Nova Fase de Manejo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Fase de Manejo</Label>
              <select
                value={newFase}
                onChange={(e) => setNewFase(e.target.value)}
                className="w-full h-12 rounded-xl border border-gray-200 px-3 text-sm bg-white"
              >
                {availableFases.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Custo R$/cab/dia</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={newCusto}
                  onChange={(e) => setNewCusto(e.target.value)}
                  className="h-12 rounded-xl border-gray-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">GMD (kg/dia)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0,000"
                  value={newGmd}
                  onChange={(e) => setNewGmd(e.target.value)}
                  className="h-12 rounded-xl border-gray-200"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Rendimento Carcaça (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="50"
                  value={newRendimento}
                  onChange={(e) => setNewRendimento(e.target.value)}
                  className="h-12 rounded-xl border-gray-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Mortalidade (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="2"
                  value={newMortalidade}
                  onChange={(e) => setNewMortalidade(e.target.value)}
                  className="h-12 rounded-xl border-gray-200"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleAdd}
                disabled={addingNew}
                className="flex-1 h-12 rounded-xl bg-[#556B2F] hover:bg-[#3D4F22] text-white font-semibold"
              >
                {addingNew ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                Salvar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNew(false)}
                className="h-12 rounded-xl"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Parameters */}
      {parametros.length === 0 && !showNew ? (
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="py-12 text-center">
            <Settings2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum parâmetro cadastrado</p>
            <p className="text-sm text-gray-400 mt-1">
              Adicione os parâmetros zootécnicos para cada fase de manejo
            </p>
          </CardContent>
        </Card>
      ) : (
        parametros.map((param) => (
          <Card key={param.id} className="rounded-2xl shadow-sm border-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-[#36454F] flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#556B2F]/10 text-[#556B2F] text-xs font-bold">
                    {param.fase_manejo.charAt(0)}
                  </span>
                  {param.fase_manejo}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(param.id)}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Custo R$/cab/dia</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={param.custo_diario_cabeca}
                    onBlur={(e) => handleUpdate(param, 'custo_diario_cabeca', e.target.value)}
                    className="h-11 rounded-xl border-gray-200"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">GMD (kg/dia)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    defaultValue={param.gmd_esperado_kg}
                    onBlur={(e) => handleUpdate(param, 'gmd_esperado_kg', e.target.value)}
                    className="h-11 rounded-xl border-gray-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Rendimento Carcaça (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    defaultValue={param.rendimento_carcaca_perc}
                    onBlur={(e) => handleUpdate(param, 'rendimento_carcaca_perc', e.target.value)}
                    className="h-11 rounded-xl border-gray-200"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Mortalidade (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    defaultValue={param.mortalidade_esperada_perc}
                    onBlur={(e) => handleUpdate(param, 'mortalidade_esperada_perc', e.target.value)}
                    className="h-11 rounded-xl border-gray-200"
                  />
                </div>
              </div>
              {saving === param.id && (
                <p className="text-xs text-[#556B2F] flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}