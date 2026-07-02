import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ios } from '../lib/theme';
import { listRecords, type ScanRecord } from '../lib/storage';
import { checkHealth, fetchCloudAnimals, getCachedCloudAnimals, type CloudAnimal } from '../lib/api';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const RING_RADIUS = 32;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [cloud, setCloud] = useState<CloudAnimal[]>([]);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Cache primeiro (instantâneo), depois atualiza em 2º plano.
    const cached = await getCachedCloudAnimals();
    if (cached.length) setCloud(cached);
    const [recs, health] = await Promise.all([listRecords(), checkHealth()]);
    setRecords(recs);
    setBackendOk(health);
    try { setCloud(await fetchCloudAnimals()); } catch { /* mantém o cache em falha de rede */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const cows = records.filter(r => r.category === 'cow');
  const totalAnimals = [...new Set(cows.map(r => r.animalId).filter(Boolean))].length;
  const avgGirth = records.length
    ? Math.round(records.reduce((s, r) => s + r.measurements.chest_girth_cm, 0) / records.length)
    : 0;
  const cowPct = records.length ? Math.round((cows.length / records.length) * 100) : 0;

  const cloudCount = cloud.length;
  const cloudWeights = cloud.map(c => c.weightKg).filter((w): w is number => w != null);
  const cloudMeanKg = cloudWeights.length
    ? Math.round(cloudWeights.reduce((a, b) => a + b, 0) / cloudWeights.length)
    : 0;

  // Métrica-título: peso (produto) quando há animais na nuvem; senão, perímetro local.
  const hasCloud = cloudCount > 0;
  const heroLabel = hasCloud ? 'Peso médio' : 'Perímetro torácico médio';
  const heroValue = hasCloud ? (cloudMeanKg > 0 ? String(cloudMeanKg) : '—')
                             : (avgGirth > 0 ? String(avgGirth) : '—');
  const heroUnit = hasCloud ? 'kg' : 'cm';
  // Rosca: % de animais com peso estimado (nuvem) ou % de vacas (local).
  const ringPct = Math.min(100, Math.max(0,
    hasCloud ? (cloudCount ? Math.round((cloudWeights.length / cloudCount) * 100) : 0) : cowPct));
  const ringOffset = RING_CIRC - (ringPct / 100) * RING_CIRC;

  const today = records.slice(0, 5);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ios.accent} />}
    >
      <View style={[styles.largeTitle, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>PondiFarm</Text>
          <Text style={styles.subtitle}>
            {backendOk === null
              ? 'Limousine pilot · loading'
              : backendOk
                ? 'Limousine pilot · online'
                : 'Limousine pilot · offline'}
          </Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>TC</Text>
        </View>
      </View>

      <View style={styles.group}>
        <View style={styles.card}>
          <View style={styles.hero}>
            <View style={styles.heroLeft}>
              <View style={styles.eyebrow}>
                <Ionicons name="layers-outline" size={14} color={ios.accent} />
                <Text style={styles.eyebrowText}>{heroLabel}</Text>
              </View>
              <View style={styles.valueRow}>
                <Text style={styles.value}>{heroValue}</Text>
                <Text style={styles.valueUnit}>{heroUnit}</Text>
              </View>
              <Text style={styles.delta}>
                {hasCloud
                  ? `${cloudCount} ${cloudCount === 1 ? 'animal' : 'animais'} no rebanho`
                  : records.length > 0
                    ? `${records.length} scan${records.length !== 1 ? 's' : ''} locais`
                    : 'Sem scans ainda · capture um para começar'}
              </Text>
            </View>
            <View style={styles.ringWrap}>
              <Svg width={78} height={78}>
                <Circle cx={39} cy={39} r={RING_RADIUS} stroke="#E5E5EA" strokeWidth={8} fill="none" />
                <Circle
                  cx={39} cy={39} r={RING_RADIUS}
                  stroke={ios.accent} strokeWidth={8} fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${RING_CIRC}`}
                  strokeDashoffset={ringOffset}
                  rotation={-90} originX={39} originY={39}
                />
              </Svg>
              <View style={styles.ringLabel} pointerEvents="none">
                <Text style={styles.ringPct}>{ringPct}%</Text>
              </View>
            </View>
          </View>

          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{totalAnimals + cloudCount}</Text>
              <Text style={styles.tileLabel}>animais</Text>
            </View>
            <View style={[styles.tile, styles.tileDivider]}>
              <Text style={styles.tileValue}>{records.length}</Text>
              <Text style={styles.tileLabel}>scans locais</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{hasCloud && cloudMeanKg > 0 ? cloudMeanKg : '—'}</Text>
              <Text style={styles.tileLabel}>peso méd (kg)</Text>
            </View>
          </View>

          {cloudCount > 0 && (
            <View style={styles.cloudLine}>
              <Ionicons name="cloud-outline" size={13} color={ios.accent} />
              <Text style={styles.cloudLineText}>
                {cloudCount} na nuvem{cloudMeanKg > 0 ? ` · média ${cloudMeanKg} kg` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {today.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupHeader}>Today</Text>
          <View style={styles.card}>
            {today.map((rec, i) => {
              const isCow = rec.category === 'cow';
              return (
              <TouchableOpacity
                key={rec.id}
                style={[styles.row, i < today.length - 1 && styles.rowDivider]}
                onPress={() => nav.navigate('Result', { record: rec })}
                activeOpacity={0.6}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={isCow ? 'paw' : 'cube-outline'} size={16} color={ios.accent} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowId}>
                    {isCow ? (rec.animalId ?? 'Bovino') : 'Extra'}
                  </Text>
                  <Text style={styles.rowMeta}>
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
                <Text style={styles.rowChevron}>›</Text>
              </TouchableOpacity>
            );
            })}
          </View>
        </View>
      )}

      {today.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="layers-outline" size={36} color={ios.tertiaryLabel} />
          <Text style={styles.emptyTitle}>Nothing logged yet</Text>
          <Text style={styles.emptySub}>Tap “New scan” to record the first measurement</Text>
        </View>
      )}

      <TouchableOpacity style={styles.cta} onPress={() => nav.navigate('Scan')} activeOpacity={0.85}>
        <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
        <Text style={styles.ctaText}>New scan</Text>
      </TouchableOpacity>
      {/* Studio 3D (Object Capture) escondido — fotogrametria lenta + crashes de GPU
          em background. Foco no LiDAR nativo (Caminho B). Código mantido para revisão. */}
    </ScrollView>
  );
}

const displayFont = Platform.select({
  ios: 'System',
  android: undefined,
  default: undefined,
});

const styles = StyleSheet.create({
  cloudLine: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingTop: 10, marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA',
  },
  cloudLineText: { fontSize: 12.5, color: '#8A8A8E', letterSpacing: -0.05 },
  scroll: { flex: 1, backgroundColor: ios.systemGroupedBackground },

  // Large title
  largeTitle: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  title: {
    fontFamily: displayFont,
    fontSize: 34, fontWeight: '700',
    letterSpacing: -0.95,
    color: ios.label,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 13, color: ios.tertiaryLabel,
    marginTop: 4, letterSpacing: -0.05,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: ios.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF', fontSize: 14, fontWeight: '600',
    letterSpacing: -0.2,
  },

  // Section grouping (iOS insetGrouped)
  group: { marginTop: 22, paddingHorizontal: 16 },
  groupHeader: {
    paddingHorizontal: 16, paddingBottom: 8,
    fontSize: 13, fontWeight: '400',
    color: ios.secondaryLabel,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 18, overflow: 'hidden',
  },

  // Hero
  hero: {
    paddingHorizontal: 22, paddingVertical: 22,
    flexDirection: 'row', alignItems: 'center', gap: 18,
  },
  heroLeft: { flex: 1 },
  eyebrow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 6,
  },
  eyebrowText: {
    fontSize: 13, fontWeight: '600',
    color: ios.accent, letterSpacing: -0.05,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: {
    fontFamily: displayFont,
    fontSize: 56, fontWeight: '700',
    lineHeight: 56, letterSpacing: -2.2,
    color: ios.label,
  },
  valueUnit: {
    fontFamily: displayFont,
    fontSize: 22, fontWeight: '500',
    color: ios.secondaryLabel, letterSpacing: -0.2,
  },
  delta: {
    fontSize: 13, color: ios.secondaryLabel,
    marginTop: 8, letterSpacing: -0.05,
  },
  deltaUp: { color: ios.accent, fontWeight: '600' },

  // Ring
  ringWrap: { width: 78, height: 78, position: 'relative' },
  ringLabel: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  ringPct: {
    fontFamily: displayFont,
    fontSize: 17, fontWeight: '700',
    letterSpacing: -0.4, color: ios.label,
  },

  // 3 tiles inside hero card
  tiles: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ios.separator,
  },
  tile: {
    flex: 1, alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 12, gap: 4,
  },
  tileDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: ios.separator,
  },
  tileValue: {
    fontFamily: displayFont,
    fontSize: 26, fontWeight: '700',
    letterSpacing: -0.65, color: ios.label,
  },
  tileLabel: {
    fontSize: 11, color: ios.secondaryLabel,
    letterSpacing: -0.05,
  },

  // Rows
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ios.separator,
  },
  rowIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: ios.accentLight,
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
  rowChevron: {
    fontSize: 20, color: ios.tertiaryLabel,
    marginLeft: 2,
  },

  // Empty
  empty: {
    marginTop: 22, marginHorizontal: 16, paddingVertical: 40,
    alignItems: 'center', gap: 10,
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 18,
  },
  emptyTitle: {
    fontSize: 17, fontWeight: '600',
    color: ios.label, letterSpacing: -0.3, marginTop: 4,
  },
  emptySub: {
    fontSize: 13, color: ios.secondaryLabel,
    textAlign: 'center', paddingHorizontal: 40,
  },

  // Primary CTA
  cta: {
    marginTop: 22, marginHorizontal: 16,
    backgroundColor: ios.label,
    borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17, fontWeight: '600',
    letterSpacing: -0.3,
  },
});
