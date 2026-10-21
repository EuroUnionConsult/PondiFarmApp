import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ios, iosDark, type Palette } from './theme';

// Tema claro/escuro escolhido no Perfil (interruptor sol/lua). Claro por
// defeito; a escolha fica guardada no telemóvel.
export type ThemeMode = 'light' | 'dark';
const KEY = '@pondifarm:theme';

interface ThemeState {
  mode: ThemeMode;
  colors: Palette;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const ThemeCtx = createContext<ThemeState>({
  mode: 'light', colors: ios, setMode: () => {}, toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(v => { if (v === 'dark' || v === 'light') setModeState(v); })
      .catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    void AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const value = useMemo<ThemeState>(() => ({
    mode,
    colors: mode === 'dark' ? iosDark : ios,
    setMode,
    toggle: () => setMode(mode === 'dark' ? 'light' : 'dark'),
  }), [mode, setMode]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeState {
  return useContext(ThemeCtx);
}
