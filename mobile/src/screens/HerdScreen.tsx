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
import { listRecords, deleteRecord, effectiveSyncState, type ScanRecord } from '../lib/storage';
import { fetchCloudAnimals, getCachedCloudAnimals, type CloudAnimal } from '../lib/api';
import { syncPending } from '../lib/sync';
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
  const [cloud, setCloud] = useState<CloudAnimal[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const cached = await getCachedCloudAnimals();
    if (cached.length) setCloud(cached);   // instantâneo
    setRecords(await listRecords());
    try {
      setCloud(await fetchCloudAnimals());  // atualiza em 2º plano
    } catch {
      /* backend offline → mantém o cache (não zera a lista) */
    }
    // Reprocessa a fila de scans pendentes; se subiu algo, atualiza lista + nuvem.
    syncPending().then(async (r) => {
      if (r.synced > 0) {
        setRecords(await listRecords());
        fetchCloudAnimals().then(setCloud).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const cloudFiltered = useMemo(
    () => cloud.filter(c => {
      const q = query.toLowerCase().trim();
      if (!q) return true;
      return c.name.toLowerCase().includes(q)
          || c.breed.toLowerCase().includes(q)
          || (c.tagCode ?? '').toLowerCase().includes(q);
    }),
    [cloud, query]
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(
    () => records.filter(r => {
      const q = query.toLowerCase().trim();
      if (!q) return true;
      return (r.animalId ?? '').toLowerCase().includes(q)
          || (r.breed ?? '').toLowerCase().includes(q)
          || r.category.toLowerCase().includes(q);
    }),
    [records, query]
  );

  // I9: scans sincronizados aparecem na seção Nuvem — não repetir na lista local.
  const localForList = useMemo(
    () => filtered.filter(r => effectiveSyncState(r) !== 'synced'),
    [filtered],
  );
  const sections = useMemo(() => groupRecords(localForList), [localForList]);

  const handleLongPress = (rec: ScanRecord) => {
    const name = rec.category === 'cow' ? (rec.animalId ?? 'cattle') : 'extra';
    Alert.alert(
      `Remove scan of ${name}?`,
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
      contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.largeTitle, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Herd</Text>
          <Text style={styles.subtitle}>
            {(() => {
              // Dedup: scans sincronizados contam só na nuvem (não em dobro).
              const localVisible = records.filter(r => effectiveSyncState(r) !== 'synced').length;
              const total = localVisible + cloud.length;
              const shown = localForList.length + cloudFiltered.length;
              return shown === total
                ? `${total} ${total === 1 ? 'record' : 'records'}`
                : `${shown} of ${total}`;
            })()}
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
            placeholder="Search by ID, breed or category"
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

      {cloudFiltered.length > 0 && (
        <View>
          <Text style={styles.sectionHeader}>☁ Cloud · synced</Text>
          <View style={styles.card}>
            {cloudFiltered.map((c, i, arr) => (
              <View key={c.id}>
                <TouchableOpacity style={styles.row} onPress={() => nav.navigate('AnimalDetail', { animal: c })} activeOpacity={0.6}>
                  <View style={[styles.rowIcon, { backgroundColor: ios.accentLight }]}>
                    <Ionicons name="cloud-outline" size={16} color={ios.accent} />
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowId} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {c.breed || 'Breed n/a'}{c.tagCode ? '  ·  ' + c.tagCode : ''}
                    </Text>
                  </View>
                  <View style={styles.rowMetric}>
                    <Text style={styles.rowMetricValue}>
                      {c.weightKg != null ? c.weightKg.toFixed(0) : '—'}
                    </Text>
                    <Text style={styles.rowMetricUnit}>kg</Text>
                  </View>
                  <Text style={styles.rowChev}>›</Text>
                </TouchableOpacity>
                {i < arr.length - 1 && <View style={styles.rowDivider} />}
              </View>
            ))}
          </View>
        </View>
      )}

      {sections.length === 0 && cloudFiltered.length === 0 ? (
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
              {section.data.map((rec, i) => {
                const isCow = rec.category === 'cow';
                const breedLabel = !rec.breed || rec.breed === 'default'
                  ? 'Unspecified breed'
                  : rec.breed.charAt(0).toUpperCase() + rec.breed.slice(1);
                return (
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
                      { backgroundColor: isCow ? ios.accentLight : '#EFEFF4' },
                    ]}>
                      <Ionicons
                        name={isCow ? 'paw' : 'cube-outline'}
                        size={16}
                        color={isCow ? ios.accent : ios.secondaryLabel}
                      />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowId}>
                        {isCow ? (rec.animalId ?? 'Cattle') : 'Extra'}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {isCow ? breedLabel : 'Object / person'}
                        {'  ·  '}
                        {new Date(rec.scannedAt).toLocaleString('pt-PT', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <View style={styles.rowMetric}>
                      <Text style={styles.rowMetricValue}>
                        {rec.measurements.chest_girth_cm.toFixed(0)}
                      </Text>
                      <Text style={styles.rowMetricUnit}>cm girth</Text>
                    </View>
                    {isCow && effectiveSyncState(rec) !== 'synced' && (
                      <Ionicons
                        name={effectiveSyncState(rec) === 'error' ? 'alert-circle' : 'time-outline'}
                        size={15}
                        color={effectiveSyncState(rec) === 'error' ? ios.systemRed : ios.orange}
                      />
                    )}
                    <Text style={styles.rowChev}>›</Text>
                  </TouchableOpacity>
                  {i < section.data.length - 1 && <View style={styles.rowDivider} />}
                </View>
              );
              })}
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
  rowMetric: {
    alignItems: 'flex-end',
  },
  rowMetricValue: {
    fontFamily: displayFont,
    fontSize: 17, fontWeight: '600',
    letterSpacing: -0.3, color: ios.label,
  },
  rowMetricUnit: {
    fontSize: 11, color: ios.tertiaryLabel,
    letterSpacing: -0.05,
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
