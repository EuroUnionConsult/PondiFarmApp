import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ios } from '../lib/theme';
import type { RootStackParamList } from '../navigation/types';

type DetailRoute = RouteProp<RootStackParamList, 'AnimalDetail'>;

export default function AnimalDetailScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { animal } = useRoute<DetailRoute>().params;

  const measures: { label: string; value: string }[] = [
    animal.bodyLengthCm != null
      ? { label: 'Body length', value: `${animal.bodyLengthCm.toFixed(0)} cm` } : null,
    animal.withersHeightCm != null
      ? { label: 'Withers height', value: `${animal.withersHeightCm.toFixed(0)} cm` } : null,
    animal.breed ? { label: 'Breed', value: animal.breed } : null,
    animal.tagCode ? { label: 'Tag', value: animal.tagCode } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.back} onPress={() => nav.goBack()} activeOpacity={0.6}>
          <Ionicons name="chevron-back" size={26} color={ios.accent} />
          <Text style={styles.backText}>Herd</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{animal.name}</Text>
          <View style={styles.cloudTag}>
            <Ionicons name="cloud-done-outline" size={13} color={ios.accent} />
            <Text style={styles.cloudTagText}>Synced</Text>
          </View>
        </View>

        {/* Hero — peso estimado */}
        <View style={styles.group}>
          <View style={styles.card}>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>Estimated weight</Text>
              <View style={styles.valueRow}>
                <Text style={styles.value}>
                  {animal.weightKg != null ? animal.weightKg.toFixed(1) : '—'}
                </Text>
                <Text style={styles.valueUnit}>kg</Text>
              </View>
              <Text style={styles.heroMeta}>PondiFarm model estimate</Text>
            </View>
          </View>
        </View>

        {/* Medidas morfométricas */}
        {measures.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Measurements</Text>
            <View style={styles.card}>
              {measures.map((m, i) => (
                <View key={m.label}>
                  <View style={styles.row}>
                    <Text style={styles.rowKey}>{m.label}</Text>
                    <Text style={styles.rowVal}>{m.value}</Text>
                  </View>
                  {i < measures.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Notas */}
        {animal.notes ? (
          <>
            <Text style={styles.sectionHeader}>Notes</Text>
            <View style={styles.card}>
              <Text style={styles.notes}>{animal.notes}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const displayFont = Platform.select({ ios: 'System', android: undefined, default: undefined });

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: ios.systemGroupedBackground },
  header: { paddingHorizontal: 8, paddingBottom: 4 },
  back: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 17, color: ios.accent, letterSpacing: -0.3, marginLeft: -2 },
  scroll: { flex: 1 },

  titleWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4, gap: 8 },
  title: {
    fontFamily: displayFont,
    fontSize: 30, fontWeight: '700',
    letterSpacing: -0.8, color: ios.label, lineHeight: 34,
  },
  cloudTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: ios.accentLight, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  cloudTagText: { fontSize: 12.5, fontWeight: '600', color: ios.accent, letterSpacing: -0.05 },

  group: { marginTop: 18, paddingHorizontal: 16 },
  card: {
    marginHorizontal: 16,
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 16, overflow: 'hidden',
  },
  hero: { padding: 22, gap: 6 },
  eyebrow: { fontSize: 13, fontWeight: '600', color: ios.accent, letterSpacing: -0.05 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: {
    fontFamily: displayFont,
    fontSize: 56, fontWeight: '700',
    lineHeight: 56, letterSpacing: -2.2, color: ios.label,
  },
  valueUnit: {
    fontFamily: displayFont,
    fontSize: 22, fontWeight: '500', color: ios.secondaryLabel, letterSpacing: -0.2,
  },
  heroMeta: { fontSize: 13, color: ios.secondaryLabel, marginTop: 4, letterSpacing: -0.05 },

  sectionHeader: {
    marginTop: 26, marginBottom: 8, paddingHorizontal: 32,
    fontSize: 13, fontWeight: '400', color: ios.secondaryLabel,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  row: {
    minHeight: 44, paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  rowDivider: { marginLeft: 16, height: StyleSheet.hairlineWidth, backgroundColor: ios.separator },
  rowKey: { flex: 1, fontSize: 17, color: ios.label, letterSpacing: -0.3 },
  rowVal: {
    fontFamily: displayFont,
    fontSize: 17, fontWeight: '500', color: ios.secondaryLabel, letterSpacing: -0.3,
  },
  notes: {
    padding: 16, fontSize: 15, lineHeight: 21,
    color: ios.label, letterSpacing: -0.1,
  },
});
