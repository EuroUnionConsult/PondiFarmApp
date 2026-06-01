import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
} from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ios } from '../lib/theme';
import { listRecords, type ScanRecord } from '../lib/storage';

const CHART_H = 140;
const CHART_PAD_X = 16;
const CHART_PAD_TOP = 14;
const CHART_PAD_BOTTOM = 28;
const BAR_W = 22;

function prettyBreed(b: string): string {
  if (b === 'default') return 'Unspecified';
  return b.charAt(0).toUpperCase() + b.slice(1);
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<ScanRecord[]>([]);

  useFocusEffect(useCallback(() => {
    listRecords().then(setRecords);
  }, []));

  const totalScans = records.length;
  const realAnimals = records.filter(r => r.detection.is_real_animal).length;

  const weights = records.map(r => r.result.estimated_weight_kg);
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
  const breedMax = breedStats.length ? Math.max(...breedStats.map(b => b.avg)) : 0;

  const last7: number[] = Array(7).fill(0);
  const now = Date.now();
  records.forEach(r => {
    const daysAgo = Math.floor((now - r.scannedAt) / 86400000);
    if (daysAgo < 7) last7[6 - daysAgo]++;
  });
  const last7Max = Math.max(...last7, 1);
  const last7Total = last7.reduce((a, b) => a + b, 0);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <View style={[styles.largeTitle, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>
            {totalScans === 0
              ? 'No data yet'
              : `${totalScans} scan${totalScans !== 1 ? 's' : ''} · all time`}
          </Text>
        </View>
      </View>

      {totalScans === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No data to show</Text>
          <Text style={styles.emptySub}>
            Record a few scans to see weight trends, breed distribution and activity here.
          </Text>
        </View>
      ) : (
        <>
          {/* Hero — Mean live weight */}
          <View style={[styles.group, { marginTop: 22 }]}>
            <View style={styles.card}>
              <View style={styles.hero}>
                <Text style={styles.eyebrow}>Mean live weight</Text>
                <View style={styles.valueRow}>
                  <Text style={styles.value}>{avgWeight.toFixed(0)}</Text>
                  <Text style={styles.valueUnit}>kg</Text>
                </View>
                <Text style={styles.heroMeta}>
                  Range {minWeight.toFixed(0)}–{maxWeight.toFixed(0)} kg
                  {'  ·  '}
                  Avg confidence {avgConf.toFixed(0)}%
                </Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.tiles}>
                <View style={styles.tile}>
                  <Text style={styles.tileValue}>{totalScans}</Text>
                  <Text style={styles.tileLabel}>scans</Text>
                </View>
                <View style={[styles.tile, styles.tileMid]}>
                  <Text style={styles.tileValue}>{realAnimals}</Text>
                  <Text style={styles.tileLabel}>real animals</Text>
                </View>
                <View style={styles.tile}>
                  <Text style={styles.tileValue}>{Object.keys(breedMap).length}</Text>
                  <Text style={styles.tileLabel}>breeds</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Activity chart */}
          <Text style={styles.sectionHeader}>Activity</Text>
          <View style={styles.card}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityTitle}>Last 7 days</Text>
              <Text style={styles.activityTotal}>{last7Total} scans</Text>
            </View>
            <ActivityChart values={last7} max={last7Max} now={now} />
          </View>

          {/* Weight by breed */}
          {breedStats.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Mean weight by breed</Text>
              <View style={styles.card}>
                {breedStats.map((b, i, arr) => {
                  const pct = breedMax > 0 ? (b.avg / breedMax) * 100 : 0;
                  return (
                    <View key={b.breed}>
                      <View style={styles.breedRow}>
                        <View style={styles.breedTop}>
                          <Text style={styles.breedLabel}>
                            {prettyBreed(b.breed)}
                            <Text style={styles.breedCount}>  · {b.count}</Text>
                          </Text>
                          <Text style={styles.breedValue}>{b.avg.toFixed(0)} kg</Text>
                        </View>
                        <View style={styles.breedTrack}>
                          <View style={[styles.breedFill, { width: `${pct}%` as `${number}%` }]} />
                        </View>
                      </View>
                      {i < arr.length - 1 && <View style={styles.rowDivider} />}
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Summary */}
          <Text style={styles.sectionHeader}>Summary</Text>
          <View style={styles.card}>
            {[
              { k: 'Max weight',      v: `${maxWeight.toFixed(1)} kg` },
              { k: 'Min weight',      v: `${minWeight.toFixed(1)} kg` },
              { k: 'Mean confidence', v: `${avgConf.toFixed(1)}%` },
              { k: 'Real animals',    v: `${realAnimals} / ${totalScans}` },
            ].map(({ k, v }, i, arr) => (
              <View key={k}>
                <View style={styles.row}>
                  <Text style={styles.rowKey}>{k}</Text>
                  <Text style={styles.rowVal}>{v}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.rowDivider} />}
              </View>
            ))}
          </View>
          <Text style={styles.sectionFooter}>
            All figures computed from locally stored scans. Trend over longer windows requires backend sync.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function ActivityChart({ values, max, now }: { values: number[]; max: number; now: number }) {
  const chartWidthFallback = 320; // recomputed via onLayout in real usage; static fallback for SSR / first paint
  const [width, setWidth] = useState(chartWidthFallback);

  const innerW = width - CHART_PAD_X * 2;
  const innerH = CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM;
  const slot = innerW / values.length;
  const barOffset = (slot - BAR_W) / 2;

  return (
    <View
      style={{ width: '100%', height: CHART_H }}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
    >
      <Svg width={width} height={CHART_H}>
        {/* baseline */}
        <Line
          x1={CHART_PAD_X} x2={width - CHART_PAD_X}
          y1={CHART_H - CHART_PAD_BOTTOM + 0.5}
          y2={CHART_H - CHART_PAD_BOTTOM + 0.5}
          stroke={ios.separator} strokeWidth={1}
        />

        {values.map((count, i) => {
          const h = max > 0 ? (count / max) * innerH : 0;
          const x = CHART_PAD_X + slot * i + barOffset;
          const y = CHART_H - CHART_PAD_BOTTOM - h;
          const dayDate = new Date(now - (6 - i) * 86400000);
          const dayLabel = dayDate.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 1);

          return (
            <React.Fragment key={i}>
              {/* bar */}
              <Rect
                x={x} y={y}
                width={BAR_W}
                height={Math.max(h, 3)}
                rx={4} ry={4}
                fill={count > 0 ? ios.accent : '#E5E5EA'}
              />
              {/* count label above bar */}
              {count > 0 && (
                <SvgText
                  x={x + BAR_W / 2} y={y - 6}
                  fontSize={11} fontWeight="600"
                  fill={ios.label} textAnchor="middle"
                >
                  {String(count)}
                </SvgText>
              )}
              {/* day letter under bar */}
              <SvgText
                x={x + BAR_W / 2} y={CHART_H - 10}
                fontSize={11}
                fill={ios.secondaryLabel} textAnchor="middle"
              >
                {dayLabel}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const displayFont = Platform.select({ ios: 'System', android: undefined, default: undefined });

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: ios.systemGroupedBackground },

  largeTitle: { paddingHorizontal: 20, paddingBottom: 6 },
  title: {
    fontFamily: displayFont,
    fontSize: 34, fontWeight: '700',
    letterSpacing: -0.95, color: ios.label, lineHeight: 36,
  },
  subtitle: {
    fontSize: 13, color: ios.tertiaryLabel,
    marginTop: 4, letterSpacing: -0.05,
  },

  // Sections
  group: { paddingHorizontal: 16 },
  sectionHeader: {
    marginTop: 28, marginBottom: 8,
    paddingHorizontal: 32,
    fontSize: 13, fontWeight: '400',
    color: ios.secondaryLabel,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionFooter: {
    marginTop: 8,
    paddingHorizontal: 32,
    fontSize: 13, lineHeight: 18,
    color: ios.secondaryLabel,
    letterSpacing: -0.05,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Hero
  hero: { padding: 22, gap: 8 },
  eyebrow: {
    fontSize: 13, fontWeight: '600',
    color: ios.accent, letterSpacing: -0.05,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: {
    fontFamily: displayFont,
    fontSize: 56, fontWeight: '700',
    lineHeight: 56, letterSpacing: -2.2, color: ios.label,
  },
  valueUnit: {
    fontFamily: displayFont,
    fontSize: 22, fontWeight: '500',
    color: ios.secondaryLabel, letterSpacing: -0.2,
  },
  heroMeta: {
    fontSize: 13, color: ios.secondaryLabel,
    marginTop: 4, letterSpacing: -0.05,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: ios.separator,
  },

  // Tiles inside hero card
  tiles: { flexDirection: 'row' },
  tile: {
    flex: 1, alignItems: 'center',
    paddingVertical: 14, gap: 4,
  },
  tileMid: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: ios.separator,
  },
  tileValue: {
    fontFamily: displayFont,
    fontSize: 24, fontWeight: '700',
    letterSpacing: -0.6, color: ios.label,
  },
  tileLabel: {
    fontSize: 11, color: ios.secondaryLabel,
    letterSpacing: -0.05,
  },

  // Activity chart
  activityHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  activityTitle: {
    fontSize: 15, fontWeight: '600',
    color: ios.label, letterSpacing: -0.2,
  },
  activityTotal: {
    fontSize: 13, color: ios.secondaryLabel,
    letterSpacing: -0.05,
  },

  // Breed bars
  breedRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  breedTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  breedLabel: {
    fontSize: 15, color: ios.label, letterSpacing: -0.2,
  },
  breedCount: {
    fontSize: 13, color: ios.tertiaryLabel,
    fontWeight: '400',
  },
  breedValue: {
    fontFamily: displayFont,
    fontSize: 15, fontWeight: '600',
    color: ios.label, letterSpacing: -0.2,
  },
  breedTrack: {
    height: 6, backgroundColor: '#E5E5EA',
    borderRadius: 3, overflow: 'hidden',
  },
  breedFill: {
    height: 6, backgroundColor: ios.accent, borderRadius: 3,
  },

  // Summary rows
  row: {
    minHeight: 44,
    paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  rowDivider: {
    marginLeft: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: ios.separator,
  },
  rowKey: {
    flex: 1,
    fontSize: 17, color: ios.label, letterSpacing: -0.3,
  },
  rowVal: {
    fontFamily: displayFont,
    fontSize: 17, fontWeight: '500',
    color: ios.secondaryLabel, letterSpacing: -0.3,
  },

  // Empty
  empty: {
    alignItems: 'center', gap: 8,
    paddingTop: 60, paddingBottom: 40, paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17, fontWeight: '600',
    color: ios.label, letterSpacing: -0.3,
  },
  emptySub: {
    fontSize: 13, color: ios.secondaryLabel,
    textAlign: 'center', letterSpacing: -0.05, lineHeight: 18,
  },
});
