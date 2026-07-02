import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
  TextInput, TouchableOpacity, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ios } from '../lib/theme';
import { clearAll } from '../lib/storage';
import { useAuth } from '../lib/AuthContext';
import {
  checkHealth, isCloudSyncEnabled, setCloudSyncEnabled,
  getDevServerUrl, setDevServerUrl,
} from '../lib/api';
import { APP_VERSION } from '../lib/version';
import { CFG_KEY, LEGACY_CFG_KEY } from '../lib/config';

interface Config {
  defaultBreed: 'default' | 'minhota' | 'alentejana';
  vibration: boolean;
}

const DEFAULT: Config = {
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
  const [cloudSync, setCloudSync] = useState(true);
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [devUrl, setDevUrl] = useState('');

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(CFG_KEY)
        ?? await AsyncStorage.getItem(LEGACY_CFG_KEY);
      if (raw) setCfg({ ...DEFAULT, ...JSON.parse(raw) });
      setCloudSync(await isCloudSyncEnabled());
      if (__DEV__) setDevUrl(await getDevServerUrl());
    })();
  }, []);

  // Conecta sozinho: com o sync ligado, verifica a ligação ao abrir a tela.
  const refreshStatus = useCallback(async (enabled: boolean) => {
    if (!enabled) { setStatus('offline'); return; }
    setStatus('checking');
    setStatus((await checkHealth()) ? 'online' : 'offline');
  }, []);

  useEffect(() => { refreshStatus(cloudSync); }, [cloudSync, refreshStatus]);

  const save = async (next: Partial<Config>) => {
    const updated = { ...cfg, ...next };
    setCfg(updated);
    await AsyncStorage.setItem(CFG_KEY, JSON.stringify(updated));
  };

  const toggleCloudSync = async (v: boolean) => {
    setCloudSync(v);
    await setCloudSyncEnabled(v);
    refreshStatus(v);
  };

  const saveDevUrl = async (v: string) => {
    setDevUrl(v);
    await setDevServerUrl(v);
    if (cloudSync) refreshStatus(true);
  };

  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign out',
      user ? `Sign out of ${user.email}?` : 'Sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => { logout(); } },
      ],
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

  const statusColor =
    !cloudSync ? ios.secondaryLabel :
    status === 'online' ? ios.accent :
    status === 'offline' ? ios.systemRed : ios.secondaryLabel;
  const statusLabel =
    !cloudSync ? 'Off' :
    status === 'checking' ? 'Connecting…' :
    status === 'online' ? 'Connected' : 'No connection';
  const statusIcon: keyof typeof Ionicons.glyphMap =
    !cloudSync ? 'cloud-offline-outline' :
    status === 'online' ? 'checkmark-circle' :
    status === 'offline' ? 'cloud-offline-outline' : 'ellipse-outline';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
    >
      <View style={[styles.largeTitle, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* CLOUD ============================================================ */}
      <Text style={styles.sectionHeader}>Cloud</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowLabel}>Cloud sync</Text>
            <Text style={styles.rowSubLabel}>
              Sync scans automatically when online
            </Text>
          </View>
          <Switch
            value={cloudSync}
            onValueChange={toggleCloudSync}
            trackColor={{ true: ios.accent, false: '#E5E5EA' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E5E5EA"
          />
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Status</Text>
          <View style={styles.rowAccessoryGroup}>
            {cloudSync && status === 'checking'
              ? <ActivityIndicator size="small" color={ios.secondaryLabel} />
              : <Ionicons name={statusIcon} size={17} color={statusColor} />}
            <Text style={[styles.rowValue, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.sectionFooter}>
        With sync on, your data is stored in your account and available on other devices.
        Off, the app works with local scans only.
      </Text>

      {__DEV__ && (
        <>
          <Text style={styles.sectionHeader}>Server (dev)</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>URL</Text>
              <TextInput
                style={styles.rowInput}
                value={devUrl}
                onChangeText={saveDevUrl}
                placeholder="use app default"
                placeholderTextColor={ios.tertiaryLabel}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          </View>
          <Text style={styles.sectionFooter}>
            Development build only. Empty = app default URL. Hidden from end users.
          </Text>
        </>
      )}

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

      {/* ACCOUNT ========================================================= */}
      <Text style={styles.sectionHeader}>Account</Text>
      <View style={styles.card}>
        {user && (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Signed in</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{user.email}</Text>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Organization</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{user.organizationName}</Text>
            </View>
            <View style={styles.rowDivider} />
          </>
        )}
        <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.6}>
          <Text style={[styles.rowLabel, { color: '#DC2626' }]}>Sign out</Text>
        </TouchableOpacity>
      </View>

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
