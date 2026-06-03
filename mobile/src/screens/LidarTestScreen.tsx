// TEMP EURODEV-74 — native module verification screen. Remove in Phase 4 (EURODEV-77).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LidarScannerView, isLidarSupported } from '../../modules/lidar-scanner';

export default function LidarTestScreen() {
  const insets = useSafeAreaInsets();
  const supported = isLidarSupported();

  return (
    <View style={styles.container}>
      <LidarScannerView style={StyleSheet.absoluteFill} />
      <View style={[styles.badge, { top: insets.top + 12 }]}>
        <Text style={styles.badgeText}>
          LiDAR suportado: {supported ? '✅ sim' : '❌ não'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  badge: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontSize: 14 },
});
