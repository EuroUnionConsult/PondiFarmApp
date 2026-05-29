import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font, shadow } from '../lib/theme';
import { listRecords, type ScanRecord } from '../lib/storage';
import { checkHealth } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [recs, health] = await Promise.all([listRecords(), checkHealth()]);
    setRecords(recs);
    setBackendOk(health);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const lastScan = records[0];
  const totalAnimals = [...new Set(records.map(r => r.animal_id))].length;
  const avgWeight = records.length
    ? Math.round(records.reduce((s, r) => s + r.result.estimated_weight_kg, 0) / records.length)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View>
          <Text style={styles.greeting}>BoviScan</Text>
          <Text style={styles.subtitle}>Fase 0 — Demo</Text>
        </View>
        <View style={[
          styles.statusPill,
          { backgroundColor: backendOk ? colors.primaryLight : backendOk === null ? colors.warningLight : colors.dangerLight }
        ]}>
          <View style={[styles.statusDot, {
            backgroundColor: backendOk === null ? colors.warning : backendOk ? colors.primary : colors.danger
          }]} />
          <Text style={[styles.statusLabel, {
            color: backendOk === null ? colors.warning : backendOk ? colors.primary : colors.danger
          }]}>
            {backendOk === null ? 'verificando' : backendOk ? 'API online' : 'API offline'}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* Scan CTA */}
        <TouchableOpacity style={styles.scanCta} onPress={() => nav.navigate('Scan')} activeOpacity={0.85}>
          <View style={styles.scanIconWrap}>
            <Ionicons name="scan" size={28} color={colors.primary} />
          </View>
          <View style={styles.scanText}>
            <Text style={styles.scanTitle}>Novo Scan</Text>
            <Text style={styles.scanDesc}>Capture o animal e obtenha o peso estimado</Text>
          </View>
          <View style={styles.scanArrow}>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{records.length}</Text>
            <Text style={styles.statLabel}>Scans</Text>
          </View>
          <View style={[styles.statCard, styles.statCardMiddle]}>
            <Text style={styles.statValue}>{totalAnimals}</Text>
            <Text style={styles.statLabel}>Animais</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.secondary }]}>
              {avgWeight > 0 ? `${avgWeight}` : '—'}
            </Text>
            <Text style={styles.statLabel}>{avgWeight > 0 ? 'kg médio' : 'sem dados'}</Text>
          </View>
        </View>

        {/* Last scan */}
        {lastScan && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Último Scan</Text>
            <TouchableOpacity
              style={styles.lastScanCard}
              onPress={() => nav.navigate('Result', { record: lastScan })}
              activeOpacity={0.8}
            >
              <View style={styles.lastScanLeft}>
                <View style={styles.lastScanIcon}>
                  <Ionicons name="paw" size={22} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.lastScanId}>{lastScan.animal_id}</Text>
                  <Text style={styles.lastScanDate}>
                    {new Date(lastScan.scannedAt).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                </View>
              </View>
              <View style={styles.lastScanRight}>
                <Text style={styles.lastScanWeight}>{lastScan.result.estimated_weight_kg.toFixed(0)} kg</Text>
                <StatusBadge
                  label={`${Math.round(lastScan.result.confidence_pct)}%`}
                  variant={lastScan.result.confidence_pct >= 85 ? 'success' : 'warning'}
                />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent list */}
        {records.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Histórico</Text>
              <TouchableOpacity onPress={() => (nav as any).navigate('Main', { screen: 'Herd' })}>
                <Text style={styles.seeAll}>Ver todos →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.listCard}>
              {records.slice(0, 5).map((rec, i) => (
                <TouchableOpacity
                  key={rec.id}
                  style={[styles.listRow, i < Math.min(records.length, 5) - 1 && styles.listRowBorder]}
                  onPress={() => nav.navigate('Result', { record: rec })}
                >
                  <View style={[styles.listDot, { backgroundColor: rec.detection.is_real_animal ? colors.primary : colors.warning }]} />
                  <View style={styles.listInfo}>
                    <Text style={styles.listId}>{rec.animal_id}</Text>
                    <Text style={styles.listDate}>{new Date(rec.scannedAt).toLocaleDateString('pt-BR')}</Text>
                  </View>
                  <Text style={styles.listWeight}>{rec.result.estimated_weight_kg.toFixed(0)} kg</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {records.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="analytics-outline" size={36} color={colors.textDim} />
            </View>
            <Text style={styles.emptyText}>Nenhum scan ainda</Text>
            <Text style={styles.emptySubText}>Capture a foto de um animal para começar</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  greeting: { color: colors.text, fontSize: font.xl, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.full,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: font.xs, fontWeight: '600' },
  body: { padding: spacing.md, gap: spacing.md },
  scanCta: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadow.md,
  },
  scanIconWrap: {
    width: 52, height: 52, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  scanText: { flex: 1 },
  scanTitle: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  scanDesc: { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  scanArrow: {
    width: 28, height: 28, borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  statCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, gap: 3,
  },
  statCardMiddle: {
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border,
  },
  statValue: { color: colors.primary, fontSize: font.xl, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: font.xs, textTransform: 'uppercase', letterSpacing: 0.4 },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  seeAll: { color: colors.primary, fontSize: font.sm, fontWeight: '600' },
  lastScanCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadow.sm,
  },
  lastScanLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lastScanIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  lastScanId: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  lastScanDate: { color: colors.textMuted, fontSize: font.xs, marginTop: 2 },
  lastScanRight: { alignItems: 'flex-end', gap: 4 },
  lastScanWeight: { color: colors.primary, fontSize: font.xl, fontWeight: '800' },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 13,
  },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  listDot: { width: 8, height: 8, borderRadius: 4 },
  listInfo: { flex: 1 },
  listId: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  listDate: { color: colors.textDim, fontSize: font.xs, marginTop: 1 },
  listWeight: { color: colors.text, fontSize: font.sm, fontWeight: '700', marginRight: 2 },
  empty: {
    alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: radius.xl,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  emptyText: { color: colors.text, fontSize: font.lg, fontWeight: '700', marginTop: spacing.sm },
  emptySubText: { color: colors.textMuted, fontSize: font.sm, textAlign: 'center' },
});
