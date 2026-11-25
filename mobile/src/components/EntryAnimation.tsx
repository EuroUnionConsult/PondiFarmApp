import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, Text, View,
  useWindowDimensions, type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { COW_POINTS } from '../lib/cowPoints';
import { CFG_KEY } from '../lib/config';
import { fonts } from '../lib/theme';
import { INTRO, INTRO_BG, entryIntro, onAppPainted, shortenEntryIntro } from '../lib/entryIntro';
import { stageGeometry } from '../lib/entryStage';

// Animação de abertura «Scan que revela» (aprovada pelo Talys, 24/11/2026). Sobre o
// azul-noite (#0F2234), os quatro cantos laranja de scan enquadram o palco; uma linha
// verde de scan desce pela zona da cabeça e os pontos da vaca do ícone acendem-se à
// passagem; os pontos dão lugar ao ícone real, o «PondiFarm» sobe por baixo, a
// assinatura aparece em baixo e tudo passa para a app (≈3 s). Uma vez por arranque
// (lib/entryIntro.ts); nunca espera pela rede nem bloqueia toques. «Reduzir movimento»:
// ícone + wordmark parados ~0,6 s. No iPhone o primeiro fotograma é igual ao splash
// nativo (só os cantos, gerado por scripts/make-splash.py com a mesma geometria).
// Um só Animated.Value (tempo em ms) conduz tudo pelo driver nativo.

const APP_ICON = require('../../assets/icon.png');
const NATIVE = Platform.OS !== 'web';
const ORANGE = '#E8792C';
const GREEN = '#7FD39A';
const DOT = '#CFE0EF';
// Zona da cabeça dentro do quadrado do ícone (a mesma dos pontos, lib/cowPoints.ts).
const COW = { x: 0.19, y: 0.10, w: 0.62, h: 0.61 };

const clamp = 'clamp' as const;
const WEB = Platform.OS === 'web';
/** Web: classe no <body> enquanto a animação corre (esconde o ícone do login, que a animação vai ocupar). */
const BODY_CLASS = 'pf-intro-on';
/** Web: o ícone para onde o da animação voa na passagem (o ícone grande do login de computador). */
const TARGET_SELECTOR = '[data-intro-target]';

type Rect = { x: number; y: number; w: number };

export default function EntryAnimation({ onDone }: { onDone?: () => void }) {
  const [alive, setAlive] = useState(() => entryIntro().play);
  const [reduced, setReduced] = useState<boolean | null>(
    Platform.OS === 'web' ? !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches : null,
  );
  // O overlay ocupa a janela toda: a geometria sai já do 1.º render (sem esperar pelo layout),
  // para o 1.º fotograma ser igual ao splash.
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const t = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Web: o fundo da página fica azul-noite até a animação acabar (index.html) E a app ter
  // pintado por baixo — sem isto, sem animação e com as fontes ainda a carregar, a página
  // ficava em branco vários segundos.
  const finish = useRef(() => {
    if (WEB) {
      document.body.classList.remove(BODY_CLASS);
      onAppPainted(() => { document.body.style.backgroundColor = 'transparent'; });
    }
    setAlive(false);
    doneRef.current?.();
  }).current;

  useEffect(() => { if (!alive) finish(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Web: passagem sem dois ícones. Pouco antes do fim, procura o ícone do ecrã que está por
  // baixo (o do login de computador); se existir, o ícone da animação voa até ele e encaixa
  // (efeito de elemento partilhado). O do login só aparece quando a animação sai.
  const [target, setTarget] = useState<Rect | null>(null);
  useEffect(() => {
    if (!WEB || !alive || reduced !== false) return;
    document.body.classList.add(BODY_CLASS);
    const at = setTimeout(() => {
      const el = document.querySelector(TARGET_SELECTOR);
      const r = el?.getBoundingClientRect();
      if (r && r.width > 0) setTarget({ x: r.left, y: r.top, w: r.width });
    }, Math.max(0, INTRO.fadeFrom - 120));
    return () => clearTimeout(at);
  }, [alive, reduced]);

  // iPhone: «Reduzir movimento» chega por promessa; até lá fica o 1.º fotograma (= splash).
  useEffect(() => {
    if (!alive || reduced !== null) return;
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (on) setReduced(v); }).catch(() => { if (on) setReduced(true); });
    return () => { on = false; };
  }, [alive, reduced]);

  useEffect(() => {
    if (!alive || reduced === null) return;
    if (reduced) shortenEntryIntro();
    const total = reduced ? INTRO.reducedTotal : INTRO.total;
    const anim = Animated.timing(t, { toValue: total, duration: total, easing: Easing.linear, useNativeDriver: NATIVE });
    anim.start(({ finished }) => { if (finished) finish(); });
    // Rede de segurança: o overlay sai sempre, mesmo que o callback não chegue.
    const guard = setTimeout(finish, total + 500);
    // Toque leve quando o ícone aparece (respeita «Haptic feedback» das Definições).
    let haptic: ReturnType<typeof setTimeout> | undefined;
    if (NATIVE && !reduced) {
      haptic = setTimeout(() => {
        AsyncStorage.getItem(CFG_KEY)
          .then((raw) => { if (!raw || JSON.parse(raw)?.vibration !== false) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); })
          .catch(() => {});
      }, INTRO.revealFrom);
    }
    return () => { anim.stop(); clearTimeout(guard); if (haptic) clearTimeout(haptic); };
  }, [alive, reduced, t, finish]);

  const g = winW > 0 && winH > 0 ? stageGeometry(winW, winH) : null;

  const dots = useMemo(() => {
    if (!g) return [];
    const d = g.s * 0.0194;
    const span = INTRO.scanTo - INTRO.scanFrom;
    return COW_POINTS.map((p, i) => {
      const reach = INTRO.scanFrom + p.y * span;
      return {
        key: i,
        left: g.left + (COW.x + p.x * COW.w) * g.s - d / 2,
        top: g.top + (COW.y + p.y * COW.h) * g.s - d / 2,
        d,
        opacity: t.interpolate({ inputRange: [reach - 10, reach + 40, INTRO.revealFrom, INTRO.revealTo], outputRange: [0, 1, 1, 0], extrapolate: clamp }),
      };
    });
  }, [g?.s, g?.left, g?.top, t]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!alive) return null;

  const root: ViewStyle = { ...StyleSheet.absoluteFillObject, position: (NATIVE ? 'absolute' : 'fixed') as ViewStyle['position'], zIndex: 1000, backgroundColor: INTRO_BG };
  const total = reduced ? INTRO.reducedTotal : INTRO.total;
  const fadeFrom = reduced ? INTRO.reducedHold : INTRO.fadeFrom;
  const overlayOpacity = t.interpolate({ inputRange: [0, fadeFrom, total], outputRange: [1, 1, 0], extrapolate: clamp });

  if (!g) return <Animated.View pointerEvents="none" style={root} />;

  const word = Math.round(g.s * 0.2);
  const wordTop = g.top + g.s + Math.round(g.s * 0.14);
  const wordmark = (
    <Text allowFontScaling={false} style={{ fontFamily: fonts.bold, fontSize: word, lineHeight: Math.round(word * 1.15), letterSpacing: -word * 0.03, textAlign: 'center' }}>
      <Text style={{ color: '#FFFFFF' }}>Pondi</Text>
      <Text style={{ color: GREEN }}>Farm</Text>
    </Text>
  );
  const byline = (
    <Text allowFontScaling={false} style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.62)', textAlign: 'center', letterSpacing: 0.2 }}>
      by Euro Union Consult
    </Text>
  );
  const icon = <Image source={APP_ICON} style={{ width: g.s, height: g.s, borderRadius: g.s * 0.2 }} accessibilityIgnoresInvertColors />;

  // «Reduzir movimento»: ícone + wordmark + assinatura, parados; só o desvanecer final.
  if (reduced) {
    return (
      <Animated.View pointerEvents="none" style={[root, { opacity: overlayOpacity }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ position: 'absolute', left: g.left, top: g.top }}>{icon}</View>
        <View style={{ position: 'absolute', left: 0, right: 0, top: wordTop }}>{wordmark}</View>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 24 }}>{byline}</View>
      </Animated.View>
    );
  }

  // Ainda sem saber o «Reduzir movimento» (iPhone): só os cantos, como no splash.
  const waiting = reduced === null;
  const cornersOpacity = waiting ? 1 : t.interpolate({
    inputRange: NATIVE ? [0, INTRO.revealFrom, INTRO.revealTo] : [0, INTRO.cornersIn, INTRO.revealFrom, INTRO.revealTo],
    outputRange: NATIVE ? [1, 1, 0] : [0, 1, 1, 0], extrapolate: clamp,
  });
  // iPhone: os cantos já estão no splash, por isso não entram a escalar (continuidade).
  const cornersScale = NATIVE || waiting ? 1 : t.interpolate({ inputRange: [0, INTRO.cornersIn], outputRange: [1.3, 1], extrapolate: clamp });
  const cowTop = g.top + COW.y * g.s, cowBottom = g.top + (COW.y + COW.h) * g.s;
  const lineY = t.interpolate({ inputRange: [INTRO.scanFrom, INTRO.scanTo], outputRange: [cowTop, cowBottom], extrapolate: clamp });
  const lineOpacity = t.interpolate({ inputRange: [INTRO.scanFrom - 1, INTRO.scanFrom + 60, INTRO.scanTo - 40, INTRO.scanTo + 60], outputRange: [0, 1, 1, 0], extrapolate: clamp });
  // O conteúdo (ícone, nome, assinatura) sai ANTES do fundo, em iPhone e web, para o ícone da
  // animação nunca aparecer ao mesmo tempo que o do ecrã de baixo nem o nome por cima do
  // formulário. Web com alvo (login de computador): o ícone voa até ele.
  const contentOut = INTRO.fadeFrom + 120;
  const fly = WEB && target ? {
    dx: target.x + target.w / 2 - (g.left + g.s / 2),
    dy: target.y + target.w / 2 - (g.top + g.s / 2),
    k: target.w / g.s,
  } : null;
  const flyEase = Easing.inOut(Easing.cubic);
  const iconOpacity = !fly
    ? t.interpolate({ inputRange: [INTRO.revealFrom, INTRO.revealTo, INTRO.fadeFrom, contentOut], outputRange: [0, 1, 1, 0], extrapolate: clamp })
    : t.interpolate({ inputRange: [INTRO.revealFrom, INTRO.revealTo], outputRange: [0, 1], extrapolate: clamp });
  const iconScale = fly
    ? t.interpolate({ inputRange: [INTRO.revealFrom, INTRO.revealTo, INTRO.fadeFrom, total], outputRange: [0.96, 1, 1, fly.k], extrapolate: clamp, easing: flyEase })
    : t.interpolate({ inputRange: [INTRO.revealFrom, INTRO.revealTo], outputRange: [0.96, 1], extrapolate: clamp });
  const iconX = fly ? t.interpolate({ inputRange: [INTRO.fadeFrom, total], outputRange: [0, fly.dx], extrapolate: clamp, easing: flyEase }) : 0;
  const iconY = fly ? t.interpolate({ inputRange: [INTRO.fadeFrom, total], outputRange: [0, fly.dy], extrapolate: clamp, easing: flyEase }) : 0;
  const wordOpacity = t.interpolate({ inputRange: [INTRO.wordFrom, INTRO.wordTo, INTRO.fadeFrom, contentOut], outputRange: [0, 1, 1, 0], extrapolate: clamp });
  const wordY = t.interpolate({ inputRange: [INTRO.wordFrom, INTRO.wordTo], outputRange: [12, 0], extrapolate: clamp });
  const bylineOpacity = t.interpolate({ inputRange: [INTRO.bylineFrom, INTRO.bylineTo, INTRO.fadeFrom, contentOut], outputRange: [0, 1, 1, 0], extrapolate: clamp });
  // O fundo só desvanece depois do conteúdo; com alvo (web), o ícone (que voa) fica opaco
  // até ao fim e o fundo sai à volta dele.
  const bgOpacity = t.interpolate({ inputRange: [0, fly ? INTRO.fadeFrom + 60 : contentOut, total], outputRange: [1, 1, 0], extrapolate: clamp });
  const lineW = g.s * 0.86;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[root, { backgroundColor: 'transparent' }]}
    >
      {/* O fundo azul-noite é uma camada própria, para o conteúdo sair antes dele. */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: INTRO_BG, opacity: bgOpacity }]} />
      {/* Cantos de scan à volta do palco. */}
      <Animated.View style={{ position: 'absolute', left: g.left - g.pad, top: g.top - g.pad, opacity: cornersOpacity, transform: [{ scale: cornersScale }] }}>
        <Svg width={g.s + 2 * g.pad} height={g.s + 2 * g.pad}>
          <Path d={g.cornersPath} stroke={ORANGE} strokeWidth={g.stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>

      {/* Pontos da cabeça: acendem-se quando a linha passa. */}
      {!waiting && dots.map((p) => (
        <Animated.View key={p.key} style={{ position: 'absolute', left: p.left, top: p.top, width: p.d, height: p.d, borderRadius: p.d / 2, backgroundColor: DOT, opacity: p.opacity }} />
      ))}

      {/* Linha de scan verde, com brilho. */}
      {!waiting && (
        <Animated.View style={{
          position: 'absolute', left: g.left + (g.s - lineW) / 2, top: 0, width: lineW, height: 2, borderRadius: 1,
          backgroundColor: GREEN, opacity: lineOpacity, transform: [{ translateY: lineY }],
          shadowColor: GREEN, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
        }} />
      )}

      {/* O ícone real aparece onde estavam os pontos. */}
      {!waiting && (
        <Animated.View style={{ position: 'absolute', left: g.left, top: g.top, opacity: iconOpacity, transform: [{ translateX: iconX }, { translateY: iconY }, { scale: iconScale }] }}>{icon}</Animated.View>
      )}

      {!waiting && (
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: wordTop, opacity: wordOpacity, transform: [{ translateY: wordY }] }}>{wordmark}</Animated.View>
      )}
      {!waiting && (
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 24, opacity: bylineOpacity }}>{byline}</Animated.View>
      )}
    </Animated.View>
  );
}
