import React, { useMemo } from 'react';
import {
  View, StyleSheet,
} from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import Text from './Text';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font, shadow, type Palette } from '../lib/theme';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: string;
}

export default function MetricCard({ label, value, unit, icon, accent = colors.primary }: Props) {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
    </View>
  );
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
    minWidth: '45%',
    ...shadow.sm,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  label: {
    color: colors.textMuted,
    fontSize: font.xs,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  value: { fontSize: font.xl, fontWeight: '700', lineHeight: 28 },
  unit: { color: colors.textDim, fontSize: font.sm, marginBottom: 2 },
});
