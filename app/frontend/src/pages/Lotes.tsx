import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES, formatDate } from '@/lib/supabase';
import { Lote, SexoLote, calcularCategoria } from '@/lib/types';
import * as loteRepo from '@/lib/repositories/loteRepo';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Beef, Scale, History, Pencil, Trash2, Plus, ArrowRight } from 'lucide-react';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === 'object') {
    const maybeError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const message = [
      maybeError.message,
      maybeError.details,
      maybeError.hint,
      maybeError.code ? `código: ${maybeError.code}` : undefined,
    ]
      .filter(Boolean)
      .join(' | ');

    return message || JSON.stringify(error);
  }

  return 'Erro desconhecido';
}

export default function Lotes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lotesAtivos, setLotesAtivos] = useState<Lote[]>([]);
  const [lotesEncerrados, setLotesEncerrados] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loteEmEdicao, setLoteEmEdicao] = useState<Lote | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [loteParaExcluir, setLoteParaExcluir] = useState<Lote | null>(null);
  const [deletingLote, setDeletingLote] = useState(false);
  const [editNomeLote, setEditNomeLote] = useState('');
  const [editQtdCabecas, setEditQtdCabecas] = useState('');
  const [editStatus, setEditStatus] = useState<'ativo' | 'encerrado'>('ativo');
  const [editSexo, setEditSexo] = useState<SexoLote>('Macho');
  const { toast } = useToast();

  const fetchLotes = async () => {
    if (!user) return;
    
    setLoading(true);
    const [ativos, encerrados] = await Promise.all([
      loteRepo.listLotesByStatus(user.id, 'ativo'),
      loteRepo.listLotesByStatus(user.id, 'encerrado'),
    ]);

    setLotesAtivos(ativos);
    setLotesEncerrados(encerrados);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchLotes();
    }
  }, [user]);

  const openEditLote = (lote: Lote) => {
    setLoteEmEdicao(lote);
    setEditNomeLote(lote.nome_lote);
    setEditQtdCabecas(String(lote.qtd_cabecas));
    setEditStatus(lote.status);
    setEditSexo(lote.sexo || 'Macho');
    setIsEditDialogOpen(true);
  };

  const openDeleteLote = (lote: Lote) => {
    setLoteParaExcluir(lote);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteLote = async () => {
    if (!loteParaExcluir || !user) return;

    setDeletingLote(true);

    try {
      const loteId = loteParaExcluir.id;

      // Verificar se o lote pertence ao usuário
      if (loteParaExcluir.user_id !== user.id) {
        throw new Error('Você não tem permissão para excluir este lote');
      }

      // Exclusão em cascata (animais/vínculos/pesagens/financeiro + legado) no servidor
      await loteRepo.excluirLote(loteId);

      toast({ title: 'Lote excluído com sucesso' });
      await fetchLotes();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('Erro ao excluir lote', error);
      toast({ title: 'Erro ao excluir lote', description: errorMessage, variant: 'destructive' });
    } finally {
      setDeletingLote(false);
      setIsDeleteDialogOpen(false);
      setLoteParaExcluir(null);
    }
  };

  const handleUpdateLote = async () => {
    if (!loteEmEdicao || !user) return;

    // Verificar se o lote pertence ao usuário
    if (loteEmEdicao.user_id !== user.id) {
      toast({ title: 'Erro ao atualizar lote', description: 'Você não tem permissão para editar este lote', variant: 'destructive' });
      return;
    }

    const payload = {
      nome_lote: editNomeLote.trim(),
      qtd_cabecas: Number(editQtdCabecas),
      status: editStatus,
      sexo: editSexo,
      categoria: calcularCategoria(editSexo, loteEmEdicao.peso_entrada_kg),
    };

    const { error } = await supabase
      .from(TABLES.lotes)
      .update(payload)
      .eq('user_id', user.id)
      .eq('id', loteEmEdicao.id);

    if (error) {
      toast({ title: 'Erro ao atualizar lote', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Lote atualizado com sucesso' });
    setIsEditDialogOpen(false);
    setLoteEmEdicao(null);
    await fetchLotes();
  };

  const LoteRow = ({ lote }: { lote: Lote }) => (
    <li className="px-5 py-3.5 hover:bg-ink-100/40 group">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/lote/${lote.id}`)}
          className="flex-1 text-left flex items-center gap-3 min-w-0"
        >
          <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${
            lote.status === 'ativo' ? 'bg-brand/10' : 'bg-ink-100'
          }`}>
            <Beef className={`w-4 h-4 ${lote.status === 'ativo' ? 'text-brand' : 'text-ink-400'}`} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-ink-900 text-sm truncate">{lote.nome_lote}</p>
              {lote.sexo && (
                <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0 border-ink-200 text-ink-500 font-medium">
                  {lote.sexo}
                </Badge>
              )}
              {lote.categoria && (
                <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0 border-ink-200 text-ink-500 font-medium">
                  {lote.categoria}
                </Badge>
              )}
            </div>
            <p className="text-xs text-ink-500 mt-0.5">
              <span className="tabular-nums">{lote.qtd_cabecas}</span> cab. ·{' '}
              <span className="tabular-nums">{lote.qtd_cabecas_vendidas}</span> vendidas · Entrada {formatDate(lote.data_entrada)}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => openEditLote(lote)}
            className="p-1.5 rounded hover:bg-ink-200"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5 text-ink-500" />
          </button>
          <button
            type="button"
            onClick={() => openDeleteLote(lote)}
            className="p-1.5 rounded hover:bg-danger-soft"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5 text-danger" />
          </button>
        </div>
      </div>
    </li>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-12 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Lotes</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Gerencie os lotes ativos e consulte o histórico encerrado.
          </p>
        </div>
        <Button
          onClick={() => navigate('/compra-venda')}
          className="h-9 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium self-start"
        >
          <Plus className="w-4 h-4 mr-1.5" strokeWidth={2.4} />
          Nova compra de gado
        </Button>
      </div>

      <Tabs defaultValue="ativos">
        <TabsList className="bg-white border border-ink-200 rounded-md h-9 p-0.5">
          <TabsTrigger
            value="ativos"
            className="rounded-[5px] data-[state=active]:bg-brand data-[state=active]:text-white text-sm h-8 px-4 font-medium"
          >
            <Beef className="w-3.5 h-3.5 mr-1.5" />
            Ativos
            <span className="ml-1.5 text-[11px] opacity-80 tabular-nums">{lotesAtivos.length}</span>
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="rounded-[5px] data-[state=active]:bg-ink-900 data-[state=active]:text-white text-sm h-8 px-4 font-medium"
          >
            <History className="w-3.5 h-3.5 mr-1.5" />
            Histórico
            <span className="ml-1.5 text-[11px] opacity-80 tabular-nums">{lotesEncerrados.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos" className="mt-4">
          <section className="rounded-xl border border-ink-200 bg-white">
            <div className="px-5 py-4 border-b border-ink-200">
              <h3 className="text-sm font-semibold text-ink-900">Lotes ativos</h3>
              <p className="text-xs text-ink-500 mt-0.5">{lotesAtivos.length} em manejo</p>
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-ink-400">Carregando...</div>
            ) : lotesAtivos.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-brand/10 rounded-lg flex items-center justify-center">
                  <Beef className="w-6 h-6 text-brand" />
                </div>
                <p className="text-sm text-ink-700 font-medium">Nenhum lote ativo no momento.</p>
                <p className="text-xs text-ink-500 mt-1">Registre uma compra de gado para começar a acompanhar.</p>
                <Button
                  onClick={() => navigate('/compra-venda')}
                  size="sm"
                  className="mt-4 h-8 rounded-md bg-brand hover:bg-brand-700 text-white text-xs"
                >
                  <Scale className="w-3.5 h-3.5 mr-1.5" />
                  Registrar compra
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-ink-200">
                {lotesAtivos.map((lote) => <LoteRow key={lote.id} lote={lote} />)}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <section className="rounded-xl border border-ink-200 bg-white">
            <div className="px-5 py-4 border-b border-ink-200">
              <h3 className="text-sm font-semibold text-ink-900">Lotes encerrados</h3>
              <p className="text-xs text-ink-500 mt-0.5">{lotesEncerrados.length} no histórico</p>
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-ink-400">Carregando...</div>
            ) : lotesEncerrados.length === 0 ? (
              <div className="p-10 text-center">
                <History className="w-10 h-10 text-ink-200 mx-auto mb-2" />
                <p className="text-sm text-ink-500">Nenhum lote encerrado ainda.</p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-200">
                {lotesEncerrados.map((lote) => <LoteRow key={lote.id} lote={lote} />)}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar lote</DialogTitle>
            <DialogDescription>Atualize os dados do lote.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Nome do lote</label>
              <Input
                className="mt-1 h-10 rounded-md border-ink-200"
                value={editNomeLote}
                onChange={(e) => setEditNomeLote(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Qtd. cabeças</label>
              <Input
                type="number"
                min="1"
                className="mt-1 h-10 rounded-md border-ink-200 tabular-nums"
                value={editQtdCabecas}
                onChange={(e) => setEditQtdCabecas(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Status</label>
              <select
                className="w-full mt-1 h-10 border border-ink-200 rounded-md px-3 text-sm bg-white"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as 'ativo' | 'encerrado')}
              >
                <option value="ativo">Ativo</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">Sexo</label>
              <select
                className="w-full mt-1 h-10 border border-ink-200 rounded-md px-3 text-sm bg-white"
                value={editSexo}
                onChange={(e) => setEditSexo(e.target.value as SexoLote)}
              >
                <option value="Macho">Macho</option>
                <option value="Fêmea">Fêmea</option>
                <option value="Misto">Misto</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateLote} className="bg-brand hover:bg-brand-700">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lote? Todas as informações vinculadas a ele poderão ser afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLote}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLote}
              disabled={deletingLote}
              className="bg-danger hover:bg-danger/90"
            >
              {deletingLote ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
