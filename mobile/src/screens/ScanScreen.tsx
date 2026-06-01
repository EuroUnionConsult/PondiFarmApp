import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Alert, ActivityIndicator, Dimensions,
  Modal, TextInput, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ios } from '../lib/theme';
import { scanAnimal } from '../lib/api';
import { saveRecord, type ScanRecord } from '../lib/storage';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const FRAME = width * 0.74;

const BREEDS = [
  { key: 'default',    label: 'Unspecified' },
  { key: 'minhota',    label: 'Minhota' },
  { key: 'alentejana', label: 'Alentejana' },
  { key: 'barrosã',    label: 'Barrosã' },
  { key: 'maronesa',   label: 'Maronesa' },
  { key: 'cachena',    label: 'Cachena' },
  { key: 'mirandesa',  label: 'Mirandesa' },
];

const PIPELINE_STEPS = [
  { icon: 'eye-outline'      as const, label: 'Detecting animal'    },
  { icon: 'git-branch-outline' as const, label: 'Segmenting contour'   },
  { icon: 'resize-outline'   as const, label: 'Extracting measurements' },
  { icon: 'analytics-outline' as const, label: 'Estimating weight'     },
];

function PreScanModal({
  visible, onConfirm, onCancel,
}: {
  visible: boolean;
  onConfirm: (animalId: string, breed: string) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [animalId, setAnimalId] = useState('');
  const [breed, setBreed] = useState('default');

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
            Animal ID is optional. Leave blank to auto-generate.
          </Text>

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

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => onConfirm(animalId.trim() || 'DEMO-001', breed)}
            activeOpacity={0.85}
          >
            <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            <Text style={styles.confirmText}>Open camera</Text>
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
  const [pipelineStep, setPipelineStep] = useState(0);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [showPreScan, setShowPreScan] = useState(true);
  const [animalId, setAnimalId] = useState('DEMO-001');
  const [breed, setBreed] = useState('default');
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (scanning) {
      setPipelineStep(0);
      stepTimer.current = setInterval(() => {
        setPipelineStep(s => (s < PIPELINE_STEPS.length - 1 ? s + 1 : s));
      }, 1500);
    } else if (stepTimer.current) {
      clearInterval(stepTimer.current);
    }
    return () => { if (stepTimer.current) clearInterval(stepTimer.current); };
  }, [scanning]);

  const handlePreScanConfirm = (id: string, b: string) => {
    setAnimalId(id);
    setBreed(b);
    setShowPreScan(false);
  };

  const handleScan = async (imageUri: string) => {
    setScanning(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await scanAnimal(imageUri, animalId, breed);
      const record: ScanRecord = {
        ...result,
        id: `${Date.now()}`,
        scannedAt: Date.now(),
        imageUri,
      };
      await saveRecord(record);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      nav.replace('Result', { record });
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Scan failed', err.message ?? 'Unknown error', [{ text: 'OK' }]);
    } finally {
      setScanning(false);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || scanning) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: false });
    if (photo?.uri) handleScan(photo.uri);
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      handleScan(result.assets[0].uri);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ios.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permWrap, { paddingTop: insets.top + 40 }]}>
        <View style={styles.permIcon}>
          <Ionicons name="camera-outline" size={36} color={ios.accent} />
        </View>
        <Text style={styles.permTitle}>Camera access required</Text>
        <Text style={styles.permDesc}>
          PondiFarm needs your camera to capture the animal and estimate its weight.
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

  return (
    <View style={styles.container}>
      <PreScanModal
        visible={showPreScan}
        onConfirm={handlePreScanConfirm}
        onCancel={() => nav.goBack()}
      />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.topIcon} onPress={() => nav.goBack()} hitSlop={8}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle} numberOfLines={1}>{animalId}</Text>
          <Text style={styles.topSub} numberOfLines={1}>
            {BREEDS.find(b => b.key === breed)?.label ?? breed}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.topIcon}
          onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
          hitSlop={8}
        >
          <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Viewfinder corners */}
      <View style={styles.frameArea} pointerEvents="none">
        <View style={styles.frameOuter}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <View style={styles.frameHintPill}>
          <Text style={styles.frameHint}>Frame the animal from the side, fully visible</Text>
        </View>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.sideBtn} onPress={pickFromGallery} disabled={scanning} hitSlop={8}>
          <Ionicons name="images-outline" size={26} color="#FFFFFF" />
          <Text style={styles.sideLabel}>Library</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureBtn, (scanning || !cameraReady) && styles.captureBtnDisabled]}
          onPress={takePicture}
          disabled={scanning || !cameraReady}
          activeOpacity={0.85}
        >
          {scanning
            ? <ActivityIndicator color={ios.accent} size="small" />
            : <View style={styles.captureInner} />
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sideBtn}
          onPress={() => setShowPreScan(true)}
          disabled={scanning}
          hitSlop={8}
        >
          <Ionicons name="create-outline" size={26} color="#FFFFFF" />
          <Text style={styles.sideLabel}>Edit ID</Text>
        </TouchableOpacity>
      </View>

      {/* Pipeline overlay */}
      {scanning && (
        <View style={styles.overlay}>
          <View style={styles.pipelineCard}>
            <Text style={styles.pipelineHeader}>Processing</Text>
            {PIPELINE_STEPS.map((step, i) => (
              <View key={step.label} style={styles.pipelineRow}>
                <Ionicons
                  name={i < pipelineStep ? 'checkmark-circle' : i === pipelineStep ? step.icon : 'ellipse-outline'}
                  size={18}
                  color={i < pipelineStep ? ios.accent : i === pipelineStep ? ios.accent : ios.tertiaryLabel}
                />
                <Text style={[styles.pipelineLabel, i <= pipelineStep && styles.pipelineLabelActive]}>
                  {step.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const displayFont = Platform.select({ ios: 'System', android: undefined, default: undefined });
const CORNER = 26;
const BORDER = 3;

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

  // Top bar over camera
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  topIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center', justifyContent: 'center',
  },
  topCenter: { alignItems: 'center', maxWidth: '60%' },
  topTitle: {
    fontFamily: displayFont,
    color: '#FFFFFF', fontSize: 15, fontWeight: '600', letterSpacing: -0.2,
  },
  topSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12, marginTop: 1, letterSpacing: -0.05,
  },

  // Viewfinder
  frameArea: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 28,
  },
  frameOuter: { width: FRAME, height: FRAME * 0.75, position: 'relative' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: ios.accent },
  tl: { top: 0, left: 0,  borderTopWidth: BORDER, borderLeftWidth: BORDER,  borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0,  borderBottomWidth: BORDER, borderLeftWidth: BORDER,  borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER, borderBottomRightRadius: 6 },
  frameHintPill: {
    backgroundColor: 'rgba(0,0,0,0.48)',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
  },
  frameHint: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13, letterSpacing: -0.05,
  },

  // Bottom controls
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingTop: 16,
  },
  sideBtn: { width: 72, alignItems: 'center', gap: 4 },
  sideLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11, letterSpacing: -0.05,
  },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  captureBtnDisabled: { opacity: 0.5 },

  // Pipeline processing overlay
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center', justifyContent: 'center',
  },
  pipelineCard: {
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 18,
    paddingHorizontal: 22, paddingVertical: 22,
    width: width * 0.78,
    gap: 12,
  },
  pipelineHeader: {
    fontFamily: displayFont,
    fontSize: 17, fontWeight: '600',
    color: ios.label, letterSpacing: -0.3,
    marginBottom: 6,
  },
  pipelineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 3,
  },
  pipelineLabel: {
    fontSize: 15, color: ios.secondaryLabel, flex: 1, letterSpacing: -0.1,
  },
  pipelineLabelActive: { color: ios.label, fontWeight: '500' },

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

  breedScroll: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  breedChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EFEFF4',
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
