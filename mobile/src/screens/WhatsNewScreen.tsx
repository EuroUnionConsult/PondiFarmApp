import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import Text from '../components/Text';
import CompactHeader, { useScrollY } from '../components/CompactHeader';
import ScreenBackground from '../components/ScreenBackground';
import CattleIcon from '../components/CattleIcon';
import { APP_VERSION } from '../lib/version';
import { AREAS, byArea, markWhatsNewSeen, whatsNewFor, type WhatsNewArea } from '../lib/whatsNew';

// «What's new» — conceito C «Árvore por área» (aprovado a 23/11/2026). Um cartão por
// área com uma linha de ramo à esquerda; cada novidade leva o selo da versão: verde
// para a versão instalada, azul-marinho claro para as anteriores. Dados em lib/whatsNew.ts.

type Filter = 'all' | WhatsNewArea;

export function AreaIcon({ area, color, size = 18 }: { area: WhatsNewArea; color: string; size?: number }) {
  if (area === 'herd') return <CattleIcon size={size} color={color} />;
  const name: keyof typeof Ionicons.glyphMap =
    area === 'scan' ? 'scan-outline' : area === 'weather' ? 'partly-sunny-outline' : 'people-outline';
  return <Ionicons name={name} size={size} color={color} />;
}

export default function WhatsNewScreen() {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { scrollY, onScroll } = useScrollY();
  const [filter, setFilter] = useState<Filter>('all');

  // Abrir o ecrã conta como «visto»: o ponto verde das Settings desaparece.
  useEffect(() => { void markWhatsNewSeen(); }, []);

  const items = useMemo(() => whatsNewFor(APP_VERSION), []);
  const areas = AREAS.filter((a) => (filter === 'all' || a.key === filter) && byArea(items, a.key).length > 0);
  const chips: { key: Filter; label: string }[] = [{ key: 'all', label: 'All' }, ...AREAS];

  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        <View style={[styles.largeTitle, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.back} onPress={() => nav.goBack()} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chevron-back" size={22} color={ios.accent} />
            <Text style={styles.backText}>Settings</Text>
          </TouchableOpacity>
          <Text style={styles.title} accessibilityRole="header">What's new</Text>
          <Text style={styles.subtitle}>You have version {APP_VERSION}</Text>
        </View>

        <View style={styles.chips} accessibilityRole="tablist">
          {chips.map((c) => {
            const on = filter === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setFilter(c.key)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {areas.map((a) => (
          <View key={a.key} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.areaIcon}><AreaIcon area={a.key} color={ios.accent} /></View>
              <Text style={styles.cardTitle}>{a.label}</Text>
            </View>
            <View style={styles.branch}>
              {byArea(items, a.key).map((it, i) => {
                const isNew = it.version === APP_VERSION;
                return (
                  <View key={`${it.version}-${i}`} style={styles.item}>
                    <View style={styles.twig} />
                    <View style={[styles.badge, isNew ? styles.badgeNew : styles.badgeOld]}>
                      <Text style={[styles.badgeText, isNew ? styles.badgeTextNew : styles.badgeTextOld]}>{it.version}</Text>
                    </View>
                    <Text style={styles.itemText}>{it.text}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: '#2D7D46' }]} />
          <Text style={styles.footnote}>Green = new in your version</Text>
        </View>
      </Animated.ScrollView>
      <CompactHeader title="What's new" scrollY={scrollY} />
    </View>
  );
}

const displayFont = Platform.select({ ios: 'System', android: undefined, default: undefined });

const makeStyles = (ios: Palette) => StyleSheet.create({
  largeTitle: { paddingHorizontal: 20, paddingBottom: 4 },
  back: { flexDirection: 'row', alignItems: 'center', marginLeft: -10, minHeight: 44, alignSelf: 'flex-start' },
  backText: { color: ios.accent, fontSize: 17 },
  title: {
    fontFamily: displayFont,
    fontSize: 34, fontWeight: '700',
    letterSpacing: -0.95, color: ios.label, lineHeight: 36,
  },
  subtitle: { marginTop: 4, fontSize: 15, color: ios.secondaryLabel },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 16, marginBottom: 4 },
  chip: {
    minHeight: 36, paddingHorizontal: 14, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: ios.segmentFill,
  },
  chipOn: { backgroundColor: ios.accentFill },
  chipLabel: { fontSize: 14, color: ios.label, fontWeight: '500' },
  chipLabelOn: { color: '#FFFFFF', fontWeight: '600' },

  card: {
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  areaIcon: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: ios.accentLight,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: ios.label, letterSpacing: -0.3 },

  // Ramo: a linha à esquerda liga as novidades da área, como numa árvore.
  branch: {
    marginTop: 10, marginLeft: 14,
    borderLeftWidth: 2, borderLeftColor: ios.separator,
    paddingVertical: 2, gap: 10,
  },
  item: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: 2 },
  twig: { width: 10, height: 2, marginTop: 10, backgroundColor: ios.separator },
  // Largura mínima igual para todos os selos: os textos ficam alinhados.
  badge: { minWidth: 52, alignItems: 'center', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 6, marginTop: 1, flexShrink: 0 },
  badgeNew: { backgroundColor: '#2D7D46' },
  badgeOld: { backgroundColor: ios.isDark ? 'rgba(141,179,216,0.16)' : '#E3EBF3' },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.1 },
  badgeTextNew: { color: '#FFFFFF' },
  badgeTextOld: { color: ios.isDark ? '#8DB3D8' : '#1B3A57' },
  itemText: { flex: 1, marginLeft: 8, fontSize: 15, lineHeight: 20, color: ios.label, letterSpacing: -0.2 },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 32, marginTop: 16 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  footnote: { fontSize: 13, color: ios.secondaryLabel },
});
