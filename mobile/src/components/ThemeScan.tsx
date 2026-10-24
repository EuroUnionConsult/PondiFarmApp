import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Mask, Pattern, Circle, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { captureScreen } from 'react-native-view-shot';
import { useTheme, type ThemeMode } from '../lib/ThemeContext';
import { useReducedMotion } from '../lib/motion';

/**
 * Troca de tema com uma passagem de scan que sai do botão, como na versão web: uma
 * linha verde a 45°, com a nuvem de pontos do LiDAR atrás dela, nasce onde se tocou e
 * varre o ecrã na diagonal, revelando o tema novo por onde passa.
 *
 * O iOS não tem a View Transitions API do browser, por isso: fotografa-se o ecrã
 * (react-native-view-shot), a foto fica por cima e o tema muda por baixo. A foto vive
 * dentro de uma «janela» rodada a 45° que avança na diagonal e a recorta; lá dentro a
 * foto roda e desloca-se ao contrário, para ficar parada. Só transformações, no thread
 * nativo. Com «reduzir movimento», ou se a fotografia falhar, o tema muda de imediato.
 */
const DURATION = 1100;                          // igual à web (themeScan.ts)
// Arranque rápido e paragem suave: a curva antiga (.55,.05,.3,1) parecia parada no topo.
const EASE = Easing.bezier(0.33, 0, 0.2, 1);
const BAND = 150;                               // altura da faixa de pontos
const GLOW = 18;                                // brilho abaixo da linha
const R2 = Math.SQRT1_2;
const U = { x: -R2, y: R2 };                    // sentido da varredura: para baixo e para a esquerda
const V = { x: R2, y: R2 };                     // ao longo da linha

export type ScanOrigin = { x: number; y: number };

type Ctx = { switchTo: (next: ThemeMode, origin?: ScanOrigin) => void };
const ThemeScanCtx = createContext<Ctx | null>(null);

/** Troca o tema com a passagem de scan quando há um ThemeScanProvider; senão, direto. */
export function useThemeSwitch(): (next: ThemeMode, origin?: ScanOrigin) => void {
  const ctx = useContext(ThemeScanCtx);
  const { setMode } = useTheme();
  return ctx ? ctx.switchTo : (next: ThemeMode) => setMode(next);
}

export function ThemeScanProvider({ children }: { children: React.ReactNode }) {
  const { setMode } = useTheme();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [shot, setShot] = useState<{ uri: string; o: ScanOrigin; s0: number; s1: number } | null>(null);
  const busy = useRef(false);
  const pending = useRef<ThemeMode | null>(null);
  const s = useRef(new Animated.Value(0)).current;   // posição da linha ao longo da diagonal

  const switchTo = useCallback(async (next: ThemeMode, origin?: ScanOrigin) => {
    if (busy.current) return;
    if (reduced) { setMode(next); return; }
    busy.current = true;
    try {
      const uri = await captureScreen({ format: 'jpg', quality: 0.9, result: 'tmpfile' });
      const o = origin ?? { x: width - 40, y: 60 };
      // Do canto atrás do botão até ao canto oposto do ecrã.
      const ds = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => (x - o.x) * U.x + (y - o.y) * U.y);
      const s0 = Math.min(...ds), s1 = Math.max(...ds);
      pending.current = next;
      s.setValue(s0);
      setShot({ uri, o, s0, s1 });     // a troca do tema arranca no onLoad da foto
    } catch {
      busy.current = false;
      setMode(next);
    }
  }, [reduced, setMode, s, width, height]);

  const onShotLoaded = () => {
    const next = pending.current;
    pending.current = null;
    if (!next || !shot) return;
    setMode(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Um frame para o tema novo pintar por baixo da foto antes de a linha começar.
    requestAnimationFrame(() => {
      Animated.timing(s, { toValue: shot.s1, duration: DURATION, easing: EASE, useNativeDriver: true })
        .start(() => { setShot(null); busy.current = false; });
    });
  };

  // Janela (lado ainda por revelar) e faixa, ambas rodadas 45° à volta do canto
  // superior esquerdo: a borda de cima da janela e a de baixo da faixa ficam sobre a linha.
  const D = 2 * Math.hypot(width, height);
  const o = shot?.o ?? { x: 0, y: 0 };
  const along = (k: number, base: number) => Animated.add(Animated.multiply(s, k), base);
  const winX = along(U.x, o.x - (D / 2) * V.x), winY = along(U.y, o.y - (D / 2) * V.y);
  const bandX = along(U.x, o.x - (D / 2) * V.x - BAND * U.x), bandY = along(U.y, o.y - (D / 2) * V.y - BAND * U.y);

  return (
    <ThemeScanCtx.Provider value={{ switchTo }}>
      <View style={styles.fill}>
        {children}
        {shot && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {/* O ecrã antigo, só do lado da linha ainda por revelar: atrás dela já é o tema novo. */}
            <Animated.View style={[styles.win, { width: D, height: D, transform: [{ translateX: winX }, { translateY: winY }, { rotate: '45deg' }] }]}>
              <Animated.View style={[styles.corner, { transform: [{ rotate: '-45deg' }, { translateX: Animated.multiply(winX, -1) }, { translateY: Animated.multiply(winY, -1) }] }]}>
                <Image source={{ uri: shot.uri }} style={{ width, height }} onLoad={onShotLoaded} fadeDuration={0} />
              </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.band, { width: D, transform: [{ translateX: bandX }, { translateY: bandY }, { rotate: '45deg' }] }]}>
              <ScanBand width={D} />
            </Animated.View>
          </View>
        )}
      </View>
    </ThemeScanCtx.Provider>
  );
}

/** A faixa: brilho verde a subir até à linha e a nuvem de pontos a desvanecer para cima. */
function ScanBand({ width }: { width: number }) {
  return (
    <Svg width={width} height={BAND + GLOW}>
      <Defs>
        <LinearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3DA05C" stopOpacity={0} />
          <Stop offset="0.6" stopColor="#3DA05C" stopOpacity={0.1} />
          <Stop offset="0.96" stopColor="#3DA05C" stopOpacity={0.28} />
          <Stop offset="0.985" stopColor="#8CFFAA" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#3DA05C" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={1} />
        </LinearGradient>
        <LinearGradient id="below" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3DA05C" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#3DA05C" stopOpacity={0} />
        </LinearGradient>
        <Pattern id="dots" width={14} height={14} patternUnits="userSpaceOnUse">
          <Circle cx={7} cy={7} r={1.3} fill="#78E696" fillOpacity={0.55} />
        </Pattern>
        <Mask id="m">
          <Rect width={width} height={BAND} fill="url(#fade)" />
        </Mask>
      </Defs>
      <Rect width={width} height={BAND} fill="url(#dots)" mask="url(#m)" />
      <Rect width={width} height={BAND} fill="url(#glow)" mask="url(#m)" />
      <Rect y={BAND} width={width} height={GLOW} fill="url(#below)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  win: { position: 'absolute', left: 0, top: 0, overflow: 'hidden', transformOrigin: 'top left' },
  corner: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left' },
  band: {
    // Sem shadow*: no iOS a sombra sem shadowPath é recalculada fora do ecrã a cada frame.
    position: 'absolute', left: 0, top: 0, height: BAND + GLOW, transformOrigin: 'top left',
  },
});
