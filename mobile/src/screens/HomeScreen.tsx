import React, { useCallback, useState, useMemo } from 'react';
import {
  View, Animated, StyleSheet, RefreshControl, Platform,
} from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import Text from '../components/Text';
import Wordmark from '../components/Wordmark';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Palette } from '../lib/theme';
import { listRecords, countPendingSync, type ScanRecord } from '../lib/storage';
import { estimateWeightKg } from '../lib/weightModel';
import { useAuth } from '../lib/AuthContext';
import { initials, loadProfile, type Profile } from '../lib/profile';
import ScreenBackground from '../components/ScreenBackground';
import CattleIcon from '../components/CattleIcon';
import { SkeletonRows } from '../components/Skeleton';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import PendingApprovalBanner from '../components/PendingApprovalBanner';
import CompactHeader, { useScrollY } from '../components/CompactHeader';
import { checkHealth, fetchCloudAnimals, getCachedCloudAnimals, type CloudAnimal } from '../lib/api';
import type { RootStackParamList } from '../navigation/types';
import SyncRing from '../components/SyncRing';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const RING_RADIUS = 32;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

export default function HomeScreen() {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [cloud, setCloud] = useState<CloudAnimal[]>([]);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  // Muda quando o Líder aprova, remove ou a pessoa troca de organização: o ecrã
  // aberto recarrega o rebanho sozinho (o useFocusEffect corre de novo).
  const access = `${user?.membershipStatus ?? ''}|${user?.organizationId ?? ''}`;
  const [profile, setProfile] = useState<Profile | null>(null);

  // Relido sempre que a Home volta a aparecer: o nome edita-se no Perfil.
  useFocusEffect(
    useCallback(() => {
      void loadProfile(user?.id).then(setProfile);
    }, [user?.id]),
  );

  const avatarInitials = initials(profile, user?.name);
  const { scrollY, onScroll } = useScrollY();

  const load = useCallback(async () => {
    // Cache primeiro (instantâneo), depois atualiza em 2º plano.
    const cached = await getCachedCloudAnimals();
    if (cached.length) { setCloud(cached); setCloudLoaded(true); }
    const [recs, health] = await Promise.all([listRecords(), checkHealth()]);
    setRecords(recs);
    setBackendOk(health);
    try { setCloud(await fetchCloudAnimals()); } catch { /* mantém o cache em falha de rede */ }
    finally { setCloudLoaded(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const cows = records.filter(r => r.category === 'cow');
  const totalAnimals = [...new Set(cows.map(r => r.animalId).filter(Boolean))].length;
  // Peso estimado de um scan local (o mesmo modelo que o sync envia para a nuvem).
  const localKg = (r: ScanRecord) => Math.round(estimateWeightKg(r.measurements, r.breed, r.animalCategory ?? 'unknown'));
  const localWeights = cows.map(localKg).filter(w => Number.isFinite(w) && w > 0);

  const cloudCount = cloud.length;
  const cloudWeights = cloud.map(c => c.weightKg).filter((w): w is number => w != null);
  const cloudMeanKg = cloudWeights.length
    ? Math.round(cloudWeights.reduce((a, b) => a + b, 0) / cloudWeights.length)
    : 0;

  // Headline metric: SEMPRE o peso (é o produto). Da nuvem quando há estimativas;
  // sem nuvem (à espera de aprovação, offline sem cache, ainda a carregar) usa a
  // estimativa dos scans deste telemóvel. Antes caía para o perímetro torácico e o
  // ecrã inicial passava a dizer «Mean chest girth» (relato do Valter, 23/10).
  const localMeanKg = localWeights.length
    ? Math.round(localWeights.reduce((a, b) => a + b, 0) / localWeights.length)
    : 0;
  const hasCloud = cloudCount > 0;
  const heroLabel = 'Mean weight';
  const heroKg = cloudMeanKg > 0 ? cloudMeanKg : localMeanKg;
  const heroValue = heroKg > 0 ? String(heroKg) : '—';
  const heroUnit = 'kg';
  const totalAnimalsUnified = totalAnimals + cloudCount;
  const pendingSync = countPendingSync(records);
  // Ring = sync progress of local scans (100% when nothing is waiting to upload).
  const ringPct = records.length
    ? Math.round(((records.length - pendingSync) / records.length) * 100)
    : 100;
  const ringOffset = RING_CIRC - (Math.min(100, Math.max(0, ringPct)) / 100) * RING_CIRC;

  const today = records.slice(0, 5);

  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground />
    <Animated.ScrollView
      style={[styles.scroll, { backgroundColor: 'transparent' }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ios.accent} />}
    >
      <View style={[styles.largeTitle, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Wordmark size={34} />
          <Text style={styles.subtitle}>
            {backendOk === null
              ? 'Limousine pilot · loading'
              : backendOk
                ? 'Limousine pilot · online'
                : 'Limousine pilot · offline'}
          </Text>
        </View>
        <SyncRing size={40}>
          <PressableScale
            style={styles.avatar}
            onPress={() => nav.navigate('Profile')}
            hitSlop={8}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
          >
            {avatarInitials ? (
              <Text style={styles.avatarText}>{avatarInitials}</Text>
            ) : (
              <Ionicons name="person" size={18} color="#FFFFFF" />
            )}
          </PressableScale>
        </SyncRing>
      </View>

      <PendingApprovalBanner />

      <FadeInView index={0} style={styles.group}>
        {/* Cartão SÓLIDO (como o «Today»): o vidro nativo do iOS 26 aqui ficava quase
            transparente e os círculos do fundo passavam por trás dos números. */}
        <View style={[styles.card, styles.heroGlass]}>
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
                {pendingSync > 0
                  ? `${pendingSync} scan${pendingSync !== 1 ? 's' : ''} pending sync`
                  : hasCloud
                    ? `${totalAnimalsUnified} animal${totalAnimalsUnified !== 1 ? 's' : ''} in herd · all synced`
                    : records.length > 0
                      ? `${records.length} scan${records.length !== 1 ? 's' : ''} · all synced`
                      : 'No scans yet · capture one to begin'}
              </Text>
            </View>
            <View style={styles.ringWrap}>
              <Svg width={78} height={78}>
                <Circle cx={39} cy={39} r={RING_RADIUS} stroke={ios.ringTrack} strokeWidth={8} fill="none" />
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
                <Text style={styles.ringCaption}>synced</Text>
              </View>
            </View>
          </View>

          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{totalAnimalsUnified}</Text>
              <Text style={styles.tileLabel}>animals</Text>
            </View>
            <View style={[styles.tile, styles.tileDivider]}>
              <Text style={[styles.tileValue, pendingSync > 0 && { color: ios.orange }]}>{pendingSync}</Text>
              <Text style={styles.tileLabel}>pending sync</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{records.length}</Text>
              <Text style={styles.tileLabel}>local scans</Text>
            </View>
          </View>
        </View>
      </FadeInView>

      {today.length > 0 && (
        <FadeInView index={1} style={styles.group}>
          <Text style={styles.groupHeader}>Today</Text>
          <View style={styles.card}>
            {today.map((rec, i) => {
              const isCow = rec.category === 'cow';
              return (
              <PressableScale
                key={rec.id}
                style={[styles.row, i < today.length - 1 && styles.rowDivider]}
                onPress={() => nav.navigate('Result', { record: rec })}
                scaleTo={0.985}
                accessibilityRole="button"
              >
                <View style={styles.rowIcon}>
                  {isCow ? <CattleIcon size={18} color={ios.accent} /> : <Ionicons name="cube-outline" size={16} color={ios.accent} />}
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowId}>
                    {isCow ? (rec.animalId ?? 'Cattle') : 'Extra'}
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
                    {isCow ? localKg(rec) : '—'}
                  </Text>
                  <Text style={styles.rowMetricUnit}>kg</Text>
                </View>
                <Text style={styles.rowChevron}>›</Text>
              </PressableScale>
            );
            })}
          </View>
        </FadeInView>
      )}

      {/* A carregar o rebanho pela primeira vez: a forma da lista a pulsar. */}
      {today.length === 0 && !cloudLoaded && (
        <FadeInView index={1} style={styles.group}>
          <Text style={styles.groupHeader}>Latest records</Text>
          <View style={styles.card}><SkeletonRows n={4} /></View>
        </FadeInView>
      )}

      {/* Sem scans feitos neste telemóvel: mostra os últimos animais da organização. */}
      {today.length === 0 && cloudLoaded && cloud.length > 0 && (
        <FadeInView index={1} style={styles.group}>
          <Text style={styles.groupHeader}>Latest records</Text>
          <View style={styles.card}>
            {cloud.slice(0, 5).map((c, i, arr) => (
              <PressableScale
                key={c.id}
                style={[styles.row, i < arr.length - 1 && styles.rowDivider]}
                onPress={() => nav.navigate('AnimalDetail', { animal: c })}
                scaleTo={0.985}
                accessibilityRole="button"
              >
                <View style={styles.rowIcon}><CattleIcon size={18} color={ios.accent} /></View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowId} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>{[c.breed, c.tagCode].filter(Boolean).join(' · ')}</Text>
                </View>
                <View style={styles.rowMetric}>
                  <Text style={styles.rowMetricValue}>{c.weightKg != null ? Math.round(c.weightKg) : '—'}</Text>
                  <Text style={styles.rowMetricUnit}>kg</Text>
                </View>
                <Text style={styles.rowChevron}>›</Text>
              </PressableScale>
            ))}
          </View>
        </FadeInView>
      )}

      {today.length === 0 && cloudLoaded && cloud.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="layers-outline" size={36} color={ios.tertiaryLabel} />
          <Text style={styles.emptyTitle}>Nothing logged yet</Text>
          <Text style={styles.emptySub}>Tap “New scan” to record the first measurement</Text>
        </View>
      )}

      <FadeInView index={2}>
        <PressableScale style={styles.cta} onPress={() => nav.navigate('Scan')} haptic accessibilityRole="button">
          <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
          <Text style={styles.ctaText}>New scan</Text>
        </PressableScale>
      </FadeInView>
      {/* Studio 3D (Object Capture) escondido — fotogrametria lenta + crashes de GPU
          em background. Foco no LiDAR nativo (Caminho B). Código mantido para revisão. */}
    </Animated.ScrollView>
      <CompactHeader title="PondiFarm" scrollY={scrollY} />
    </View>
  );
}

const displayFont = Platform.select({
  ios: 'System',
  android: undefined,
  default: undefined,
});

const makeStyles = (ios: Palette) => StyleSheet.create({
  cloudLine: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingTop: 10, marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator,
  },
  cloudLineText: { fontSize: 12.5, color: ios.secondaryLabel, letterSpacing: -0.05 },
  scroll: { flex: 1, backgroundColor: ios.systemGroupedBackground },

  // Large title
  largeTitle: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  subtitle: {
    fontSize: 13, color: ios.tertiaryLabel,
    marginTop: 4, letterSpacing: -0.05,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: ios.accentFill,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '700',
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
  heroGlass: { borderRadius: 18, overflow: 'hidden' },

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
    color: ios.accentDark, letterSpacing: -0.05,
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
  ringCaption: {
    fontSize: 9, color: ios.secondaryLabel,
    letterSpacing: 0.2, textTransform: 'uppercase', marginTop: 1,
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

  // Primary CTA — verde sólido (padrão único de ação primária no app; Fable)
  cta: {
    marginTop: 22, marginHorizontal: 16,
    backgroundColor: ios.accentFill,
    borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: ios.accent, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17, fontWeight: '600',
    letterSpacing: -0.3,
  },
});
