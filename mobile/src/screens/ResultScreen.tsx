import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform,
  Image, Share, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ios } from '../lib/theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Result'>;

const IMG_H = 240;
const IMG_W = Dimensions.get('window').width;

type Measurements = {
  body_length_cm: number;
  withers_height_cm: number;
  thoracic_depth_cm: number;
  rump_width_cm: number;
  chest_girth_cm: number;
};

const MEASURE_LINES = [
  { key: 'body_length_cm'    as keyof Measurements, color: ios.accent,    dir: 'h' as const, x1: 0.07, x2: 0.93, yc: 0.57 },
  { key: 'withers_height_cm' as keyof Measurements, color: ios.systemBlue, dir: 'v' as const, xc: 0.21, y1: 0.09, y2: 0.84 },
];

function MeasurementOverlay({ measurements }: { measurements: Measurements }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {MEASURE_LINES.map(item => {
        const val = measurements[item.key];
        const label = `${val.toFixed(0)} cm`;

        if (item.dir === 'h') {
          const left = item.x1 * IMG_W;
          const top  = item.yc * IMG_H;
          const w    = (item.x2 - item.x1) * IMG_W;
          return (
            <View key={item.key}>
              <View style={{ position: 'absolute', left, top, width: w, height: 2, backgroundColor: item.color }}>
                <View style={{ position: 'absolute', left: 0,  top: -4, width: 2,  height: 10, backgroundColor: item.color }} />
                <View style={{ position: 'absolute', right: 0, top: -4, width: 2,  height: 10, backgroundColor: item.color }} />
              </View>
              <View style={{ position: 'absolute', left: left + w / 2 - 24, top: top - 22, backgroundColor: item.color, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: -0.1 }}>{label}</Text>
              </View>
            </View>
          );
        } else {
          const left = item.xc * IMG_W;
          const top  = item.y1 * IMG_H;
          const h    = (item.y2 - item.y1) * IMG_H;
          return (
            <View key={item.key}>
              <View style={{ position: 'absolute', left, top, width: 2, height: h, backgroundColor: item.color }}>
                <View style={{ position: 'absolute', top: 0,    left: -4, width: 10, height: 2, backgroundColor: item.color }} />
                <View style={{ position: 'absolute', bottom: 0, left: -4, width: 10, height: 2, backgroundColor: item.color }} />
              </View>
              <View style={{ position: 'absolute', left: left + 8, top: top + h / 2 - 10, backgroundColor: item.color, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: -0.1 }}>{label}</Text>
              </View>
            </View>
          );
        }
      })}
    </View>
  );
}

export default function ResultScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { record } = params;
  const { detection, measurements, result } = record;
  const confPct = Math.round(result.confidence_pct);
  const isDemo = record._isDemo === true;
  const [showOverlay, setShowOverlay] = useState(true);

  const handleShare = async () => {
    await Share.share({
      message:
        `PondiFarm — ${record.animal_id}\n` +
        `Breed: ${record.breed}\n` +
        `Estimated weight: ${result.estimated_weight_kg.toFixed(1)} kg\n` +
        `Confidence: ${confPct}%\n` +
        `Date: ${new Date(record.scannedAt).toLocaleDateString('pt-PT')}`,
    });
  };

  return (
    <View style={styles.container}>
      {/* Inline navigation bar (push view, not large title) */}
      <View style={[styles.navbar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.navButton} hitSlop={8}>
          <Text style={styles.navBack}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navTitle}>{record.animal_id}</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.navButton} hitSlop={8}>
          <Ionicons name="share-outline" size={20} color={ios.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Demo banner — iOS warning info strip */}
        {isDemo && (
          <View style={styles.demoBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={ios.label} />
            <Text style={styles.demoBannerText}>
              Demo mode — backend unreachable. Showing precomputed result.
            </Text>
          </View>
        )}

        {/* Photo + measurement overlay */}
        {record.imageUri && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: record.imageUri }} style={styles.preview} resizeMode="cover" />
            {showOverlay && <MeasurementOverlay measurements={measurements} />}
            <TouchableOpacity style={styles.overlayToggle} onPress={() => setShowOverlay(v => !v)}>
              <Ionicons name={showOverlay ? 'eye-off-outline' : 'eye-outline'} size={13} color="#fff" />
              <Text style={styles.overlayToggleText}>
                {showOverlay ? 'Hide measurements' : 'Show measurements'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hero — Estimated weight */}
        <View style={[styles.group, { marginTop: 22 }]}>
          <View style={styles.card}>
            <View style={styles.hero}>
              <View style={styles.eyebrow}>
                <Ionicons name="speedometer-outline" size={14} color={ios.accent} />
                <Text style={styles.eyebrowText}>Estimated weight</Text>
              </View>
              <View style={styles.valueRow}>
                <Text style={styles.value}>{result.estimated_weight_kg.toFixed(1)}</Text>
                <Text style={styles.valueUnit}>kg</Text>
              </View>
              <View style={styles.confRow}>
                <View style={styles.confBar}>
                  <View style={[styles.confFill, { width: `${confPct}%` as `${number}%` }]} />
                </View>
                <Text style={styles.confLabel}>{confPct}%</Text>
              </View>
              {!!result.accuracy_note && (
                <Text style={styles.accuracyNote}>{result.accuracy_note}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Detection */}
        <Text style={styles.sectionHeader}>Detection</Text>
        <View style={styles.card}>
          {[
            { k: 'Detected class',    v: detection.class },
            { k: 'Model confidence',  v: `${Math.round(detection.confidence_pct * 100)}%` },
            { k: 'Mode',              v: detection.mode },
            { k: 'Breed',             v: record.breed },
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

        {/* Measurements */}
        <Text style={styles.sectionHeader}>Measurements</Text>
        <View style={styles.card}>
          {[
            { k: 'Body length',     v: `${measurements.body_length_cm.toFixed(1)} cm` },
            { k: 'Withers height',  v: `${measurements.withers_height_cm.toFixed(1)} cm` },
            { k: 'Thoracic depth',  v: `${measurements.thoracic_depth_cm.toFixed(1)} cm` },
            { k: 'Rump width',      v: `${measurements.rump_width_cm.toFixed(1)} cm` },
            { k: 'Chest girth',     v: `${measurements.chest_girth_cm.toFixed(1)} cm` },
          ].map(({ k, v }, i, arr) => (
            <View key={k}>
              <View style={styles.row}>
                <Text style={styles.rowKey}>{k}</Text>
                <Text style={styles.rowMeasure}>{v}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>
        <Text style={styles.sectionFooter}>
          Captured at {new Date(record.scannedAt).toLocaleString('pt-PT', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}.
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionPrimary}
            onPress={() => nav.navigate('Scan')}
            activeOpacity={0.85}
          >
            <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionPrimaryText}>New scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionSecondary}
            onPress={() => (nav as any).navigate('Main', { screen: 'Herd' })}
            activeOpacity={0.6}
          >
            <Text style={styles.actionSecondaryText}>View herd</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const displayFont = Platform.select({ ios: 'System', android: undefined, default: undefined });

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ios.systemGroupedBackground },

  // Inline nav
  navbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10,
    backgroundColor: ios.systemGroupedBackground,
  },
  navButton: { paddingHorizontal: 8, paddingVertical: 4, minWidth: 56 },
  navBack: {
    fontSize: 17, color: ios.accent, letterSpacing: -0.3,
  },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle: {
    fontFamily: displayFont,
    fontSize: 17, fontWeight: '600', color: ios.label, letterSpacing: -0.3,
  },

  // Demo banner
  demoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#FFF4D6',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10,
  },
  demoBannerText: {
    flex: 1, fontSize: 13, color: ios.label, letterSpacing: -0.05,
  },

  // Photo
  previewContainer: {
    position: 'relative',
    marginHorizontal: 16,
    height: IMG_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  preview: { width: '100%', height: IMG_H },
  overlayToggle: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
  },
  overlayToggleText: {
    color: '#FFFFFF', fontSize: 12, fontWeight: '600', letterSpacing: -0.1,
  },

  // Sections
  group: { paddingHorizontal: 16 },
  sectionHeader: {
    marginTop: 32, marginBottom: 8,
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
  hero: { padding: 22, gap: 10 },
  eyebrow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  eyebrowText: {
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
  confRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 6,
  },
  confBar: {
    flex: 1, height: 6, backgroundColor: '#E5E5EA',
    borderRadius: 3, overflow: 'hidden',
  },
  confFill: { height: 6, backgroundColor: ios.accent, borderRadius: 3 },
  confLabel: {
    fontFamily: displayFont,
    fontSize: 13, fontWeight: '600',
    color: ios.accent, minWidth: 40, letterSpacing: -0.1,
  },
  accuracyNote: {
    fontSize: 13, color: ios.secondaryLabel,
    marginTop: 4, letterSpacing: -0.05,
  },

  // Rows
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
    fontSize: 17, color: ios.secondaryLabel, letterSpacing: -0.3,
    textAlign: 'right', maxWidth: '60%',
  },
  rowMeasure: {
    fontFamily: displayFont,
    fontSize: 17, fontWeight: '500',
    color: ios.label, letterSpacing: -0.3,
  },

  // Actions
  actions: {
    marginTop: 32, marginHorizontal: 16, gap: 10,
  },
  actionPrimary: {
    backgroundColor: ios.label,
    borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 17, fontWeight: '600', letterSpacing: -0.3,
  },
  actionSecondary: {
    paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  actionSecondaryText: {
    color: ios.accent, fontSize: 17, fontWeight: '500', letterSpacing: -0.3,
  },
});
