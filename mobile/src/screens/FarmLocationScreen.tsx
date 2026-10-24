import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Text from '../components/Text';
import FarmMap from '../components/FarmMap';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import { useAuth } from '../lib/AuthContext';
import { reversePlace, saveFarmLocation, searchPlaces, useWeather, type Place } from '../lib/weather';

/**
 * Onde fica a quinta (só o Líder). Três formas no mesmo ecrã: o GPS do telemóvel,
 * pesquisar por nome ou código postal, e ajustar o pino no mapa. Guarda-se
 * arredondado a ~1 km; todos os membros passam a ver a previsão desta quinta.
 */
const PORTUGAL = { lat: 39.5, lon: -8.0 };

export default function FarmLocationScreen() {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { user } = useAuth();
  const { weather, refresh } = useWeather();
  const start = weather?.location ?? null;
  const [pin, setPin] = useState(start ? { lat: start.lat, lon: start.lon } : PORTUGAL);
  const [label, setLabel] = useState<string | null>(start?.label ?? null);
  const [touched, setTouched] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pesquisa enquanto escreve (com pausa, para não pedir a cada letra).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) { setResults([]); return; }
    timer.current = setTimeout(() => {
      setSearching(true);
      searchPlaces(q).then(setResults).catch(() => setResults([])).finally(() => setSearching(false));
    }, 450);
  }, [q]);

  const movePin = (lat: number, lon: number, knownLabel?: string | null) => {
    setPin({ lat, lon }); setTouched(true); setErr(null);
    if (knownLabel) { setLabel(knownLabel); return; }
    setLabel(null);
    reversePlace(lat, lon).then((p) => setLabel(p.label)).catch(() => {});
  };

  const useMine = async () => {
    setLocating(true); setErr(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setErr('Location permission was not given. Search or move the pin instead.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      void Haptics.selectionAsync();
      movePin(pos.coords.latitude, pos.coords.longitude);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally { setLocating(false); }
  };

  const save = async () => {
    if (!user?.organizationId) return;
    setSaving(true); setErr(null);
    try {
      await saveFarmLocation(user.organizationId, { lat: pin.lat, lon: pin.lon, label });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
      nav.goBack();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.back} onPress={() => nav.goBack()} activeOpacity={0.6}>
          <Ionicons name="chevron-back" size={26} color={ios.accent} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Farm location</Text>
          <Text style={styles.sub}>Mark the farm once. Everyone in the organization sees its forecast and welfare alerts.</Text>
        </View>

        <TouchableOpacity style={styles.gps} onPress={useMine} disabled={locating} activeOpacity={0.8} accessibilityRole="button">
          {locating ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="navigate" size={18} color="#FFFFFF" />}
          <Text style={styles.gpsText}>Use my location</Text>
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={ios.secondaryLabel} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search a place or postcode, e.g. 6000-458"
            placeholderTextColor={ios.tertiaryLabel}
            style={styles.input}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching && <ActivityIndicator size="small" color={ios.accent} />}
        </View>
        {results.length > 0 && (
          <View style={styles.card}>
            {results.map((r, i) => (
              <TouchableOpacity key={`${r.lat},${r.lon},${i}`} style={[styles.result, i > 0 && styles.divider]}
                onPress={() => { movePin(r.lat, r.lon, r.label); setResults([]); setQ(''); }} activeOpacity={0.6}>
                <Ionicons name="location-outline" size={18} color={ios.accent} />
                <Text style={styles.resultText} numberOfLines={2}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.mapWrap}>
          <FarmMap lat={pin.lat} lon={pin.lon} onChange={(a, b) => movePin(a, b)} />
          <Text style={styles.hint}>Drag the pin or tap the map to adjust it, for example to the middle of the pasture.</Text>
        </View>

        <View style={[styles.card, styles.chosen]}>
          <Ionicons name="pin" size={20} color={ios.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.chosenTitle}>{label ?? (touched || start ? 'Finding the place name…' : 'No location yet')}</Text>
            <Text style={styles.chosenSub}>{pin.lat.toFixed(2)}, {pin.lon.toFixed(2)} · saved rounded to about 1 km</Text>
          </View>
        </View>
        {err && <Text style={styles.err}>{err}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={[styles.save, !(touched || start) && { opacity: 0.5 }]} disabled={saving || !(touched || start)} onPress={save} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save farm location</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: ios.systemGroupedBackground },
  header: { paddingHorizontal: 12, paddingBottom: 4 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { fontSize: 17, color: ios.accent },
  titleWrap: { paddingHorizontal: 20, paddingBottom: 14 },
  title: { fontSize: 34, fontWeight: '800', color: ios.label, letterSpacing: -0.6 },
  sub: { fontSize: 14.5, color: ios.secondaryLabel, marginTop: 4, lineHeight: 20 },
  gps: { marginHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: ios.accentFill, borderRadius: 14, height: 50 },
  gpsText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  searchBox: { marginHorizontal: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ios.secondarySystemGroupedBackground, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, fontSize: 16, color: ios.label, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null) },
  card: { marginHorizontal: 16, marginTop: 10, borderRadius: 14, backgroundColor: ios.secondarySystemGroupedBackground, overflow: 'hidden' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  resultText: { flex: 1, fontSize: 15, color: ios.label },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  mapWrap: { marginHorizontal: 16, marginTop: 14 },
  hint: { fontSize: 12.5, color: ios.secondaryLabel, marginTop: 8, lineHeight: 18 },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  chosenTitle: { fontSize: 16, fontWeight: '700', color: ios.label },
  chosenSub: { fontSize: 12.5, color: ios.secondaryLabel, marginTop: 2 },
  err: { color: ios.danger, fontSize: 14, marginHorizontal: 20, marginTop: 10 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: ios.systemGroupedBackground },
  save: { backgroundColor: ios.accentFill, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
