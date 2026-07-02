import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass } from '../lib/theme';

type Tone = 'light' | 'dark';

interface Props {
  /** `light` = vidro claro (sobre fundos claros); `dark` = vidro navy (sobre câmera/AR/3D). */
  tone?: Tone;
  /** Raio dos cantos (concêntrico, padrão iOS 26). */
  radius?: number;
  /** Sobrepõe o `fill` do token — usar para vidro tingido (ex.: CTA verde). */
  fillColor?: string;
  /** Sobrepõe a intensidade do material. */
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Superfície de vidro fosco — padrão Liquid Glass (iOS 26).
 * Camadas (de baixo p/ cima): material (BlurView) → fill translúcido → borda especular.
 * O conteúdo é renderizado por cima, com o layout vindo de `style`.
 */
export default function GlassSurface({
  tone = 'light',
  radius = 18,
  fillColor,
  intensity,
  style,
  children,
}: Props) {
  const g = glass[tone];
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={intensity ?? g.intensity}
        tint={g.tint}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: fillColor ?? g.fill }]}
        pointerEvents="none"
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: g.border,
          },
        ]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
