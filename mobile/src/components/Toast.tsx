// Avisos rápidos com o estilo PondiFarm: um só componente para o iPhone e a web,
// sempre no mesmo sítio (em baixo, acima da barra de separadores e da área segura),
// três tons com ícone, título a negrito e uma linha de detalhe. Somem ao fim de
// ~4 s ou ao tocar. `showToast` pode ser chamado de qualquer ecrã; o `ToastHost`
// vive uma vez na raiz (App.tsx e App.web.tsx).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './Text';
import { useTheme } from '../lib/ThemeContext';
import { useReducedMotion } from '../lib/motion';

export type ToastTone = 'success' | 'warning' | 'error';
export interface ToastInput { tone: ToastTone; title: string; detail?: string; durationMs?: number }
type Shown = ToastInput & { key: number };

const DEFAULT_MS = 4000;
let seq = 0;
const listeners = new Set<(t: Shown | null) => void>();
const liftListeners = new Set<(px: number) => void>();
const lifts = new Map<number, number>();
let liftSeq = 0;

/** Mostra um aviso (substitui o que estiver aberto). */
export function showToast(t: ToastInput): void {
  const shown = { ...t, key: ++seq };
  listeners.forEach((l) => l(shown));
}

export function hideToast(): void {
  listeners.forEach((l) => l(null));
}

const currentLift = () => Math.max(0, ...Array.from(lifts.values()));

/** Um ecrã com uma barra fixa em baixo sobe os avisos `px` enquanto `active`. */
export function useToastLift(px: number, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const id = ++liftSeq;
    lifts.set(id, px);
    liftListeners.forEach((l) => l(currentLift()));
    return () => { lifts.delete(id); liftListeners.forEach((l) => l(currentLift())); };
  }, [px, active]);
}

// Cores aprovadas (mock de 24/11/2026); no escuro, fundos profundos com texto claro (AA).
const TONES = {
  light: {
    success: { bg: '#E3F1E7', fg: '#17502C' },
    warning: { bg: '#FBEBDD', fg: '#6E360F' },
    error: { bg: '#FBE3E1', fg: '#7A1E17' },
  },
  dark: {
    success: { bg: '#163A24', fg: '#C4ECD0' },
    warning: { bg: '#3E2614', fg: '#F8D3B0' },
    error: { bg: '#401B18', fg: '#F9C9C3' },
  },
} as const;
const ICON = { success: 'checkmark', warning: 'alert', error: 'close' } as const;

/** Bottom do aviso: acima da barra de separadores (49 pt) e da área segura. */
const TAB_BAR = 64;

export function ToastHost() {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [toast, setToast] = useState<Shown | null>(null);
  const [lift, setLift] = useState(currentLift());
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const l = (t: Shown | null) => setToast(t);
    listeners.add(l); liftListeners.add(setLift);
    return () => { listeners.delete(l); liftListeners.delete(setLift); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: reduced ? 1 : 220, useNativeDriver: Platform.OS !== 'web' }).start();
    // VoiceOver lê o aviso mesmo sem foco (no web, o role status/alert trata disso).
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(toast.detail ? `${toast.title}. ${toast.detail}` : toast.title);
    const t = setTimeout(() => setToast((cur) => (cur?.key === toast.key ? null : cur)), toast.durationMs ?? DEFAULT_MS);
    return () => clearTimeout(t);
  }, [toast, anim, reduced]);

  const st = useMemo(() => StyleSheet.create({
    wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 1000 },
    box: {
      width: '100%', maxWidth: 440, flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
      shadowColor: '#10171D', shadowOpacity: c.isDark ? 0.5 : 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    },
    icon: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    title: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
    detail: { fontSize: 14, lineHeight: 19, marginTop: 1 },
  }), [c.isDark]);

  if (!toast) return null;
  const tone = TONES[c.isDark ? 'dark' : 'light'][toast.tone];
  const role = toast.tone === 'error' ? 'alert' : 'status';
  return (
    <View pointerEvents="box-none" style={[st.wrap, { bottom: insets.bottom + TAB_BAR + lift }]}>
      <Animated.View style={{ width: '100%', alignItems: 'center', opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 10, 0] }) }] }}>
        <Pressable
          onPress={() => setToast(null)}
          style={[st.box, { backgroundColor: tone.bg }]}
          accessibilityRole={Platform.OS === 'web' ? (role as any) : 'alert'}
          accessibilityLiveRegion={toast.tone === 'error' ? 'assertive' : 'polite'}
          accessibilityLabel={toast.detail ? `${toast.title}. ${toast.detail}` : toast.title}
          accessibilityHint="Tap to dismiss"
          testID="pf-toast"
        >
          <View style={[st.icon, { borderColor: tone.fg }]}>
            <Ionicons name={ICON[toast.tone]} size={14} color={tone.fg} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[st.title, { color: tone.fg }]}>{toast.title}</Text>
            {toast.detail ? <Text style={[st.detail, { color: tone.fg }]}>{toast.detail}</Text> : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
