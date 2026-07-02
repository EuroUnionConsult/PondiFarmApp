import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Easing,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ios } from '../lib/theme';
import { useAuth } from '../lib/AuthContext';
import { getDevServerUrl, setDevServerUrl } from '../lib/api';
import LiquidGlass from '../components/LiquidGlass';

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
      {/* Fundo: gradiente navy da marca + blobs de cor que o vidro desfoca (efeito líquido) */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor="#16294D" />
            <Stop offset="1" stopColor="#0B1730" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" />
      </Svg>
      <View style={[styles.blob, styles.blobGreen]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobOrange]} pointerEvents="none" />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>PondiFarm</Text>
          <Text style={styles.tagline}>Estimativa de peso bovino por LiDAR</Text>

          <LiquidGlass tone="dark" radius={24} style={styles.glassCard}>
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
              tone="dark"
              radius={12}
              fillColor="rgba(47,158,68,0.9)"
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
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}
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
      <TextInput style={styles.input} placeholderTextColor="rgba(255,255,255,0.4)" {...input} />
    </View>
  );
}

const displayFont = Platform.select({ ios: 'System', android: undefined, default: undefined });

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0B1730' },
  content: { paddingHorizontal: 24 },

  // Blobs de cor por trás do vidro (o BlurView os desfoca → profundidade líquida)
  blob: { position: 'absolute', width: 260, height: 260, borderRadius: 130, opacity: 0.5 },
  blobGreen: { top: 40, right: -80, backgroundColor: 'rgba(47,158,68,0.55)' },
  blobOrange: { bottom: 60, left: -90, backgroundColor: 'rgba(232,115,31,0.45)' },

  brand: { fontFamily: displayFont, fontSize: 42, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1.2, textAlign: 'center' },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 6, marginBottom: 28 },

  glassCard: { padding: 20 },

  segment: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 12, padding: 3, marginBottom: 18,
  },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segItemActive: { backgroundColor: 'rgba(255,255,255,0.92)' },
  segText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  segTextActive: { color: ios.label },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginBottom: 6, marginLeft: 2 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#FFFFFF',
  },
  error: { color: '#FFB4A9', fontSize: 13.5, marginTop: 2, marginBottom: 4, textAlign: 'center' },
  buttonGlass: { marginTop: 14, minHeight: 52 },
  button: {
    flex: 1, paddingVertical: 15, minHeight: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },

  serverBox: { marginTop: 28, opacity: 0.8 },
  serverLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, marginLeft: 2 },
  serverInput: {
    backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: 'rgba(255,255,255,0.8)',
  },
});
