import React, { useState, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Alert, TextInput, Platform, Animated, RefreshControl,
  type SectionListRenderItemInfo,
} from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import Text from '../components/Text';
import CompactHeader, { useScrollY } from '../components/CompactHeader';
import PressableScale from '../components/PressableScale';
import PendingApprovalBanner from '../components/PendingApprovalBanner';
import { breedLabel } from '../lib/breeds';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fonts, type Palette } from '../lib/theme';
import { estimateWeightKg } from '../lib/weightModel';
import { listRecords, deleteRecord, effectiveSyncState, type ScanRecord } from '../lib/storage';
import { useAuth } from '../lib/AuthContext';
import { fetchCloudAnimals, getCachedCloudSnapshot, staleDataLabel, type CloudAnimal } from '../lib/api';
import { syncPending } from '../lib/sync';
import ScreenBackground from '../components/ScreenBackground';
import CattleIcon from '../components/CattleIcon';
import { SkeletonRows } from '../components/Skeleton';
import type { RootStackParamList } from '../navigation/types';
import EmptyState, { EMPTY_HINT_NATIVE, EMPTY_HINT_WEB } from '../components/EmptyState';
import RefreshLoader, { REFRESH_TINT } from '../components/RefreshLoader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Section = { title: string; data: ScanRecord[] };
type ListItem = { kind: 'cloud'; c: CloudAnimal } | { kind: 'local'; rec: ScanRecord };
type ListSection = { key: string; title: string; data: ListItem[] };

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
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollY();
  const nav = useNavigation<Nav>();
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [cloud, setCloud] = useState<CloudAnimal[]>([]);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  // Distingue "não há nada para mostrar" de "não consegui perguntar". Sem isto,
  // um servidor inacessível e um rebanho vazio são o mesmo ecrã em branco, e o
  // utilizador conclui que perdeu os animais.
  const [cloudOffline, setCloudOffline] = useState(false);
  // Hora da cópia guardada que está a ser mostrada.
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  // Recarrega o ecrã aberto quando muda o acesso (aprovado, removido, outra organização).
  const { user } = useAuth();
  const access = `${user?.membershipStatus ?? ''}|${user?.organizationId ?? ''}`;
  const load = useCallback(async () => {
    const cached = await getCachedCloudSnapshot();
    if (cached?.animals.length) { setCloud(cached.animals); setCloudLoaded(true); setCachedAt(cached.at); }   // instantâneo
    setRecords(await listRecords());
    try {
      setCloud(await fetchCloudAnimals());  // atualiza em 2º plano
      setCloudOffline(false);
    } catch {
      // Backend inacessível: mantém o cache em vez de esvaziar a lista, e
      // assinala-o, para o ecrã poder dizer que está desactualizado.
      setCloudOffline(true);
    } finally {
      setCloudLoaded(true);
    }
    // Reprocessa a fila de scans pendentes; se subiu algo, atualiza lista + nuvem.
    syncPending().then(async (r) => {
      if (r.synced > 0) {
        setRecords(await listRecords());
        fetchCloudAnimals().then(setCloud).catch(() => {});
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  const cloudFiltered = useMemo(
    () => cloud.filter(c => {
      const q = query.toLowerCase().trim();
      if (!q) return true;
      return c.name.toLowerCase().includes(q)
          || breedLabel(c.breed).toLowerCase().includes(q)
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
          || breedLabel(r.breed).toLowerCase().includes(q)
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

  const handleLongPress = useCallback((rec: ScanRecord) => {
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
  }, [load]);

  // Linhas da lista: a nuvem primeiro, depois os scans locais por data. Uma só
  // SectionList virtualizada: com ~300 animais só se desenham as linhas à vista.
  const listSections = useMemo<ListSection[]>(() => {
    const out: ListSection[] = [];
    if (cloudFiltered.length) {
      out.push({ key: 'cloud', title: '☁ Cloud · synced', data: cloudFiltered.map((c) => ({ kind: 'cloud', c })) });
    }
    for (const sec of sections) {
      out.push({ key: sec.title, title: sec.title, data: sec.data.map((rec) => ({ kind: 'local', rec })) });
    }
    return out;
  }, [cloudFiltered, sections]);

  const renderItem = useCallback(({ item, index, section }: SectionListRenderItemInfo<ListItem, ListSection>) => {
    const first = index === 0;
    const last = index === section.data.length - 1;
    // O cartão arredondado de cada secção é feito pelas próprias linhas (1.ª e última).
    const cardStyle = [styles.cardRow, first && styles.cardFirst, last && styles.cardLast];
    if (item.kind === 'cloud') {
      const c = item.c;
      return (
        <View style={cardStyle}>
          <PressableScale style={styles.row} onPress={() => nav.navigate('AnimalDetail', { animal: c })} scaleTo={0.985} accessibilityRole="button">
            <View style={[styles.rowIcon, { backgroundColor: ios.accentLight }]}>
              <Ionicons name="cloud-outline" size={16} color={ios.accent} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowId} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {c.breed ? breedLabel(c.breed) : 'Breed n/a'}{c.tagCode ? '  ·  ' + c.tagCode : ''}
              </Text>
            </View>
            <View style={styles.rowMetric}>
              <Text style={styles.rowMetricValue}>
                {c.weightKg != null ? c.weightKg.toFixed(0) : '—'}
              </Text>
              <Text style={styles.rowMetricUnit}>kg</Text>
            </View>
            <Text style={styles.rowChev}>›</Text>
          </PressableScale>
          {!last && <View style={styles.rowDivider} />}
        </View>
      );
    }
    const rec = item.rec;
    const isCow = rec.category === 'cow';
    const recBreed = !rec.breed || rec.breed === 'default'
      ? 'Unspecified breed'
      : breedLabel(rec.breed);
    return (
      <View style={cardStyle}>
        <PressableScale
          style={styles.row}
          onPress={() => nav.navigate('Result', { record: rec })}
          onLongPress={() => handleLongPress(rec)}
          delayLongPress={350}
          scaleTo={0.985}
        >
          <View style={[
            styles.rowIcon,
            { backgroundColor: isCow ? ios.accentLight : ios.segmentFill },
          ]}>
            {isCow
              ? <CattleIcon size={18} color={ios.accent} />
              : <Ionicons name="cube-outline" size={16} color={ios.secondaryLabel} />}
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowId} numberOfLines={1}>
              {isCow ? (rec.animalId ?? 'Cattle') : 'Extra'}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {isCow ? recBreed : 'Object / person'}
              {'  ·  '}
              {new Date(rec.scannedAt).toLocaleString('pt-PT', {
                day: '2-digit', month: 'short',
                hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.rowMetric}>
            <Text style={styles.rowMetricValue}>
              {isCow ? Math.round(estimateWeightKg(rec.measurements, rec.breed, rec.animalCategory ?? 'unknown')) : '—'}
            </Text>
            <Text style={styles.rowMetricUnit}>kg</Text>
          </View>
          {isCow && effectiveSyncState(rec) !== 'synced' && (
            <Ionicons
              name={effectiveSyncState(rec) === 'error' ? 'alert-circle' : 'time-outline'}
              size={15}
              color={effectiveSyncState(rec) === 'error' ? ios.systemRed : ios.orange}
            />
          )}
          <Text style={styles.rowChev}>›</Text>
        </PressableScale>
        {!last && <View style={styles.rowDivider} />}
      </View>
    );
  }, [styles, ios, nav, handleLongPress]);

  const renderSectionHeader = useCallback(({ section }: { section: ListSection }) => (
    <Text style={styles.sectionHeader}>{section.title}</Text>
  ), [styles]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  // Elemento (não componente): a caixa de pesquisa não perde o foco a cada letra.
  const header = (
    <>
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
        {Platform.OS !== 'web' && (
          <TouchableOpacity style={styles.headerAction} onPress={() => nav.navigate('Scan')} activeOpacity={0.6}>
            <Ionicons name="add" size={26} color={ios.accent} />
          </TouchableOpacity>
        )}
      </View>

      <PendingApprovalBanner />

      {cloudOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={15} color={ios.secondaryLabel} />
          <Text style={styles.offlineText}>
            {cachedAt !== null ? staleDataLabel(cachedAt) : 'The server could not be reached.'}
          </Text>
        </View>
      )}

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
    </>
  );

  const empty = !cloudLoaded ? (
    <View style={[styles.card, { marginHorizontal: 16, marginTop: 8 }]}><SkeletonRows n={6} /></View>
  ) : (
    <EmptyState
      style={{ paddingTop: 48 }}
      title={query ? 'No results' : 'No animals yet'}
      text={query ? 'Try a different ID or breed.' : Platform.OS === 'web' ? EMPTY_HINT_WEB : EMPTY_HINT_NATIVE}
      action={!query && Platform.OS !== 'web' ? { label: 'New scan', icon: 'scan-outline', onPress: () => nav.navigate('Scan') } : undefined}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground />
      <Animated.SectionList<ListItem, ListSection>
        sections={listSections}
        keyExtractor={(item) => (item.kind === 'cloud' ? `c-${item.c.id}` : `l-${item.rec.id}`)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={sections.length > 0 ? (
          <Text style={styles.footerHint}>
            Long-press a row to remove it.
          </Text>
        ) : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={REFRESH_TINT} />}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={[styles.scroll, { backgroundColor: 'transparent' }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // iPhone: só as linhas perto do ecrã (memória e arranque). Web: abre com 14
        // linhas e completa o resto em lotes logo a seguir; no browser, montar linhas
        // durante o scroll custava mais do que tê-las já no DOM (medido a 4× CPU).
        initialNumToRender={14}
        maxToRenderPerBatch={Platform.OS === 'web' ? 60 : 12}
        windowSize={Platform.OS === 'web' ? 201 : 9}
      />
      {/* Puxar para atualizar: o PondiLoader no lugar do spinner do sistema. */}
      <RefreshLoader scrollY={scrollY} refreshing={refreshing} top={insets.top} />
      <CompactHeader title="Herd" scrollY={scrollY} />
    </View>
  );
}

const displayFont = Platform.select({ ios: 'System', android: undefined, default: undefined });

const makeStyles = (ios: Palette) => StyleSheet.create({
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
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: ios.tertiarySystemGroupedBackground, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: ios.separator,
  },
  offlineText: { flex: 1, fontSize: 12.5, color: ios.secondaryLabel, lineHeight: 17 },

  searchWrap: { paddingHorizontal: 16, marginTop: 12, marginBottom: 4 },
  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ios.segmentFill,
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  searchInput: {
    fontFamily: fonts.regular,
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
  // Cada linha é um bocado do cartão: fundo + margens; a 1.ª e a última arredondam.
  cardRow: {
    marginHorizontal: 16,
    backgroundColor: ios.secondarySystemGroupedBackground,
    overflow: 'hidden',
  },
  cardFirst: { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  cardLast: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
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
