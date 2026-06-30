import { useState, useEffect } from 'react';
import { supabase, TABLES } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Pasto, Lote } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, MapPin, Trash2, Plus, Beef, X } from 'lucide-react';

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
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-12 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Pastos</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Cadastre os pastos da fazenda e vincule aos lotes.
          </p>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className="h-9 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium self-start"
        >
          <Plus className="w-4 h-4 mr-1.5" strokeWidth={2.4} />
          Novo pasto
        </Button>
      </div>

      {/* Form (inline) */}
      {showNew && (
        <section className="rounded-xl border border-brand/30 bg-brand/[0.03]">
          <div className="px-5 py-3 border-b border-brand/15 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand">Novo pasto</h3>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="p-1 rounded hover:bg-brand/10 text-ink-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Nome do pasto</Label>
                <Input
                  placeholder="Ex: Pasto 1 - Frente"
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  className="h-10 mt-1 rounded-md border-ink-200"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Capacidade (cabeças)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={newCapacidade}
                  onChange={(e) => setNewCapacidade(e.target.value)}
                  className="h-10 mt-1 rounded-md border-ink-200 tabular-nums"
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
                Salvar pasto
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowNew(false)}
                size="sm"
                className="h-9 rounded-md text-sm"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* List */}
      {pastos.length === 0 && !showNew ? (
        <section className="rounded-xl border border-ink-200 bg-white p-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-brand/10 rounded-lg flex items-center justify-center">
            <MapPin className="w-6 h-6 text-brand" />
          </div>
          <p className="text-sm text-ink-700 font-medium">Nenhum pasto cadastrado.</p>
          <p className="text-xs text-ink-500 mt-1">Adicione pastos para vincular aos seus lotes.</p>
          <Button
            onClick={() => setShowNew(true)}
            size="sm"
            className="mt-4 h-8 rounded-md bg-brand hover:bg-brand-700 text-white text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Adicionar primeiro pasto
          </Button>
        </section>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {pastos.map((pasto) => {
            const cabecas = getCabecasNoPasto(pasto.id);
            const lotesVinculados = getLotesNoPasto(pasto.id);
            const ocupacao = pasto.capacidade_cabecas > 0 ? (cabecas / pasto.capacidade_cabecas) * 100 : 0;
            const ocupacaoTone =
              ocupacao > 90 ? { bar: 'bg-danger', text: 'text-danger' } :
              ocupacao > 70 ? { bar: 'bg-warning', text: 'text-warning' } :
                              { bar: 'bg-success', text: 'text-success' };
            return (
              <section key={pasto.id} className="rounded-xl border border-ink-200 bg-white overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-brand/10 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-brand" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900 truncate">{pasto.nome_pasto}</p>
                        <p className="text-xs text-ink-500 tabular-nums">
                          Capacidade {pasto.capacidade_cabecas} cab.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(pasto.id)}
                      className="p-1.5 rounded hover:bg-danger-soft"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-danger" />
                    </button>
                  </div>

                  {/* Ocupação */}
                  <div className="mb-3">
                    <div className="flex justify-between items-baseline text-xs mb-1.5">
                      <span className="text-ink-500 tabular-nums">
                        {cabecas} / {pasto.capacidade_cabecas} cab.
                      </span>
                      <span className={`font-semibold tabular-nums ${ocupacaoTone.text}`}>
                        {ocupacao.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${ocupacaoTone.bar}`}
                        style={{ width: `${Math.min(ocupacao, 100)}%` }}
                      />
                    </div>
                  </div>

                  {lotesVinculados.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
                        Lotes vinculados
                      </p>
                      {lotesVinculados.map((l) => (
                        <div key={l.id} className="flex items-center gap-2 text-xs bg-ink-100/60 rounded-md px-2.5 py-1.5">
                          <Beef className="w-3 h-3 text-brand flex-shrink-0" />
                          <span className="text-ink-900 font-medium truncate flex-1">{l.nome_lote}</span>
                          <span className="text-ink-500 tabular-nums whitespace-nowrap">
                            {l.qtd_cabecas - l.qtd_cabecas_vendidas} cab.
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-400 italic">Sem lotes vinculados.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}