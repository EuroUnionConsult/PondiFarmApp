import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { MeshPreviewView, renderTexture } from '../../modules/lidar-scanner';
import { ios } from '../lib/theme';
import { estimateWeightKg, WEIGHT_MODEL_VERSION } from '../lib/weightModel';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Result'>;

function prettyBreed(b?: string): string {
  if (!b || b === 'default') return 'Unspecified';
  return b.charAt(0).toUpperCase() + b.slice(1);
}

// Peso preliminar pela fórmula de fita (offline, sem backend) — mesma do baseline #46:
// peso(lb) = (cinta_torácica_in² × comprimento_in) / 300 → kg.

export default function ResultScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { record } = params;
  const { measurements } = record;
  const isCow = record.category === 'cow';

  // Render de textura sob demanda. Começa com o que já existir (se já texturizado).
  const [texturedUri, setTexturedUri] = useState<string | null>(record.meshTexturedUri ?? null);
  const [rendering, setRendering] = useState(false);
  const viewerSource = texturedUri ?? record.meshPlyUri ?? record.meshUri;
  const canRender = !texturedUri && !!record.keyframesDir;

  const handleRender = async () => {
    if (!record.keyframesDir) return;
    setRendering(true);
    try {
      const { url } = await renderTexture(record.meshUri, record.keyframesDir);
      setTexturedUri(url);
    } catch (e: any) {
      Alert.alert('Render failed', e?.message ?? 'Could not build the texture. Try a scan with more coverage/light.');
    } finally {
      setRendering(false);
    }
  };

  const handleShare = async () => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(texturedUri ?? record.meshUri);
    }
  };

  const title = isCow ? (record.animalId ?? 'Bovino') : 'Scan (extra)';

  return (
    <View style={styles.container}>
      {/* Inline navigation bar */}
      <View style={[styles.navbar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.navButton} hitSlop={8}>
          <Text style={styles.navBack}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.navButton} hitSlop={8}>
          <Ionicons name="share-outline" size={20} color={ios.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* 3D model — scanned mesh */}
        {typeof record.meshUri === 'string' && record.meshUri.length > 0 && (
          <View style={styles.meshSection}>
            <View style={styles.meshCard}>
              <MeshPreviewView source={viewerSource} style={StyleSheet.absoluteFill} />
            </View>
            <Text style={styles.meshHint}>Drag to rotate · pinch to zoom</Text>

            {/* Render texture — on-demand bake (gray → photo-textured) */}
            {canRender && (
              <TouchableOpacity
                style={[styles.renderBtn, rendering && { opacity: 0.6 }]}
                onPress={handleRender}
                disabled={rendering}
                activeOpacity={0.85}
              >
                {rendering ? (
                  <>
                    <ActivityIndicator color="#FFF" />
                    <Text style={styles.renderBtnText}>Rendering texture…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="color-wand-outline" size={18} color="#FFF" />
                    <Text style={styles.renderBtnText}>Render texture</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {texturedUri && (
              <Text style={styles.meshHint}>Textured ✓</Text>
            )}
          </View>
        )}

        {/* Category badge */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, isCow ? styles.badgeCow : styles.badgeExtra]}>
            <Ionicons
              name={isCow ? 'paw' : 'cube-outline'}
              size={13}
              color={isCow ? ios.accent : ios.secondaryLabel}
            />
            <Text style={[styles.badgeText, isCow ? styles.badgeTextCow : styles.badgeTextExtra]}>
              {isCow ? 'Bovino' : 'Extra'}
            </Text>
          </View>
        </View>

        {/* Estimated weight — embedded trained model (offline, on-device) */}
        <Text style={styles.sectionHeader}>Estimated weight</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowKey}>Model estimate</Text>
            <Text style={styles.rowMeasure}>≈ {estimateWeightKg(measurements).toFixed(0)} kg</Text>
          </View>
        </View>
        <Text style={styles.sectionFooter}>
          On-device trained model ({WEIGHT_MODEL_VERSION}, MAPE 3.96%), running offline from
          the 3D measurements. Base model trained on public beef-cattle data; being
          recalibrated with PondiFarm Limousine ground-truth.
        </Text>

        {/* Measurements — main card */}
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

        {/* Scan info */}
        <Text style={styles.sectionHeader}>Scan</Text>
        <View style={styles.card}>
          {[
            { k: 'Category', v: isCow ? 'Bovino' : 'Extra' },
            ...(isCow ? [{ k: 'Breed', v: prettyBreed(record.breed) }] : []),
            { k: 'Source',   v: 'LiDAR (on-device)' },
            { k: 'Vertices', v: record.vertexCount.toLocaleString('pt-PT') },
            { k: 'Faces',    v: record.faceCount.toLocaleString('pt-PT') },
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

  // 3D model card
  meshSection: {
    marginTop: 12,
  },
  meshCard: {
    height: 260,
    marginHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  meshHint: {
    marginTop: 8,
    paddingHorizontal: 32,
    textAlign: 'center',
    fontSize: 13, lineHeight: 18,
    color: ios.secondaryLabel,
    letterSpacing: -0.05,
  },
  renderBtn: {
    marginTop: 12, marginHorizontal: 16, paddingVertical: 14, borderRadius: 14,
    backgroundColor: ios.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  renderBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },

  // Category badge
  badgeRow: {
    paddingHorizontal: 16, marginTop: 12, marginBottom: 4,
    flexDirection: 'row',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
  },
  badgeCow: { backgroundColor: ios.accentLight },
  badgeExtra: { backgroundColor: '#EFEFF4' },
  badgeText: {
    fontSize: 13, fontWeight: '600', letterSpacing: -0.1,
  },
  badgeTextCow: { color: ios.accent },
  badgeTextExtra: { color: ios.secondaryLabel },

  // Sections
  sectionHeader: {
    marginTop: 24, marginBottom: 8,
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
