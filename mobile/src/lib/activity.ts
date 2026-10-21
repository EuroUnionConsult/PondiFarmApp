import { useEffect, useState } from 'react';

// Trabalho com a nuvem em curso (rebanho, sincronização, perfil). Um contador
// global em vez de estado por ecrã: o anel do avatar acende-se seja qual for o
// ecrã que pediu, e só se apaga quando o último pedido acabar.
let pending = 0;
const listeners = new Set<(busy: boolean) => void>();

function emit() {
  const busy = pending > 0;
  listeners.forEach((l) => l(busy));
}

/** Marca `work` como trabalho com a nuvem enquanto não terminar. Devolve-o igual. */
export function trackCloud<T>(work: Promise<T>): Promise<T> {
  pending += 1;
  emit();
  return work.finally(() => {
    pending = Math.max(0, pending - 1);
    emit();
  });
}

export function useCloudBusy(): boolean {
  const [busy, setBusy] = useState(pending > 0);
  useEffect(() => {
    listeners.add(setBusy);
    setBusy(pending > 0);
    return () => { listeners.delete(setBusy); };
  }, []);
  return busy;
}
