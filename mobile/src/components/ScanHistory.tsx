import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import Text from './Text';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import { fetchScanHistory, type ScanHistoryData, type HistoryScan, type ScanWx } from '../lib/api';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { fmtScanDate, fmtScanTime, growthSummary, measureDeltas, shrunk, weatherDiffers, weatherLine, weightDelta, weightMargin } from '../lib/scanHistory';

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
  const [more, setMore] = useState(false);
  const [cw, setCw] = useState(0);

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
          <Text style={[s.chipText, { color: d.withinMargin ? c.secondaryLabel : d.kg >= 0 ? c.accent : c.orangeText }]}>
            {d.kg >= 0 ? '+' : '−'}{Math.abs(d.kg)} kg vs previous scan{d.withinMargin ? ' · within margin' : ''}
          </Text>
        </View>
      )}
      {isOld && <Text style={s.meta}>Today: ≈ {Math.round(latest.weightKg as number)} kg ± {weightMargin(latest.weightKg as number)}</Text>}
      <Text style={s.wx}>
        {!data.hasLocation ? 'Set the farm location to see weather' : data.weatherFailed ? 'Weather unavailable right now' : wl ? `Weather at scan: ${wl}` : 'No weather data for this scan yet'}
      </Text>
      {isOld && data.hasLocation && !data.weatherFailed && (
        <View style={s.table}>
          <View style={s.tr}><Text style={[s.th, { flex: 1.3 }]}> </Text><Text style={s.th}>Then</Text><Text style={s.th}>Latest</Text></View>
          {([['Temperature', (x?: ScanWx) => (x?.tempC != null ? `${Math.round(x.tempC)} °C` : '—')],
            ['Humidity', (x?: ScanWx) => (x?.humidity != null ? `${Math.round(x.humidity)} %` : '—')],
            ['THI', (x?: ScanWx) => (x?.thi != null ? `${Math.round(x.thi)}${x.heatStress ? ' ⚠︎' : ''}` : '—')],
            ['Rain 24 h', (x?: ScanWx) => (x?.rain24hMm != null ? `${x.rain24hMm} mm` : '—')]] as [string, (x?: ScanWx) => string][]).map(([l, f]) => (
            <View key={l} style={s.tr}><Text style={[s.td, { flex: 1.3 }]}>{l}</Text><Text style={s.td}>{f(w)}</Text><Text style={s.td}>{f(data.weather[latest.id])}</Text></View>))}
          {weatherDiffers(w, data.weather[latest.id]) && <Text style={s.warn}>The weather was very different. Compare with care.</Text>}
        </View>
      )}
      <View style={s.table}>
        <View style={s.tr}><Text style={[s.th, { flex: 1.3 }]}>Measurements</Text><Text style={s.th}>{isOld ? 'Then' : 'Now'}</Text><Text style={s.th}>{isOld ? 'Latest' : 'Since previous'}</Text></View>
        {measureDeltas(shown, isOld ? latest : prev).map((m) => (
          <View key={m.label} style={s.tr}>
            <Text style={[s.td, { flex: 1.3 }]}>{m.label}</Text>
            <Text style={s.td}>{m.now != null ? `${Math.round(m.now)} cm` : '—'}</Text>
            <Text style={s.td}>{isOld ? (m.before != null ? `${Math.round(m.before)} cm` : '—') : m.diff != null ? `${m.diff >= 0 ? '+' : '−'}${Math.abs(m.diff)} cm` : '—'}</Text>
          </View>))}
      </View>
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
      {n > 1 && (() => {
        const H = 130, PX = 12, PY = 12, t0 = scans[0].at, t1 = latest.at;
        const ws = scans.map((x) => x.weightKg as number);
        const lo = Math.min(...ws) * 0.88, hi = Math.max(...ws) * 1.12;
        const x = (t: number) => PX + ((t - t0) / (t1 - t0 || 1)) * (cw - 2 * PX);
        const y = (v: number) => H - PY - ((v - lo) / (hi - lo || 1)) * (H - 2 * PY);
        const up = scans.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y((p.weightKg as number) * 1.1).toFixed(1)}`).join(' ');
        const dn = [...scans].reverse().map((p) => `L${x(p.at).toFixed(1)} ${y((p.weightKg as number) * 0.9).toFixed(1)}`).join(' ');
        const line = scans.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.weightKg as number).toFixed(1)}`).join(' ');
        const first = scans[0];
        return (
          <>
            <Text style={s.sub}>Growth</Text>
            <View onLayout={(e) => setCw(e.nativeEvent.layout.width)} style={{ height: H }}
              accessible accessibilityLabel={`Weight from ${Math.round(ws[0])} to ${Math.round(ws[n - 1])} kg over ${n} scans, shaded band is the ± 10 % margin`}>
              {cw > 0 && (
                <Svg width={cw} height={H}>
                  <Path d={`${up} ${dn} Z`} fill={c.accent} opacity={0.14} />
                  <Line x1={PX} x2={cw - PX} y1={H - 1} y2={H - 1} stroke={c.separator} />
                  <Path d={line} fill="none" stroke={c.accent} strokeWidth={2.5} strokeLinejoin="round" />
                  {scans.map((p) => <Circle key={p.id} cx={x(p.at)} cy={y(p.weightKg as number)} r={p.id === shown.id ? 5.5 : 3.5} fill={p.id === shown.id ? c.accent : c.secondarySystemGroupedBackground} stroke={c.accent} strokeWidth={2} />)}
                </Svg>)}
            </View>
            <View style={s.chips}>
              {scans.map((p) => {
                const t = data.weather[p.id]?.thi;
                const hot = data.weather[p.id]?.heatStress;
                return (
                  <View key={p.id} style={[s.thiChip, { backgroundColor: hot ? c.orangeLight : c.segmentFill }]}>
                    <Text style={[s.thiText, hot && { color: c.orangeText }]} numberOfLines={1}>{new Date(p.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · THI {t != null ? Math.round(t) : '—'}</Text>
                  </View>);
              })}
            </View>
            <Text style={s.meta}>Shaded band: ± 10 % weight margin. Chips: heat index (THI) at each scan; orange = heat stress.</Text>
            <Pressable onPress={() => setMore((v) => !v)} style={s.more} accessibilityRole="button" accessibilityState={{ expanded: more }}>
              <Text style={s.link}>{more ? 'Hide growth & weather' : 'Growth & weather'}</Text>
            </Pressable>
            {more && (
              <View>
                <Text style={s.summary}>{growthSummary(first, latest, n)}</Text>
                <View style={s.cards}>
                  {measureDeltas(latest, first).map((m) => (
                    <View key={m.label} style={s.dcard}>
                      <Text style={s.dlabel}>{m.label}</Text>
                      <Text style={s.dval}>{m.diff != null ? `${m.diff >= 0 ? '+' : '−'}${Math.abs(m.diff)} cm` : '—'}</Text>
                      <Text style={s.dnote}>reliable</Text>
                    </View>))}
                  {(() => { const wd = weightDelta(latest, first); return wd && (
                    <View style={s.dcard}>
                      <Text style={s.dlabel}>Weight</Text>
                      <Text style={s.dval}>{wd.kg >= 0 ? '+' : '−'}{Math.abs(wd.kg)} kg</Text>
                      <Text style={s.dnote}>{wd.withinMargin ? `within margin ± ${wd.margin}` : `margin ± ${wd.margin}`}</Text>
                    </View>); })()}
                </View>
                {data.hasLocation && data.intervals.length > 0 && (
                  <View style={s.table}>
                    <Text style={s.sub}>Between scans</Text>
                    <View style={s.tr}><Text style={[s.th, { flex: 1.4 }]}>Period</Text><Text style={s.th}>Avg max</Text><Text style={s.th}>Heat days</Text><Text style={s.th}>Rain</Text></View>
                    {data.intervals.map((iv) => {
                      const a = scans.find((p) => p.id === iv.fromScanId), b = scans.find((p) => p.id === iv.toScanId);
                      if (!a || !b) return null;
                      const dm = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                      return (
                        <View key={iv.fromScanId} style={s.tr}>
                          <Text style={[s.td, { flex: 1.4 }]}>{dm(a.at)}–{dm(b.at)}</Text>
                          <Text style={s.td}>{iv.avgMaxTempC != null ? `${Math.round(iv.avgMaxTempC)} °C` : '—'}</Text>
                          <Text style={s.td}>{iv.heatDays ?? '—'}</Text>
                          <Text style={s.td}>{iv.rainMm != null ? `${Math.round(iv.rainMm)} mm` : '—'}</Text>
                        </View>);
                    })}
                    <Text style={s.meta}>Heat days: days with THI 75 or more.</Text>
                  </View>
                )}
                <View style={s.sure}>
                  <Text style={s.sureTitle}>How sure is this?</Text>
                  <Text style={s.sureText}>Measurements are more stable than weight. Weight is an estimate of ± 10 % today; it is being calibrated with scale weights at farm visits.</Text>
                </View>
              </View>
            )}
          </>
        );
      })()}
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
  warn: { fontSize: 13, color: c.orangeText, marginTop: 8 },
  btn: { marginTop: 14, backgroundColor: c.accentFill, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
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
  table: { marginTop: 12 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
  th: { flex: 1, fontSize: 12, fontWeight: '600', color: c.secondaryLabel },
  td: { flex: 1, fontSize: 13, color: c.label },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  thiChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  thiText: { fontSize: 11.5, fontWeight: '600', color: c.secondaryLabel },
  more: { marginTop: 12, paddingVertical: 6 },
  summary: { fontSize: 14, color: c.label, lineHeight: 20, marginTop: 4 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  dcard: { flexBasis: '47%', flexGrow: 1, padding: 10, borderRadius: 10, backgroundColor: c.segmentFill },
  dlabel: { fontSize: 12, color: c.secondaryLabel },
  dval: { fontSize: 18, fontWeight: '700', color: c.label, marginTop: 2 },
  dnote: { fontSize: 11.5, color: c.secondaryLabel, marginTop: 2 },
  sure: { marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: c.accentLight },
  sureTitle: { fontSize: 14, fontWeight: '600', color: c.label },
  sureText: { fontSize: 13, color: c.label, marginTop: 4, lineHeight: 18 },
});
