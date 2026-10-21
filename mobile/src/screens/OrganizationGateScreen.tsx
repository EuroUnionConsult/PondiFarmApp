import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';
import Text from '../components/Text';
import Wordmark from '../components/Wordmark';
import ScreenBackground from '../components/ScreenBackground';
import { fonts, type Palette } from '../lib/theme';
import { useAuth } from '../lib/AuthContext';
import {
  MIN_SEARCH_CHARS, cancelMyRequest, createOrganization, requestToJoin, searchOrganizations,
  type OrgSearchResult,
} from '../lib/orgs';

// Conta com sessão iniciada mas sem organização ativa: escolhe entrar numa que
// já existe (pesquisa + pedido ao Líder) ou criar uma nova (fica Líder). Com o
// pedido feito, mostra a espera até o Líder aprovar. Nada sincroniza aqui.

const POLL_MS = 30_000;

export default function OrganizationGateScreen() {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const insets = useSafeAreaInsets();
  const { user, refreshMe, logout } = useAuth();
  const pending = user?.membershipStatus === 'pending';

  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrgSearchResult[] | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pesquisa com pequena pausa enquanto se escreve.
  useEffect(() => {
    if (pending || mode !== 'join') return;
    const q = query.trim();
    if (q.length < MIN_SEARCH_CHARS) { setResults(null); return; }
    const t = setTimeout(() => {
      searchOrganizations(q).then(setResults).catch(e => setError(String(e?.message ?? e)));
    }, 350);
    return () => clearTimeout(t);
  }, [query, mode, pending]);

  // À espera: confirma de vez em quando se o Líder já aprovou.
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => { void refreshMe(); }, POLL_MS);
    return () => clearInterval(id);
  }, [pending, refreshMe]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await refreshMe();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, [refreshMe]);

  const askToJoin = (org: OrgSearchResult) => {
    Alert.alert(
      'Ask to join?',
      `The leader of ${org.name} has to approve you before you can see or sync its data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send request', onPress: () => run(() => requestToJoin(org.id)) },
      ],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Wordmark size={30} />
          <Text style={styles.hello}>Hi {user?.name?.split(' ')[0] ?? 'there'}.</Text>

          {pending ? (
            <View style={styles.card}>
              <View style={styles.waitIcon}>
                <Ionicons name="hourglass-outline" size={26} color={ios.navy} />
              </View>
              <Text style={styles.cardTitle}>Waiting for approval</Text>
              <Text style={styles.cardText}>
                You asked to join <Text style={styles.strong}>{user?.pendingOrganizationName}</Text>.
                As soon as its leader approves, the app opens with the organization’s herd.
              </Text>
              <TouchableOpacity style={styles.primary} onPress={() => run(async () => {})} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Check again</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={() => run(cancelMyRequest)} disabled={busy} activeOpacity={0.6}>
                <Text style={styles.secondaryText}>Cancel request</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.lead}>To start, join your organization or create a new one.</Text>
              <View style={styles.segment}>
                {(['join', 'create'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.segItem, mode === m && styles.segItemActive]}
                    onPress={() => { setMode(m); setError(null); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: mode === m }}
                  >
                    <Text style={[styles.segText, mode === m && styles.segTextActive]}>
                      {m === 'join' ? 'Join existing' : 'Create new'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {mode === 'join' ? (
                <View style={styles.card}>
                  <Text style={styles.label} nativeID="orgSearch">Organization name</Text>
                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={18} color={ios.tertiaryLabel} />
                    <TextInput
                      style={styles.searchInput}
                      value={query}
                      onChangeText={setQuery}
                      placeholder={`Type at least ${MIN_SEARCH_CHARS} letters, e.g. Euro`}
                      placeholderTextColor={ios.tertiaryLabel}
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabelledBy="orgSearch"
                    />
                  </View>
                  {results !== null && results.length === 0 && (
                    <Text style={styles.empty}>No organization found with that name.</Text>
                  )}
                  {results?.map(org => (
                    <TouchableOpacity
                      key={org.id}
                      style={styles.resultRow}
                      onPress={() => askToJoin(org)}
                      disabled={busy}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Ask to join ${org.name}`}
                    >
                      <View style={styles.orgBadge}>
                        <Ionicons name="business-outline" size={18} color={ios.navy} />
                      </View>
                      <Text style={styles.resultName} numberOfLines={1}>{org.name}</Text>
                      <Text style={styles.resultAction}>Ask to join</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.label} nativeID="orgName">New organization name</Text>
                  <TextInput
                    style={styles.input}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="e.g. Quinta do Vale"
                    placeholderTextColor={ios.tertiaryLabel}
                    autoCapitalize="words"
                    accessibilityLabelledBy="orgName"
                  />
                  <Text style={styles.cardText}>You become its leader: you approve who joins and manage members.</Text>
                  <TouchableOpacity
                    style={[styles.primary, !newName.trim() && styles.primaryDisabled]}
                    disabled={!newName.trim() || busy}
                    onPress={() => run(() => createOrganization(newName))}
                    activeOpacity={0.85}
                  >
                    {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Create organization</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}

          <TouchableOpacity style={styles.signOut} onPress={logout} activeOpacity={0.6}>
            <Text style={styles.signOutText}>Sign out ({user?.email})</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },
  hello: { fontSize: 22, fontWeight: '700', color: ios.label, marginTop: 8 },
  lead: { fontSize: 16, color: ios.secondaryLabel, lineHeight: 22 },
  card: {
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 18, padding: 18, gap: 12,
  },
  waitIcon: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: ios.navyLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: ios.label },
  cardText: { fontSize: 15, color: ios.secondaryLabel, lineHeight: 21 },
  strong: { fontWeight: '700', color: ios.label },
  segment: {
    flexDirection: 'row', backgroundColor: ios.segmentFill,
    borderRadius: 10, padding: 2,
  },
  segItem: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segItemActive: { backgroundColor: ios.surface },
  segText: { fontSize: 15, color: ios.secondaryLabel },
  segTextActive: { color: ios.label, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700', color: ios.secondaryLabel },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: ios.systemGroupedBackground, borderRadius: 12, paddingHorizontal: 12, height: 48,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 17, color: ios.label },
  input: {
    fontFamily: fonts.regular, backgroundColor: ios.systemGroupedBackground,
    borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 17, color: ios.label,
  },
  empty: { fontSize: 14, color: ios.secondaryLabel },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  orgBadge: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: ios.navyLight,
    alignItems: 'center', justifyContent: 'center',
  },
  resultName: { flex: 1, fontSize: 17, color: ios.label },
  resultAction: { fontSize: 15, fontWeight: '700', color: ios.accent },
  primary: {
    backgroundColor: ios.accentFill, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  secondary: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: ios.accent, fontSize: 16 },
  error: { color: ios.danger, fontSize: 14, textAlign: 'center' },
  signOut: { alignItems: 'center', paddingVertical: 12 },
  signOutText: { color: ios.secondaryLabel, fontSize: 14 },
});
