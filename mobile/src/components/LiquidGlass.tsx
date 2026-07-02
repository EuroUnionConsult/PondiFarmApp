import React from 'react';
import { type ViewStyle, type StyleProp } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import GlassSurface from './GlassSurface';

type Tone = 'light' | 'dark';

interface Props {
  /** `light` sobre fundos claros; `dark` sobre navy/câmera/3D. */
  tone?: Tone;
  /** Raio concêntrico (padrão iOS 26). */
  radius?: number;
  /** Tinta do vidro (ex.: verde no CTA). No fallback vira o fill translúcido. */
  fillColor?: string;
  /** Vidro reage ao toque (só no Liquid Glass nativo do iOS 26). */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

// Avaliado uma vez: no iOS 26 (com o módulo nativo compilado) usa o Liquid Glass
// REAL (UIGlassEffect — refração + especular reativo). Senão, cai no vidro fosco
// (expo-blur) do GlassSurface. Requer rebuild nativo para o caminho real ativar.
const LIQUID = isLiquidGlassAvailable();

export default function LiquidGlass({
  tone = 'light',
  radius = 18,
  fillColor,
  interactive,
  style,
  children,
}: Props) {
  if (LIQUID) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={tone === 'dark' ? 'dark' : 'light'}
        tintColor={fillColor}
        isInteractive={interactive}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <GlassSurface tone={tone} radius={radius} fillColor={fillColor} style={style}>
      {children}
    </GlassSurface>
  );
}

/** True quando o Liquid Glass nativo do iOS 26 está ativo (para ajustes finos de UI). */
export const liquidGlassActive = LIQUID;
