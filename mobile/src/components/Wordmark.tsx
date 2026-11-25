import React from 'react';
import { View, useWindowDimensions, type TextStyle, type ViewStyle } from 'react-native';
import Text from './Text';
import { useTheme } from '../lib/ThemeContext';

// Logótipo de palavra da Identidade visual v1.0: «Pondi» em azul-noite + «Farm»
// em verde, Inter 700, com a assinatura por baixo. O símbolo da marca é o ícone
// da app (cabeça de bovino), não o símbolo low-poly do documento.

type Props = {
  size?: number;
  tagline?: boolean;
  align?: 'left' | 'center';
  style?: ViewStyle;
};

export const BRAND_TAGLINE = 'Non-invasive cattle weighing · LiDAR 3D';

export default function Wordmark({ size: base = 34, tagline = false, align = 'left', style }: Props) {
  const { colors: ios } = useTheme();
  // É o logótipo: com texto grande cresce só até 1,3× e nunca parte a palavra.
  const size = base * Math.min(useWindowDimensions().fontScale, 1.3);
  const word: TextStyle = {
    fontSize: size,
    lineHeight: Math.round(size * 1.08),
    letterSpacing: -size * 0.03,
    fontWeight: '700',
    textAlign: align,
  };
  return (
    <View style={style} accessible accessibilityRole="header" accessibilityLabel="PondiFarm">
      <Text style={word} allowFontScaling={false} numberOfLines={1}>
        <Text style={[word, { color: ios.navy }]} allowFontScaling={false}>Pondi</Text>
        <Text style={[word, { color: ios.accent }]} allowFontScaling={false}>Farm</Text>
      </Text>
      {tagline && (
        <Text
          style={{
            fontSize: Math.max(12, Math.round(base * 0.3)),
            color: ios.secondaryLabel,
            letterSpacing: 0.1,
            marginTop: 4,
            textAlign: align,
          }}
        >
          {BRAND_TAGLINE}
        </Text>
      )}
    </View>
  );
}
