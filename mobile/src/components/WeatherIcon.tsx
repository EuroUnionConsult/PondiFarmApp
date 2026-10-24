import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../lib/ThemeContext';
import { useReducedMotion } from '../lib/motion';
import type { WeatherKind } from '../lib/weather';

/**
 * Ícone animado do tempo, ao estilo da app Meteorologia do iPhone: sol com raios a
 * girar, sol forte vermelho com halo e ondas de calor, chuva a cair, trovoada com
 * clarão, vento, nuvens e lua com estrelas. Cada parte é uma camada própria animada
 * só com transformações/opacidade (thread nativo). `dot`: o ponto laranja da marca
 * com o «duplo toque» quando há aviso importante por ler.
 */
const CLOUD = 'M9.5 22h13a5 5 0 0 0 .6-9.96A7 7 0 0 0 9.7 13.4 4.3 4.3 0 0 0 9.5 22z';
const ORANGE = '#C2611F';

// Uma camada do desenho (SVG 32×32 do tamanho do ícone) com a sua animação.
// Fora do componente: definida lá dentro, cada render montava as camadas de novo.
const SizeCtx = React.createContext(34);
function L({ style, children }: { style?: any; children: React.ReactNode }) {
  const S = React.useContext(SizeCtx);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={S} height={S} viewBox="0 0 32 32">{children}</Svg>
    </Animated.View>
  );
}

function useLoop(duration: number, run: boolean, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) { v.setValue(0); return; }
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [v, duration, run, delay]);
  return v;
}

export default function WeatherIcon({ kind, size = 34, chip = false, dot = false, box: boxSize }: {
  kind: WeatherKind; size?: number; chip?: boolean; dot?: boolean; box?: number;
}) {
  const { colors: ios, mode } = useTheme();
  const dark = mode === 'dark';
  const run = !useReducedMotion();
  const S = size, u = S / 32;   // 1 unidade do desenho em píxeis
  const cloudA = dark ? '#B4C1CE' : '#D5DEE7', cloudB = dark ? '#7F90A1' : '#A9B7C5';
  const blue = dark ? '#7FB0E6' : '#2563A8', navy = dark ? '#9DBCE0' : '#1B3A57';
  const hot = kind === 'hot';
  // Ids únicos por ícone: com vários na página, um id repetido apontava para o gradiente errado.
  const uid = `wx${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const spin = useLoop(16000, run && (kind === 'sun' || hot));
  const breath = useLoop(2400, run && (kind === 'sun' || hot));
  const halo = useLoop(1900, run && hot);
  const floatV = useLoop(5000, run && (kind === 'cloudy' || kind === 'rain'));
  const d1 = useLoop(1050, run && (kind === 'rain' || kind === 'storm'));
  const d2 = useLoop(900, run && kind === 'rain', 330);
  const d3 = useLoop(1150, run && (kind === 'rain' || kind === 'storm'), 620);
  const flash = useLoop(2600, run && kind === 'storm');
  const gust = useLoop(1700, run && kind === 'wind');
  const gust2 = useLoop(1700, run && kind === 'wind', 450);
  const leaf = useLoop(3400, run && kind === 'wind');
  const twinkle = useLoop(2800, run && kind === 'night');
  const twinkle2 = useLoop(2800, run && kind === 'night', 1000);
  const shim = useLoop(2200, run && hot);
  const shim2 = useLoop(2200, run && hot, 700);
  const beat = useLoop(2800, run && dot);

  const ip = (v: Animated.Value, input: number[], output: number[] | string[]) => v.interpolate({ inputRange: input, outputRange: output as any });
  const fall = (v: Animated.Value) => ({
    opacity: ip(v, [0, 0.15, 0.85, 1], [0, 1, 1, 0]),
    transform: [{ translateY: ip(v, [0, 1], [-3 * u, 8 * u]) }],
  });
  const flashOp = ip(flash, [0, 0.05, 0.06, 0.1, 0.14, 0.15, 0.18, 1], [0, 0, 1, 0, 0, 1, 0, 0]);

  const grads = useMemo(() => (
    <Defs>
      <RadialGradient id={`${uid}s`} cx="40%" cy="38%" r="70%">
        <Stop offset="0" stopColor={hot ? '#FF8A6B' : '#FFD27A'} />
        <Stop offset="1" stopColor={hot ? '#D7372B' : '#F29A1F'} />
      </RadialGradient>
      <LinearGradient id={`${uid}c`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={cloudA} />
        <Stop offset="1" stopColor={cloudB} />
      </LinearGradient>
    </Defs>
  ), [hot, cloudA, cloudB, uid]);

  const rays = (color: string) => (
    <L style={{ opacity: ip(breath, [0, 0.5, 1], [1, 0.55, 1]), transform: [{ rotate: ip(spin, [0, 1], ['0deg', '360deg']) }] }}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <G key={a} rotation={a} origin="16,16"><Line x1="16" y1="2.6" x2="16" y2="6.2" stroke={color} strokeWidth={2.3} strokeLinecap="round" /></G>
      ))}
    </L>
  );

  let layers: React.ReactNode;
  if (kind === 'sun' || hot) {
    layers = (<>
      {hot && <L style={{ opacity: ip(halo, [0, 0.5, 1], [0.16, 0.36, 0.16]), transform: [{ scale: ip(halo, [0, 0.5, 1], [1, 1.28, 1]) }] }}><Circle cx="16" cy="16" r="12" fill="#E5533F" /></L>}
      {rays(hot ? '#E5533F' : '#F2A93B')}
      <L>{grads}<Circle cx="16" cy="16" r="6.4" fill={`url(#${uid}s)`} /></L>
      {hot && [shim, shim2].map((v, i) => (
        <L key={i} style={{ opacity: ip(v, [0, 0.4, 1], [0, 0.8, 0]), transform: [{ translateY: ip(v, [0, 1], [2 * u, -5 * u]) }] }}>
          <Path d={i ? 'M9 29q2-1.5 4 0t4 0 4 0' : 'M8 27q2-1.5 4 0t4 0 4 0 4 0'} fill="none" stroke="#E5533F" strokeWidth={1.6} strokeLinecap="round" />
        </L>
      ))}
    </>);
  } else if (kind === 'cloudy') {
    layers = (<>
      <L style={{ transform: [{ translateX: ip(floatV, [0, 0.5, 1], [0, -1.8 * u, 0]) }] }}><Path d="M18 13h8a3.5 3.5 0 0 0 .3-6.98A5 5 0 0 0 17 7.5 3 3 0 0 0 18 13z" transform="translate(-3 2)" fill={cloudB} /></L>
      <L style={{ transform: [{ translateX: ip(floatV, [0, 0.5, 1], [0, 1.8 * u, 0]) }] }}>{grads}<Path d={CLOUD} transform="translate(0 1)" fill={`url(#${uid}c)`} /></L>
    </>);
  } else if (kind === 'rain' || kind === 'storm') {
    const storm = kind === 'storm';
    layers = (<>
      {(storm ? [d1, d3] : [d1, d2, d3]).map((v, i) => {
        const x = storm ? [10, 22][i] : [11, 16, 21][i];
        return <L key={i} style={fall(v)}><Line x1={x} y1={21} x2={x - 1} y2={24.5} stroke={blue} strokeWidth={2} strokeLinecap="round" /></L>;
      })}
      {!storm && <L style={{ opacity: ip(d1, [0, 0.8, 0.88, 1], [0, 0, 0.9, 0]), transform: [{ scale: ip(d1, [0, 0.8, 1], [0.4, 0.4, 1.2]) }] }}><Ellipse cx="15" cy="29.5" rx="3" ry="1" fill="none" stroke={blue} strokeWidth={1.2} /></L>}
      <L style={!storm ? { transform: [{ translateX: ip(floatV, [0, 0.5, 1], [0, 1.6 * u, 0]) }] } : undefined}>{grads}<Path d={CLOUD} transform="translate(0 -3)" fill={storm ? (dark ? '#6C7D8E' : '#8A98A8') : `url(#${uid}c)`} /></L>
      {storm && <L style={{ opacity: flashOp }}><Path d={CLOUD} transform="translate(0 -3)" fill={dark ? '#AFC0D0' : '#C9D4DF'} /></L>}
      {storm && <L style={{ opacity: flashOp }}><Path d="M16.6 17.2 13 24h3.2l-1.3 5.6L20.4 22h-3.3l1.8-4.8z" fill="#F5C518" /></L>}
    </>);
  } else if (kind === 'wind') {
    layers = (<>
      <L><G opacity={0.22} stroke={navy} strokeWidth={2.2} strokeLinecap="round" fill="none"><Path d="M4 11h15a3.5 3.5 0 1 0-3.5-3.5" /><Path d="M4 16h20a3.5 3.5 0 1 1-3.5 3.5" /><Path d="M4 21h10" /></G></L>
      {[gust, gust2].map((v, i) => (
        <L key={i} style={{ opacity: ip(v, [0, 0.2, 0.8, 1], [0, 1, 1, 0]), transform: [{ translateX: ip(v, [0, 1], [-6 * u, 9 * u]) }] }}>
          <Line x1={4} y1={i ? 16 : 11} x2={12} y2={i ? 16 : 11} stroke={navy} strokeWidth={2.2} strokeLinecap="round" />
        </L>
      ))}
      <L style={{ opacity: ip(leaf, [0, 0.2, 0.85, 1], [0, 1, 1, 0]), transform: [{ translateX: ip(leaf, [0, 1], [-6 * u, 18 * u]) }, { translateY: ip(leaf, [0, 0.5, 1], [4 * u, -2 * u, -6 * u]) }, { rotate: ip(leaf, [0, 1], ['0deg', '320deg']) }] }}>
        <Path d="M8 25c2-3 5-3 6-1-2 2-4 2.6-6 1z" fill={ios.accent} />
      </L>
    </>);
  } else {
    layers = (<>
      <L><Path d="M24 19.5A9 9 0 1 1 13 7.2a7.2 7.2 0 0 0 11 12.3z" fill={dark ? '#C9D6E4' : '#8FA6BF'} /></L>
      {[[twinkle, 23, 7.5, 1.4], [twinkle2, 27.5, 12.5, 1]].map(([v, cx, cy, r], i) => (
        <L key={i} style={{ opacity: ip(v as Animated.Value, [0, 0.5, 1], [1, 0.2, 1]) }}><Circle cx={cx as number} cy={cy as number} r={r as number} fill="#F2C66B" /></L>
      ))}
    </>);
  }

  const box = boxSize ?? (chip ? S + 14 * (S / 34) : S);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Weather now: ${kind}${dot ? ', important alert to read' : ''}`}
      style={[{ width: box, height: box, alignItems: 'center', justifyContent: 'center' },
        chip && { borderRadius: box / 2, backgroundColor: ios.secondarySystemGroupedBackground, borderWidth: StyleSheet.hairlineWidth, borderColor: ios.separator }]}
    >
      <SizeCtx.Provider value={S}><View style={{ width: S, height: S }}>{layers}</View></SizeCtx.Provider>
      {dot && (
        <View style={[styles.dotWrap, { top: chip ? 0 : -2, right: chip ? 0 : -2 }]} pointerEvents="none">
          <Animated.View style={[styles.ripple, {
            opacity: ip(beat, [0, 0.18, 0.22, 0.6, 1], [0, 0, 0.9, 0, 0]),
            transform: [{ scale: ip(beat, [0, 0.18, 0.6, 1], [1, 1, 2.6, 2.6]) }],
          }]} />
          <Animated.View style={[styles.dot, { borderColor: ios.secondarySystemGroupedBackground,
            transform: [{ scale: ip(beat, [0, 0.06, 0.12, 0.18, 0.24, 0.3, 1], [1, 1.35, 0.95, 1.3, 1, 1, 1]) }] }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dotWrap: { position: 'absolute', width: 12, height: 12 },
  dot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: ORANGE, borderWidth: 2 },
  ripple: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: ORANGE },
});
