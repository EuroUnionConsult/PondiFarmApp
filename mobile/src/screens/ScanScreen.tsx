import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Dimensions,
  Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font } from '../lib/theme';
import { scanAnimal } from '../lib/api';
import { saveRecord, type ScanRecord } from '../lib/storage';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const FRAME = width * 0.72;
const BREEDS = ['default', 'minhota', 'alentejana', 'barrosã', 'maronesa', 'cachena', 'mirandesa'];

function PreScanModal({
  visible,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  onConfirm: (animalId: string, breed: string) => void;
  onCancel: () => void;
}) {
  const [animalId, setAnimalId] = useState('');
  const [breed, setBreed] = useState('default');

  const handleConfirm = () => {
    onConfirm(animalId.trim() || 'DEMO-001', breed);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Identificar Animal</Text>
          <Text style={styles.modalSub}>Opcional — pode deixar em branco</Text>

          <Text style={styles.fieldLabel}>ID / Nome do animal</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: PT-347821 ou Mimosa"
            placeholderTextColor={colors.textDim}
            value={animalId}
            onChangeText={setAnimalId}
            autoCapitalize="characters"
            returnKeyType="done"
          />

          <Text style={styles.fieldLabel}>Raça</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.breedScroll} contentContainerStyle={styles.breedRow}>
            {BREEDS.map(b => (
              <TouchableOpacity
                key={b}
                style={[styles.breedBtn, breed === b && styles.breedBtnActive]}
                onPress={() => setBreed(b)}
              >
                <Text style={[styles.breedLabel, breed === b && styles.breedLabelActive]}>
                  {b.charAt(0).toUpperCase() + b.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Ionicons name="camera" size={18} color="#fff" />
            <Text style={styles.confirmText}>Abrir Câmera</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const PIPELINE_STEPS = [
  { icon: 'eye-outline',        label: 'Detectando animal...' },
  { icon: 'git-branch-outline', label: 'Segmentando contorno...' },
  { icon: 'resize-outline',     label: 'Extraindo medidas...' },
  { icon: 'analytics-outline',  label: 'Calculando peso...' },
];

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
    } else {
      if (stepTimer.current) clearInterval(stepTimer.current);
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
      Alert.alert('Erro no scan', err.message, [{ text: 'OK' }]);
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
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="camera-outline" size={56} color={colors.textDim} />
        <Text style={styles.permTitle}>Câmera necessária</Text>
        <Text style={styles.permDesc}>Precisamos de acesso à câmera para fazer o scan do animal.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Permitir acesso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Modal de identificação */}
      <PreScanModal
        visible={showPreScan}
        onConfirm={handlePreScanConfirm}
        onCancel={() => nav.goBack()}
      />

      {/* Camera — sem filhos */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>Scan Animal</Text>
          <Text style={styles.topSub}>{animalId} · {breed}</Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
        >
          <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Viewfinder */}
      <View style={styles.frameArea} pointerEvents="none">
        <View style={styles.frameOuter}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <Text style={styles.frameHint}>Posicione o animal de perfil, visível inteiro</Text>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.xl }]}>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery} disabled={scanning}>
          <Ionicons name="image-outline" size={26} color="#fff" />
          <Text style={styles.galleryLabel}>Galeria</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureBtn, (scanning || !cameraReady) && styles.captureBtnDisabled]}
          onPress={takePicture}
          disabled={scanning || !cameraReady}
        >
          {scanning
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <View style={styles.captureInner} />
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editIdBtn}
          onPress={() => setShowPreScan(true)}
          disabled={scanning}
        >
          <Ionicons name="create-outline" size={22} color="#fff" />
          <Text style={styles.galleryLabel}>Editar</Text>
        </TouchableOpacity>
      </View>

      {/* Pipeline overlay */}
      {scanning && (
        <View style={styles.overlay}>
          <View style={styles.pipelineCard}>
            <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: spacing.md }} />
            {PIPELINE_STEPS.map((step, i) => (
              <View key={step.label} style={styles.pipelineRow}>
                <Ionicons
                  name={i < pipelineStep ? 'checkmark-circle' : i === pipelineStep ? (step.icon as any) : 'ellipse-outline'}
                  size={18}
                  color={i <= pipelineStep ? colors.primary : colors.textDim}
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

const CORNER = 24;
const BORDER = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl, gap: spacing.md,
  },
  permTitle: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  permDesc: { color: colors.textMuted, fontSize: font.sm, textAlign: 'center' },
  permBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  topCenter: { alignItems: 'center' },
  topTitle: { color: '#fff', fontSize: font.md, fontWeight: '700' },
  topSub: { color: 'rgba(255,255,255,0.65)', fontSize: font.xs, marginTop: 1 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  frameArea: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: spacing.lg,
  },
  frameOuter: { width: FRAME, height: FRAME * 0.75, position: 'relative' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.primary },
  tl: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER, borderTopLeftRadius: 4 },
  tr: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER, borderTopRightRadius: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER, borderBottomLeftRadius: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER, borderBottomRightRadius: 4 },
  frameHint: {
    color: 'rgba(255,255,255,0.75)', fontSize: font.sm,
    textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, marginTop: spacing.lg,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
  },
  galleryBtn: { width: 64, alignItems: 'center', gap: 4 },
  editIdBtn: { width: 64, alignItems: 'center', gap: 4 },
  galleryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: font.xs },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
  captureBtnDisabled: { opacity: 0.5 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5,13,26,0.80)',
    alignItems: 'center', justifyContent: 'center',
  },
  pipelineCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: width * 0.78,
    gap: spacing.sm,
  },
  pipelineRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 4,
  },
  pipelineLabel: { color: colors.textDim, fontSize: font.sm, flex: 1 },
  pipelineLabelActive: { color: colors.text, fontWeight: '600' },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.sm,
  },
  modalTitle: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  modalSub: { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.sm },
  fieldLabel: { color: colors.textMuted, fontSize: font.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    color: colors.text, fontSize: font.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  breedScroll: { marginBottom: spacing.md },
  breedRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.md },
  breedBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  breedBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  breedLabel: { color: colors.textMuted, fontSize: font.sm },
  breedLabelActive: { color: colors.primary, fontWeight: '700' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  confirmText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { color: colors.textMuted, fontSize: font.md },
});
