// O projeto não traz @types/react-dom; só precisamos do flushSync (troca de tema com View Transitions).
declare module 'react-dom' {
  export function flushSync<R>(fn: () => R): R;
}
