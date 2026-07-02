import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ios } from '../lib/theme';
import { useAuth } from '../lib/AuthContext';

const CFG_KEY = '@pondifarm:config';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CFG_KEY);
        if (raw) setServerUrl(JSON.parse(raw).backendUrl ?? '');
      } catch {}
    })();
  }, []);

  const saveServer = async (url: string) => {
    setServerUrl(url);
    try {
      const raw = await AsyncStorage.getItem(CFG_KEY);
      const cfg = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(CFG_KEY, JSON.stringify({ ...cfg, backendUrl: url.trim() }));
    } catch {}
  };

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) { setError('Preencha email e senha.'); return; }
    if (mode === 'register' && (!name.trim() || !org.trim())) {
      setError('Preencha nome e organização.'); return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password, org);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>PondiFarm</Text>
        <Text style={styles.tagline}>Estimativa de peso bovino por LiDAR</Text>

        <View style={styles.segment}>
          {(['login', 'register'] as const).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.segItem, mode === m && styles.segItemActive]}
              onPress={() => { setMode(m); setError(null); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.segText, mode === m && styles.segTextActive]}>
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'register' && (
          <>
            <Field label="Nome" value={name} onChangeText={setName} placeholder="Teu nome" autoCapitalize="words" />
            <Field label="Organização" value={org} onChangeText={setOrg} placeholder="Ex.: Quinta Limousine" autoCapitalize="words" />
          </>
        )}
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="email@exemplo.pt" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Field label="Senha" value={password} onChangeText={setPassword} placeholder="mínimo 8 caracteres" secureTextEntry autoCapitalize="none" />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={[styles.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.buttonText}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.serverBox}>
          <Text style={styles.serverLabel}>Servidor</Text>
          <TextInput
            style={styles.serverInput}
            value={serverUrl}
            onChangeText={saveServer}
            placeholder="https://…"
            placeholderTextColor={ios.tertiaryLabel}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...input } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={ios.tertiaryLabel} {...input} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: ios.systemGroupedBackground },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24 },
  brand: { fontSize: 40, fontWeight: '800', color: ios.label, letterSpacing: -1, textAlign: 'center' },
  tagline: { fontSize: 14, color: ios.secondaryLabel, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  segment: {
    flexDirection: 'row', backgroundColor: '#E8E8EC', borderRadius: 10, padding: 3, marginBottom: 20,
  },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segItemActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  segText: { fontSize: 15, fontWeight: '600', color: ios.secondaryLabel },
  segTextActive: { color: ios.label },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: ios.secondaryLabel, marginBottom: 6, marginLeft: 2 },
  input: {
    backgroundColor: ios.secondarySystemGroupedBackground, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: ios.label,
  },
  error: { color: '#D70015', fontSize: 13.5, marginTop: 4, marginBottom: 4, textAlign: 'center' },
  button: {
    backgroundColor: ios.accent, borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center', marginTop: 12, minHeight: 52,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  serverBox: { marginTop: 28, opacity: 0.75 },
  serverLabel: { fontSize: 11, fontWeight: '600', color: ios.tertiaryLabel, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, marginLeft: 2 },
  serverInput: {
    backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: ios.separator,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: ios.secondaryLabel,
  },
});
