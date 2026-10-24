import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Text from './Text';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import { fetchScanMeshFile, type CloudAnimal } from '../lib/api';
import { MeshPreviewView } from '../../modules/lidar-scanner';
import type { MeshViewMode } from '../../modules/lidar-scanner/src/MeshPreviewView';

// Os mesmos três modos da versão web.
const MODES: { id: MeshViewMode; label: string }[] = [
  { id: 'photo', label: 'Photo' }, { id: 'clay', label: 'Clay' }, { id: 'points', label: 'LiDAR' },
];

/**
 * Modelo 3D do último scan do animal, vindo da nuvem (o mesmo que a versão de
 * computador mostra), com os modos Photo, Clay e LiDAR como na web. Sem modelo
 * na nuvem, explica de onde ele virá.
 */
export default function Scan3DCard({ animal }: { animal: CloudAnimal }) {
  const { colors: ios, mode: theme } = useTheme();
  const [mode, setMode] = useState<MeshViewMode>('photo');
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
        {file ? <MeshPreviewView source={file} mode={mode} dark={theme === 'dark'} style={StyleSheet.absoluteFill} />
          : failed ? <Text style={styles.emptyText}>The 3D model could not be loaded.</Text>
          : <ActivityIndicator color={ios.accent} />}
        {file && (
          <View style={styles.modes} accessibilityRole="tablist">
            {MODES.map((m) => {
              const on = m.id === mode;
              return (
                <Pressable key={m.id} onPress={() => { void Haptics.selectionAsync(); setMode(m.id); }}
                  accessibilityRole="tab" accessibilityState={{ selected: on }}
                  style={[styles.modeBtn, on && styles.modeOn]}>
                  <Text style={[styles.modeText, on && styles.modeTextOn]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
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
  modes: {
    position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', padding: 3, borderRadius: 12,
    backgroundColor: ios.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: ios.separator,
  },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  modeOn: { backgroundColor: ios.accentLight },
  modeText: { fontSize: 14, fontWeight: '600', color: ios.secondaryLabel },
  modeTextOn: { color: ios.accentDark },
  hint: { fontSize: 13, color: ios.secondaryLabel, textAlign: 'center', marginTop: 8 },
  empty: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: 14,
    backgroundColor: ios.secondarySystemGroupedBackground,
  },
  emptyText: { flex: 1, fontSize: 14, color: ios.secondaryLabel, lineHeight: 20, textAlign: 'left' },
});
