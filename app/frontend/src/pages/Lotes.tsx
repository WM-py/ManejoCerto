import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES, formatDate } from '@/lib/supabase';
import { Lote, SexoLote, calcularCategoria } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Beef, Scale, History, Pencil, Trash2 } from 'lucide-react';

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
      maybeError.code ? `codigo: ${maybeError.code}` : undefined,
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
    const [ativosRes, encerradosRes] = await Promise.all([
      supabase.from(TABLES.lotes).select('*').eq('user_id', user.id).eq('status', 'ativo').order('data_entrada', { ascending: false }),
      supabase.from(TABLES.lotes).select('*').eq('user_id', user.id).eq('status', 'encerrado').order('data_entrada', { ascending: false }),
    ]);

    if (ativosRes.data) setLotesAtivos(ativosRes.data as Lote[]);
    if (encerradosRes.data) setLotesEncerrados(encerradosRes.data as Lote[]);
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

      // Primeiro, buscar transações relacionadas ao lote
      const { data: transacoes, error: transacoesError } = await supabase
        .from(TABLES.transacoes)
        .select('id')
        .eq('user_id', user.id)
        .eq('lote_id', loteId);

      if (transacoesError) throw transacoesError;

      const transacaoIds = (transacoes || []).map((transacao) => transacao.id);

      // Deletar compras_vendas vinculadas às transações encontradas
      if (transacaoIds.length > 0) {
        const { error: comprasVendasPorTransacaoError } = await supabase
          .from(TABLES.compras_vendas)
          .delete()
          .in('transacao_id', transacaoIds);

        if (comprasVendasPorTransacaoError) throw comprasVendasPorTransacaoError;
      }

      // Lista de tabelas dependentes (excluindo transacoes que já foram processadas)
      const tabelasDependentes = [
        TABLES.pesagens,
        TABLES.pesagens_lote,
        TABLES.baixas,
      ] as const;

      // Deletar registros das tabelas dependentes
      for (const tabela of tabelasDependentes) {
        const { error } = await supabase.from(tabela).delete().eq('user_id', user.id).eq('lote_id', loteId);
        if (error) throw error;
      }

      // Deletar transações (após ter deletado compras_vendas relacionadas)
      if (transacaoIds.length > 0) {
        const { error: transacoesDeleteError } = await supabase
          .from(TABLES.transacoes)
          .delete()
          .in('id', transacaoIds)
          .eq('user_id', user.id);

        if (transacoesDeleteError) throw transacoesDeleteError;
      }

      // Verificar se ainda há dependências restantes
      const todasTabelas = [
        TABLES.compras_vendas,
        TABLES.pesagens,
        TABLES.pesagens_lote,
        TABLES.baixas,
        TABLES.transacoes,
      ] as const;

      const pendencias = await Promise.all(
        todasTabelas.map(async (tabela) => {
          const query = supabase.from(tabela).select('*', { count: 'exact', head: true }).eq('lote_id', loteId);
          if (tabela !== TABLES.compras_vendas) {
            query.eq('user_id', user.id);
          }

          const { count, error } = await query;

          if (error) throw error;

          return { tabela, count: count || 0 };
        })
      );

      const dependenciasRestantes = pendencias.filter((item) => item.count > 0);

      if (dependenciasRestantes.length > 0) {
        const details = dependenciasRestantes.map((item) => `${item.tabela}: ${item.count}`).join(', ');
        throw new Error(`Ainda existem registros vinculados a este lote: ${details}`);
      }

      // Finalmente, deletar o lote
      const { error: loteError } = await supabase
        .from(TABLES.lotes)
        .delete()
        .eq('user_id', user.id)
        .eq('id', loteId);

      if (loteError) throw loteError;

      toast({ title: 'Lote excluido com sucesso' });
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

  const LoteCard = ({ lote }: { lote: Lote }) => (
    <div className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-[#556B2F]/5 rounded-xl transition-colors">
      <button
        onClick={() => navigate(`/lote/${lote.id}`)}
        className="flex-1 text-left flex items-center gap-3"
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          lote.status === 'ativo' ? 'bg-[#556B2F]/10' : 'bg-gray-200'
        }`}>
          <Beef className={`w-6 h-6 ${lote.status === 'ativo' ? 'text-[#556B2F]' : 'text-gray-400'}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[#36454F]">{lote.nome_lote}</p>
            <Badge
              className={`rounded-full text-[10px] px-2 py-0 ${
                lote.status === 'ativo'
                  ? 'bg-green-50 text-green-600 border-green-200'
                  : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}
            >
              {lote.status}
            </Badge>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {lote.qtd_cabecas} cabecas - {lote.qtd_cabecas_vendidas} vendidas - Entrada: {formatDate(lote.data_entrada)}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-1 ml-3">
        <button
          type="button"
          onClick={() => openEditLote(lote)}
          className="p-1 rounded-md hover:bg-gray-100"
        >
          <Pencil className="w-4 h-4 text-gray-500" />
        </button>
        <button
          type="button"
          onClick={() => openDeleteLote(lote)}
          className="p-1 rounded-md hover:bg-gray-100"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-8">
      <Button
        onClick={() => navigate('/compra-venda')}
        className="w-full h-14 rounded-2xl bg-[#556B2F] hover:bg-[#3D4F22] text-white font-semibold mb-6 shadow-lg"
      >
        <Scale className="w-5 h-5 mr-2" />
        Nova Compra de Gado
      </Button>

      <Tabs defaultValue="ativos">
        <TabsList className="w-full bg-white rounded-xl shadow-sm border-0 h-12 p-1">
          <TabsTrigger
            value="ativos"
            className="flex-1 rounded-lg data-[state=active]:bg-[#556B2F] data-[state=active]:text-white h-10 font-semibold"
          >
            <Beef className="w-4 h-4 mr-2" />
            Ativos ({lotesAtivos.length})
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="flex-1 rounded-lg data-[state=active]:bg-[#36454F] data-[state=active]:text-white h-10 font-semibold"
          >
            <History className="w-4 h-4 mr-2" />
            Historico ({lotesEncerrados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos" className="mt-4">
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-[#36454F]">Lotes Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-gray-400">Carregando...</p>
              ) : lotesAtivos.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-3 bg-[#556B2F]/10 rounded-2xl flex items-center justify-center">
                    <Beef className="w-10 h-10 text-[#556B2F]/30" />
                  </div>
                  <p className="text-gray-400 text-sm">Nenhum lote ativo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lotesAtivos.map((lote) => (
                    <LoteCard key={lote.id} lote={lote} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-[#36454F]">Lotes Encerrados</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-gray-400">Carregando...</p>
              ) : lotesEncerrados.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">Nenhum lote encerrado</p>
              ) : (
                <div className="space-y-3">
                  {lotesEncerrados.map((lote) => (
                    <LoteCard key={lote.id} lote={lote} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lote</DialogTitle>
            <DialogDescription>Atualize os dados do lote.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Nome do Lote</label>
              <input
                className="w-full h-10 border rounded-lg p-2"
                value={editNomeLote}
                onChange={(e) => setEditNomeLote(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Qtd. Cabecas</label>
              <input
                type="number"
                min="1"
                className="w-full h-10 border rounded-lg p-2"
                value={editQtdCabecas}
                onChange={(e) => setEditQtdCabecas(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select
                className="w-full h-10 border rounded-lg p-2"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as 'ativo' | 'encerrado')}
              >
                <option value="ativo">ativo</option>
                <option value="encerrado">encerrado</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Sexo</label>
              <select
                className="w-full h-10 border rounded-lg p-2"
                value={editSexo}
                onChange={(e) => setEditSexo(e.target.value as SexoLote)}
              >
                <option value="Macho">Macho</option>
                <option value="Femea">Femea</option>
                <option value="Misto">Misto</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateLote}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lote? Todas as informacoes vinculadas a ele poderao ser afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLote}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLote} disabled={deletingLote}>
              {deletingLote ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
