import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, ActivityIndicator, Pressable } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Text from './Text';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import { fetchAnimalScans, type ScanPoint } from '../lib/api';

// Histórico já pedido nesta sessão: voltar ao mesmo animal não repete o pedido.
const cache = new Map<string, ScanPoint[]>();
const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Evolução do peso estimado ao longo dos scans do animal (mesmo gráfico da versão de computador). */
export default function WeightHistory({ animalId }: { animalId: string }) {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const [pts, setPts] = useState<ScanPoint[] | null>(cache.get(animalId) ?? null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [w, setW] = useState(0);
  const draw = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cache.has(animalId)) return;
    let alive = true;
    fetchAnimalScans(animalId).then((p) => { cache.set(animalId, p); if (alive) setPts(p); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [animalId]);

  const ws = (pts ?? []).filter((p): p is ScanPoint & { weightKg: number } => p.weightKg !== null && p.weightKg > 0);
  useEffect(() => {
    if (ws.length < 2 || !w) return;
    draw.setValue(0);
    Animated.timing(draw, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [ws.length, w]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return <Text style={styles.note}>The scan history could not be loaded.</Text>;
  if (pts === null) return <View style={styles.loading}><ActivityIndicator color={ios.accent} /></View>;
  if (ws.length < 2) {
    return <Text style={styles.note}>{ws.length === 1 ? `One scan so far (${fmtDate(ws[0].at)}). The trend appears after the next scan.` : 'No scans with a weight yet.'}</Text>;
  }

  const H = 120, PX = 10, PY = 14;
  const t0 = ws[0].at, t1 = ws[ws.length - 1].at;
  const lo = Math.min(...ws.map((p) => p.weightKg)), hi = Math.max(...ws.map((p) => p.weightKg));
  const x = (t: number) => PX + ((t - t0) / (t1 - t0 || 1)) * (w - 2 * PX);
  const y = (v: number) => H - PY - ((v - lo) / (hi - lo || 1)) * (H - 2 * PY);
  const line = ws.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.weightKg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(t1).toFixed(1)} ${H} L${x(t0).toFixed(1)} ${H} Z`;
  const diff = Math.round(ws[ws.length - 1].weightKg - ws[0].weightKg);
  const h = sel !== null ? ws[sel] : null;

  return (
    <View>
      <View style={styles.top}>
        <View style={[styles.delta, diff >= 0 ? styles.up : styles.down]}>
          <Text style={[styles.deltaText, { color: diff >= 0 ? ios.accent : '#C2611F' }]}>{diff >= 0 ? '+' : '−'}{Math.abs(diff)} kg since {fmtDate(t0)}</Text>
        </View>
        <Text style={styles.meta}>{h ? `${fmtDate(h.at)} · ${Math.round(h.weightKg)} kg` : `${ws.length} scans`}</Text>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H, marginTop: 10 }}>
        {w > 0 && (
          <Svg width={w} height={H}>
            <Defs><LinearGradient id="wfill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={ios.accent} stopOpacity={0.28} /><Stop offset="1" stopColor={ios.accent} stopOpacity={0} /></LinearGradient></Defs>
            <Path d={area} fill="url(#wfill)" />
            <AnimatedPath d={line} fill="none" stroke={ios.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
              strokeDasharray={[w * 2, w * 2]} strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [w * 2, 0] })} />
            {ws.map((p, i) => (
              <Circle key={i} cx={x(p.at)} cy={y(p.weightKg)} r={i === sel || i === ws.length - 1 ? 5 : 3.5}
                fill={i === sel ? ios.accent : ios.secondarySystemGroupedBackground} stroke={ios.accent} strokeWidth={2.5} />))}
          </Svg>)}
        {/* Toques: o ponto mais próximo do dedo mostra a data e o peso. */}
        <Pressable style={StyleSheet.absoluteFill} onPressIn={(e) => {
          const tx = e.nativeEvent.locationX; let best = 0;
          ws.forEach((p, i) => { if (Math.abs(x(p.at) - tx) < Math.abs(x(ws[best].at) - tx)) best = i; });
          setSel(best);
        }} accessibilityRole="adjustable" accessibilityLabel={`Weight from ${Math.round(ws[0].weightKg)} to ${Math.round(ws[ws.length - 1].weightKg)} kg over ${ws.length} scans`} />
      </View>
      <View style={styles.axis}><Text style={styles.meta}>{fmtDate(t0)}</Text><Text style={styles.meta}>{fmtDate(t1)}</Text></View>
    </View>
  );
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  delta: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  up: { backgroundColor: ios.accentLight }, down: { backgroundColor: 'rgba(194,97,31,0.12)' },
  deltaText: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 12.5, color: ios.secondaryLabel },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  note: { fontSize: 14, color: ios.secondaryLabel, lineHeight: 20 },
  loading: { height: 120, alignItems: 'center', justifyContent: 'center' },
});
