import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from './Text';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import { fetchScanMeshFile, type CloudAnimal } from '../lib/api';
import { MeshPreviewView } from '../../modules/lidar-scanner';

/**
 * Modelo 3D do último scan do animal, vindo da nuvem (o mesmo que a versão de
 * computador mostra). Sem modelo na nuvem, explica de onde ele virá.
 */
export default function Scan3DCard({ animal }: { animal: CloudAnimal }) {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const [file, setFile] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const scanId = animal.hasMesh ? animal.latestScanId : null;

  useEffect(() => {
    if (!scanId) return;
    let alive = true;
    setFile(null); setFailed(false);
    fetchScanMeshFile(scanId).then((f) => { if (alive) setFile(f); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [scanId]);

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
  return (
    <View>
      <View style={styles.viewer}>
        {file ? <MeshPreviewView source={file} style={StyleSheet.absoluteFill} />
          : failed ? <Text style={styles.emptyText}>The 3D model could not be loaded.</Text>
          : <ActivityIndicator color={ios.accent} />}
      </View>
      {file && <Text style={styles.hint}>Drag to rotate · pinch to zoom</Text>}
    </View>
  );
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  viewer: {
    height: 260, borderRadius: 18, overflow: 'hidden',
    backgroundColor: ios.secondarySystemGroupedBackground,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: { fontSize: 13, color: ios.secondaryLabel, textAlign: 'center', marginTop: 8 },
  empty: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: 14,
    backgroundColor: ios.secondarySystemGroupedBackground,
  },
  emptyText: { flex: 1, fontSize: 14, color: ios.secondaryLabel, lineHeight: 20, textAlign: 'left' },
});
