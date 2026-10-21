import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// «Reduzir movimento» do iOS (Acessibilidade > Movimento). Com ele ligado as
// animações passam a fades curtos, sem deslizes nem molas.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setReduced(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduced;
}

/** Atraso de entrada em cascata: cada secção 45 ms depois da anterior, com teto. */
export const stagger = (index: number) => Math.min(index, 8) * 45;
