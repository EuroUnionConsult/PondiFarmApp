import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useCloudBusy } from '../lib/activity';
import { useReducedMotion } from '../lib/motion';
import { useTheme } from '../lib/ThemeContext';

// Anel laranja à volta do avatar enquanto há trabalho com a nuvem (rebanho,
// sincronização, perfil). Meio círculo a rodar; com «Reduzir movimento»
// fica o anel inteiro a pulsar devagar, sem rotação.
const STROKE = 2.5;
const GAP = 3;

export default function SyncRing({ size, children }: { size: number; children: React.ReactNode }) {
  const { colors } = useTheme();
  const busy = useCloudBusy();
  const reduced = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: busy ? 1 : 0, duration: 180, useNativeDriver: true }).start();
    if (!busy) return;
    const loop = reduced
      ? Animated.loop(Animated.sequence([
          Animated.timing(spin, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(spin, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]))
      : Animated.loop(Animated.timing(spin, {
          toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true,
        }));
    spin.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [busy, reduced, spin, fade]);

  const ring = size + (GAP + STROKE) * 2;
  const motion = reduced
    ? { opacity: Animated.multiply(fade, spin.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] })) }
    : {
        opacity: fade,
        transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      };

  return (
    <View
      style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}
      accessibilityState={{ busy }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: ring / 2,
            borderWidth: STROKE,
            borderColor: reduced ? colors.orange : 'transparent',
            borderTopColor: colors.orange,
            borderRightColor: colors.orange,
          },
          motion,
        ]}
      />
      {children}
    </View>
  );
}
