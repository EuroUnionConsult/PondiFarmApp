import { useEffect, useState } from 'react';
import { fetchCloudAnimals, getCachedCloudSnapshot, type CloudAnimal } from '../lib/api';
import { listRecords, countPendingSync } from '../lib/storage';
import { useAuth } from '../lib/AuthContext';

// Rebanho da nuvem: mostra o que está em cache e atualiza em segundo plano, como na app.
// Volta a carregar quando muda o acesso (aprovado, removido, outra organização):
// sem isto, quem era aprovado ficava «Member» com o rebanho vazio até recarregar.
const RETRY_MS = 30_000;

export function useHerd() {
  const { token, user } = useAuth();
  const access = `${token ?? ''}|${user?.membershipStatus ?? ''}|${user?.organizationId ?? ''}`;
  const [animals, setAnimals] = useState<CloudAnimal[] | null>(null);
  const [pending, setPending] = useState(0);
  // Rebanho em cache e o servidor não respondeu: quando foi guardado (o ecrã diz que não é atual).
  const [staleAt, setStaleAt] = useState<number | null>(null);
  // Sem cache e sem servidor: nada para mostrar (não é «sem animais»).
  const [failed, setFailed] = useState(false);
  // true só depois de o servidor responder: até lá não se diz «Everything is synced».
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    let alive = true;
    setAnimals(null); setStaleAt(null); setFailed(false); setFresh(false);
    const cached = getCachedCloudSnapshot();
    cached.then((c) => { if (alive && c?.animals.length) setAnimals(c.animals); });
    let retry: ReturnType<typeof setTimeout> | undefined;
    // Sem resposta do servidor: tenta outra vez de 30 em 30 s e sai do estado «velho» sozinho.
    const load = () => fetchCloudAnimals()
      .then((a) => { if (alive) { setAnimals(a); setFresh(true); setStaleAt(null); setFailed(false); } })
      .catch(async () => {
        const c = await cached;
        if (!alive) return;
        if (c?.animals.length) { setAnimals(c.animals); setStaleAt(c.at); }
        else setFailed(true);
        retry = setTimeout(load, RETRY_MS);
      });
    void load();
    listRecords().then((r) => { if (alive) setPending(countPendingSync(r)); }).catch(() => {});
    return () => { alive = false; if (retry) clearTimeout(retry); };
  }, [access]);
  return { animals, pending, staleAt, failed, fresh };
}
export type Herd = ReturnType<typeof useHerd>;

export const fmtW = (w: number | null) => (w && w > 0 ? Math.round(w) : null);
