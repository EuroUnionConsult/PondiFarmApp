import React, { useMemo } from 'react';
import {
  View, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import Text from './Text';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, font, type Palette } from '../lib/theme';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export default function GradientHeader({ title, subtitle, onBack, right }: Props) {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {right && <View style={styles.right}>{right}</View>}
      </View>
      <View style={styles.divider} />
    </View>
  );
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs, marginLeft: -spacing.xs },
  titleWrap: { flex: 1 },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  right: {},
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginHorizontal: -spacing.md,
  },
});
