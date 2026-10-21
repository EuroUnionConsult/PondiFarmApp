import React from 'react';
import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { fonts } from '../lib/theme';

// Texto com a tipografia da marca (Inter). O React Native não tem fonte global,
// por isso os ecrãs importam este `Text` em vez do do react-native. A família
// sai da `fontWeight` que o estilo já tem: 600 ou mais → Inter 700 (títulos),
// abaixo → Inter 400 (texto). São as duas espessuras da Identidade visual v1.0.
// Uma família explícita que não seja a do sistema (ex.: monospace) é respeitada.

const BOLD = new Set(['600', '700', '800', '900', 'bold', 600, 700, 800, 900]);

export default function Text({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const explicit = flat.fontFamily && flat.fontFamily !== 'System' ? flat.fontFamily : null;
  const family = explicit ?? (BOLD.has(flat.fontWeight as never) ? fonts.bold : fonts.regular);
  // Com uma família de peso fixo, a fontWeight já não tem papel e no iOS pode
  // fazer o sistema sintetizar um negrito falso por cima — por isso sai.
  return <RNText {...rest} style={[style, { fontFamily: family, fontWeight: undefined }]} />;
}
