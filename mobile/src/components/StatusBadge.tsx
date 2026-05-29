import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, font, spacing, radius } from '../lib/theme';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

interface Props {
  label: string;
  variant?: Variant;
}

const variantMap: Record<Variant, { bg: string; text: string }> = {
  success: { bg: colors.primaryLight,   text: colors.primary   },
  warning: { bg: colors.warningLight,   text: colors.warning   },
  danger:  { bg: colors.dangerLight,    text: colors.danger    },
  info:    { bg: colors.secondaryLight, text: colors.secondary },
  muted:   { bg: colors.border,         text: colors.textMuted },
};

export default function StatusBadge({ label, variant = 'muted' }: Props) {
  const v = variantMap[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.label, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
