import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Text from './Text';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import { fetchScanMeshFile } from '../lib/api';
import { MeshPreviewView } from '../../modules/lidar-scanner';
import type { MeshViewMode } from '../../modules/lidar-scanner/src/MeshPreviewView';
import PondiLoader from './PondiLoader';

// Os mesmos três modos da versão web.
const MODES: { id: MeshViewMode; label: string }[] = [
  { id: 'photo', label: 'Photo' }, { id: 'clay', label: 'Clay' }, { id: 'points', label: 'LiDAR' },
];

/**
 * iPhone: descarrega o modelo 3D do scan (PLY) para a cache e mostra-o no
 * visualizador nativo, com os modos Photo, Clay e LiDAR. A web usa Scan3DViewer.web.tsx.
 */
export default function Scan3DViewer({ scanId }: { scanId: string }) {
  const { colors: ios, mode: theme } = useTheme();
  const [mode, setMode] = useState<MeshViewMode>('photo');
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const [file, setFile] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFile(null); setFailed(false);
    fetchScanMeshFile(scanId).then((f) => { if (alive) setFile(f); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [scanId]);

  return (
    <View>
      <View style={styles.viewer}>
        {file ? <MeshPreviewView source={file} mode={mode} dark={theme === 'dark'} style={StyleSheet.absoluteFill} />
          : failed ? <Text style={styles.failedText}>The 3D model could not be loaded.</Text>
          : <PondiLoader size="md" />}
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
  failedText: { flex: 1, fontSize: 14, color: ios.secondaryLabel, lineHeight: 20, textAlign: 'left' },
});
