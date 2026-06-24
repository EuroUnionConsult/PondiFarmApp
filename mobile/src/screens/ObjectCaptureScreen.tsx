import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';

import {
  ObjectCaptureView,
  MeshPreviewView,
  isObjectCaptureSupported,
  measureObjectBounds,
  type ObjectCapturePhase,
} from '../../modules/lidar-scanner';
import { ios } from '../lib/theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Bounds = { width: number; height: number; depth: number };

const PHASE_LABEL: Record<ObjectCapturePhase, string> = {
  initializing: 'Starting camera…',
  ready: 'Position the object and tap Continue',
  detecting: 'Adjust the box around the object',
  capturing: 'Move around the object, slowly',
  finishing: 'Saving capture…',
  reconstructing: 'Building 3D model…',
  done: 'Done',
  error: 'Error',
};

export default function ObjectCaptureScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const [supported, setSupported] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<ObjectCapturePhase>('initializing');
  const [progress, setProgress] = useState(0);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bump remonta a ObjectCaptureView → sessão nova (retry sem sair da tela).
  const [attempt, setAttempt] = useState(0);

  const restart = () => {
    setError(null);
    setModelUrl(null);
    setBounds(null);
    setPhase('initializing');
    setProgress(0);
    setAttempt((a) => a + 1);
  };

  useEffect(() => {
    isObjectCaptureSupported().then(setSupported).catch(() => setSupported(false));
  }, []);

  const handleComplete = async (url: string) => {
    setModelUrl(url);
    setPhase('done');
    try {
      setBounds(await measureObjectBounds(url));
    } catch {
      setBounds(null);
    }
  };

  const handleShare = async () => {
    if (modelUrl && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(modelUrl);
    }
  };

  const cm = (m: number) => `${(m * 100).toFixed(1)} cm`;

  // --- Estados de borda ---

  if (supported === false) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="cube-outline" size={48} color={ios.secondaryLabel} />
        <Text style={styles.errTitle}>Object Capture unavailable</Text>
        <Text style={styles.errBody}>
          Requires iOS 17+ and an iPhone with LiDAR (12 Pro or newer).
        </Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => nav.goBack()}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (supported === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ios.accent} />
      </View>
    );
  }

  // --- Resultado: modelo texturizado + medidas ---

  if (modelUrl) {
    return (
      <View style={styles.container}>
        <View style={[styles.navbar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.navButton} hitSlop={8}>
            <Text style={styles.navBack}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>3D model</Text>
          <TouchableOpacity onPress={handleShare} style={styles.navButton} hitSlop={8}>
            <Ionicons name="share-outline" size={20} color={ios.accent} />
          </TouchableOpacity>
        </View>

        <View style={styles.meshCard}>
          <MeshPreviewView source={modelUrl} style={StyleSheet.absoluteFill} />
        </View>
        <Text style={styles.meshHint}>Drag to rotate · pinch to zoom</Text>

        {bounds && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Real dimensions</Text>
            {[
              { k: 'Length', v: cm(Math.max(bounds.width, bounds.depth)) },
              { k: 'Width', v: cm(Math.min(bounds.width, bounds.depth)) },
              { k: 'Height', v: cm(bounds.height) },
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
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, { marginTop: 'auto', marginBottom: insets.bottom + 16 }]}
          onPress={restart}
        >
          <Ionicons name="scan-outline" size={18} color="#FFF" />
          <Text style={styles.primaryBtnText}>New scan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Captura ao vivo (Object Capture overlay nativo) ---

  return (
    <View style={styles.container}>
      <ObjectCaptureView
        key={attempt}
        style={StyleSheet.absoluteFill}
        detail="reduced"
        onStateChange={(e) => setPhase(e.nativeEvent.state)}
        onProgress={(e) => setProgress(e.nativeEvent.progress)}
        onComplete={(e) => handleComplete(e.nativeEvent.url)}
        onError={(e) => setError(e.nativeEvent.message)}
      />

      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 8 }]}
        onPress={() => nav.goBack()}
        hitSlop={10}
      >
        <Ionicons name="close" size={22} color="#FFF" />
      </TouchableOpacity>

      {phase === 'reconstructing' && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#FFF" size="large" />
          <Text style={styles.overlayText}>{PHASE_LABEL.reconstructing}</Text>
          {progress > 0 && (
            <Text style={styles.overlayPct}>{Math.round(progress * 100)}%</Text>
          )}
        </View>
      )}

      {error && (
        <View style={styles.overlay}>
          <Ionicons name="alert-circle-outline" size={40} color="#FFF" />
          <Text style={styles.overlayText}>Couldn't build the model</Text>
          <Text style={styles.overlayHint}>
            More light, a textured object on a textured surface, and do a full slow
            orbit. Point at the surface first so the plane is detected.
          </Text>
          <TouchableOpacity style={styles.primaryBtnInline} onPress={restart}>
            <Ionicons name="refresh" size={18} color="#FFF" />
            <Text style={styles.primaryBtnText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => nav.goBack()}>
            <Text style={styles.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const displayFont = Platform.select({ ios: 'System', default: undefined });

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ios.systemGroupedBackground },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: 32, backgroundColor: ios.systemGroupedBackground,
  },

  navbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10,
    backgroundColor: ios.systemGroupedBackground,
  },
  navButton: { paddingHorizontal: 8, paddingVertical: 4, minWidth: 64 },
  navBack: { fontSize: 17, color: ios.accent, letterSpacing: -0.3 },
  navTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: displayFont, fontSize: 17, fontWeight: '600',
    color: ios.label, letterSpacing: -0.3,
  },

  meshCard: {
    height: 300, marginHorizontal: 16, marginTop: 4,
    borderRadius: 18, backgroundColor: '#000', overflow: 'hidden',
  },
  meshHint: {
    marginTop: 8, textAlign: 'center',
    fontSize: 13, color: ios.secondaryLabel,
  },

  card: {
    marginHorizontal: 16, marginTop: 20,
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 12, overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
    fontSize: 13, color: ios.secondaryLabel,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  row: {
    minHeight: 44, paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center',
  },
  rowDivider: { marginLeft: 16, height: StyleSheet.hairlineWidth, backgroundColor: ios.separator },
  rowKey: { flex: 1, fontSize: 17, color: ios.label, letterSpacing: -0.3 },
  rowMeasure: {
    fontFamily: displayFont, fontSize: 17, fontWeight: '500',
    color: ios.label, letterSpacing: -0.3,
  },

  closeBtn: {
    position: 'absolute', right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32,
  },
  overlayText: {
    color: '#FFF', fontSize: 17, fontWeight: '600',
    textAlign: 'center', letterSpacing: -0.3,
  },
  overlayPct: { color: '#FFF', fontSize: 15, opacity: 0.8 },
  overlayHint: {
    color: '#FFF', opacity: 0.85, fontSize: 14, lineHeight: 20,
    textAlign: 'center', paddingHorizontal: 12,
  },
  primaryBtnInline: {
    marginTop: 6, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14,
    backgroundColor: ios.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },

  primaryBtn: {
    marginHorizontal: 16,
    backgroundColor: ios.label, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  primaryBtnText: { color: '#FFF', fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  secondaryBtnText: { color: ios.accent, fontSize: 17, fontWeight: '500' },

  errTitle: {
    fontFamily: displayFont, fontSize: 20, fontWeight: '700',
    color: ios.label, textAlign: 'center',
  },
  errBody: { fontSize: 15, color: ios.secondaryLabel, textAlign: 'center', lineHeight: 21 },
});
