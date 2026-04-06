import { useState, useEffect } from 'react';
import { supabase, TABLES } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Pasto, Lote } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, MapPin, Trash2, Plus, Beef } from 'lucide-react';

export default function Pastos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pastos, setPastos] = useState<Pasto[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newCapacidade, setNewCapacidade] = useState('');
  const [addingNew, setAddingNew] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [pastosRes, lotesRes] = await Promise.all([
      supabase.from(TABLES.pastos).select('*').eq('user_id', user.id).order('nome_pasto'),
      supabase.from(TABLES.lotes).select('*').eq('status', 'ativo'),
    ]);
    if (pastosRes.data) setPastos(pastosRes.data as Pasto[]);
    if (lotesRes.data) setLotes(lotesRes.data as Lote[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAdd = async () => {
    if (!user || !newNome.trim() || !newCapacidade) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setAddingNew(true);
    const { error } = await supabase.from(TABLES.pastos).insert({
      user_id: user.id,
      nome_pasto: newNome.trim(),
      capacidade_cabecas: Number(newCapacidade),
    });
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pasto adicionado!' });
      setShowNew(false);
      setNewNome('');
      setNewCapacidade('');
      await fetchData();
    }
    setAddingNew(false);
  };

  const handleDelete = async (id: string) => {
    const linked = lotes.filter((l) => l.pasto_id === id);
    if (linked.length > 0) {
      toast({ title: 'Não é possível excluir', description: 'Existem lotes vinculados a este pasto.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from(TABLES.pastos).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pasto excluído' });
      setPastos((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const getLotesNoPasto = (pastoId: string) => lotes.filter((l) => l.pasto_id === pastoId);
  const getCabecasNoPasto = (pastoId: string) =>
    getLotesNoPasto(pastoId).reduce((sum, l) => sum + (l.qtd_cabecas - l.qtd_cabecas_vendidas), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#556B2F]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-8 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#556B2F] rounded-xl flex items-center justify-center">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#36454F]">Gestão de Pastos</h2>
            <p className="text-xs text-gray-500">Cadastre e gerencie os pastos da fazenda</p>
          </div>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className="bg-[#556B2F] hover:bg-[#3D4F22] text-white rounded-xl"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Novo Pasto
        </Button>
      </div>

      {showNew && (
        <Card className="rounded-2xl shadow-sm border-2 border-[#556B2F]/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#556B2F]">Novo Pasto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Nome do Pasto</Label>
              <Input
                placeholder="Ex: Pasto 1 - Frente"
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                className="h-12 rounded-xl border-gray-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Capacidade (cabeças)</Label>
              <Input
                type="number"
                min="1"
                placeholder="0"
                value={newCapacidade}
                onChange={(e) => setNewCapacidade(e.target.value)}
                className="h-12 rounded-xl border-gray-200"
              />
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
              <Button variant="outline" onClick={() => setShowNew(false)} className="h-12 rounded-xl">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pastos.length === 0 && !showNew ? (
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum pasto cadastrado</p>
            <p className="text-sm text-gray-400 mt-1">Adicione pastos para vincular aos seus lotes</p>
          </CardContent>
        </Card>
      ) : (
        pastos.map((pasto) => {
          const cabecas = getCabecasNoPasto(pasto.id);
          const lotesVinculados = getLotesNoPasto(pasto.id);
          const ocupacao = pasto.capacidade_cabecas > 0 ? (cabecas / pasto.capacidade_cabecas) * 100 : 0;
          return (
            <Card key={pasto.id} className="rounded-2xl shadow-sm border-0">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#556B2F]/10 rounded-xl flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-[#556B2F]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#36454F]">{pasto.nome_pasto}</p>
                      <p className="text-xs text-gray-400">Capacidade: {pasto.capacidade_cabecas} cabeças</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(pasto.id)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Occupation bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">{cabecas} / {pasto.capacidade_cabecas} cabeças</span>
                    <span className={`font-semibold ${ocupacao > 90 ? 'text-red-500' : ocupacao > 70 ? 'text-amber-500' : 'text-green-600'}`}>
                      {ocupacao.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${ocupacao > 90 ? 'bg-red-500' : ocupacao > 70 ? 'bg-amber-500' : 'bg-[#556B2F]'}`}
                      style={{ width: `${Math.min(ocupacao, 100)}%` }}
                    />
                  </div>
                </div>

                {lotesVinculados.length > 0 && (
                  <div className="space-y-1">
                    {lotesVinculados.map((l) => (
                      <div key={l.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                        <Beef className="w-3 h-3 text-[#556B2F]" />
                        <span className="text-[#36454F] font-medium">{l.nome_lote}</span>
                        <span className="text-gray-400">({l.qtd_cabecas - l.qtd_cabecas_vendidas} cab.)</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}