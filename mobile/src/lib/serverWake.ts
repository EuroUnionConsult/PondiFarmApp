import { useSyncExternalStore } from 'react';

/**
 * «A ligar ao servidor…»: a base de dados é serverless e adormece ao fim de 60
 * minutos sem uso; o primeiro pedido depois disso demora 30–60 s. Em vez de a
 * manter acordada (isso esgotou a quota gratuita em agosto), avisamos com calma:
 * um pedido ao servidor ainda pendente ao fim de SLOW_MS acende o aviso, que se
 * apaga quando o último pedido lento termina (com sucesso ou não).
 */
export const SLOW_MS = 3000;

let slow = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Acompanha um pedido ao servidor. Devolve a mesma promessa, sem a alterar. */
export function trackServerRequest<T>(p: Promise<T>): Promise<T> {
  let marked = false;
  const timer = setTimeout(() => { marked = true; slow += 1; emit(); }, SLOW_MS);
  const done = () => {
    clearTimeout(timer);
    if (marked) { slow -= 1; emit(); }
  };
  p.then(done, done);
  return p;
}

/**
 * A base respondeu 503 «database_waking» (ou o servidor não respondeu) e ainda
 * nenhum pedido seguinte correu bem: o aviso fica aceso mesmo sem pedidos
 * pendentes, até um pedido ao servidor voltar a dar certo.
 */
let unavailable = false;
export function setServerUnavailable(v: boolean): void {
  if (unavailable === v) return;
  unavailable = v;
  emit();
}

/** O ecrã de arranque já diz «Connecting to the server…» em grande: o aviso pequeno esconde-se. */
let suppressed = 0;
export function suppressWakeNotice(): () => void {
  suppressed += 1; emit();
  return () => { suppressed -= 1; emit(); };
}

export function isServerWaking(): boolean {
  return suppressed === 0 && (slow > 0 || unavailable);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** true enquanto houver um pedido pendente há mais de SLOW_MS ou um 503 por resolver. */
export function useServerWaking(): boolean {
  return useSyncExternalStore(subscribe, isServerWaking, isServerWaking);
}
