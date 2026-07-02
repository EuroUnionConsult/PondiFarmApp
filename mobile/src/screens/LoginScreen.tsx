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

  // Entrance animation (presentation): fade + slide-up with iOS easing.
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
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    if (mode === 'register' && (!name.trim() || !org.trim())) {
      setError('Enter your name and organization.'); return;
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
      {/* Light theme background + soft brand blobs (the glass blurs them). */}
      <ScreenBackground />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={enterStyle}>
            <Text style={styles.brand}>PondiFarm</Text>
            <Text style={styles.tagline}>LiDAR cattle weight estimation</Text>

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
                      {m === 'login' ? 'Sign in' : 'Sign up'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {mode === 'register' && (
                <>
                  <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
                  <Field label="Organization" value={org} onChangeText={setOrg} placeholder="e.g. Limousine Farm" autoCapitalize="words" />
                </>
              )}
              <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="at least 8 characters" secureTextEntry autoCapitalize="none" />

              {error && <Text style={styles.error}>{error}</Text>}

              {/* Primary CTA = SOLID (never glass — glass tint is translucent = invisible). */}
              <TouchableOpacity
                style={[styles.button, busy && styles.buttonBusy]}
                onPress={submit}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.buttonText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
                )}
              </TouchableOpacity>
            </LiquidGlass>

            {__DEV__ && (
              <View style={styles.serverBox}>
                <Text style={styles.serverLabel}>Server (dev)</Text>
                <TextInput
                  style={styles.serverInput}
                  value={serverUrl}
                  onChangeText={saveServer}
                  placeholder="use app default"
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

  // Primary button — SOLID green, white text (contrast AA). Never glass.
  button: {
    backgroundColor: ios.accent, borderRadius: 12, marginTop: 14, minHeight: 52,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 15,
    shadowColor: ios.accent, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  buttonBusy: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },

  serverBox: { marginTop: 28, opacity: 0.9 },
  serverLabel: { fontSize: 11, fontWeight: '600', color: ios.tertiaryLabel, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, marginLeft: 2 },
  serverInput: {
    backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: ios.separator,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: ios.secondaryLabel,
  },
});
