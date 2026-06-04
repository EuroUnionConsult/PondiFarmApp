// TEMP EURODEV-74/75 — verificação do módulo nativo. Remover na Fase 4 (EURODEV-77).
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LidarScannerView,
  isLidarSupported,
  type LidarScannerViewRef,
  type ScanCompleteEvent,
} from '../../modules/lidar-scanner';

export default function LidarTestScreen() {
  const insets = useSafeAreaInsets();
  const supported = isLidarSupported();
  const viewRef = useRef<LidarScannerViewRef>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanCompleteEvent | null>(null);

  const start = () => {
    setResult(null);
    setScanning(true);
    viewRef.current?.startScan?.();
  };
  const stop = () => {
    setScanning(false);
    viewRef.current?.stopScan?.();
  };

  return (
    <View style={styles.container}>
      <LidarScannerView
        ref={viewRef}
        style={StyleSheet.absoluteFill}
        onScanComplete={(e: { nativeEvent: ScanCompleteEvent }) => setResult(e.nativeEvent)}
      />
      <View style={[styles.badge, { top: insets.top + 12 }]}>
        <Text style={styles.badgeText}>LiDAR: {supported ? '✅ sim' : '❌ não'}</Text>
        {result && (
          <Text style={styles.badgeText}>
            {result.vertexCount} vértices · {result.faceCount} faces
          </Text>
        )}
        {result?.meshUri ? (
          <Text style={styles.path} numberOfLines={1}>{result.meshUri}</Text>
        ) : null}
      </View>
      <View style={[styles.controls, { bottom: insets.bottom + 28 }]}>
        <TouchableOpacity
          style={[styles.btn, scanning && styles.btnActive]}
          onPress={scanning ? stop : start}
        >
          <Text style={styles.btnText}>{scanning ? 'Parar e exportar' : 'Iniciar scan'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  badge: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, gap: 2, maxWidth: '90%',
  },
  badgeText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  path: { color: '#9fe6b0', fontSize: 10 },
  controls: { position: 'absolute', alignSelf: 'center' },
  btn: {
    backgroundColor: '#5F8068', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999,
  },
  btnActive: { backgroundColor: '#C0392B' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
