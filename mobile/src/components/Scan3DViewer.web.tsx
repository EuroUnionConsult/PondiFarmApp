import React, { Suspense, lazy, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import { fetchScanMesh } from '../lib/api';
import PondiLoader from './PondiLoader';

// O three.js (~600 KB) só se descarrega quando há um modelo 3D para mostrar:
// pedaço próprio do bundle (import dinâmico), fora do arranque da app.
const ScanViewer = lazy(() => import('../web/ScanViewer'));

/**
 * Web (modo telemóvel do site): o mesmo visualizador three.js da versão de
 * computador, que lê o GLB com a foto. O iPhone usa Scan3DViewer.tsx (nativo).
 */
export default function Scan3DViewer({ scanId }: { scanId: string }) {
  const { colors: ios, mode } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const load = useMemo(() => () => fetchScanMesh(scanId), [scanId]);
  return (
    <Suspense fallback={<View style={styles.loading}><PondiLoader size="md" /></View>}>
      <ScanViewer load={load} dark={mode === 'dark'} />
    </Suspense>
  );
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  loading: { height: 260, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: ios.secondarySystemGroupedBackground },
});
