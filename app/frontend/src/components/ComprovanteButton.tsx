import { useState } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { getComprovanteUrl } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

/** Botão discreto que abre o comprovante da transação em nova aba (URL assinada). */
export function ComprovanteButton({ path, className }: { path: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const abrir = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const url = await getComprovanteUrl(path);
    setLoading(false);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      toast({ title: 'Não foi possível abrir o comprovante', variant: 'destructive' });
    }
  };

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={loading}
      title="Ver comprovante"
      className={`p-1.5 rounded hover:bg-brand/10 text-brand disabled:opacity-50 ${className || ''}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
    </button>
  );
}
