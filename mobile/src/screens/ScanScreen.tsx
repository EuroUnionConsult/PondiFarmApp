import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Alert, ActivityIndicator, Dimensions,
  Modal, TextInput, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ios } from '../lib/theme';
import {
  LidarScannerView,
  type LidarScannerViewRef,
  type ScanCompleteEvent,
} from '../../modules/lidar-scanner';
import { saveRecord, type ScanRecord, type ScanCategory } from '../lib/storage';
import type { RootStackParamList } from '../navigation/types';
import GlassSurface from '../components/GlassSurface';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const MIN_VERTICES = 100;

const CATEGORIES: { key: ScanCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'cow',   label: 'Bovino', icon: 'paw-outline' },
  { key: 'extra', label: 'Extra',  icon: 'cube-outline' },
];

const BREEDS = [
  { key: 'default',    label: 'Unspecified' },
  { key: 'minhota',    label: 'Minhota' },
  { key: 'alentejana', label: 'Alentejana' },
  { key: 'barrosã',    label: 'Barrosã' },
  { key: 'maronesa',   label: 'Maronesa' },
  { key: 'cachena',    label: 'Cachena' },
  { key: 'mirandesa',  label: 'Mirandesa' },
];

function PreScanModal({
  visible, onConfirm, onCancel,
}: {
  visible: boolean;
  onConfirm: (category: ScanCategory, animalId: string, breed: string) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<ScanCategory>('cow');
  const [animalId, setAnimalId] = useState('');
  const [breed, setBreed] = useState('default');

  const isCow = category === 'cow';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New scan</Text>
          <Text style={styles.modalSub}>
            {isCow
              ? 'Animal ID is optional. Leave blank to auto-generate.'
              : 'Extra captures (objects / people) need no ID or breed.'}
          </Text>

          <Text style={styles.sectionHeader}>Category</Text>
          <View style={styles.card}>
            <View style={styles.chipScroll}>
              {CATEGORIES.map(c => {
                const active = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.breedChip, styles.categoryChip, active && styles.breedChipActive]}
                    onPress={() => setCategory(c.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={c.icon}
                      size={15}
                      color={active ? '#FFFFFF' : ios.label}
                    />
                    <Text style={[styles.breedLabel, active && styles.breedLabelActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {isCow && (
            <>
              <Text style={styles.sectionHeader}>Animal</Text>
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>ID</Text>
                  <TextInput
                    style={styles.rowInput}
                    placeholder="e.g. PT-347821"
                    placeholderTextColor={ios.tertiaryLabel}
                    value={animalId}
                    onChangeText={setAnimalId}
                    autoCapitalize="characters"
                    returnKeyType="done"
                  />
                </View>
              </View>

              <Text style={styles.sectionHeader}>Breed</Text>
              <View style={styles.card}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.breedScroll}
                >
                  {BREEDS.map(b => {
                    const active = breed === b.key;
                    return (
                      <TouchableOpacity
                        key={b.key}
                        style={[styles.breedChip, active && styles.breedChipActive]}
                        onPress={() => setBreed(b.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.breedLabel, active && styles.breedLabelActive]}>
                          {b.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => onConfirm(category, animalId.trim(), breed)}
            activeOpacity={0.85}
          >
            <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
            <Text style={styles.confirmText}>Open scanner</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.6}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showPreScan, setShowPreScan] = useState(true);
  const [category, setCategory] = useState<ScanCategory>('cow');
  const [animalId, setAnimalId] = useState('');
  const [breed, setBreed] = useState('default');
  const [boxScale, setBoxScale] = useState(1.0);
  const scannerRef = useRef<LidarScannerViewRef>(null);

  const handlePreScanConfirm = (cat: ScanCategory, id: string, b: string) => {
    setCategory(cat);
    setAnimalId(id);
    setBreed(b);
    setShowPreScan(false);
  };

  const startScan = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScanning(true);
    await scannerRef.current?.startScan?.();
  };

  const stopScan = async () => {
    setScanning(false);
    setProcessing(true);
    await scannerRef.current?.stopScan?.();
  };

  const adjustBoxScale = async (delta: number) => {
    const next = Math.min(2.0, Math.max(0.5, Math.round((boxScale + delta) * 10) / 10));
    if (next === boxScale) return;
    await Haptics.selectionAsync();
    setBoxScale(next);
    await scannerRef.current?.setBoxScale?.(next);
  };

  const recenterBox = async () => {
    await Haptics.selectionAsync();
    await scannerRef.current?.recenterBox?.();
  };

  const handleScanComplete = async (e: { nativeEvent: ScanCompleteEvent }) => {
    setScanning(false);
    setProcessing(false);
    const { meshUri, meshPlyUri, meshTexturedUri, keyframesDir, vertexCount, faceCount, measurements } = e.nativeEvent;

    if (!measurements || vertexCount < MIN_VERTICES) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Scan insuficiente',
        'Não captámos geometria suficiente. Aproxime-se do animal e tente novamente.',
        [{ text: 'OK' }],
      );
      return;
    }

    const isCow = category === 'cow';
    const record: ScanRecord = {
      id: `${Date.now()}`,
      scannedAt: Date.now(),
      category,
      source: 'lidar',
      animalId: isCow ? (animalId || 'PT-—') : undefined,
      breed: isCow ? breed : undefined,
      measurements,
      vertexCount,
      faceCount,
      meshUri,
      meshPlyUri,
      meshTexturedUri,
      keyframesDir,
    };

    await saveRecord(record);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nav.replace('Result', { record });
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ios.accent} />
      </View>
    );
  }

  // ARKit needs the camera, so we keep the permission gate.
  if (!permission.granted) {
    return (
      <View style={[styles.permWrap, { paddingTop: insets.top + 40 }]}>
        <View style={styles.permIcon}>
          <Ionicons name="cube-outline" size={36} color={ios.accent} />
        </View>
        <Text style={styles.permTitle}>Camera access required</Text>
        <Text style={styles.permDesc}>
          PondiFarm needs the camera so the LiDAR scanner can capture the animal in 3D.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.permBtnText}>Allow camera access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permSecondary} onPress={() => nav.goBack()} activeOpacity={0.6}>
          <Text style={styles.permSecondaryText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isCow = category === 'cow';
  const topTitle = isCow ? (animalId || 'New scan') : 'Extra';
  const topSub = isCow
    ? (BREEDS.find(b => b.key === breed)?.label ?? breed)
    : 'Object / person';

  return (
    <View style={styles.container}>
      <PreScanModal
        visible={showPreScan}
        onConfirm={handlePreScanConfirm}
        onCancel={() => nav.goBack()}
      />

      <LidarScannerView
        ref={scannerRef}
        style={StyleSheet.absoluteFill}
        onScanComplete={handleScanComplete}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <GlassSurface tone="dark" radius={18} style={styles.topIcon}>
          <TouchableOpacity style={styles.glassFill} onPress={() => nav.goBack()} hitSlop={8}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </GlassSurface>
        <GlassSurface tone="dark" radius={16} style={styles.topCenterGlass}>
          <Text style={styles.topTitle} numberOfLines={1}>{topTitle}</Text>
          <Text style={styles.topSub} numberOfLines={1}>{topSub}</Text>
        </GlassSurface>
        <GlassSurface tone="dark" radius={18} style={styles.topIcon}>
          <TouchableOpacity
            style={styles.glassFill}
            onPress={() => setShowPreScan(true)}
            disabled={scanning || processing}
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </GlassSurface>
      </View>

      {/* Scan hint */}
      {!scanning && !processing && (
        <View style={styles.frameArea} pointerEvents="none">
          <GlassSurface tone="dark" radius={999} style={styles.frameHintPill}>
            <Text style={styles.frameHint}>
              Move slowly around the {isCow ? 'animal' : 'subject'} to capture all sides
            </Text>
          </GlassSurface>
        </View>
      )}

      {/* Box framing controls — only while scanning */}
      {scanning && (
        <View
          style={[styles.boxControls, { bottom: insets.bottom + 104 }]}
          pointerEvents="box-none"
        >
          <GlassSurface tone="dark" radius={999} style={styles.boxHintPill}>
            <Text style={styles.boxHint}>Frame the animal inside the green box</Text>
          </GlassSurface>
          <View style={styles.boxRow}>
            <GlassSurface tone="dark" radius={999} style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => adjustBoxScale(-0.1)}
                disabled={boxScale <= 0.5}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="remove"
                  size={18}
                  color={boxScale <= 0.5 ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
                />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{boxScale.toFixed(1)}×</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => adjustBoxScale(0.1)}
                disabled={boxScale >= 2.0}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={boxScale >= 2.0 ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
                />
              </TouchableOpacity>
            </GlassSurface>
            <GlassSurface tone="dark" radius={999} style={styles.recenterWrap}>
              <TouchableOpacity
                style={styles.recenterBtn}
                onPress={recenterBox}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Ionicons name="locate-outline" size={16} color={ios.accent} />
                <Text style={styles.recenterText}>Recenter</Text>
              </TouchableOpacity>
            </GlassSurface>
          </View>
        </View>
      )}

      {/* Bottom controls — Start / Stop scan */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[
            styles.scanBtn,
            scanning && styles.scanBtnActive,
            processing && styles.scanBtnDisabled,
          ]}
          onPress={scanning ? stopScan : startScan}
          disabled={processing}
          activeOpacity={0.85}
        >
          {processing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons
                name={scanning ? 'stop' : 'scan'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.scanBtnText}>
                {scanning ? 'Stop & export' : 'Start scan'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Processing overlay */}
      {processing && (
        <View style={styles.overlay} pointerEvents="none">
          <GlassSurface tone="dark" radius={20} style={styles.processingCard}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.processingLabel}>Building mesh…</Text>
          </GlassSurface>
        </View>
      )}
    </View>
  );
}

const displayFont = Platform.select({ ios: 'System', android: undefined, default: undefined });

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, backgroundColor: ios.systemGroupedBackground,
    alignItems: 'center', justifyContent: 'center',
  },

  // Permission screen
  permWrap: {
    flex: 1, backgroundColor: ios.systemGroupedBackground,
    alignItems: 'center', paddingHorizontal: 32, gap: 12,
  },
  permIcon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: ios.accentLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  permTitle: {
    fontFamily: displayFont,
    fontSize: 22, fontWeight: '700',
    letterSpacing: -0.5, color: ios.label, textAlign: 'center',
  },
  permDesc: {
    fontSize: 15, color: ios.secondaryLabel,
    textAlign: 'center', letterSpacing: -0.1, lineHeight: 20,
    paddingHorizontal: 16, marginBottom: 16,
  },
  permBtn: {
    backgroundColor: ios.label, borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 14, minWidth: 240,
    alignItems: 'center',
  },
  permBtnText: {
    color: '#FFFFFF',
    fontSize: 17, fontWeight: '600', letterSpacing: -0.3,
  },
  permSecondary: { paddingVertical: 14, alignItems: 'center' },
  permSecondaryText: {
    color: ios.accent, fontSize: 17, fontWeight: '500', letterSpacing: -0.3,
  },

  // Top bar over scanner
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  topIcon: {
    width: 36, height: 36,
  },
  glassFill: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  topCenterGlass: {
    maxWidth: '60%',
    alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 5,
  },
  topTitle: {
    fontFamily: displayFont,
    color: '#FFFFFF', fontSize: 15, fontWeight: '600', letterSpacing: -0.2,
  },
  topSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12, marginTop: 1, letterSpacing: -0.05,
  },

  // Hint
  frameArea: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 160,
  },
  frameHintPill: {
    paddingHorizontal: 16, paddingVertical: 8,
  },
  frameHint: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13, letterSpacing: -0.05,
  },

  // Box framing controls
  boxControls: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', gap: 10,
  },
  boxHintPill: {
    paddingHorizontal: 16, paddingVertical: 8,
  },
  boxHint: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13, letterSpacing: -0.05,
  },
  boxRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4,
  },
  stepperBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperValue: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '600',
    letterSpacing: -0.2, minWidth: 44, textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  recenterWrap: {},
  recenterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 36,
  },
  recenterText: {
    color: ios.accent, fontSize: 14, fontWeight: '600', letterSpacing: -0.1,
  },

  // Bottom controls
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingTop: 16,
  },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: ios.accent,
    paddingHorizontal: 36, paddingVertical: 16,
    borderRadius: 999, minWidth: 200,
  },
  scanBtnActive: { backgroundColor: ios.systemRed },
  scanBtnDisabled: { opacity: 0.6 },
  scanBtnText: {
    color: '#FFFFFF', fontSize: 17, fontWeight: '600', letterSpacing: -0.3,
  },

  // Processing overlay
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  processingCard: {
    paddingHorizontal: 28, paddingVertical: 24,
    alignItems: 'center', gap: 12,
  },
  processingLabel: {
    fontSize: 15, color: '#FFFFFF', fontWeight: '500', letterSpacing: -0.2,
  },

  // Pre-scan modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: ios.systemGroupedBackground,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingTop: 8, paddingHorizontal: 0,
  },
  modalHandle: {
    width: 36, height: 5, borderRadius: 3,
    backgroundColor: ios.opaqueSeparator,
    alignSelf: 'center', marginBottom: 14,
  },
  modalTitle: {
    fontFamily: displayFont,
    fontSize: 22, fontWeight: '700',
    letterSpacing: -0.5, color: ios.label,
    paddingHorizontal: 20,
  },
  modalSub: {
    fontSize: 13, color: ios.secondaryLabel,
    marginTop: 4, letterSpacing: -0.05,
    paddingHorizontal: 20,
  },

  sectionHeader: {
    marginTop: 22, marginBottom: 8,
    paddingHorizontal: 32,
    fontSize: 13, fontWeight: '400',
    color: ios.secondaryLabel,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 12, overflow: 'hidden',
  },
  row: {
    minHeight: 44,
    paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  rowLabel: {
    fontSize: 17, color: ios.label, letterSpacing: -0.3, width: 44,
  },
  rowInput: {
    flex: 1, fontSize: 17, color: ios.label, letterSpacing: -0.3,
    padding: 0,
  },

  chipScroll: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  breedScroll: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  breedChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EFEFF4',
  },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  breedChipActive: { backgroundColor: ios.accent },
  breedLabel: {
    fontSize: 14, color: ios.label, letterSpacing: -0.1,
  },
  breedLabelActive: { color: '#FFFFFF', fontWeight: '600' },

  confirmBtn: {
    marginTop: 22, marginHorizontal: 16,
    backgroundColor: ios.label,
    borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 17, fontWeight: '600', letterSpacing: -0.3,
  },
  cancelBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  cancelText: {
    color: ios.accent, fontSize: 17, fontWeight: '500', letterSpacing: -0.3,
  },
});
