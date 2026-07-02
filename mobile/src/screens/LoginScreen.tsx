import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ios } from '../lib/theme';
import { useAuth } from '../lib/AuthContext';
import { getDevServerUrl, setDevServerUrl } from '../lib/api';
import LiquidGlass from '../components/LiquidGlass';
import ScreenBackground from '../components/ScreenBackground';

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

  // Animação de entrada (apresentação): fade + slide-up com easing iOS.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);
  const enterStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }],
  };

  useEffect(() => {
    if (!__DEV__) return;
    (async () => { setServerUrl(await getDevServerUrl()); })();
  }, []);

  const saveServer = async (url: string) => {
    setServerUrl(url);
    await setDevServerUrl(url);
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
    <View style={styles.flex}>
      {/* Fundo claro do tema + blobs de marca suaves (o vidro os desfoca) */}
      <ScreenBackground />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={enterStyle}>
            <Text style={styles.brand}>PondiFarm</Text>
            <Text style={styles.tagline}>Estimativa de peso bovino por LiDAR</Text>

            <LiquidGlass tone="light" radius={24} style={styles.glassCard}>
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

              <LiquidGlass
                tone="light"
                radius={12}
                fillColor="rgba(47,158,68,0.92)"
                interactive
                style={[styles.buttonGlass, busy && { opacity: 0.6 }]}
              >
                <TouchableOpacity style={styles.button} onPress={submit} disabled={busy} activeOpacity={0.85}>
                  {busy ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.buttonText}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
                  )}
                </TouchableOpacity>
              </LiquidGlass>
            </LiquidGlass>

            {__DEV__ && (
              <View style={styles.serverBox}>
                <Text style={styles.serverLabel}>Servidor (dev)</Text>
                <TextInput
                  style={styles.serverInput}
                  value={serverUrl}
                  onChangeText={saveServer}
                  placeholder="usar padrão do app"
                  placeholderTextColor={ios.quaternaryLabel}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...input } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={ios.quaternaryLabel} {...input} />
    </View>
  );
}

const displayFont = Platform.select({ ios: 'System', android: undefined, default: undefined });

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: ios.systemGroupedBackground },
  content: { paddingHorizontal: 24 },

  brand: { fontFamily: displayFont, fontSize: 42, fontWeight: '800', color: ios.navy, letterSpacing: -1.2, textAlign: 'center' },
  tagline: { fontSize: 14, color: ios.tertiaryLabel, textAlign: 'center', marginTop: 6, marginBottom: 28 },

  glassCard: { padding: 20 },

  segment: {
    flexDirection: 'row', backgroundColor: 'rgba(120,120,128,0.16)', borderRadius: 12, padding: 3, marginBottom: 18,
  },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  segText: { fontSize: 15, fontWeight: '600', color: 'rgba(60,60,67,0.6)' },
  segTextActive: { color: ios.label },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: ios.secondaryLabel, marginBottom: 6, marginLeft: 2 },
  input: {
    backgroundColor: 'rgba(120,120,128,0.12)', borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(60,60,67,0.18)',
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: ios.label,
  },
  error: { color: '#DC2626', fontSize: 13.5, marginTop: 2, marginBottom: 4, textAlign: 'center' },
  buttonGlass: { marginTop: 14, minHeight: 52 },
  button: {
    flex: 1, paddingVertical: 15, minHeight: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },

  serverBox: { marginTop: 28, opacity: 0.9 },
  serverLabel: { fontSize: 11, fontWeight: '600', color: ios.tertiaryLabel, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, marginLeft: 2 },
  serverInput: {
    backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: ios.separator,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: ios.secondaryLabel,
  },
});
