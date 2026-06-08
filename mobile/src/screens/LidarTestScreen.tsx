// TEMP EURODEV-74/75/76 — verificação do módulo nativo. Remover na Fase 4 (EURODEV-77).
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import {
  LidarScannerView,
  isLidarSupported,
  type LidarScannerViewRef,
  type ScanCompleteEvent,
} from '../../modules/lidar-scanner';

const ROWS: { key: keyof NonNullable<ScanCompleteEvent['measurements']>; label: string }[] = [
  { key: 'body_length_cm',    label: 'Comprimento' },
  { key: 'withers_height_cm', label: 'Cernelha' },
  { key: 'thoracic_depth_cm', label: 'Prof. torácica' },
  { key: 'rump_width_cm',     label: 'Largura garupa' },
  { key: 'chest_girth_cm',    label: 'Perímetro torácico' },
];

export default function LidarTestScreen() {
  const insets = useSafeAreaInsets();
  const supported = isLidarSupported();
  const viewRef = useRef<LidarScannerViewRef>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanCompleteEvent | null>(null);

  const start = () => { setResult(null); setScanning(true); viewRef.current?.startScan?.(); };
  const stop = () => { setScanning(false); viewRef.current?.stopScan?.(); };
  const share = async () => {
    if (result?.meshUri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(result.meshUri);
    }
  };

  return (
    <View style={styles.container}>
      <LidarScannerView
        ref={viewRef}
        style={StyleSheet.absoluteFill}
        onScanComplete={(e: { nativeEvent: ScanCompleteEvent }) => setResult(e.nativeEvent)}
      />
      <View style={[styles.panel, { top: insets.top + 12 }]}>
        <Text style={styles.badgeText}>LiDAR: {supported ? '✅ sim' : '❌ não'}</Text>
        {result && (
          <Text style={styles.badgeText}>{result.vertexCount} vért · {result.faceCount} faces</Text>
        )}
        {result?.measurements && (
          <ScrollView style={styles.measWrap}>
            {ROWS.map((r) => (
              <View key={r.key} style={styles.measRow}>
                <Text style={styles.measLabel}>{r.label}</Text>
                <Text style={styles.measVal}>{result.measurements![r.key].toFixed(1)} cm</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      <View style={[styles.controls, { bottom: insets.bottom + 28 }]}>
        <TouchableOpacity style={[styles.btn, scanning && styles.btnActive]} onPress={scanning ? stop : start}>
          <Text style={styles.btnText}>{scanning ? 'Parar e exportar' : 'Iniciar scan'}</Text>
        </TouchableOpacity>
        {result?.meshUri ? (
          <TouchableOpacity style={styles.shareBtn} onPress={share}>
            <Text style={styles.btnText}>Compartilhar .obj</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  panel: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 14, gap: 4, maxWidth: '92%', maxHeight: 260,
  },
  badgeText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  measWrap: { marginTop: 6 },
  measRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 18, paddingVertical: 2 },
  measLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  measVal: { color: '#9fe6b0', fontSize: 13, fontWeight: '600' },
  controls: { position: 'absolute', alignSelf: 'center', alignItems: 'center', gap: 10 },
  btn: { backgroundColor: '#5F8068', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
  btnActive: { backgroundColor: '#C0392B' },
  shareBtn: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
