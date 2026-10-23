import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

// Bloco cinzento que pulsa enquanto o conteúdo carrega (a forma do que vem a seguir).
export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors: ios } = useTheme();
  const a = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0.45, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[{ backgroundColor: ios.segmentFill, borderRadius: 8, opacity: a }, style]} />;
}

/** Linhas de lista a carregar: ícone, duas linhas de texto e o valor à direita. */
export function SkeletonRows({ n = 4 }: { n?: number }) {
  const { colors: ios } = useTheme();
  return (
    <View accessibilityLabel="Loading" accessible>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[styles.row, i < n - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ios.separator }]}>
          <SkeletonBlock style={styles.icon} />
          <View style={{ flex: 1, gap: 7 }}>
            <SkeletonBlock style={{ height: 13, width: `${55 - (i % 3) * 10}%` }} />
            <SkeletonBlock style={{ height: 11, width: `${35 + (i % 2) * 10}%` }} />
          </View>
          <SkeletonBlock style={styles.value} />
        </View>))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  icon: { width: 32, height: 32, borderRadius: 9 },
  value: { width: 46, height: 18 },
});
