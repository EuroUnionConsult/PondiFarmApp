import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

/**
 * Fundo claro do tema com blobs de marca MUITO suaves (navy/verde/laranja a 8–14%).
 * O BlurView do LiquidGlass/GlassSurface desfoca esses blobs → auréolas de cor
 * dentro do vidro ("líquido") sem escurecer a tela. Uso: primeiro filho da tela,
 * atrás do conteúdo.
 */
export default function ScreenBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="pf-bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FBFBFD" />
            <Stop offset="0.55" stopColor="#F2F2F7" />
            <Stop offset="1" stopColor="#EDF0F5" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#pf-bg)" />
      </Svg>
      <View style={[styles.blob, styles.green]} />
      <View style={[styles.blob, styles.navy]} />
      <View style={[styles.blob, styles.orange]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', borderRadius: 999 },
  green:  { top: 60,  right: -90,  width: 300, height: 300, backgroundColor: 'rgba(47,158,68,0.14)' },
  navy:   { top: 320, left: -110, width: 340, height: 340, backgroundColor: 'rgba(22,41,77,0.08)' },
  orange: { bottom: 40, right: -70, width: 240, height: 240, backgroundColor: 'rgba(232,115,31,0.08)' },
});
