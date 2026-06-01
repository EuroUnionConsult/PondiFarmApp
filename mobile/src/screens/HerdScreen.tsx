import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, TextInput, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ios } from '../lib/theme';
import { listRecords, deleteRecord, type ScanRecord } from '../lib/storage';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Section = { title: string; data: ScanRecord[] };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function groupRecords(records: ScanRecord[]): Section[] {
  const today = startOfDay(new Date()).getTime();
  const weekAgo = today - 6 * 24 * 60 * 60 * 1000;

  const buckets: { today: ScanRecord[]; week: ScanRecord[]; earlier: ScanRecord[] } = {
    today: [], week: [], earlier: [],
  };

  for (const r of records) {
    const t = new Date(r.scannedAt).getTime();
    if (t >= today) buckets.today.push(r);
    else if (t >= weekAgo) buckets.week.push(r);
    else buckets.earlier.push(r);
  }

  const sections: Section[] = [];
  if (buckets.today.length)   sections.push({ title: 'Today',     data: buckets.today });
  if (buckets.week.length)    sections.push({ title: 'This week', data: buckets.week });
  if (buckets.earlier.length) sections.push({ title: 'Earlier',   data: buckets.earlier });
  return sections;
}

export default function HerdScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setRecords(await listRecords());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(
    () => records.filter(r => {
      const q = query.toLowerCase().trim();
      if (!q) return true;
      return r.animal_id.toLowerCase().includes(q)
          || r.breed.toLowerCase().includes(q);
    }),
    [records, query]
  );

  const sections = useMemo(() => groupRecords(filtered), [filtered]);

  const handleLongPress = (rec: ScanRecord) => {
    Alert.alert(
      `Remove scan of ${rec.animal_id}?`,
      'This permanently deletes the scan from local storage. Backend data is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          await deleteRecord(rec.id);
          load();
        } },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.largeTitle, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Herd</Text>
          <Text style={styles.subtitle}>
            {filtered.length === records.length
              ? `${records.length} scan${records.length !== 1 ? 's' : ''}`
              : `${filtered.length} of ${records.length}`}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerAction} onPress={() => nav.navigate('Scan')} activeOpacity={0.6}>
          <Ionicons name="add" size={26} color={ios.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={16} color={ios.tertiaryLabel} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ID or breed"
            placeholderTextColor={ios.tertiaryLabel}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="paw-outline" size={36} color={ios.tertiaryLabel} />
          <Text style={styles.emptyTitle}>
            {query ? 'No matches' : 'No scans yet'}
          </Text>
          <Text style={styles.emptySub}>
            {query
              ? 'Try a different ID or breed.'
              : 'Tap + to record the first scan of the herd.'}
          </Text>
        </View>
      ) : (
        sections.map(section => (
          <View key={section.title}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            <View style={styles.card}>
              {section.data.map((rec, i) => (
                <View key={rec.id}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => nav.navigate('Result', { record: rec })}
                    onLongPress={() => handleLongPress(rec)}
                    delayLongPress={350}
                    activeOpacity={0.6}
                  >
                    <View style={[
                      styles.rowIcon,
                      { backgroundColor: rec.detection.is_real_animal ? ios.accentLight : '#FFF4D6' },
                    ]}>
                      <Ionicons
                        name={rec.detection.is_real_animal ? 'paw' : 'cube-outline'}
                        size={16}
                        color={rec.detection.is_real_animal ? ios.accent : '#B4641A'}
                      />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowId}>{rec.animal_id}</Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {rec.breed === 'default'
                          ? 'Unspecified breed'
                          : rec.breed.charAt(0).toUpperCase() + rec.breed.slice(1)}
                        {'  ·  '}
                        {new Date(rec.scannedAt).toLocaleString('pt-PT', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                        {'  ·  '}
                        {Math.round(rec.result.confidence_pct)}%
                      </Text>
                    </View>
                    <Text style={styles.rowWeight}>
                      {rec.result.estimated_weight_kg.toFixed(0)} kg
                    </Text>
                    <Text style={styles.rowChev}>›</Text>
                  </TouchableOpacity>
                  {i < section.data.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))}
            </View>
          </View>
        ))
      )}

      {sections.length > 0 && (
        <Text style={styles.footerHint}>
          Long-press a row to remove it.
        </Text>
      )}
    </ScrollView>
  );
}

const displayFont = Platform.select({ ios: 'System', android: undefined, default: undefined });

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: ios.systemGroupedBackground },

  // Large title
  largeTitle: {
    paddingHorizontal: 20, paddingBottom: 6,
    flexDirection: 'row', alignItems: 'flex-end',
  },
  title: {
    fontFamily: displayFont,
    fontSize: 34, fontWeight: '700',
    letterSpacing: -0.95, color: ios.label, lineHeight: 36,
  },
  subtitle: {
    fontSize: 13, color: ios.tertiaryLabel,
    marginTop: 4, letterSpacing: -0.05,
  },
  headerAction: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  // Search field iOS HIG
  searchWrap: { paddingHorizontal: 16, marginTop: 12, marginBottom: 4 },
  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E8E8EC',
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17, color: ios.label, letterSpacing: -0.3,
    padding: 0,
  },

  // Sections
  sectionHeader: {
    marginTop: 24, marginBottom: 8,
    paddingHorizontal: 32,
    fontSize: 13, fontWeight: '400',
    color: ios.secondaryLabel,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    minHeight: 60,
    paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  rowDivider: {
    marginLeft: 58,
    height: StyleSheet.hairlineWidth,
    backgroundColor: ios.separator,
  },
  rowIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowId: {
    fontSize: 16, fontWeight: '500',
    letterSpacing: -0.3, color: ios.label,
  },
  rowMeta: {
    fontSize: 13, color: ios.secondaryLabel,
    marginTop: 1, letterSpacing: -0.05,
  },
  rowWeight: {
    fontFamily: displayFont,
    fontSize: 17, fontWeight: '600',
    letterSpacing: -0.3, color: ios.label,
  },
  rowChev: {
    fontSize: 20, color: ios.tertiaryLabel,
    marginLeft: 2,
  },

  // Empty
  empty: {
    alignItems: 'center', gap: 8,
    paddingTop: 60, paddingBottom: 40, paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17, fontWeight: '600',
    color: ios.label, letterSpacing: -0.3, marginTop: 6,
  },
  emptySub: {
    fontSize: 13, color: ios.secondaryLabel,
    textAlign: 'center', letterSpacing: -0.05,
  },

  footerHint: {
    marginTop: 24, paddingHorizontal: 32,
    fontSize: 12, color: ios.tertiaryLabel,
    textAlign: 'center', letterSpacing: -0.05,
  },
});
