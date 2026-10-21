import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../lib/ThemeContext';
import { useReducedMotion } from '../lib/motion';

// Interruptor de tema sol/lua (canto superior direito do Perfil). Claro: bola à
// esquerda, sol à direita. Escuro: bola desliza para a direita, lua à esquerda.
const W = 60, H = 32, KNOB = 26, PAD = 3;

export default function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const dark = mode === 'dark';
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(dark ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) { x.setValue(dark ? 1 : 0); return; }
    Animated.spring(x, { toValue: dark ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 7 }).start();
  }, [dark, reduced, x]);

  const knobX = x.interpolate({ inputRange: [0, 1], outputRange: [0, W - KNOB - PAD * 2] });
  const sunOpacity = x.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' });
  const moonOpacity = x.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <Pressable
      onPress={() => { void Haptics.selectionAsync(); toggle(); }}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: dark }}
      accessibilityLabel="Dark theme"
      style={[styles.track, { backgroundColor: dark ? '#2A3846' : 'rgba(118,118,128,0.22)' }]}
    >
      <Animated.View style={[styles.icon, styles.right, { opacity: sunOpacity }]}>
        <Ionicons name="sunny" size={16} color="#C2611F" />
      </Animated.View>
      <Animated.View style={[styles.icon, styles.left, { opacity: moonOpacity }]}>
        <Ionicons name="moon" size={15} color="#9DBCE0" />
      </Animated.View>
      <Animated.View style={[styles.knob, { transform: [{ translateX: knobX }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: W, height: H, borderRadius: H / 2, padding: PAD, justifyContent: 'center' },
  knob: {
    width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  icon: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  right: { right: 10 },
  left: { left: 10 },
});
