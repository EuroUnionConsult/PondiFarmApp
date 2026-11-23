import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';
import { type Palette } from '../lib/theme';
import { useServerWaking } from '../lib/serverWake';
import Text from './Text';

// Aviso calmo no topo enquanto o servidor acorda (ver lib/serverWake.ts). Não
// bloqueia nada: os toques passam através dele e some quando o pedido termina.
export default function ServerWakeNotice() {
  const waking = useServerWaking();
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (waking) setMounted(true);
    const anim = Animated.timing(opacity, { toValue: waking ? 1 : 0, duration: 220, useNativeDriver: true });
    anim.start(({ finished }) => { if (finished && !waking) setMounted(false); });
    return () => anim.stop();
  }, [waking, opacity]);

  if (!mounted) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Animated.View
        style={[styles.pill, { opacity }]}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        accessibilityLabel="Connecting to the server. This can take up to a minute after a quiet period."
      >
        <ActivityIndicator size="small" color={ios.accent} />
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <Text style={styles.title}>Connecting to the server…</Text>
          <Text style={styles.text}>This can take up to a minute after a quiet period.</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    maxWidth: 440, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderWidth: StyleSheet.hairlineWidth, borderColor: ios.separator,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  title: { fontSize: 14, fontWeight: '700', color: ios.label },
  text: { fontSize: 13, lineHeight: 17, color: ios.secondaryLabel },
});
