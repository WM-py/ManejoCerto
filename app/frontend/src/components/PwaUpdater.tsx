import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

/**
 * Registra o service worker do PWA e avisa quando há uma nova versão pronta.
 *
 * Como o registerType é 'autoUpdate', o SW baixa a nova versão sozinho; aqui só
 * damos ao usuário o controle de quando recarregar (evita interromper um
 * lançamento em andamento no curral).
 *
 * Não renderiza nada — o feedback vai pelo Toaster já montado no App.
 */
export function PwaUpdater() {
  const { toast } = useToast();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Falha ao registrar o service worker:', error);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast({
      title: 'Nova versão disponível',
      description: 'Atualize para carregar as últimas melhorias.',
      duration: Infinity,
      action: (
        <ToastAction altText="Atualizar agora" onClick={() => updateServiceWorker(true)}>
          Atualizar
        </ToastAction>
      ),
    });
  }, [needRefresh, toast, updateServiceWorker]);

  return null;
}
