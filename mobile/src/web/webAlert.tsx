import React, { useEffect, useRef, useState } from 'react';
import { Alert, type AlertButton } from 'react-native';

/**
 * Alert.alert na web.
 *
 * No react-native-web, Alert.alert é uma função vazia: os ecrãs da app que pedem
 * confirmação (Ask to join, Sign out, Leave, Make leader, Remove, Clear scans)
 * não faziam NADA no browser. Aqui substitui-se por um diálogo com os mesmos
 * botões, no estilo e tema da versão web. No iPhone continua o alerta nativo.
 */
type Pending = { title: string; message?: string; buttons: AlertButton[] };
let push: ((p: Pending) => void) | null = null;
const queue: Pending[] = [];

export function installWebAlert() {
  (Alert as any).alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const p = { title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] };
    if (push) push(p); else queue.push(p);
  };
}

export function AlertHost() {
  const [items, setItems] = useState<Pending[]>([]);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    push = (p) => setItems((xs) => [...xs, p]);
    if (queue.length) setItems((xs) => [...xs, ...queue.splice(0)]);
    return () => { push = null; };
  }, []);
  const cur = items[0];
  const close = () => setItems((xs) => xs.slice(1));
  const cancel = cur?.buttons.find((b) => b.style === 'cancel');
  useEffect(() => {
    if (!cur) return;
    first.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); cancel?.onPress?.(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cur) return null;
  // Cancelar à esquerda, a ação principal à direita (como nos diálogos da versão web).
  const ordered = [...cur.buttons].sort((a, b) => (a.style === 'cancel' ? -1 : 0) - (b.style === 'cancel' ? -1 : 0));
  return (
    <div className="pf pf-scrim" onClick={() => { close(); cancel?.onPress?.(); }}>
      <div className="pf-dlg" role="alertdialog" aria-modal="true" aria-labelledby="pf-alert-t" onClick={(e) => e.stopPropagation()}>
        <h3 id="pf-alert-t" className="w8">{cur.title}</h3>
        {cur.message ? <p>{cur.message}</p> : null}
        <div className={`acts${ordered.length > 2 ? ' col' : ''}`}>
          {ordered.map((b, i) => (
            <button key={i} ref={i === ordered.length - 1 ? first : undefined}
              className={`pf-btn w7 ${b.style === 'cancel' ? 'l' : b.style === 'destructive' ? 'r' : 'g'}`}
              onClick={() => { close(); b.onPress?.(); }}>{b.text ?? 'OK'}</button>))}
        </div>
      </div>
    </div>
  );
}
