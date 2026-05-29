import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, Share, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { colors, spacing, radius, font, shadow } from '../lib/theme';
import StatusBadge from '../components/StatusBadge';
import MetricCard from '../components/MetricCard';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Result'>;

const IMG_H = 220;
const IMG_W = Dimensions.get('window').width;

type Measurements = {
  body_length_cm: number;
  withers_height_cm: number;
  thoracic_depth_cm: number;
  rump_width_cm: number;
  chest_girth_cm: number;
};

const MEASURE_LINES = [
  { key: 'body_length_cm'    as keyof Measurements, color: '#059669', dir: 'h' as const, x1: 0.07, x2: 0.93, yc: 0.57 },
  { key: 'withers_height_cm' as keyof Measurements, color: '#0284C7', dir: 'v' as const, xc: 0.21, y1: 0.09, y2: 0.84 },
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
              <View style={{ position: 'absolute', left: left + w / 2 - 22, top: top - 19, backgroundColor: item.color, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{label}</Text>
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
              <View style={{ position: 'absolute', left: left + 6, top: top + h / 2 - 9, backgroundColor: item.color, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{label}</Text>
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
        `BoviScan — ${record.animal_id}\n` +
        `Raça: ${record.breed}\n` +
        `Peso estimado: ${result.estimated_weight_kg.toFixed(1)} kg\n` +
        `Confiança: ${confPct}%\n` +
        `Data: ${new Date(record.scannedAt).toLocaleDateString('pt-BR')}`,
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => nav.navigate('Main')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Resultado</Text>
          <Text style={styles.headerSub}>{record.animal_id}</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Demo banner */}
      {isDemo && (
        <View style={styles.demoBanner}>
          <Ionicons name="wifi-outline" size={14} color="#92400E" />
          <Text style={styles.demoBannerText}>Modo demo offline — servidor não alcançado. Resultados pré-calculados.</Text>
        </View>
      )}

      {/* Photo + measurement overlay */}
      {record.imageUri && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: record.imageUri }} style={styles.preview} resizeMode="cover" />
          {showOverlay && <MeasurementOverlay measurements={measurements} />}
          <TouchableOpacity style={styles.overlayToggle} onPress={() => setShowOverlay(v => !v)}>
            <Ionicons name={showOverlay ? 'eye-off-outline' : 'eye-outline'} size={13} color="#fff" />
            <Text style={styles.overlayToggleText}>{showOverlay ? 'Ocultar medidas' : 'Ver medidas'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.body}>
        {/* Weight hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroLabel}>
              <Ionicons name="scale-outline" size={14} color={colors.primary} />
              <Text style={styles.heroLabelText}>Peso Estimado</Text>
            </View>
            <StatusBadge
              label={detection.is_real_animal ? 'Animal real' : 'Demo'}
              variant={detection.is_real_animal ? 'success' : 'warning'}
            />
          </View>
          <View style={styles.heroRow}>
            <Text style={styles.heroWeight}>{result.estimated_weight_kg.toFixed(1)}</Text>
            <Text style={styles.heroUnit}>kg</Text>
          </View>
          <View style={styles.confRow}>
            <View style={styles.confBar}>
              <View style={[styles.confFill, { width: `${confPct}%` as any }]} />
            </View>
            <Text style={styles.confLabel}>{confPct}%</Text>
          </View>
          <Text style={styles.accuracyNote}>{result.accuracy_note}</Text>
        </View>

        {/* Detection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detecção</Text>
          <View style={styles.infoCard}>
            {[
              { k: 'Classe detectada', v: detection.class },
              { k: 'Confiança do modelo', v: `${Math.round(detection.confidence_pct * 100)}%` },
              { k: 'Modo', v: detection.mode },
            ].map(({ k, v }, i, arr) => (
              <View key={k} style={[styles.infoRow, i < arr.length - 1 && styles.infoRowBorder]}>
                <Text style={styles.infoKey}>{k}</Text>
                <Text style={styles.infoVal}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Measurements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medidas Morfométricas</Text>
          <View style={styles.metricsGrid}>
            <MetricCard label="Comprimento" value={measurements.body_length_cm.toFixed(1)} unit="cm" icon="resize-outline" accent={colors.primary} />
            <MetricCard label="Alt. Cernelha" value={measurements.withers_height_cm.toFixed(1)} unit="cm" icon="arrow-up-outline" accent={colors.secondary} />
            <MetricCard label="Prof. Torácica" value={measurements.thoracic_depth_cm.toFixed(1)} unit="cm" icon="contract-outline" accent={colors.warning} />
            <MetricCard label="Larg. Garupa" value={measurements.rump_width_cm.toFixed(1)} unit="cm" icon="expand-outline" accent={colors.secondary} />
          </View>
          <MetricCard label="Perímetro Torácico" value={measurements.chest_girth_cm.toFixed(1)} unit="cm" icon="radio-button-on-outline" accent={colors.primary} />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionPrimary} onPress={() => nav.navigate('Scan')}>
            <Ionicons name="scan" size={18} color="#fff" />
            <Text style={styles.actionPrimaryText}>Novo Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionSecondary} onPress={() => (nav as any).navigate('Main', { screen: 'Herd' })}>
            <Ionicons name="list" size={18} color={colors.textMuted} />
            <Text style={styles.actionSecondaryText}>Ver Rebanho</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: spacing.xs },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  headerSub: { color: colors.textMuted, fontSize: font.xs, marginTop: 1 },
  shareBtn: { padding: spacing.xs },
  demoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  demoBannerText: { color: '#92400E', fontSize: font.xs, flex: 1 },
  previewContainer: { position: 'relative', width: '100%', height: IMG_H },
  preview: { width: '100%', height: IMG_H, backgroundColor: colors.surfaceHigh },
  overlayToggle: {
    position: 'absolute', bottom: spacing.sm, right: spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderRadius: radius.full,
  },
  overlayToggleText: { color: '#fff', fontSize: font.xs, fontWeight: '600' },
  body: { padding: spacing.md, gap: spacing.md },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.md,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroLabelText: { color: colors.primary, fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  heroWeight: { color: colors.text, fontSize: 56, fontWeight: '800', lineHeight: 62, letterSpacing: -1 },
  heroUnit: { color: colors.textMuted, fontSize: font.xl, marginBottom: 10 },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  confBar: {
    flex: 1, height: 6, backgroundColor: colors.border,
    borderRadius: 3, overflow: 'hidden',
  },
  confFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  confLabel: { color: colors.primary, fontSize: font.sm, fontWeight: '700', minWidth: 40 },
  accuracyNote: { color: colors.textDim, fontSize: font.xs, fontStyle: 'italic' },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 13 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoKey: { color: colors.textMuted, fontSize: font.sm },
  infoVal: { color: colors.text, fontSize: font.sm, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: spacing.md,
    ...shadow.sm,
  },
  actionPrimaryText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
  actionSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.surface,
    borderRadius: radius.md, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  actionSecondaryText: { color: colors.textMuted, fontSize: font.md, fontWeight: '600' },
});
