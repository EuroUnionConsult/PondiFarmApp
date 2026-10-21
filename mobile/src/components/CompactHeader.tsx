import React, { useRef, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, type Palette } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

// Barra compacta ao estilo iOS: o título grande do ecrã sai com o scroll e esta
// barra (vidro + título pequeno + linha) aparece no topo. Tudo no thread nativo.
//
// Uso:
//   const { scrollY, onScroll } = useScrollY();
//   <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}>…
//   <CompactHeader title="Herd" scrollY={scrollY} />   (depois do ScrollView)

export function useScrollY() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
  });
  return { scrollY, onScroll };
}

export default function CompactHeader({
  title, scrollY, threshold = 44,
}: { title: string; scrollY: Animated.Value; threshold?: number }) {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const insets = useSafeAreaInsets();
  const opacity = scrollY.interpolate({
    inputRange: [threshold, threshold + 24],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const titleShift = scrollY.interpolate({
    inputRange: [threshold, threshold + 24],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.bar, { paddingTop: insets.top, height: insets.top + 44, opacity }]}
    >
      <BlurView intensity={60} tint={ios.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      <Animated.Text
        style={[styles.title, { transform: [{ translateY: titleShift }] }]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Animated.Text>
      <View style={styles.hairline} />
    </Animated.View>
  );
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  tint: { backgroundColor: ios.isDark ? 'rgba(11,22,34,0.62)' : 'rgba(242,242,247,0.55)' },
  title: { fontFamily: fonts.bold, fontSize: 17, color: ios.label },
  hairline: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: ios.separator,
  },
});
