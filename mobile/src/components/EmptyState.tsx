import React, { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Text from './Text';
import PressableScale from './PressableScale';
import { useTheme } from '../lib/ThemeContext';
import { COW_POINTS } from '../lib/cowPoints';

// Estado vazio (sem animais, sem scans, sem resultados): a cabeça de bovino do ícone em
// pontos (o mesmo conjunto do PondiLoader, estático e esbatido), um título, uma frase do
// que fazer e, onde existir, o botão da próxima ação (no iPhone: «New scan»). Na web não
// há captura, por isso quem chama não passa a ação.

export const EMPTY_HINT_NATIVE = 'Scan your first animal with the iPhone, or ask your team to join your organization.';
export const EMPTY_HINT_WEB = 'Scans are made with the iPhone app.';

const CowDots = memo(function CowDots({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size * (46 / 48)} viewBox="0 0 48 46" accessibilityElementsHidden importantForAccessibility="no">
      {COW_POINTS.map((p, i) => <Circle key={i} cx={p.x * 48} cy={p.y * 46} r={0.85} fill={color} />)}
    </Svg>
  );
});

type Action = { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap };

export default function EmptyState({
  title, text, action, compact = false, style,
}: { title: string; text?: string; action?: Action; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const { mode, colors: ios } = useTheme();
  const cow = mode === 'dark' ? '#CFE0EF' : '#1B3A57';
  return (
    <View style={[{ alignItems: 'center', paddingHorizontal: 28, paddingVertical: compact ? 22 : 36, gap: 8 }, style]} accessibilityRole="summary">
      <View style={{ opacity: 0.35, marginBottom: 4 }}>
        <CowDots size={compact ? 64 : 96} color={cow} />
      </View>
      <Text style={{ fontSize: compact ? 15.5 : 17, fontWeight: '700', color: ios.label, textAlign: 'center', letterSpacing: -0.3 }}>{title}</Text>
      {!!text && (
        <Text style={{ fontSize: compact ? 13.5 : 14, lineHeight: compact ? 19 : 20, color: ios.secondaryLabel, textAlign: 'center', maxWidth: 340 }}>{text}</Text>
      )}
      {action && (
        <PressableScale
          onPress={action.onPress}
          haptic
          accessibilityRole="button"
          style={{
            marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: ios.accentFill, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20,
          }}
        >
          {action.icon && <Ionicons name={action.icon} size={17} color="#FFFFFF" />}
          <Text style={{ color: '#FFFFFF', fontSize: 15.5, fontWeight: '600' }}>{action.label}</Text>
        </PressableScale>
      )}
    </View>
  );
}
