import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, font, shadow } from '../lib/theme';
import { listRecords, type ScanRecord } from '../lib/storage';

const { width } = Dimensions.get('window');

function StatRow({ label, value, accent = colors.text }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function WeightBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={styles.barItem}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` as any }]} />
      </View>
      <Text style={styles.barValue}>{value.toFixed(0)} kg</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<ScanRecord[]>([]);

  useFocusEffect(useCallback(() => {
    listRecords().then(setRecords);
  }, []));

  const weights = records.map(r => r.result.estimated_weight_kg);
  const totalScans = records.length;
  const realAnimals = records.filter(r => r.detection.is_real_animal).length;
  const avgWeight = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : 0;
  const maxWeight = weights.length ? Math.max(...weights) : 0;
  const minWeight = weights.length ? Math.min(...weights) : 0;
  const avgConf = records.length
    ? records.reduce((s, r) => s + r.result.confidence_pct, 0) / records.length
    : 0;

  const breedMap: Record<string, number[]> = {};
  records.forEach(r => {
    if (!breedMap[r.breed]) breedMap[r.breed] = [];
    breedMap[r.breed].push(r.result.estimated_weight_kg);
  });
  const breedStats = Object.entries(breedMap).map(([breed, ws]) => ({
    breed,
    avg: ws.reduce((a, b) => a + b, 0) / ws.length,
    count: ws.length,
  })).sort((a, b) => b.avg - a.avg);

  const last7: number[] = Array(7).fill(0);
  const now = Date.now();
  records.forEach(r => {
    const daysAgo = Math.floor((now - r.scannedAt) / 86400000);
    if (daysAgo < 7) last7[6 - daysAgo]++;
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Análises</Text>
        <Text style={styles.subtitle}>{totalScans} scan{totalScans !== 1 ? 's' : ''} no total</Text>
      </View>

      {totalScans === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nenhum dado para exibir ainda.</Text>
          <Text style={styles.emptySubText}>Faça scans para ver as análises aqui.</Text>
        </View>
      ) : (
        <>
          {/* KPIs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumo</Text>
            <View style={styles.kpiCard}>
              <StatRow label="Peso médio" value={`${avgWeight.toFixed(1)} kg`} accent={colors.primary} />
              <StatRow label="Peso máximo" value={`${maxWeight.toFixed(1)} kg`} accent={colors.secondary} />
              <StatRow label="Peso mínimo" value={`${minWeight.toFixed(1)} kg`} accent={colors.warning} />
              <StatRow label="Confiança média" value={`${avgConf.toFixed(1)}%`} accent={colors.primary} />
              <StatRow label="Animais reais" value={`${realAnimals} / ${totalScans}`} />
            </View>
          </View>

          {/* Activity last 7 days */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scans — Últimos 7 dias</Text>
            <View style={styles.kpiCard}>
              <View style={styles.chartRow}>
                {last7.map((count, i) => {
                  const maxVal = Math.max(...last7, 1);
                  const h = (count / maxVal) * 80;
                  const day = new Date(now - (6 - i) * 86400000).toLocaleDateString('pt-BR', { weekday: 'short' });
                  return (
                    <View key={i} style={styles.chartCol}>
                      <Text style={styles.chartCount}>{count > 0 ? count : ''}</Text>
                      <View style={styles.chartBarTrack}>
                        <View style={[styles.chartBar, { height: h || 4 }]} />
                      </View>
                      <Text style={styles.chartDay}>{day.slice(0, 3)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* By breed */}
          {breedStats.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Por Raça</Text>
              <View style={styles.kpiCard}>
                {breedStats.map(b => (
                  <WeightBar
                    key={b.breed}
                    label={`${b.breed} (${b.count})`}
                    value={b.avg}
                    max={maxWeight}
                  />
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  sectionTitle: { color: colors.text, fontSize: font.md, fontWeight: '700', marginBottom: spacing.sm },
  kpiCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statLabel: { color: colors.textMuted, fontSize: font.sm },
  statValue: { fontSize: font.md, fontWeight: '700' },
  barItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  barLabel: { color: colors.textMuted, fontSize: font.xs, width: 90 },
  barTrack: {
    flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3, overflow: 'hidden',
  },
  barFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  barValue: { color: colors.text, fontSize: font.xs, width: 52, textAlign: 'right' },
  chartRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    alignItems: 'flex-end', paddingHorizontal: spacing.md,
    paddingTop: spacing.md, paddingBottom: spacing.sm,
    height: 130,
  },
  chartCol: { alignItems: 'center', gap: 4, flex: 1 },
  chartCount: { color: colors.textMuted, fontSize: font.xs, height: 16 },
  chartBarTrack: {
    width: 20, height: 80,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  chartBar: { width: 20, backgroundColor: colors.primary, borderRadius: 4 },
  chartDay: { color: colors.textDim, fontSize: font.xs },
  empty: {
    alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyText: { color: colors.textMuted, fontSize: font.lg, fontWeight: '600' },
  emptySubText: { color: colors.textDim, fontSize: font.sm, textAlign: 'center' },
});
