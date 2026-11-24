import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../lib/ThemeContext';
import { useReducedMotion } from '../lib/motion';
import { COW_POINTS } from '../lib/cowPoints';

// Animação de carregamento oficial: a cabeça de bovino do ícone em pontos (estáticos,
// sempre visíveis) e um arco verde a rodar à volta (uma volta por 1,1 s; com «Reduzir
// movimento», 2,4 s). Substitui o ActivityIndicator em toda a app (iPhone e web).
// Os pontos vêm de scripts/sample-logo-points.py (lib/cowPoints.ts).

export type LoaderSize = 'sm' | 'md' | 'lg' | number;
/** `auto` segue o tema; `onColor` = sobre um botão verde ou uma superfície escura (câmara). */
export type LoaderTone = 'auto' | 'onColor';

const SIZES = { sm: 22, md: 48, lg: 88 } as const;
const NATIVE = Platform.OS !== 'web';
// Caixa da cabeça dentro do viewBox 64×64.
const BOX = { x: 8, y: 9, w: 48, h: 46 };

const PALETTE = {
  light: { cow: '#1B3A57', arc: '#2D7D46', track: 'rgba(27,58,87,0.12)' },
  dark: { cow: '#CFE0EF', arc: '#7FD39A', track: 'rgba(207,224,239,0.16)' },
  onColor: { cow: '#CFE0EF', arc: '#7FD39A', track: 'rgba(207,224,239,0.22)' },
} as const;

const Face = memo(function Face({ px, cow, track }: { px: number; cow: string; track: string }) {
  return (
    <Svg width={px} height={px} viewBox="0 0 64 64">
      <Circle cx={32} cy={32} r={30} stroke={track} strokeWidth={3} fill="none" />
      {COW_POINTS.map((p, i) => (
        <Circle key={i} cx={BOX.x + p.x * BOX.w} cy={BOX.y + p.y * BOX.h} r={0.75} fill={cow} />
      ))}
    </Svg>
  );
});

export default function PondiLoader({
  size = 'md', tone = 'auto', label = 'Loading', style,
}: { size?: LoaderSize; tone?: LoaderTone; label?: string; style?: StyleProp<ViewStyle> }) {
  const { mode } = useTheme();
  const reduced = useReducedMotion();
  const px = typeof size === 'number' ? size : SIZES[size];
  const c = tone === 'onColor' ? PALETTE.onColor : mode === 'dark' ? PALETTE.dark : PALETTE.light;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: reduced ? 2400 : 1100, easing: Easing.linear, useNativeDriver: NATIVE }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin, reduced]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View
      style={[{ width: px, height: px }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <Face px={px} cow={c.cow} track={c.track} />
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: px, height: px, transform: [{ rotate }] }}>
        <Svg width={px} height={px} viewBox="0 0 64 64">
          <Circle cx={32} cy={32} r={30} stroke={c.arc} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray="52 137" />
        </Svg>
      </Animated.View>
    </View>
  );
}
