import React, { useEffect, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import type { Connection } from '../lib/AuthContext';
import { suppressWakeNotice } from '../lib/serverWake';
import PondiLoader from './PondiLoader';
import Text from './Text';

// Ecrã de arranque enquanto a conta é lida (iPhone e web). Nunca mostra o painel com
// dados velhos: ou espera aqui («Connecting to the server…», a base serverless pode
// demorar até um minuto a acordar), ou, ao fim de ~2 min, diz que não chega ao
// servidor e oferece «Retry». No iPhone há ainda «Continue offline» (scans no campo).
export default function BootScreen({ connection, onRetry, onOffline, quiet }: {
  connection: Connection;
  onRetry: () => void;
  onOffline?: () => void;
  /** Ainda sem sessão (a ler o armazenamento): só o símbolo, sem texto. */
  quiet?: boolean;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const failed = connection === 'failed';
  useEffect(() => suppressWakeNotice(), []);
  if (quiet && !failed) {
    return <View style={s.wrap}><PondiLoader size="lg" /></View>;
  }
  return (
    <View style={s.wrap}>
      <View style={s.box} accessibilityLiveRegion="polite">
        {failed ? null : <PondiLoader size="lg" label="Connecting to the server" />}
        <Text style={s.title} accessibilityRole="header">
          {failed ? 'Can’t reach the server' : 'Connecting to the server…'}
        </Text>
        <Text style={s.text}>
          {failed
            ? 'The server did not answer for two minutes. Check your connection and try again.'
            : 'This can take up to a minute after a quiet period.'}
        </Text>
        {failed && (
          <Pressable onPress={onRetry} style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <Text style={s.btnText}>Retry</Text>
          </Pressable>
        )}
        {onOffline && (
          <Pressable onPress={onOffline} style={s.link} accessibilityRole="button" accessibilityHint="Opens the app without the server. Scans stay on this phone until they sync.">
            <Text style={s.linkText}>Continue offline</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24,
    backgroundColor: Platform.OS === 'web' ? ('var(--ground)' as any) : c.systemGroupedBackground,
  },
  box: { alignItems: 'center', gap: 12, maxWidth: 360, width: '100%' },
  title: { fontSize: 19, fontWeight: '700', color: c.label, textAlign: 'center', marginTop: 8 },
  text: { fontSize: 15, lineHeight: 21, color: c.secondaryLabel, textAlign: 'center' },
  btn: {
    marginTop: 8, minHeight: 48, minWidth: 160, paddingHorizontal: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentFill,
  },
  btnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  link: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  linkText: { fontSize: 15, fontWeight: '600', color: c.accent },
});
