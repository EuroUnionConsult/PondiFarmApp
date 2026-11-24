import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from './Text';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import { type CloudAnimal } from '../lib/api';
// iPhone: visualizador nativo (Scan3DViewer.tsx). Web: three.js (Scan3DViewer.web.tsx).
import Scan3DViewer from './Scan3DViewer';

/**
 * Modelo 3D do último scan do animal, vindo da nuvem (o mesmo que a versão de
 * computador mostra), com os modos Photo, Clay e LiDAR. Sem modelo na nuvem,
 * explica de onde ele virá.
 */
export default function Scan3DCard({ animal }: { animal: CloudAnimal }) {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const scanId = animal.hasMesh ? animal.latestScanId : null;

  if (!scanId) {
    return (
      <View style={styles.empty}>
        <Ionicons name="phone-portrait-outline" size={20} color={ios.secondaryLabel} />
        <Text style={styles.emptyText}>
          No 3D model in the cloud yet. It is sent automatically when the iPhone that captured the scan syncs.
        </Text>
      </View>
    );
  }
  return <Scan3DViewer scanId={scanId} />;
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  empty: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: 14,
    backgroundColor: ios.secondarySystemGroupedBackground,
  },
  emptyText: { flex: 1, fontSize: 14, color: ios.secondaryLabel, lineHeight: 20, textAlign: 'left' },
});
