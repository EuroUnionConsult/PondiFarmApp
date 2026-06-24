import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
  TextInput, TouchableOpacity, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ios } from '../lib/theme';
import { clearAll } from '../lib/storage';
import { checkHealth } from '../lib/api';
import { APP_VERSION } from '../lib/version';

const CFG_KEY = '@pondifarm:config';
const LEGACY_CFG_KEY = '@boviscan:config';

interface Config {
  backendUrl: string;
  defaultBreed: 'default' | 'minhota' | 'alentejana';
  vibration: boolean;
}

const DEFAULT: Config = {
  backendUrl: 'http://localhost:8000',
  defaultBreed: 'default',
  vibration: true,
};

const BREEDS: { key: Config['defaultBreed']; label: string }[] = [
  { key: 'default',    label: 'Padrão' },
  { key: 'minhota',    label: 'Minhota' },
  { key: 'alentejana', label: 'Alentejana' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [cfg, setCfg] = useState<Config>(DEFAULT);
  const [ping, setPing] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(CFG_KEY)
        ?? await AsyncStorage.getItem(LEGACY_CFG_KEY);
      if (raw) setCfg({ ...DEFAULT, ...JSON.parse(raw) });
    })();
  }, []);

  const save = async (next: Partial<Config>) => {
    const updated = { ...cfg, ...next };
    setCfg(updated);
    await AsyncStorage.setItem(CFG_KEY, JSON.stringify(updated));
  };

  const testConnection = async () => {
    setTesting(true);
    setPing(null);
    const ok = await checkHealth(cfg.backendUrl);
    setPing(ok);
    setTesting(false);
    Alert.alert(
      ok ? 'Connected' : 'No connection',
      ok ? 'Backend API responded successfully.'
         : 'Make sure the server is running and the URL is correct.',
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear all scans',
      'This will permanently delete all locally saved scans. Confirm?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: async () => {
          await clearAll();
          Alert.alert('Done', 'Local scans removed.');
        } },
      ]
    );
  };

  const pingColor =
    ping === null ? ios.secondaryLabel :
    ping ? ios.accent : ios.systemRed;
  const pingIcon: keyof typeof Ionicons.glyphMap =
    ping === null ? 'pulse-outline' :
    ping ? 'checkmark-circle' : 'close-circle';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <View style={[styles.largeTitle, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* API ============================================================== */}
      <Text style={styles.sectionHeader}>API</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>URL</Text>
          <TextInput
            style={styles.rowInput}
            value={cfg.backendUrl}
            onChangeText={v => save({ backendUrl: v })}
            placeholder="http://192.168.x.x:8000"
            placeholderTextColor={ios.tertiaryLabel}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
        <View style={styles.rowDivider} />
        <TouchableOpacity
          style={styles.row}
          onPress={testConnection}
          disabled={testing}
          activeOpacity={0.6}
        >
          <Text style={[styles.rowLabel, { color: ios.accent }]}>
            {testing ? 'Testing…' : 'Test connection'}
          </Text>
          <View style={styles.rowAccessoryGroup}>
            <Ionicons name={pingIcon} size={17} color={pingColor} />
          </View>
        </TouchableOpacity>
      </View>
      <Text style={styles.sectionFooter}>
        Use the local network IP or a tunnel URL. The API runs on port 8000 by default.
      </Text>

      {/* SCAN ============================================================= */}
      <Text style={styles.sectionHeader}>Scan</Text>
      <View style={styles.card}>
        <View style={[styles.row, { paddingBottom: 4 }]}>
          <Text style={styles.rowLabel}>Default breed</Text>
        </View>
        <View style={styles.segmented}>
          {BREEDS.map(b => {
            const active = cfg.defaultBreed === b.key;
            return (
              <TouchableOpacity
                key={b.key}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => save({ defaultBreed: b.key })}
                activeOpacity={0.7}
              >
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                  {b.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowLabel}>Haptic feedback</Text>
            <Text style={styles.rowSubLabel}>Vibrate the device when a scan is captured</Text>
          </View>
          <Switch
            value={cfg.vibration}
            onValueChange={v => save({ vibration: v })}
            trackColor={{ true: ios.accent, false: '#E5E5EA' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E5E5EA"
          />
        </View>
      </View>

      {/* ABOUT ============================================================ */}
      <Text style={styles.sectionHeader}>About</Text>
      <View style={styles.card}>
        {[
          { k: 'Application', v: 'PondiFarm Mobile' },
          { k: 'Version',     v: APP_VERSION },
          { k: 'AI engine',   v: 'PCA morphometrics — ML pending' },
          { k: 'Protocol',    v: 'LiDAR (ARKit scene reconstruction)' },
        ].map(({ k, v }, i, arr) => (
          <View key={k}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{k}</Text>
              <Text style={styles.rowValue}>{v}</Text>
            </View>
            {i < arr.length - 1 && <View style={styles.rowDivider} />}
          </View>
        ))}
      </View>
      <Text style={styles.sectionFooter}>
        PondiFarm — Euro Union Consult, Lda. Phase 0 demo build.
      </Text>

      {/* DESTRUCTIVE ====================================================== */}
      <View style={styles.destructiveSpacer} />
      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={handleClearData} activeOpacity={0.6}>
          <Text style={[styles.rowLabel, { color: ios.systemRed }]}>Clear all scans</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sectionFooter}>
        This deletes locally saved scans. It does not affect data on the backend.
      </Text>
    </ScrollView>
  );
}

const displayFont = Platform.select({ ios: 'System', android: undefined, default: undefined });

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: ios.systemGroupedBackground },

  largeTitle: { paddingHorizontal: 20, paddingBottom: 8 },
  title: {
    fontFamily: displayFont,
    fontSize: 34, fontWeight: '700',
    letterSpacing: -0.95, color: ios.label, lineHeight: 36,
  },

  // Section chrome
  sectionHeader: {
    marginTop: 32, marginBottom: 8,
    paddingHorizontal: 32,
    fontSize: 13, fontWeight: '400',
    color: ios.secondaryLabel,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionFooter: {
    marginTop: 8,
    paddingHorizontal: 32,
    fontSize: 13, lineHeight: 18,
    color: ios.secondaryLabel,
    letterSpacing: -0.05,
  },

  // Card (insetGrouped)
  card: {
    marginHorizontal: 16,
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Row
  row: {
    minHeight: 44,
    paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  rowDivider: {
    marginLeft: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: ios.separator,
  },
  rowMain: { flex: 1 },
  rowLabel: {
    flex: 1,
    fontSize: 17, color: ios.label,
    letterSpacing: -0.3,
  },
  rowSubLabel: {
    fontSize: 13, color: ios.secondaryLabel,
    marginTop: 2, letterSpacing: -0.05,
  },
  rowValue: {
    fontSize: 17, color: ios.secondaryLabel,
    letterSpacing: -0.3,
  },
  rowChevron: {
    fontSize: 20, color: ios.tertiaryLabel,
  },
  rowAccessoryGroup: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  rowInput: {
    flex: 1,
    fontSize: 17, color: ios.secondaryLabel,
    letterSpacing: -0.3,
    textAlign: 'right',
    padding: 0,
  },

  // Segmented (breed picker)
  segmented: {
    flexDirection: 'row',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#EFEFF4',
    borderRadius: 9,
    padding: 2, gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentLabel: {
    fontSize: 13, color: ios.label, letterSpacing: -0.05,
  },
  segmentLabelActive: {
    fontWeight: '600',
  },

  destructiveSpacer: { height: 24 },
});
