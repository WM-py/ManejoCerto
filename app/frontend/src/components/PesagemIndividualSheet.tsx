import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { daysBetween, kgToArrobas } from '@/lib/supabase';
import * as loteRepo from '@/lib/repositories/loteRepo';
import type { AnimalVinculo } from '@/lib/types';
import { Scale, Check, Loader2, Wifi, ArrowRight, TrendingDown, Tag } from 'lucide-react';

interface PesagemIndividualSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loteId: string;
  userId: string;
  onDone: () => void;
}

interface Alvo {
  animalId: string;
  brinco: string;
}

interface Pesado {
  animalId: string;
  brinco: string;
  peso: number;
  gmd: number | null;
}

const hoje = () => new Date().toISOString().split('T')[0];

function comBrinco(v: AnimalVinculo): Alvo | null {
  const a = v.animais;
  const brinco = a?.brinco_visual || a?.brinco_rfid;
  return brinco ? { animalId: v.animal_id, brinco } : null;
}

export function PesagemIndividualSheet({
  open,
  onOpenChange,
  loteId,
  userId,
  onDone,
}: PesagemIndividualSheetProps) {
  const { toast } = useToast();
  const [data, setData] = useState(hoje());
  const [alvos, setAlvos] = useState<Alvo[]>([]);
  const [semBrinco, setSemBrinco] = useState(0);
  const [idx, setIdx] = useState(0);
  const [peso, setPeso] = useState('');
  const [pesoAnterior, setPesoAnterior] = useState<{ peso: number; data: string } | null>(null);
  const [pesados, setPesados] = useState<Pesado[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [tocou, setTocou] = useState(false);
  const pesoRef = useRef<HTMLInputElement | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const vinculos = await loteRepo.listAnimaisDoLote(loteId);
      const identificados = vinculos.map(comBrinco).filter((x): x is Alvo => x !== null);
      setAlvos(identificados);
      setSemBrinco(vinculos.length - identificados.length);
      setIdx(0);
      setPesados([]);
      setPeso('');
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
      setData(hoje());
      void carregar();
    }
  }, [open, carregar]);

  const atual = alvos[idx] ?? null;
  const concluiu = !loading && alvos.length > 0 && idx >= alvos.length;

  // Busca o peso anterior do animal atual (contexto do GMD).
  useEffect(() => {
    let vivo = true;
    setPesoAnterior(null);
    if (!open || !atual) return;
    void loteRepo
      .getUltimoPesoAnimal(atual.animalId)
      .then((r) => {
        if (vivo) setPesoAnterior(r);
      })
      .catch(() => {
        /* contexto best-effort */
      });
    // foco no campo de peso ao trocar de animal
    const t = setTimeout(() => pesoRef.current?.focus(), 50);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [open, atual]);

  const gmdPrevisto = useMemo(() => {
    const p = Number(peso);
    if (!pesoAnterior || !(p > 0)) return null;
    const dias = daysBetween(pesoAnterior.data, data);
    if (dias <= 0) return null;
    return (p - pesoAnterior.peso) / dias;
  }, [peso, pesoAnterior, data]);

  const salvar = useCallback(async () => {
    if (!atual) return;
    const p = Number(peso);
    if (!(p > 0)) {
      toast({ title: 'Informe o peso', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      await loteRepo.registrarPesagemIndividual({
        userId,
        loteId,
        animalId: atual.animalId,
        data,
        pesoKg: p,
      });
      setTocou(true);
      setPesados((cur) => [
        ...cur,
        { animalId: atual.animalId, brinco: atual.brinco, peso: p, gmd: gmdPrevisto },
      ]);
      setPeso('');
      setIdx((i) => i + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao salvar pesagem', description: msg, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  }, [atual, peso, userId, loteId, data, gmdPrevisto, toast]);

  const fechar = (v: boolean) => {
    if (!v && tocou) onDone();
    onOpenChange(v);
  };

  const pesoMedio =
    pesados.length > 0 ? pesados.reduce((s, x) => s + x.peso, 0) / pesados.length : 0;
  const gmds = pesados.filter((x) => x.gmd != null) as (Pesado & { gmd: number })[];
  const gmdMedio = gmds.length > 0 ? gmds.reduce((s, x) => s + x.gmd, 0) / gmds.length : null;
  const pior =
    gmds.length > 0 ? gmds.reduce((min, x) => (x.gmd < min.gmd ? x : min), gmds[0]) : null;

  return (
    <Sheet open={open} onOpenChange={fechar}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-ink-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-brand" strokeWidth={2.4} />
              <SheetTitle className="text-base font-semibold text-ink-900">Pesagem individual</SheetTitle>
            </div>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-8 w-auto rounded-md border-ink-200 text-xs"
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${alvos.length > 0 ? (pesados.length / alvos.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-brand tabular-nums">
              {pesados.length} / {alvos.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
          </div>
        ) : alvos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
            <Tag className="w-8 h-8 text-ink-400 mb-2" />
            <p className="text-sm text-ink-700 font-medium">Nenhum animal com brinco</p>
            <p className="text-xs text-ink-500 mt-1 max-w-xs">
              Etiquete os animais primeiro para poder pesá-los individualmente.
            </p>
          </div>
        ) : concluiu ? (
          /* Resumo final */
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-success-soft flex items-center justify-center">
                <Check className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {pesados.length} animais pesados
                </p>
                <p className="text-xs text-ink-500">GMD calculado por brinco e consolidado no lote</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <Metric label="Peso médio" value={`${pesoMedio.toFixed(0)} kg`} sub={`${kgToArrobas(pesoMedio).toFixed(2)} @`} />
              <Metric
                label="GMD médio"
                value={gmdMedio != null ? gmdMedio.toFixed(3) : '—'}
                sub={gmdMedio != null ? 'kg/dia' : undefined}
                tone="text-success"
              />
              <Metric
                label="Menor GMD"
                value={pior ? pior.brinco : '—'}
                sub={pior ? `${pior.gmd.toFixed(3)} kg/dia` : undefined}
                tone="text-warning"
              />
            </div>
            <ul className="rounded-xl border border-ink-200 divide-y divide-ink-100 overflow-hidden">
              {pesados.map((x) => (
                <li key={x.animalId} className="flex items-center gap-3 px-4 py-2 text-xs">
                  <Check className="w-3.5 h-3.5 text-success flex-shrink-0" />
                  <span className="font-medium text-ink-900 w-24">Brinco {x.brinco}</span>
                  <span className="text-ink-700 flex-1 tabular-nums">{x.peso.toFixed(0)} kg</span>
                  {x.gmd != null && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium tabular-nums ${
                        x.gmd >= (gmdMedio ?? 0) ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
                      }`}
                    >
                      GMD {x.gmd.toFixed(3)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <Button
              onClick={() => fechar(false)}
              className="w-full mt-5 h-10 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium"
            >
              Concluir sessão
            </Button>
          </div>
        ) : (
          atual && (
            <>
              {/* Animal atual */}
              <div className="px-5 py-6 bg-ink-50 border-b border-ink-200">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <span
                    className="w-9 h-9 rounded-md border border-ink-200 bg-white flex items-center justify-center text-brand"
                    title="Leitores RFID digitam direto no campo"
                  >
                    <Wifi className="w-4 h-4" />
                  </span>
                  <div className="text-center">
                    <p className="text-[10px] text-ink-500 uppercase tracking-wider">Brinco</p>
                    <p className="text-2xl font-bold text-ink-900 tabular-nums leading-tight">
                      {atual.brinco}
                    </p>
                  </div>
                </div>
                <div className="flex items-end justify-center gap-2">
                  <Input
                    ref={pesoRef}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    value={peso}
                    onChange={(e) => setPeso(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !salvando) {
                        e.preventDefault();
                        void salvar();
                      }
                    }}
                    className="w-40 h-14 text-center text-3xl font-bold tabular-nums rounded-md border-ink-200"
                  />
                  <span className="text-base text-ink-500 pb-3">kg</span>
                </div>
                <p className="text-center text-xs text-ink-500 mt-2">
                  {pesoAnterior
                    ? `Peso anterior: ${pesoAnterior.peso.toFixed(0)} kg · ${daysBetween(pesoAnterior.data, data)} dias atrás`
                    : 'Primeira pesagem individual deste animal'}
                </p>
                {gmdPrevisto != null && (
                  <p
                    className={`text-center text-xs font-medium mt-1 tabular-nums ${
                      gmdPrevisto >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    GMD previsto: {gmdPrevisto.toFixed(3)} kg/dia
                  </p>
                )}
                <div className="flex justify-center mt-4">
                  <Button
                    onClick={() => void salvar()}
                    disabled={salvando}
                    className="h-11 px-7 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-medium"
                  >
                    {salvando ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="w-4 h-4 mr-2" />
                    )}
                    Salvar e próximo
                  </Button>
                </div>
              </div>

              {/* Já pesados nesta sessão */}
              <div className="flex-1 overflow-y-auto">
                {pesados.length > 0 && (
                  <ul className="divide-y divide-ink-100">
                    {[...pesados].reverse().map((x) => (
                      <li key={x.animalId} className="flex items-center gap-3 px-5 py-2 text-xs">
                        <Check className="w-3.5 h-3.5 text-success flex-shrink-0" />
                        <span className="font-medium text-ink-900 w-24">Brinco {x.brinco}</span>
                        <span className="text-ink-700 flex-1 tabular-nums">{x.peso.toFixed(0)} kg</span>
                        {x.gmd != null && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium tabular-nums ${
                              x.gmd >= 0 ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
                            }`}
                          >
                            GMD {x.gmd.toFixed(3)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-ink-200 bg-ink-50 flex items-center justify-between gap-3">
                <span className="text-xs text-ink-500 flex items-center gap-1.5">
                  {semBrinco > 0 && (
                    <>
                      <TrendingDown className="w-3.5 h-3.5" />
                      {semBrinco} sem brinco fora da pesagem
                    </>
                  )}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fechar(false)}
                  className="h-9 rounded-md text-sm"
                >
                  Encerrar sessão
                </Button>
              </div>
            </>
          )
        )}
      </SheetContent>
    </Sheet>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-ink-50 p-3 text-center">
      <p className="text-[10px] text-ink-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-base font-bold tabular-nums ${tone || 'text-ink-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-500 mt-0.5">{sub}</p>}
    </div>
  );
}
