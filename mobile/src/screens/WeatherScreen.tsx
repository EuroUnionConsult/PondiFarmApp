import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Text from '../components/Text';
import WeatherIcon from '../components/WeatherIcon';
import ScreenBackground from '../components/ScreenBackground';
import FadeInView from '../components/FadeInView';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import { BAND_LABEL, KIND_LABEL, useWeather, type Weather, type WeatherAlert } from '../lib/weather';
import type { RootStackParamList } from '../navigation/types';

/**
 * Tempo e bem-estar da quinta: avisos primeiro (stress térmico, chuva, noite fria,
 * vento), o tempo agora, o índice THI, as próximas 24 h, 7 dias e o resumo da
 * estação. Os números vêm do servidor (ECMWF, Copernicus CAMS e ERA5).
 */
export default function WeatherScreen() {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { weather, loading, error, refresh, markSeen } = useWeather();
  const [chartW, setChartW] = useState(0);

  // Ver a página conta como ler os avisos: o ponto laranja apaga.
  useEffect(() => { if (weather?.alerts?.length) markSeen(); }, [weather, markSeen]);

  const w = weather;
  const cur = w?.current;
  return (
    <View style={styles.flex}>
      <ScreenBackground />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.back} onPress={() => nav.goBack()} activeOpacity={0.6} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={ios.accent} />
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={loading && !!w} onRefresh={refresh} tintColor={ios.accent} />}
      >
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Weather</Text>
          {w?.location && (
            <Text style={styles.sub}>
              {w.location.label ?? 'Farm'} · {w.replay ? `replay of a real day (${w.replay}), ERA5 / Copernicus` : `ECMWF forecast${w.updatedAt ? `, updated ${hhmm(w.updatedAt)}` : ''}`}
            </Text>
          )}
          {error && w && <Text style={styles.stale}>Showing the last forecast saved. {error}</Text>}
        </View>

        {!w && (loading ? <ActivityIndicator style={{ marginTop: 40 }} color={ios.accent} /> : <Text style={styles.empty}>{error ?? 'No forecast yet.'}</Text>)}

        {w && !w.location && (
          <View style={[styles.card, styles.noLoc]}>
            <Ionicons name="location-outline" size={28} color={ios.accent} />
            <Text style={styles.noLocTitle}>Where is the farm?</Text>
            <Text style={styles.noLocText}>
              {w.canSetLocation
                ? 'Mark the farm once and everyone in the organization sees its forecast and welfare alerts.'
                : 'Ask the leader of your organization to mark the farm location in the Profile.'}
            </Text>
            {w.canSetLocation && (
              <TouchableOpacity style={styles.primary} onPress={() => nav.navigate('FarmLocation')} activeOpacity={0.8}>
                <Text style={styles.primaryText}>Set the farm location</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {w?.location && cur && (
          <>
            <FadeInView index={0}><Alerts w={w} styles={styles} ios={ios} /></FadeInView>

            <FadeInView index={1}>
              <View style={[styles.card, styles.pad]}>
                <Text style={styles.eyebrow}>Now</Text>
                <View style={styles.nowRow}>
                  <Text style={styles.big}>{Math.round(cur.temp)}°</Text>
                  <Text style={styles.unit}>C</Text>
                  <View style={{ marginLeft: 12 }}><WeatherIcon kind={cur.kind} size={58} /></View>
                </View>
                <Text style={styles.cond}>{KIND_LABEL[cur.kind]} · feels like {Math.round(cur.feelsLike)}°</Text>
                <View style={styles.facts}>
                  <Fact k="Humidity" v={`${cur.rh}%`} styles={styles} />
                  <Fact k="Wind" v={`${Math.round(cur.wind)} km/h`} styles={styles} />
                  {cur.uv != null && <Fact k="UV" v={`${cur.uv}`} styles={styles} />}
                  {cur.aqi != null && <Fact k="Air" v={`${cur.aqi} AQI`} styles={styles} />}
                </View>
              </View>
            </FadeInView>

            <FadeInView index={2}>
              <View style={[styles.card, styles.pad]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.eyebrow}>Heat stress (THI)</Text>
                  {w.thiPeak != null && <Text style={[styles.peak, bandStyle(styles, band(w.thiPeak))]}>today’s peak {Math.round(w.thiPeak)}</Text>}
                </View>
                <Text style={[styles.big, { fontSize: 44, marginTop: 6 }]}>{Math.round(cur.thi)}</Text>
                <Text style={[styles.peak, bandStyle(styles, cur.thiBand), { alignSelf: 'flex-start' }]}>{BAND_LABEL[cur.thiBand]}</Text>
                <ThiScale value={cur.thi} ios={ios} />
                <Text style={styles.small}>Temperature and humidity together: what the animals feel. Above 75 beef cattle start to struggle; above 79 it is dangerous.</Text>
              </View>
            </FadeInView>

            <Text style={styles.section}>Next 24 hours</Text>
            <View style={[styles.card, styles.pad]} onLayout={(e) => setChartW(e.nativeEvent.layout.width - 32)}>
              <View style={styles.legend}>
                <Legend color={ios.accent} label="Temperature" styles={styles} />
                <Legend color="#2563A8" label="Rain (mm)" styles={styles} />
                <Legend color="#C2611F" label="Heat stress" styles={styles} />
              </View>
              {chartW > 0 && <Chart w={w} width={chartW} ios={ios} />}
            </View>

            {!!w.days?.length && <>
              <Text style={styles.section}>Next 7 days</Text>
              <View style={styles.card}>
                {w.days.map((d, i) => (
                  <View key={d.date} style={[styles.dayRow, i > 0 && styles.divider]}>
                    <Text style={styles.dayName}>{i === 0 ? 'Today' : new Date(`${d.date}T12:00`).toLocaleDateString('en-GB', { weekday: 'short' })}</Text>
                    <WeatherIcon kind={d.kind} size={30} />
                    <Text style={styles.dayTemps}>{Math.round(d.max)}° <Text style={styles.dayMin}>{Math.round(d.min)}°</Text></Text>
                    <Text style={styles.dayPop}>{d.pop ? `${d.pop}% rain` : ''}</Text>
                  </View>
                ))}
              </View>
            </>}

            {w.season && <>
              <Text style={styles.section}>This season on the farm</Text>
              <View style={[styles.card, styles.pad]}>
                <Text style={styles.eyebrow}>Since {fmtDay(w.season.from)}</Text>
                <View style={styles.seasonRow}>
                  <View><Text style={[styles.seasonNum, { color: ios.orangeText }]}>{w.season.alertDays}</Text><Text style={styles.small}>days with heat-stress alert</Text></View>
                  <View><Text style={[styles.seasonNum, { color: ios.danger }]}>{w.season.dangerDays}</Text><Text style={styles.small}>days in danger</Text></View>
                </View>
                <Text style={styles.small}>Heat is the main welfare risk here in summer. On those days the app warns the team with the hours to avoid.</Text>
              </View>
            </>}

            {w.canSetLocation && (
              <TouchableOpacity onPress={() => nav.navigate('FarmLocation')} style={styles.changeLoc} activeOpacity={0.6}>
                <Ionicons name="location-outline" size={16} color={ios.accent} />
                <Text style={styles.changeLocText}>Change the farm location</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.sources}>
              Forecast: ECMWF IFS (European model) via Open-Meteo. UV and air quality: Copernicus Atmosphere Monitoring Service (CAMS). Season: ERA5, Copernicus Climate Change Service. Heat-stress bands: Livestock Weather Safety Index for beef cattle.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const band = (x: number) => (x >= 84 ? 'emergency' : x >= 79 ? 'danger' : x >= 75 ? 'alert' : 'normal') as 'normal' | 'alert' | 'danger' | 'emergency';
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function bandStyle(styles: any, b: string) {
  return b === 'normal' ? styles.bNormal : b === 'alert' ? styles.bAlert : b === 'danger' ? styles.bDanger : styles.bEmergency;
}

const ALERT_ICON: Record<WeatherAlert['kind'], React.ComponentProps<typeof Ionicons>['name']> = {
  heat: 'thermometer-outline', rain: 'rainy-outline', cold: 'snow-outline', wind: 'flag-outline',
};

function Alerts({ w, styles, ios }: { w: Weather; styles: any; ios: Palette }) {
  const list = w.alerts ?? [];
  if (!list.length) {
    return (
      <View style={[styles.card, styles.alertRow]}>
        <View style={[styles.alertIcon, { backgroundColor: ios.accentLight }]}><Ionicons name="checkmark" size={20} color={ios.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.alertTitle}>No welfare alerts for the next 24 hours</Text>
          <Text style={styles.alertText}>Comfortable for the herd: THI stays below 75 and no rain or cold night is expected.</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      {list.map((a, i) => {
        const red = a.kind === 'heat' && a.severity === 'danger';
        return (
          <View key={a.id} style={[styles.alertRow, i > 0 && styles.divider]}>
            <View style={[styles.alertIcon, { backgroundColor: red ? ios.dangerLight : a.kind === 'heat' ? ios.orangeLight : 'rgba(37,99,168,0.12)' }]}>
              <Ionicons name={ALERT_ICON[a.kind]} size={20} color={red ? ios.danger : a.kind === 'heat' ? ios.orangeText : '#2563A8'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{a.title}</Text>
              <Text style={styles.alertText}>{a.text}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Fact({ k, v, styles }: { k: string; v: string; styles: any }) {
  return <Text style={styles.fact}>{k} <Text style={styles.factV}>{v}</Text></Text>;
}
function Legend({ color, label, styles }: { color: string; label: string; styles: any }) {
  return <View style={styles.legendItem}><View style={[styles.legendSw, { backgroundColor: color }]} /><Text style={styles.small}>{label}</Text></View>;
}

function ThiScale({ value, ios }: { value: number; ios: Palette }) {
  const pos = Math.max(0, Math.min(1, (value - 60) / 30));
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: 'row', height: 8, borderRadius: 6, overflow: 'hidden' }}>
        <View style={{ flex: 1, backgroundColor: ios.accent, opacity: 0.55 }} />
        <View style={{ flex: 0.55, backgroundColor: '#C2611F', opacity: 0.6 }} />
        <View style={{ flex: 0.7, backgroundColor: ios.danger, opacity: 0.65 }} />
        <View style={{ flex: 0.8, backgroundColor: ios.danger }} />
      </View>
      <View style={{ position: 'absolute', top: -4, left: `${pos * 100}%`, width: 3, height: 16, borderRadius: 2, backgroundColor: ios.label, marginLeft: -1.5 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {['Normal', '75 Alert', '79 Danger', '84'].map((t) => <Text key={t} style={{ fontSize: 11, color: ios.secondaryLabel }}>{t}</Text>)}
      </View>
    </View>
  );
}

function Chart({ w, width, ios }: { w: Weather; width: number; ios: Palette }) {
  const h = w.hours!, n = h.time.length, H = 180, P = { l: 28, r: 6, t: 14, b: 22 };
  const cw = width - P.l - P.r, ch = H - P.t - P.b;
  const tmin = Math.floor(Math.min(...h.temp) - 2), tmax = Math.ceil(Math.max(...h.temp) + 2);
  const x = (i: number) => P.l + (i / Math.max(1, n - 1)) * cw;
  const y = (t: number) => P.t + ch - ((t - tmin) / Math.max(1, tmax - tmin)) * ch;
  const rmax = Math.max(1, ...h.rain.map((r) => r || 0));
  const path = h.temp.map((t, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(t).toFixed(1)}`).join(' ');
  const step = cw / Math.max(1, n - 1);
  return (
    <Svg width={width} height={H}>
      {h.thi.map((v, i) => v >= 75 && (
        <Rect key={`t${i}`} x={x(i) - step / 2} y={P.t} width={step} height={ch} fill={v >= 79 ? ios.dangerLight : ios.orangeLight} />
      ))}
      {[0, 1, 2, 3].map((k) => {
        const t = tmin + ((tmax - tmin) * k) / 3, yy = y(t);
        return (
          <React.Fragment key={k}>
            <Line x1={P.l} x2={P.l + cw} y1={yy} y2={yy} stroke={ios.separator} strokeDasharray="3 4" />
            <SvgText x={P.l - 6} y={yy + 4} fontSize={10} textAnchor="end" fill={ios.secondaryLabel}>{Math.round(t)}°</SvgText>
          </React.Fragment>
        );
      })}
      {h.rain.map((r, i) => r > 0 && (
        <Rect key={`r${i}`} x={x(i) - 4} y={P.t + ch - (r / rmax) * ch * 0.45} width={8} height={(r / rmax) * ch * 0.45} rx={3} fill="#2563A8" opacity={0.55} />
      ))}
      <Path d={`${path} L${x(n - 1)},${P.t + ch} L${x(0)},${P.t + ch} Z`} fill={ios.accent} opacity={0.08} />
      <Path d={path} fill="none" stroke={ios.accent} strokeWidth={2.4} strokeLinejoin="round" />
      <Circle cx={x(0)} cy={y(h.temp[0])} r={4.5} fill={ios.secondarySystemGroupedBackground} stroke={ios.accent} strokeWidth={2.4} />
      {[0, 6, 12, 18, n - 1].filter((i) => i < n).map((i) => (
        <SvgText key={`h${i}`} x={x(i)} y={H - 6} fontSize={10} textAnchor="middle" fill={ios.secondaryLabel}>{i === 0 ? 'now' : h.time[i].slice(11, 16)}</SvgText>
      ))}
    </Svg>
  );
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: ios.systemGroupedBackground },
  header: { paddingHorizontal: 12, paddingBottom: 4 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { fontSize: 17, color: ios.accent },
  titleWrap: { paddingHorizontal: 20, paddingBottom: 10 },
  title: { fontSize: 34, fontWeight: '800', color: ios.label, letterSpacing: -0.6 },
  sub: { fontSize: 14, color: ios.secondaryLabel, marginTop: 4, lineHeight: 19 },
  stale: { fontSize: 12.5, color: ios.orangeText, marginTop: 6 },
  empty: { textAlign: 'center', marginTop: 40, color: ios.secondaryLabel },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, backgroundColor: ios.secondarySystemGroupedBackground, overflow: 'hidden' },
  pad: { padding: 16 },
  noLoc: { padding: 22, alignItems: 'center', gap: 8 },
  noLocTitle: { fontSize: 18, fontWeight: '700', color: ios.label },
  noLocText: { fontSize: 14, color: ios.secondaryLabel, textAlign: 'center', lineHeight: 20 },
  primary: { marginTop: 8, backgroundColor: ios.accentFill, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  eyebrow: { fontSize: 13, fontWeight: '700', color: ios.accent },
  nowRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  big: { fontSize: 52, fontWeight: '800', color: ios.label, letterSpacing: -2 },
  unit: { fontSize: 22, color: ios.secondaryLabel, fontWeight: '600', marginLeft: 4, alignSelf: 'flex-start', marginTop: 10 },
  cond: { fontSize: 15, color: ios.secondaryLabel },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  fact: { fontSize: 13, color: ios.secondaryLabel },
  factV: { color: ios.label, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  peak: { fontSize: 12.5, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, overflow: 'hidden' },
  bNormal: { backgroundColor: ios.accentLight, color: ios.accent },
  bAlert: { backgroundColor: ios.orangeLight, color: ios.orangeText },
  bDanger: { backgroundColor: ios.dangerLight, color: ios.danger },
  bEmergency: { backgroundColor: ios.danger, color: '#FFFFFF' },
  small: { fontSize: 12.5, color: ios.secondaryLabel, lineHeight: 18, marginTop: 10 },
  section: { paddingHorizontal: 32, paddingTop: 14, paddingBottom: 8, fontSize: 13, color: ios.secondaryLabel, textTransform: 'uppercase', letterSpacing: 0.3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSw: { width: 10, height: 10, borderRadius: 3, marginTop: 10 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  dayName: { width: 52, fontSize: 15, color: ios.label, fontWeight: '600' },
  dayTemps: { fontSize: 16, fontWeight: '700', color: ios.label },
  dayMin: { fontSize: 14, color: ios.secondaryLabel, fontWeight: '400' },
  dayPop: { marginLeft: 'auto', fontSize: 13, color: '#2563A8' },
  seasonRow: { flexDirection: 'row', gap: 28, marginTop: 8 },
  seasonNum: { fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  alertRow: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  alertIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 15.5, fontWeight: '700', color: ios.label, marginBottom: 2 },
  alertText: { fontSize: 13.5, color: ios.secondaryLabel, lineHeight: 19 },
  changeLoc: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 10, marginTop: 4 },
  changeLocText: { color: ios.accent, fontSize: 15 },
  sources: { fontSize: 11.5, color: ios.tertiaryLabel, paddingHorizontal: 24, lineHeight: 17, marginTop: 6 },
});
