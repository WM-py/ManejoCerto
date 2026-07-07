import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as loteRepo from '@/lib/repositories/loteRepo';
import type { AnimalVinculo } from '@/lib/types';
import { Tag, Check, Loader2, Wifi } from 'lucide-react';

interface EtiquetarLoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loteId: string;
  loteNome: string;
  userId: string;
  /** Chamado ao fechar quando houve ao menos uma etiquetagem (para o pai refetchar). */
  onDone: () => void;
}

interface Linha {
  animalId: string;
  brincoVisual: string | null;
  rascunho: string;
  salvando: boolean;
}

function semBrinco(v: AnimalVinculo): boolean {
  const a = v.animais;
  return !a?.brinco_visual && !a?.brinco_rfid;
}

export function EtiquetarLoteSheet({
  open,
  onOpenChange,
  loteId,
  loteNome,
  userId,
  onDone,
}: EtiquetarLoteSheetProps) {
  const { toast } = useToast();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tocou, setTocou] = useState(false);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const vinculos = await loteRepo.listAnimaisDoLote(loteId);
      setTotal(vinculos.length);
      setLinhas(
        vinculos
          .filter(semBrinco)
          .map((v) => ({
            animalId: v.animal_id,
            brincoVisual: null,
            rascunho: '',
            salvando: false,
          }))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao carregar animais', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [loteId, toast]);

  useEffect(() => {
    if (open) {
      setTocou(false);
      void carregar();
    }
  }, [open, carregar]);

  const pendentes = useMemo(() => linhas.filter((l) => !l.brincoVisual), [linhas]);
  const etiquetadosAgora = linhas.filter((l) => l.brincoVisual).length;
  const jaIdentificados = total - linhas.length;
  const identificados = jaIdentificados + etiquetadosAgora;
  const progresso = total > 0 ? Math.round((identificados / total) * 100) : 0;

  const focarProximo = useCallback((apartirDe: string) => {
    const ids = Object.keys(inputsRef.current);
    const idx = ids.indexOf(apartirDe);
    for (let i = idx + 1; i < ids.length; i++) {
      const el = inputsRef.current[ids[i]];
      if (el && !el.disabled && el.value === '') {
        el.focus();
        return;
      }
    }
  }, []);

  const salvarLinha = useCallback(
    async (animalId: string, valor: string) => {
      const brinco = valor.trim();
      if (!brinco) return;
      // duplicata dentro da própria lista (antes de ir ao servidor)
      if (linhas.some((l) => l.brincoVisual === brinco)) {
        toast({ title: 'Brinco já usado nesta sessão', variant: 'destructive' });
        return;
      }
      setLinhas((cur) =>
        cur.map((l) => (l.animalId === animalId ? { ...l, salvando: true } : l))
      );
      try {
        await loteRepo.etiquetarAnimal({
          userId,
          animalId,
          brincoVisual: brinco,
          brincoRfid: null,
        });
        setTocou(true);
        setLinhas((cur) =>
          cur.map((l) =>
            l.animalId === animalId ? { ...l, brincoVisual: brinco, salvando: false } : l
          )
        );
        focarProximo(animalId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        toast({ title: 'Erro ao etiquetar', description: msg, variant: 'destructive' });
        setLinhas((cur) =>
          cur.map((l) => (l.animalId === animalId ? { ...l, salvando: false } : l))
        );
      }
    },
    [linhas, userId, toast, focarProximo]
  );

  const fechar = (v: boolean) => {
    if (!v && tocou) onDone();
    onOpenChange(v);
  };

  return (
    <Sheet open={open} onOpenChange={fechar}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-ink-200">
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-brand" strokeWidth={2.4} />
            <h2 className="text-base font-semibold text-ink-900">Etiquetar animais</h2>
          </div>
          <p className="text-xs text-ink-500">
            {loteNome} · digite o brinco e pressione Enter para avançar
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
              <div className="h-full bg-brand transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <span className="text-sm font-semibold text-brand tabular-nums">
              {identificados} / {total}
            </span>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-brand" />
            </div>
          ) : linhas.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Check className="w-8 h-8 text-success mx-auto mb-2" />
              <p className="text-sm text-ink-700 font-medium">Todos os animais já têm brinco</p>
              <p className="text-xs text-ink-500 mt-1">Nada a etiquetar neste lote.</p>
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {linhas.map((l, idx) => {
                const salvo = !!l.brincoVisual;
                return (
                  <li
                    key={l.animalId}
                    className={`flex items-center gap-3 px-5 py-2.5 ${salvo ? 'bg-success-soft/40' : ''}`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                        salvo ? 'bg-success text-white' : 'border border-ink-200 text-ink-500'
                      }`}
                    >
                      {salvo ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    {salvo ? (
                      <span className="flex-1 text-sm font-medium text-ink-900">
                        Brinco {l.brincoVisual}
                      </span>
                    ) : (
                      <input
                        ref={(el) => {
                          inputsRef.current[l.animalId] = el;
                        }}
                        defaultValue=""
                        inputMode="numeric"
                        placeholder="Brinco visual (ex: 4478)"
                        disabled={l.salvando}
                        className="flex-1 h-9 rounded-md border border-ink-200 px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void salvarLinha(l.animalId, (e.target as HTMLInputElement).value);
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value.trim()) void salvarLinha(l.animalId, e.target.value);
                        }}
                      />
                    )}
                    {salvo ? (
                      <span className="text-[11px] text-success font-medium">Salvo</span>
                    ) : l.salvando ? (
                      <Loader2 className="w-4 h-4 animate-spin text-brand flex-shrink-0" />
                    ) : (
                      <span
                        className="w-8 h-8 rounded-md border border-ink-200 flex items-center justify-center flex-shrink-0 text-ink-400"
                        title="Leitores RFID digitam direto no campo"
                      >
                        <Wifi className="w-4 h-4" />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-ink-200 bg-ink-50 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-500">
            {pendentes.length > 0
              ? `${pendentes.length} sem brinco — continuam válidos no lote`
              : 'Todos etiquetados nesta sessão'}
          </span>
          <Button
            size="sm"
            onClick={() => fechar(false)}
            className="h-9 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium"
          >
            Concluir
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
