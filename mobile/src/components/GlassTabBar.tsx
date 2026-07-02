import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ios, font } from '../lib/theme';
import LiquidGlass from './LiquidGlass';

// Tab bar FLUTUANTE (pill Liquid Glass, estilo iOS 26) com REALCE ANIMADO que desliza
// para a aba ativa (Animated.spring, nativo). Labels em inglês.
const TABS: Record<string, { active: string; inactive: string; label: string }> = {
  Home:      { active: 'home',      inactive: 'home-outline',      label: 'Home' },
  Herd:      { active: 'paw',       inactive: 'paw-outline',       label: 'Herd' },
  Analytics: { active: 'bar-chart', inactive: 'bar-chart-outline', label: 'Analytics' },
  Settings:  { active: 'settings',  inactive: 'settings-outline',  label: 'Settings' },
};

export default function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom > 0 ? insets.bottom : 12;
  const [width, setWidth] = useState(0);
  const tabW = width > 0 ? width / state.routes.length : 0;
  const indicatorX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tabW <= 0) return;
    // Desliza o realce até a aba ativa — mola suave (iOS-like).
    Animated.spring(indicatorX, {
      toValue: state.index * tabW,
      useNativeDriver: true,
      stiffness: 240, damping: 26, mass: 0.7,
    }).start();
  }, [state.index, tabW, indicatorX]);

  return (
    <View style={[styles.wrap, { bottom }]}>
      <LiquidGlass tone="light" radius={32} style={StyleSheet.absoluteFill} />
      <View style={styles.row} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {tabW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, { width: tabW - 12, transform: [{ translateX: indicatorX }] }]}
          />
        )}
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const t = TABS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline', label: route.name };
          const color = focused ? ios.accentDark : 'rgba(60,60,67,0.6)';
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
          };
          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t.label}
            >
              <Ionicons name={(focused ? t.active : t.inactive) as any} size={23} color={color} />
              <Text style={[styles.label, { color }]} numberOfLines={1}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 16, right: 16,
    height: 64, borderRadius: 32,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  indicator: {
    position: 'absolute', left: 6, top: 8, bottom: 8,
    borderRadius: 22, backgroundColor: ios.accentLight,
  },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 1 },
  label: { fontSize: font.xs, fontWeight: '600', marginTop: 2 },
});
