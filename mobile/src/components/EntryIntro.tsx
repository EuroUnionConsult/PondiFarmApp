import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { INTRO, entryIntro, entryIntroActive } from '../lib/entryIntro';
import { LOGO_POINTS, LOGO_POINT_COLORS, type LogoPointColor } from '../lib/logoPoints';
import Wordmark from './Wordmark';

// Animação de entrada (conceito A): pontos coloridos, como os de um scan LiDAR, voam de
// posições espalhadas e formam o logótipo oficial (assets/icon.png); os pontos passam
// ao ícone real, o «PondiFarm» aparece por baixo e o overlay desvanece enquanto a Home
// entra cartão a cartão (FadeInView). ≈1,9 s, uma vez por sessão (lib/entryIntro.ts).
// Um só Animated.Value (0 → total, linear) conduz tudo pelo driver nativo; as curvas
// de easing são feitas com vários pontos no inputRange (o driver nativo não aplica
// `easing` em interpolate). Nunca bloqueia toques (pointerEvents="none") e não espera
// pela rede: por baixo, a Home carrega como sempre.

const APP_ICON = require('../../assets/icon.png');
const NATIVE = Platform.OS !== 'web';
// No browser o Animated corre em JS: menos pontos (a lista vem misturada, por isso
// os primeiros N cobrem o logótipo todo).
const COUNT = Platform.OS === 'web' ? 220 : LOGO_POINTS.length;
const TRAVEL = 700;
const MAX_DELAY = 280;
// ease-out cubic em 7 nós (fração do tempo → fração do caminho).
const KNOTS = [0, 0.12, 0.25, 0.4, 0.6, 0.8, 1];
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);

// Pseudo-aleatório determinístico (as mesmas posições de partida em cada execução).
function rand(i: number, salt: number) {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export default function EntryIntro() {
  // Decide uma vez por sessão; montar depois do fim (ou com «Reduzir movimento») = nada.
  const [alive, setAlive] = useState(() => entryIntro().play && entryIntroActive());
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const { mode, colors: ios } = useTheme();
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!alive) return;
    const { startedAt } = entryIntro();
    const elapsed = Math.min(INTRO.total, Date.now() - startedAt);
    t.setValue(elapsed);
    const anim = Animated.timing(t, { toValue: INTRO.total, duration: INTRO.total - elapsed, easing: Easing.linear, useNativeDriver: NATIVE });
    anim.start(({ finished }) => { if (finished) setAlive(false); });
    // Rede de segurança: o overlay sai sempre, mesmo que o callback não chegue.
    const guard = setTimeout(() => setAlive(false), INTRO.total - elapsed + 400);
    return () => { anim.stop(); clearTimeout(guard); };
  }, [alive, t]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.w !== width || size.h !== height) setSize({ w: width, h: height });
  };

  const logo = size ? Math.round(Math.min(200, size.w * 0.38, size.h * 0.24)) : 0;
  const dot = Math.max(2.5, logo / 40);
  // Num fundo escuro o azul-noite dos pontos quase desaparece: usa o azul de texto do tema escuro.
  const colorOf = (c: LogoPointColor) => (c === 'navy' && mode === 'dark' ? ios.navy : LOGO_POINT_COLORS[c]);

  const points = useMemo(() => {
    if (!size) return [];
    const cx = size.w / 2, cy = size.h / 2 - logo * 0.18;
    const left = cx - logo / 2, top = cy - logo / 2;
    return LOGO_POINTS.slice(0, COUNT).map((p, i) => {
      const x = left + p.x * logo - dot / 2, y = top + p.y * logo - dot / 2;
      // Partida espalhada pelo ecrã todo (com margem para fora), como uma nuvem de pontos.
      const sx = (rand(i, 1) * 1.3 - 0.15) * size.w, sy = (rand(i, 2) * 1.3 - 0.15) * size.h;
      const d = Math.round(rand(i, 3) * MAX_DELAY);
      const input = KNOTS.map((k) => d + k * TRAVEL);
      const translateX = t.interpolate({ inputRange: input, outputRange: KNOTS.map((k) => (sx - x) * (1 - easeOut(k))), extrapolate: 'clamp' });
      const translateY = t.interpolate({ inputRange: input, outputRange: KNOTS.map((k) => (sy - y) * (1 - easeOut(k))), extrapolate: 'clamp' });
      const opacity = t.interpolate({ inputRange: [d, d + 160, INTRO.crossFrom + 40, INTRO.crossTo], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
      return { key: i, x, y, color: p.color, translateX, translateY, opacity };
    });
  }, [size, logo, dot, t]);

  if (!alive) return null;

  const cx = size ? size.w / 2 : 0, cy = size ? size.h / 2 - logo * 0.18 : 0;
  const overlayOpacity = t.interpolate({ inputRange: [0, INTRO.fadeFrom, INTRO.total], outputRange: [1, 1, 0], extrapolate: 'clamp' });
  const iconOpacity = t.interpolate({ inputRange: [0, INTRO.crossFrom, INTRO.crossTo], outputRange: [0, 0, 1], extrapolate: 'clamp' });
  const iconScale = t.interpolate({ inputRange: [0, INTRO.crossFrom, INTRO.crossTo], outputRange: [0.96, 0.96, 1], extrapolate: 'clamp' });
  const wordOpacity = t.interpolate({ inputRange: [0, INTRO.wordFrom, INTRO.wordTo], outputRange: [0, 0, 1], extrapolate: 'clamp' });
  const wordY = t.interpolate({ inputRange: [0, INTRO.wordFrom, INTRO.wordTo], outputRange: [10, 10, 0], extrapolate: 'clamp' });

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: ios.systemGroupedBackground, opacity: overlayOpacity }]}
    >
      {size && (
        <>
          {points.map((p) => (
            <Animated.View
              key={p.key}
              style={{
                position: 'absolute', left: p.x, top: p.y, width: dot, height: dot, borderRadius: dot / 2,
                backgroundColor: colorOf(p.color), opacity: p.opacity,
                transform: [{ translateX: p.translateX }, { translateY: p.translateY }],
              }}
            />
          ))}
          <Animated.View style={{ position: 'absolute', left: cx - logo / 2, top: cy - logo / 2, width: logo, height: logo, opacity: iconOpacity, transform: [{ scale: iconScale }] }}>
            <Image source={APP_ICON} style={{ width: logo, height: logo, borderRadius: logo * 0.2 }} accessibilityIgnoresInvertColors />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: cy + logo / 2 + 18, alignItems: 'center', opacity: wordOpacity, transform: [{ translateY: wordY }] }}>
            <Wordmark size={Math.round(Math.max(26, logo * 0.24))} align="center" />
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 50, overflow: 'hidden' },
});
