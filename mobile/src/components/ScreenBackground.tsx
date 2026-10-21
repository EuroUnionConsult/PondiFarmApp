import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../lib/ThemeContext';

/**
 * Fundo do tema com blobs de marca MUITO suaves (navy/verde/laranja a 6–14%).
 * O BlurView do LiquidGlass/GlassSurface desfoca esses blobs → auréolas de cor
 * dentro do vidro ("líquido") sem escurecer a tela. Uso: primeiro filho da tela,
 * atrás do conteúdo. No tema escuro o degradê é azul-noite e os blobs mais leves.
 */
export default function ScreenBackground() {
  const { colors, mode } = useTheme();
  const stops = mode === 'dark'
    ? ['#0F1B28', '#0B1622', '#08111B']
    : ['#FBFBFD', '#F2F2F7', '#EDF0F5'];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          {/* id muda com o tema: o react-native-svg não refaz um gradiente com o mesmo id */}
          <LinearGradient id={`pf-bg-${mode}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stops[0]} />
            <Stop offset="0.55" stopColor={stops[1]} />
            <Stop offset="1" stopColor={stops[2]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#pf-bg-${mode})`} />
      </Svg>
      <View style={[styles.blob, styles.green, { backgroundColor: colors.blobGreen }]} />
      <View style={[styles.blob, styles.navy, { backgroundColor: colors.blobNavy }]} />
      <View style={[styles.blob, styles.orange, { backgroundColor: colors.blobOrange }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', borderRadius: 999 },
  green:  { top: 60,  right: -90,  width: 300, height: 300 },
  navy:   { top: 320, left: -110, width: 340, height: 340 },
  orange: { bottom: 40, right: -70, width: 240, height: 240 },
});
