import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import Text from './Text';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import { fetchScanHistory, type ScanHistoryData, type HistoryScan } from '../lib/api';
import { fmtScanDate, fmtScanTime, shrunk, weatherLine, weightDelta, weightMargin } from '../lib/scanHistory';

const cache = new Map<string, ScanHistoryData>();

/**
 * Último scan em destaque (peso ± margem, diferença para o anterior, tempo na hora)
 * e a lista dos scans anteriores. Tocar num scan antigo mostra-o só para leitura.
 */
export default function ScanHistory({ animalId, onScanAgain, name }: { animalId: string; name: string; onScanAgain?: () => void }) {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [data, setData] = useState<ScanHistoryData | null>(cache.get(animalId) ?? null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (cache.has(animalId)) return;
    let alive = true;
    fetchScanHistory(animalId)
      .then((d) => { cache.set(animalId, d); if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [animalId]);

  if (failed) return <Text style={s.note}>The scan history could not be loaded.</Text>;
  if (data === null) return <View style={s.loading}><ActivityIndicator color={c.accent} /></View>;
  const scans = data.scans.filter((x) => x.weightKg != null && x.weightKg > 0);
  if (!scans.length) return <Text style={s.note}>No scans with a weight yet.</Text>;

  const n = scans.length;
  const latest = scans[n - 1];
  const idx = openId ? scans.findIndex((x) => x.id === openId) : n - 1;
  const shown = scans[idx >= 0 ? idx : n - 1];
  const isOld = shown.id !== latest.id;
  const prev = scans[scans.indexOf(shown) - 1];
  const d = weightDelta(shown, prev);
  const w = data.weather[shown.id];
  const wl = weatherLine(w);
  const kg = Math.round(shown.weightKg as number);

  return (
    <View>
      {isOld && (
        <View style={s.banner} accessibilityRole="alert">
          <Text style={s.bannerText}>Previous scan · {scans.indexOf(shown) + 1} of {n} · not the current one</Text>
          <Pressable onPress={() => setOpenId(null)} hitSlop={8} accessibilityRole="button"><Text style={s.link}>Back to latest</Text></Pressable>
        </View>
      )}
      <Text style={s.meta}>{isOld ? 'Scan of' : 'Latest scan'} · {fmtScanDate(shown.at)}, {fmtScanTime(shown.at)}</Text>
      <View style={s.weightRow}>
        <Text style={s.weight}>≈ {kg} kg</Text>
        <Text style={s.margin}>± {weightMargin(kg)}</Text>
        <View style={s.exp}><Text style={s.expText}>Experimental</Text></View>
      </View>
      {d && (
        <View style={[s.chip, { backgroundColor: d.withinMargin ? c.segmentFill : d.kg >= 0 ? c.accentLight : c.orangeLight }]}>
          <Text style={[s.chipText, { color: d.withinMargin ? c.secondaryLabel : d.kg >= 0 ? c.accent : c.orange }]}>
            {d.kg >= 0 ? '+' : '−'}{Math.abs(d.kg)} kg vs previous scan{d.withinMargin ? ' · within margin' : ''}
          </Text>
        </View>
      )}
      {isOld && <Text style={s.meta}>Today: ≈ {Math.round(latest.weightKg as number)} kg ± {weightMargin(latest.weightKg as number)}</Text>}
      <Text style={s.wx}>
        {!data.hasLocation ? 'Set the farm location to see weather' : data.weatherFailed ? 'Weather unavailable right now' : wl ? `Weather at scan: ${wl}` : 'No weather data for this scan yet'}
      </Text>
      {shrunk(shown, prev) && <Text style={s.warn}>Check this scan. It may have been taken in a different pose.</Text>}
      {onScanAgain && !isOld && (
        <Pressable onPress={onScanAgain} style={s.btn} accessibilityRole="button">
          <Text style={s.btnText}>Scan {name} again</Text>
        </Pressable>
      )}
      {n > 1 && (
        <>
          <Text style={s.sub}>Previous scans</Text>
          {scans.slice(0, -1).reverse().map((x: HistoryScan) => {
            const line = weatherLine(data.weather[x.id]);
            const active = x.id === shown.id;
            return (
              <Pressable key={x.id} onPress={() => setOpenId(x.id)} style={[s.row, active && s.rowActive]} accessibilityRole="button"
                accessibilityLabel={`Scan of ${fmtScanDate(x.at)}, ${Math.round(x.weightKg as number)} kg`}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rowDate} numberOfLines={1}>{fmtScanDate(x.at)} · {fmtScanTime(x.at)}</Text>
                  {line && <Text style={s.rowWx} numberOfLines={1}>{line}</Text>}
                </View>
                <Text style={s.rowKg}>{Math.round(x.weightKg as number)} kg</Text>
              </Pressable>
            );
          })}
        </>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  note: { fontSize: 14, color: c.secondaryLabel, lineHeight: 20 },
  loading: { height: 120, alignItems: 'center', justifyContent: 'center' },
  meta: { fontSize: 12.5, color: c.secondaryLabel, marginTop: 2 },
  weightRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  weight: { fontSize: 30, fontWeight: '700', color: c.label },
  margin: { fontSize: 16, color: c.secondaryLabel },
  exp: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: c.orangeLight },
  expText: { fontSize: 11.5, fontWeight: '600', color: c.orangeText },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
  chipText: { fontSize: 13, fontWeight: '600' },
  wx: { fontSize: 13.5, color: c.label, marginTop: 10 },
  warn: { fontSize: 13, color: c.orange, marginTop: 8 },
  btn: { marginTop: 14, backgroundColor: c.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  sub: { fontSize: 13, fontWeight: '600', color: c.secondaryLabel, marginTop: 18, marginBottom: 4, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
  rowActive: { backgroundColor: c.accentLight },
  rowDate: { fontSize: 14, color: c.label },
  rowWx: { fontSize: 12.5, color: c.secondaryLabel, marginTop: 2 },
  rowKg: { fontSize: 15, fontWeight: '600', color: c.label },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, padding: 10, borderRadius: 10, backgroundColor: c.orangeLight, marginBottom: 10 },
  bannerText: { fontSize: 13, fontWeight: '600', color: c.label, flexShrink: 1 },
  link: { fontSize: 13, fontWeight: '600', color: c.accent },
});
