import React from 'react';
import { useTheme, type ThemeMode } from '../lib/ThemeContext';
import { switchThemeWithScan, type ScanOrigin } from '../web/themeScan';

/**
 * Web: a mesma passagem de scan do iPhone (ThemeScan.tsx), mas com a View
 * Transitions API do browser (src/web/themeScan.ts). Não precisa de fotografar o
 * ecrã, por isso o provider não faz nada.
 */
export type { ScanOrigin };

export function useThemeSwitch(): (next: ThemeMode, origin?: ScanOrigin) => void {
  const { setMode } = useTheme();
  return (next, origin) => switchThemeWithScan(next, setMode, origin);
}

export function ThemeScanProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
